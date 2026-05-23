import { Server as SocketIOServer, Socket, Namespace } from 'socket.io';
import { verifySocketTicket } from '../utils/jwt';
import { chatService } from '../services/chat.service';
import { logger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

interface JoinChatPayload {
  chatId: string;
}

interface SendMessagePayload {
  chatId: string;
  message?: string; // Para mensagens não criptografadas
  encryptedContent?: string; // Criptografado para o DESTINATÁRIO
  encryptedForSender?: string; // Criptografado para o REMETENTE (E2E correto)
  isEncrypted?: boolean; // Flag de criptografia
  iv?: string; // IV para encryptedContent (destinatário)
  ivForSender?: string; // IV para encryptedForSender (remetente)
  attachments?: string[]; // Retrocompatibilidade
  attachmentUrl?: string; // URL do anexo (novo formato)
  attachmentType?: string; // Tipo MIME do anexo
}

interface TypingPayload {
  chatId: string;
  isTyping: boolean;
}

export class ChatSocketServer {
  private namespace: Namespace;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(io: SocketIOServer) {
    // Usar namespace /chat para separar do namespace de notificações
    this.namespace = io.of('/chat');

    this.setupMiddleware();
    this.setupConnectionHandler();

    logger.info('[SOCKET] Chat namespace initialized on /chat');
  }

  /**
   * Middleware de autenticação
   */
  private setupMiddleware() {
    this.namespace.use(async (socket: AuthenticatedSocket, next) => {
      try {
        // Support both auth.token (legacy) and HttpOnly cookie
        let token = socket.handshake.auth.token;

        if (!token) {
          const cookieHeader = socket.handshake.headers.cookie || '';
          const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
          token = match ? decodeURIComponent(match[1]) : null;
        }

        if (!token) {
          throw new Error('Authentication token required');
        }

        // SECURITY (SER-13): verifica audience mktplace:socket — token HTTP é rejeitado
        const decoded = verifySocketTicket(token);

        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;

        logger.info('[SOCKET] User authenticated', {
          userId: decoded.userId,
          socketId: socket.id,
        });

        next();
      } catch (error: any) {
        logger.error('[SOCKET] Authentication failed', { error: error.message });
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Handler de conexão
   */
  private setupConnectionHandler() {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('[SOCKET] Client connected', {
        userId: socket.userId,
        socketId: socket.id,
      });

      // Registrar usuário conectado
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);

        // Notificar outros usuários que este usuário está online
        socket.broadcast.emit('user:online', { userId: socket.userId });
      }

      // Entrar em uma sala de chat
      socket.on('chat:join', async (payload: JoinChatPayload) => {
        try {
          const { chatId } = payload;

          // Verificar se usuário tem permissão
          const chat = await chatService.getChatById(chatId, socket.userId!);

          // Entrar na sala
          socket.join(`chat:${chatId}`);

          logger.info('[SOCKET] User joined chat', {
            userId: socket.userId,
            chatId,
          });

          // Notificar que entrou
          socket.to(`chat:${chatId}`).emit('user:joined', {
            userId: socket.userId,
            userName: socket.userEmail,
          });

          // Marcar mensagens como lidas
          await chatService.markAsRead(chatId, socket.userId!);

          // Confirmar entrada
          socket.emit('chat:joined', { chatId });
        } catch (error: any) {
          logger.error('[SOCKET] Failed to join chat', { error: error.message });
          socket.emit('error', { message: error.message });
        }
      });

      // Enviar mensagem
      socket.on('message:send', async (payload: SendMessagePayload) => {
        try {
          const { chatId, message, encryptedContent, encryptedForSender, isEncrypted, iv, ivForSender, attachments, attachmentUrl, attachmentType } = payload;

          // Enviar mensagem via serviço (suporta formato híbrido com E2E para ambos)
          const newMessage = await chatService.sendMessage({
            chatId,
            senderId: socket.userId!,
            message,
            encryptedContent,
            encryptedForSender,
            isEncrypted,
            iv,
            ivForSender,
            attachments,
            attachmentUrl,
            attachmentType,
          });

          // Emitir para todos na sala (incluindo sender)
          this.namespace.to(`chat:${chatId}`).emit('message:new', newMessage);

          logger.info('[SOCKET] Message sent', {
            messageId: newMessage.id,
            chatId,
            senderId: socket.userId,
            encrypted: isEncrypted || false,
          });
        } catch (error: any) {
          logger.error('[SOCKET] Failed to send message', { error: error.message });
          socket.emit('error', { message: error.message });
        }
      });

      // Indicador de digitação
      socket.on('typing:start', (payload: TypingPayload) => {
        const { chatId } = payload;
        socket.to(`chat:${chatId}`).emit('user:typing', {
          userId: socket.userId,
          isTyping: true,
        });
      });

      socket.on('typing:stop', (payload: TypingPayload) => {
        const { chatId } = payload;
        socket.to(`chat:${chatId}`).emit('user:typing', {
          userId: socket.userId,
          isTyping: false,
        });
      });

      // Marcar mensagens como lidas
      socket.on('messages:read', async (payload: JoinChatPayload) => {
        try {
          const { chatId } = payload;
          await chatService.markAsRead(chatId, socket.userId!);

          // Notificar o outro usuário
          socket.to(`chat:${chatId}`).emit('messages:read', {
            userId: socket.userId,
            chatId,
          });

          logger.info('[SOCKET] Messages marked as read', {
            userId: socket.userId,
            chatId,
          });
        } catch (error: any) {
          logger.error('[SOCKET] Failed to mark as read', { error: error.message });
        }
      });

      // Sair de uma sala
      socket.on('chat:leave', (payload: JoinChatPayload) => {
        const { chatId } = payload;
        socket.leave(`chat:${chatId}`);

        socket.to(`chat:${chatId}`).emit('user:left', {
          userId: socket.userId,
        });

        logger.info('[SOCKET] User left chat', {
          userId: socket.userId,
          chatId,
        });
      });

      // Desconexão
      socket.on('disconnect', () => {
        logger.info('[SOCKET] Client disconnected', {
          userId: socket.userId,
          socketId: socket.id,
        });

        // Remover usuário da lista de conectados
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);

          // Notificar outros usuários que este usuário está offline
          socket.broadcast.emit('user:offline', { userId: socket.userId });
        }
      });
    });
  }

  /**
   * Enviar mensagem para usuário específico (usado por serviços)
   */
  public sendToUser(userId: string, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.namespace.to(socketId).emit(event, data);
      logger.info('[SOCKET] Sent event to user', { userId, event });
    }
  }

  /**
   * Enviar mensagem para sala de chat (usado por serviços)
   */
  public sendToChat(chatId: string, event: string, data: any) {
    this.namespace.to(`chat:${chatId}`).emit(event, data);
    logger.info('[SOCKET] Sent event to chat', { chatId, event });
  }

  /**
   * Verificar se usuário está online
   */
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Obter quantidade de usuários conectados
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Obter instância do namespace (para uso externo se necessário)
   */
  public getNamespace(): Namespace {
    return this.namespace;
  }
}

// Singleton
let chatSocketServer: ChatSocketServer | null = null;

export function initializeChatSocket(io: SocketIOServer): ChatSocketServer {
  if (!chatSocketServer) {
    chatSocketServer = new ChatSocketServer(io);
  }
  return chatSocketServer;
}

export function getChatSocket(): ChatSocketServer {
  if (!chatSocketServer) {
    throw new Error('Chat socket not initialized');
  }
  return chatSocketServer;
}
