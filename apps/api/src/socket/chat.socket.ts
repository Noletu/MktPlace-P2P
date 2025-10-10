import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
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
  message: string;
  attachments?: string[];
}

interface TypingPayload {
  chatId: string;
  isTyping: boolean;
}

export class ChatSocketServer {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin:
          process.env.NODE_ENV === 'production'
            ? process.env.ALLOWED_ORIGINS?.split(',')
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true,
      },
      path: '/socket.io/',
    });

    this.setupMiddleware();
    this.setupConnectionHandler();

    logger.info('[SOCKET] Chat socket server initialized');
  }

  /**
   * Middleware de autenticação
   */
  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          throw new Error('Authentication token required');
        }

        // Verificar token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          userId: string;
          email: string;
        };

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
    this.io.on('connection', (socket: AuthenticatedSocket) => {
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
          const { chatId, message, attachments } = payload;

          // Enviar mensagem via serviço
          const newMessage = await chatService.sendMessage({
            chatId,
            senderId: socket.userId!,
            message,
            attachments,
          });

          // Emitir para todos na sala (incluindo sender)
          this.io.to(`chat:${chatId}`).emit('message:new', newMessage);

          logger.info('[SOCKET] Message sent', {
            messageId: newMessage.id,
            chatId,
            senderId: socket.userId,
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
      this.io.to(socketId).emit(event, data);
      logger.info('[SOCKET] Sent event to user', { userId, event });
    }
  }

  /**
   * Enviar mensagem para sala de chat (usado por serviços)
   */
  public sendToChat(chatId: string, event: string, data: any) {
    this.io.to(`chat:${chatId}`).emit(event, data);
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
   * Obter instância do Socket.IO (para uso externo se necessário)
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}

// Singleton
let chatSocketServer: ChatSocketServer | null = null;

export function initializeChatSocket(httpServer: HTTPServer): ChatSocketServer {
  if (!chatSocketServer) {
    chatSocketServer = new ChatSocketServer(httpServer);
  }
  return chatSocketServer;
}

export function getChatSocket(): ChatSocketServer {
  if (!chatSocketServer) {
    throw new Error('Chat socket not initialized');
  }
  return chatSocketServer;
}
