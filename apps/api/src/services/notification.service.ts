import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { getNotificationSocket } from '../socket/notification.socket';

const prisma = new PrismaClient();

export interface CreateNotificationInput {
  userId: string;
  type: string;
  category: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  relatedId?: string;
  relatedType?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  metadata?: Record<string, any>;
}

export interface GetNotificationsFilters {
  category?: string;
  isRead?: boolean;
  priority?: string;
  limit?: number;
  offset?: number;
}

export class NotificationService {
  /**
   * Criar notificação genérica
   */
  async createNotification(input: CreateNotificationInput) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          category: input.category,
          title: input.title,
          message: input.message,
          actionUrl: input.actionUrl,
          actionLabel: input.actionLabel,
          relatedId: input.relatedId,
          relatedType: input.relatedType,
          priority: input.priority || 'NORMAL',
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        },
      });

      logger.info('[NOTIFICATION] Created', {
        notificationId: notification.id,
        userId: input.userId,
        type: input.type,
        category: input.category,
      });

      // Emitir evento WebSocket para usuário conectado
      try {
        const notificationSocket = getNotificationSocket();
        notificationSocket.sendNotificationToUser(input.userId, {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          category: notification.category,
          priority: notification.priority,
          actionUrl: notification.actionUrl || undefined,
          isRead: notification.isRead,
          createdAt: notification.createdAt.toISOString(),
        });

        // Atualizar contagem não lidas
        const unreadCount = await this.getUnreadCount(input.userId);
        const total = await prisma.notification.count({ where: { userId: input.userId } });
        notificationSocket.updateUnreadCount(input.userId, { unreadCount, total });
      } catch (socketError: any) {
        // Socket não inicializado ainda ou usuário offline - não é erro crítico
        logger.warn('[NOTIFICATION] WebSocket emission failed', {
          error: socketError.message,
          notificationId: notification.id,
        });
      }

      return notification;
    } catch (error: any) {
      logger.error('[NOTIFICATION] Failed to create', {
        error: error.message,
        input,
      });
      throw error;
    }
  }

  /**
   * Buscar notificações do usuário
   */
  async getUserNotifications(userId: string, filters?: GetNotificationsFilters) {
    const where: any = { userId };

    if (filters?.category) where.category = filters.category;
    if (filters?.isRead !== undefined) where.isRead = filters.isRead;
    if (filters?.priority) where.priority = filters.priority;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    if (notification.userId !== userId) {
      throw new Error('Você não tem permissão para marcar esta notificação como lida');
    }

    if (notification.isRead) {
      return notification; // Já está lida
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Emitir evento WebSocket
    try {
      const notificationSocket = getNotificationSocket();
      notificationSocket.notifyNotificationRead(userId, notificationId);

      // Atualizar contagem não lidas
      const unreadCount = await this.getUnreadCount(userId);
      const total = await prisma.notification.count({ where: { userId } });
      notificationSocket.updateUnreadCount(userId, { unreadCount, total });
    } catch (socketError: any) {
      logger.warn('[NOTIFICATION] WebSocket emission failed (markAsRead)', {
        error: socketError.message,
      });
    }

    return updated;
  }

  /**
   * Marcar todas as notificações como lidas
   */
  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Emitir evento WebSocket
    try {
      const notificationSocket = getNotificationSocket();
      notificationSocket.notifyAllRead(userId);

      // Atualizar contagem (deve ser 0 agora)
      const total = await prisma.notification.count({ where: { userId } });
      notificationSocket.updateUnreadCount(userId, { unreadCount: 0, total });
    } catch (socketError: any) {
      logger.warn('[NOTIFICATION] WebSocket emission failed (markAllAsRead)', {
        error: socketError.message,
      });
    }

    return { success: true };
  }

  /**
   * Deletar notificação
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    if (notification.userId !== userId) {
      throw new Error('Você não tem permissão para deletar esta notificação');
    }

    const wasUnread = !notification.isRead;

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    // Emitir evento WebSocket
    try {
      const notificationSocket = getNotificationSocket();
      notificationSocket.notifyNotificationDeleted(userId, notificationId);

      // Atualizar contagem se era não lida
      if (wasUnread) {
        const unreadCount = await this.getUnreadCount(userId);
        const total = await prisma.notification.count({ where: { userId } });
        notificationSocket.updateUnreadCount(userId, { unreadCount, total });
      }
    } catch (socketError: any) {
      logger.warn('[NOTIFICATION] WebSocket emission failed (deleteNotification)', {
        error: socketError.message,
      });
    }

    return { success: true };
  }

  /**
   * Deletar todas as notificações lidas
   */
  async deleteAllRead(userId: string) {
    await prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });

    // Emitir evento WebSocket para atualizar contagem total
    try {
      const notificationSocket = getNotificationSocket();
      const unreadCount = await this.getUnreadCount(userId);
      const total = await prisma.notification.count({ where: { userId } });
      notificationSocket.updateUnreadCount(userId, { unreadCount, total });
    } catch (socketError: any) {
      logger.warn('[NOTIFICATION] WebSocket emission failed (deleteAllRead)', {
        error: socketError.message,
      });
    }

    return { success: true };
  }

  /**
   * Contar notificações não lidas
   */
  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return count;
  }

  // ============================================
  // NOTIFICATION HELPERS - ORDER EVENTS
  // ============================================

  /**
   * Pedido foi matched/pareado
   */
  async notifyOrderMatched(orderId: string, sellerId: string, buyerId: string, orderData: any) {
    await Promise.all([
      this.createNotification({
        userId: sellerId,
        type: 'ORDER_MATCHED',
        category: 'ORDER',
        title: '🎯 Pedido Pareado!',
        message: `Seu pedido de venda foi pareado! Um comprador está aguardando o pagamento.`,
        actionUrl: `/orders/${orderId}`,
        actionLabel: 'Ver Pedido',
        relatedId: orderId,
        relatedType: 'ORDER',
        priority: 'HIGH',
        metadata: orderData,
      }),
      this.createNotification({
        userId: buyerId,
        type: 'ORDER_MATCHED',
        category: 'ORDER',
        title: '🎯 Pedido Pareado!',
        message: `Seu pedido foi pareado! Realize o pagamento para continuar.`,
        actionUrl: `/orders/${orderId}`,
        actionLabel: 'Pagar Agora',
        relatedId: orderId,
        relatedType: 'ORDER',
        priority: 'HIGH',
        metadata: orderData,
      }),
    ]);
  }

  /**
   * Pagamento foi enviado/comprovante enviado
   */
  async notifyPaymentSent(orderId: string, sellerId: string, buyerId: string) {
    await this.createNotification({
      userId: sellerId,
      type: 'PAYMENT_SENT',
      category: 'ORDER',
      title: '💰 Pagamento Enviado',
      message: `O comprador enviou o comprovante de pagamento. Verifique e valide.`,
      actionUrl: `/orders/${orderId}`,
      actionLabel: 'Validar Pagamento',
      relatedId: orderId,
      relatedType: 'ORDER',
      priority: 'HIGH',
    });
  }

  /**
   * Pagamento foi validado/aprovado
   */
  async notifyPaymentValidated(orderId: string, buyerId: string, cryptoAmount: string, cryptoType: string) {
    await this.createNotification({
      userId: buyerId,
      type: 'PAYMENT_VALIDATED',
      category: 'ORDER',
      title: '✅ Pagamento Aprovado!',
      message: `Seu pagamento foi aprovado! Você receberá ${cryptoAmount} ${cryptoType} em breve.`,
      actionUrl: `/orders/${orderId}`,
      actionLabel: 'Ver Pedido',
      relatedId: orderId,
      relatedType: 'ORDER',
      priority: 'HIGH',
    });
  }

  /**
   * Pedido foi concluído
   */
  async notifyOrderCompleted(orderId: string, userId: string, wasSuccessful: boolean) {
    await this.createNotification({
      userId,
      type: 'ORDER_COMPLETED',
      category: 'ORDER',
      title: wasSuccessful ? '🎉 Pedido Concluído!' : '⚠️ Pedido Finalizado',
      message: wasSuccessful
        ? 'Sua transação foi concluída com sucesso! Não se esqueça de avaliar a outra parte.'
        : 'Seu pedido foi finalizado.',
      actionUrl: `/orders/${orderId}`,
      actionLabel: wasSuccessful ? 'Deixar Avaliação' : 'Ver Detalhes',
      relatedId: orderId,
      relatedType: 'ORDER',
      priority: 'NORMAL',
    });
  }

  /**
   * Pedido expirou
   */
  async notifyOrderExpired(orderId: string, userId: string, reason: string) {
    await this.createNotification({
      userId,
      type: 'ORDER_EXPIRED',
      category: 'ORDER',
      title: '⏰ Pedido Expirado',
      message: `Seu pedido expirou: ${reason}`,
      actionUrl: `/orders/${orderId}`,
      actionLabel: 'Ver Detalhes',
      relatedId: orderId,
      relatedType: 'ORDER',
      priority: 'HIGH',
    });
  }

  /**
   * Pedido foi cancelado
   */
  async notifyOrderCancelled(orderId: string, userId: string, reason?: string) {
    await this.createNotification({
      userId,
      type: 'ORDER_CANCELLED',
      category: 'ORDER',
      title: '🚫 Pedido Cancelado',
      message: reason ? `Pedido cancelado: ${reason}` : 'Seu pedido foi cancelado.',
      actionUrl: `/orders/${orderId}`,
      actionLabel: 'Ver Detalhes',
      relatedId: orderId,
      relatedType: 'ORDER',
      priority: 'NORMAL',
    });
  }

  // ============================================
  // NOTIFICATION HELPERS - DISPUTE EVENTS
  // ============================================

  /**
   * Disputa foi criada
   */
  async notifyDisputeCreated(disputeId: string, orderId: string, counterpartyId: string, creatorName: string) {
    await this.createNotification({
      userId: counterpartyId,
      type: 'DISPUTE_CREATED',
      category: 'DISPUTE',
      title: '⚠️ Nova Disputa',
      message: `${creatorName} abriu uma disputa sobre seu pedido. Responda para resolver a situação.`,
      actionUrl: `/disputes/${disputeId}`,
      actionLabel: 'Ver Disputa',
      relatedId: disputeId,
      relatedType: 'DISPUTE',
      priority: 'URGENT',
    });
  }

  /**
   * Nova mensagem na disputa
   */
  async notifyDisputeMessage(disputeId: string, recipientId: string, senderName: string, isAdmin: boolean) {
    await this.createNotification({
      userId: recipientId,
      type: 'DISPUTE_MESSAGE',
      category: 'DISPUTE',
      title: isAdmin ? '🛡️ Mensagem do Suporte' : '💬 Nova Mensagem na Disputa',
      message: isAdmin
        ? 'O suporte enviou uma mensagem na sua disputa.'
        : `${senderName} enviou uma mensagem na disputa.`,
      actionUrl: `/disputes/${disputeId}`,
      actionLabel: 'Ver Mensagem',
      relatedId: disputeId,
      relatedType: 'DISPUTE',
      priority: isAdmin ? 'HIGH' : 'NORMAL',
    });
  }

  /**
   * Disputa foi resolvida
   */
  async notifyDisputeResolved(disputeId: string, userId: string, resolution: string, resolutionType: string) {
    await this.createNotification({
      userId,
      type: 'DISPUTE_RESOLVED',
      category: 'DISPUTE',
      title: '✅ Disputa Resolvida',
      message: `Sua disputa foi resolvida: ${resolution}`,
      actionUrl: `/disputes/${disputeId}`,
      actionLabel: 'Ver Resolução',
      relatedId: disputeId,
      relatedType: 'DISPUTE',
      priority: 'HIGH',
      metadata: { resolutionType },
    });
  }

  // ============================================
  // NOTIFICATION HELPERS - REVIEW EVENTS
  // ============================================

  /**
   * Usuário recebeu uma avaliação
   */
  async notifyReviewReceived(reviewId: string, reviewedId: string, reviewerName: string, rating: number, orderId: string) {
    const stars = '⭐'.repeat(rating);
    await this.createNotification({
      userId: reviewedId,
      type: 'REVIEW_RECEIVED',
      category: 'REVIEW',
      title: '⭐ Nova Avaliação',
      message: `${reviewerName} avaliou você com ${stars} (${rating}/5)`,
      actionUrl: `/reviews?orderId=${orderId}`,
      actionLabel: 'Ver Avaliação',
      relatedId: reviewId,
      relatedType: 'REVIEW',
      priority: 'NORMAL',
    });
  }

  /**
   * Avaliação recebeu uma resposta
   */
  async notifyReviewResponse(reviewId: string, reviewerId: string, respondentName: string) {
    await this.createNotification({
      userId: reviewerId,
      type: 'REVIEW_RESPONSE',
      category: 'REVIEW',
      title: '💬 Resposta à Avaliação',
      message: `${respondentName} respondeu sua avaliação`,
      actionUrl: `/reviews/${reviewId}`,
      actionLabel: 'Ver Resposta',
      relatedId: reviewId,
      relatedType: 'REVIEW',
      priority: 'LOW',
    });
  }

  // ============================================
  // NOTIFICATION HELPERS - WALLET EVENTS
  // ============================================

  /**
   * Depósito foi confirmado
   */
  async notifyDepositConfirmed(userId: string, amount: string, cryptoType: string, txHash: string) {
    await this.createNotification({
      userId,
      type: 'DEPOSIT_CONFIRMED',
      category: 'WALLET',
      title: '💎 Depósito Confirmado',
      message: `Seu depósito de ${amount} ${cryptoType} foi confirmado!`,
      actionUrl: `/wallets`,
      actionLabel: 'Ver Carteira',
      relatedId: txHash,
      relatedType: 'DEPOSIT',
      priority: 'HIGH',
      metadata: { amount, cryptoType, txHash },
    });
  }

  /**
   * Saque foi processado
   */
  async notifyWithdrawalProcessed(userId: string, amount: string, cryptoType: string, txHash: string) {
    await this.createNotification({
      userId,
      type: 'WITHDRAWAL_PROCESSED',
      category: 'WALLET',
      title: '💸 Saque Processado',
      message: `Seu saque de ${amount} ${cryptoType} foi processado!`,
      actionUrl: `/wallets`,
      actionLabel: 'Ver Transação',
      relatedId: txHash,
      relatedType: 'WITHDRAWAL',
      priority: 'NORMAL',
      metadata: { amount, cryptoType, txHash },
    });
  }

  // ============================================
  // NOTIFICATION HELPERS - KYC EVENTS
  // ============================================

  /**
   * KYC foi aprovado
   */
  async notifyKycApproved(userId: string, level: string) {
    await this.createNotification({
      userId,
      type: 'KYC_APPROVED',
      category: 'KYC',
      title: '✅ KYC Aprovado!',
      message: `Seu KYC nível ${level} foi aprovado! Você agora tem acesso a novos recursos.`,
      actionUrl: `/kyc/info`,
      actionLabel: 'Ver Perfil',
      relatedId: userId,
      relatedType: 'KYC',
      priority: 'HIGH',
    });
  }

  /**
   * KYC foi rejeitado
   */
  async notifyKycRejected(userId: string, level: string, reason?: string) {
    await this.createNotification({
      userId,
      type: 'KYC_REJECTED',
      category: 'KYC',
      title: '❌ KYC Rejeitado',
      message: reason
        ? `Seu KYC nível ${level} foi rejeitado: ${reason}`
        : `Seu KYC nível ${level} foi rejeitado. Tente novamente.`,
      actionUrl: `/kyc/info`,
      actionLabel: 'Tentar Novamente',
      relatedId: userId,
      relatedType: 'KYC',
      priority: 'HIGH',
    });
  }

  // ============================================
  // NOTIFICATION HELPERS - SYSTEM EVENTS
  // ============================================

  /**
   * Notificação de sistema/anúncio
   */
  async notifySystemAnnouncement(userId: string, title: string, message: string, priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL') {
    await this.createNotification({
      userId,
      type: 'SYSTEM_ANNOUNCEMENT',
      category: 'SYSTEM',
      title,
      message,
      priority,
    });
  }

  /**
   * Broadcast - enviar notificação para múltiplos usuários
   */
  async broadcastNotification(userIds: string[], notification: Omit<CreateNotificationInput, 'userId'>) {
    const notifications = userIds.map(userId =>
      prisma.notification.create({
        data: {
          userId,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionLabel: notification.actionLabel,
          relatedId: notification.relatedId,
          relatedType: notification.relatedType,
          priority: notification.priority || 'NORMAL',
          metadata: notification.metadata ? JSON.stringify(notification.metadata) : null,
        },
      })
    );

    await Promise.all(notifications);

    logger.info('[NOTIFICATION] Broadcast sent', {
      recipientCount: userIds.length,
      type: notification.type,
    });

    return { success: true, count: userIds.length };
  }
}

export const notificationService = new NotificationService();
