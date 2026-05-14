import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';

let ioInstance: SocketIOServer | null = null;

/**
 * Inicializa a instância única do Socket.IO Server
 * Esta função garante que apenas um servidor Socket.IO seja criado
 */
export function initializeSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (ioInstance) {
    logger.info('[SOCKET] Reusing existing Socket.IO instance');
    return ioInstance;
  }

  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.ALLOWED_ORIGINS?.split(',')
          : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    },
    path: '/socket.io/',
  });

  logger.info('[SOCKET] Socket.IO server initialized');

  return ioInstance;
}

/**
 * Retorna a instância do Socket.IO Server
 * Lança erro se o servidor não foi inicializado
 */
export function getSocketServer(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('[SOCKET] Socket.IO server not initialized. Call initializeSocketServer first.');
  }
  return ioInstance;
}
