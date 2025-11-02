import { NotificationService } from '../notification.service';
import { PrismaClient } from '@prisma/client';

// Mock do WebSocket
jest.mock('../../socket/notification.socket', () => ({
  getNotificationSocket: jest.fn(() => ({
    sendNotificationToUser: jest.fn(),
    updateUnreadCount: jest.fn(),
    notifyNotificationRead: jest.fn(),
    notifyAllRead: jest.fn(),
    notifyNotificationDeleted: jest.fn(),
  })),
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let prisma: any;

  beforeEach(() => {
    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks();

    notificationService = new NotificationService();
    prisma = new PrismaClient();
  });

  describe('createNotification', () => {
    it('deve criar uma notificação com sucesso', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: 'ORDER_MATCHED',
        category: 'ORDER',
        title: 'Pedido Pareado',
        message: 'Seu pedido foi pareado',
        priority: 'HIGH',
        isRead: false,
        createdAt: new Date(),
        actionUrl: '/orders/order-1',
      };

      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification({
        userId: 'user-1',
        type: 'ORDER_MATCHED',
        category: 'ORDER',
        title: 'Pedido Pareado',
        message: 'Seu pedido foi pareado',
        priority: 'HIGH',
        actionUrl: '/orders/order-1',
      });

      expect(result).toEqual(mockNotification);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'ORDER_MATCHED',
          category: 'ORDER',
          title: 'Pedido Pareado',
        }),
      });
    });

    it('deve usar prioridade NORMAL como padrão', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: 'SYSTEM',
        category: 'SYSTEM',
        title: 'Teste',
        message: 'Mensagem de teste',
        priority: 'NORMAL',
        isRead: false,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);

      await notificationService.createNotification({
        userId: 'user-1',
        type: 'SYSTEM',
        category: 'SYSTEM',
        title: 'Teste',
        message: 'Mensagem de teste',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 'NORMAL',
        }),
      });
    });

    it('deve lançar erro ao falhar ao criar notificação', async () => {
      prisma.notification.create.mockRejectedValue(new Error('Database error'));

      await expect(
        notificationService.createNotification({
          userId: 'user-1',
          type: 'TEST',
          category: 'TEST',
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('getUserNotifications', () => {
    it('deve buscar notificações do usuário com filtros', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-1',
          category: 'ORDER',
          priority: 'HIGH',
          isRead: false,
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count.mockResolvedValueOnce(1); // total
      prisma.notification.count.mockResolvedValueOnce(1); // unread

      const result = await notificationService.getUserNotifications('user-1', {
        category: 'ORDER',
        isRead: false,
        priority: 'HIGH',
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 1,
        unreadCount: 1,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          category: 'ORDER',
          isRead: false,
          priority: 'HIGH',
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        skip: 0,
      });
    });

    it('deve usar valores padrão quando filtros não fornecidos', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await notificationService.getUserNotifications('user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        skip: 0,
      });
    });
  });

  describe('markAsRead', () => {
    it('deve marcar notificação como lida', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        isRead: false,
      };

      const mockUpdated = {
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue(mockUpdated);

      const result = await notificationService.markAsRead('notification-1', 'user-1');

      expect(result.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('deve lançar erro se notificação não encontrada', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        notificationService.markAsRead('notification-1', 'user-1')
      ).rejects.toThrow('Notificação não encontrada');
    });

    it('deve lançar erro se usuário não tem permissão', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-2',
        isRead: false,
      });

      await expect(
        notificationService.markAsRead('notification-1', 'user-1')
      ).rejects.toThrow('Você não tem permissão');
    });

    it('deve retornar notificação sem atualizar se já está lida', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        isRead: true,
      };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);

      const result = await notificationService.markAsRead('notification-1', 'user-1');

      expect(result).toEqual(mockNotification);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('deve marcar todas as notificações como lidas', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await notificationService.markAllAsRead('user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe('deleteNotification', () => {
    it('deve deletar notificação com sucesso', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        isRead: false,
      };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);
      prisma.notification.delete.mockResolvedValue(mockNotification);

      const result = await notificationService.deleteNotification('notification-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
      });
    });

    it('deve lançar erro se notificação não encontrada', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        notificationService.deleteNotification('notification-1', 'user-1')
      ).rejects.toThrow('Notificação não encontrada');
    });

    it('deve lançar erro se usuário não tem permissão', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-2',
        isRead: false,
      });

      await expect(
        notificationService.deleteNotification('notification-1', 'user-1')
      ).rejects.toThrow('Você não tem permissão');
    });
  });

  describe('deleteAllRead', () => {
    it('deve deletar todas as notificações lidas', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 3 });

      const result = await notificationService.deleteAllRead('user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: true },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('deve retornar contagem de notificações não lidas', async () => {
      prisma.notification.count.mockResolvedValue(5);

      const result = await notificationService.getUnreadCount('user-1');

      expect(result).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });

    it('deve retornar 0 quando não há notificações não lidas', async () => {
      prisma.notification.count.mockResolvedValue(0);

      const result = await notificationService.getUnreadCount('user-1');

      expect(result).toBe(0);
    });
  });
});
