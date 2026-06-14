import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { getAllowedOrigins } from '../config/cors';

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
      // SER-31: mesma whitelist do CORS HTTP (fonte única em config/cors.ts)
      origin: getAllowedOrigins(),
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
