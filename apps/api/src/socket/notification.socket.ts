import { Server as SocketIOServer, Socket, Namespace } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

interface NotificationEvent {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCountEvent {
  unreadCount: number;
  total: number;
}

export class NotificationSocketServer {
  private namespace: Namespace;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(io: SocketIOServer) {
    // Usar namespace /notifications para separar do namespace de chat
    this.namespace = io.of('/notifications');

    this.setupMiddleware();
    this.setupConnectionHandler();

    logger.info('[SOCKET] Notification namespace initialized on /notifications');
  }

  /**
   * Middleware de autenticação
   */
  private setupMiddleware() {
    this.namespace.use(async (socket: AuthenticatedSocket, next) => {
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

        logger.info('[SOCKET] Notification user authenticated', {
          userId: decoded.userId,
          socketId: socket.id,
        });

        next();
      } catch (error: any) {
        logger.error('[SOCKET] Notification authentication failed', { error: error.message });
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Handler de conexão
   */
  private setupConnectionHandler() {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('[SOCKET] Notification client connected', {
        userId: socket.userId,
        socketId: socket.id,
      });

      // Registrar usuário conectado
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);

        // Entrar na sala de notificações do usuário
        socket.join(`user:${socket.userId}`);

        logger.info('[SOCKET] User joined notification room', {
          userId: socket.userId,
          room: `user:${socket.userId}`,
        });
      }

      // Confirmar conexão
      socket.emit('notification:connected', {
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });

      // Desconexão
      socket.on('disconnect', () => {
        logger.info('[SOCKET] Notification client disconnected', {
          userId: socket.userId,
          socketId: socket.id,
        });

        // Remover usuário da lista de conectados
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
        }
      });
    });
  }

  /**
   * Enviar nova notificação para usuário específico
   */
  public sendNotificationToUser(userId: string, notification: NotificationEvent) {
    const room = `user:${userId}`;
    this.namespace.to(room).emit('notification:new', notification);

    logger.info('[SOCKET] New notification sent to user', {
      userId,
      notificationId: notification.id,
      category: notification.category,
      priority: notification.priority,
    });
  }

  /**
   * Notificar que notificação foi marcada como lida
   */
  public notifyNotificationRead(userId: string, notificationId: string) {
    const room = `user:${userId}`;
    this.namespace.to(room).emit('notification:read', { notificationId });

    logger.info('[SOCKET] Notification marked as read', {
      userId,
      notificationId,
    });
  }

  /**
   * Notificar que todas as notificações foram marcadas como lidas
   */
  public notifyAllRead(userId: string) {
    const room = `user:${userId}`;
    this.namespace.to(room).emit('notification:all-read');

    logger.info('[SOCKET] All notifications marked as read', { userId });
  }

  /**
   * Notificar que notificação foi deletada
   */
  public notifyNotificationDeleted(userId: string, notificationId: string) {
    const room = `user:${userId}`;
    this.namespace.to(room).emit('notification:deleted', { notificationId });

    logger.info('[SOCKET] Notification deleted', {
      userId,
      notificationId,
    });
  }

  /**
   * Atualizar contagem de notificações não lidas
   */
  public updateUnreadCount(userId: string, count: NotificationCountEvent) {
    const room = `user:${userId}`;
    this.namespace.to(room).emit('notification:count', count);

    logger.info('[SOCKET] Unread count updated', {
      userId,
      unreadCount: count.unreadCount,
      total: count.total,
    });
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
let notificationSocketServer: NotificationSocketServer | null = null;

export function initializeNotificationSocket(io: SocketIOServer): NotificationSocketServer {
  if (!notificationSocketServer) {
    notificationSocketServer = new NotificationSocketServer(io);
  }
  return notificationSocketServer;
}

export function getNotificationSocket(): NotificationSocketServer {
  if (!notificationSocketServer) {
    throw new Error('Notification socket not initialized');
  }
  return notificationSocketServer;
}
