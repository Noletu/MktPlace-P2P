import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { NotificationSocketServer } from '../notification.socket';

describe('NotificationSocketServer - Integration Tests', () => {
  let httpServer: HTTPServer;
  let notificationSocket: NotificationSocketServer;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll((done) => {
    // Criar servidor HTTP
    const express = require('express');
    const app = express();
    httpServer = require('http').createServer(app);

    // Porta aleatória para testes
    port = 3002;

    httpServer.listen(port, () => {
      // Inicializar WebSocket Server
      notificationSocket = new NotificationSocketServer(httpServer);
      done();
    });
  });

  afterAll((done) => {
    if (httpServer) {
      httpServer.close(done);
    }
  });

  beforeEach((done) => {
    // Limpar socket anterior
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    done();
  });

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    done();
  });

  describe('Autenticação', () => {
    it('deve aceitar conexão com token JWT válido', (done) => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('deve rejeitar conexão sem token', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
      });

      clientSocket.on('connect', () => {
        done(new Error('Não deveria conectar sem token'));
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        done();
      });
    });

    it('deve rejeitar conexão com token inválido', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token: 'invalid-token' },
      });

      clientSocket.on('connect', () => {
        done(new Error('Não deveria conectar com token inválido'));
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        done();
      });
    });
  });

  describe('Eventos de Notificação', () => {
    let token: string;

    beforeEach(() => {
      token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );
    });

    it('deve receber evento notification:connected ao conectar', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('notification:connected', (data) => {
        expect(data).toHaveProperty('userId');
        expect(data).toHaveProperty('timestamp');
        expect(data.userId).toBe('user-1');
        done();
      });
    });

    it('deve receber evento notification:new quando notificação for enviada', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        // Simular envio de notificação
        const notification = {
          id: 'notification-1',
          title: 'Teste',
          message: 'Mensagem de teste',
          category: 'TEST',
          priority: 'NORMAL',
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        notificationSocket.sendNotificationToUser('user-1', notification);
      });

      clientSocket.on('notification:new', (notification) => {
        expect(notification).toHaveProperty('id');
        expect(notification).toHaveProperty('title');
        expect(notification.id).toBe('notification-1');
        expect(notification.title).toBe('Teste');
        done();
      });
    });

    it('deve receber evento notification:count quando contador for atualizado', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        notificationSocket.updateUnreadCount('user-1', {
          unreadCount: 5,
          total: 10,
        });
      });

      clientSocket.on('notification:count', (count) => {
        expect(count).toHaveProperty('unreadCount');
        expect(count).toHaveProperty('total');
        expect(count.unreadCount).toBe(5);
        expect(count.total).toBe(10);
        done();
      });
    });

    it('deve receber evento notification:read quando notificação for marcada como lida', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        notificationSocket.notifyNotificationRead('user-1', 'notification-1');
      });

      clientSocket.on('notification:read', (data) => {
        expect(data).toHaveProperty('notificationId');
        expect(data.notificationId).toBe('notification-1');
        done();
      });
    });

    it('deve receber evento notification:all-read quando todas forem marcadas como lidas', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        notificationSocket.notifyAllRead('user-1');
      });

      clientSocket.on('notification:all-read', () => {
        expect(true).toBe(true);
        done();
      });
    });

    it('deve receber evento notification:deleted quando notificação for deletada', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        notificationSocket.notifyNotificationDeleted('user-1', 'notification-1');
      });

      clientSocket.on('notification:deleted', (data) => {
        expect(data).toHaveProperty('notificationId');
        expect(data.notificationId).toBe('notification-1');
        done();
      });
    });
  });

  describe('Isolamento de Usuários', () => {
    it('usuário não deve receber notificações de outros usuários', (done) => {
      const token1 = jwt.sign(
        { userId: 'user-1', email: 'user1@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const token2 = jwt.sign(
        { userId: 'user-2', email: 'user2@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const client1 = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token: token1 },
      });

      const client2 = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token: token2 },
      });

      let receivedByUser1 = false;
      let receivedByUser2 = false;

      client1.on('notification:new', () => {
        receivedByUser1 = true;
      });

      client2.on('notification:new', () => {
        receivedByUser2 = true;
      });

      Promise.all([
        new Promise<void>((resolve) => client1.on('connect', () => resolve())),
        new Promise<void>((resolve) => client2.on('connect', () => resolve())),
      ]).then(() => {
        // Enviar notificação apenas para user-2
        notificationSocket.sendNotificationToUser('user-2', {
          id: 'notification-1',
          title: 'Teste',
          message: 'Apenas para user-2',
          category: 'TEST',
          priority: 'NORMAL',
          isRead: false,
          createdAt: new Date().toISOString(),
        });

        setTimeout(() => {
          expect(receivedByUser1).toBe(false);
          expect(receivedByUser2).toBe(true);

          client1.disconnect();
          client2.disconnect();
          done();
        }, 500);
      });
    });
  });

  describe('Gerenciamento de Conexões', () => {
    it('deve rastrear usuários conectados', (done) => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        expect(notificationSocket.isUserOnline('user-1')).toBe(true);
        done();
      });
    });

    it('deve remover usuário da lista ao desconectar', (done) => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        expect(notificationSocket.isUserOnline('user-1')).toBe(true);

        clientSocket.disconnect();

        setTimeout(() => {
          expect(notificationSocket.isUserOnline('user-1')).toBe(false);
          done();
        }, 100);
      });
    });

    it('deve retornar contagem de usuários conectados', (done) => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      clientSocket = Client(`http://localhost:${port}`, {
        path: '/socket.io/',
        auth: { token },
      });

      clientSocket.on('connect', () => {
        const count = notificationSocket.getConnectedUsersCount();
        expect(count).toBeGreaterThanOrEqual(1);
        done();
      });
    });
  });
});
