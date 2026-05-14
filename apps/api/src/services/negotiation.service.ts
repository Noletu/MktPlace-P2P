import { PrismaClient, Order } from '@prisma/client';
import { OrderStatus } from '../types/order.types';
import { notificationService } from './notification.service';

const prisma = new PrismaClient();

export class NegotiationService {
  /**
   * Iniciar negociação (chamado ao enviar primeira mensagem no chat)
   * Marca pedido como IN_NEGOTIATION e reserva por 10 minutos
   */
  async startNegotiation(orderId: string, userId: string): Promise<Order> {
    return await prisma.$transaction(async (tx: any) => {
      // Buscar e travar pedido
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error('Pedido não encontrado');
      }

      // Validar que não é o owner tentando negociar
      if (order.userId === userId) {
        throw new Error('Você não pode negociar seu próprio pedido');
      }

      // Validar status
      if (order.status !== OrderStatus.PENDING) {
        if (order.status === OrderStatus.IN_NEGOTIATION) {
          // Se já está em negociação com este usuário, permitir
          if (order.negotiatingUserId === userId) {
            return order;
          }
          throw new Error('Este pedido já está em negociação com outro usuário');
        }
        throw new Error('Este pedido não está disponível para negociação');
      }

      // Iniciar negociação
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.IN_NEGOTIATION,
          negotiatingUserId: userId,
          negotiationStartedAt: new Date(),
        },
      });

      console.log(`💬 Negotiation started: Order ${orderId} by User ${userId}`);

      // Enviar notificação para o owner
      setImmediate(async () => {
        try {
          await notificationService.createNotification({
            userId: order.userId,
            type: 'NEGOTIATION_STARTED',
            category: 'ORDER',
            title: 'Negociação Iniciada',
            message: 'Alguém iniciou negociação no seu pedido. Responda rápido!',
            priority: 'HIGH',
            relatedId: orderId,
            relatedType: 'ORDER',
            actionUrl: `/orders/${orderId}/preview`,
            actionLabel: 'Ver Pedido',
          });
        } catch (error) {
          console.error('Failed to send negotiation notification:', error);
        }
      });

      return updatedOrder;
    });
  }

  /**
   * Cancelar negociação (voluntariamente ou por timeout)
   * Volta pedido para PENDING
   */
  async cancelNegotiation(orderId: string, userId: string, reason: 'user' | 'timeout' = 'user'): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Validar que está em negociação
    if (order.status !== OrderStatus.IN_NEGOTIATION) {
      throw new Error('Pedido não está em negociação');
    }

    // Validar permissão: owner ou quem está negociando
    if (order.userId !== userId && order.negotiatingUserId !== userId) {
      throw new Error('Você não tem permissão para cancelar esta negociação');
    }

    // Limpar mensagens do chat + voltar para PENDING atomicamente
    const chat = await prisma.chat.findUnique({
      where: { orderId },
    });

    const updatedOrder = await prisma.$transaction(async (tx: any) => {
      if (chat) {
        await tx.chatMessage.deleteMany({
          where: { chatId: chat.id },
        });
        console.log(`🗑️ Chat messages cleared for order ${orderId} (negotiation cancelled)`);
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PENDING,
          negotiatingUserId: null,
          negotiationStartedAt: null,
        },
      });
    });

    const reasonText = reason === 'timeout' ? 'por timeout (10min)' : 'pelo usuário';
    console.log(`❌ Negotiation cancelled: Order ${orderId} - ${reasonText}`);

    // Notificar o owner se foi cancelado por timeout
    if (reason === 'timeout') {
      setImmediate(async () => {
        try {
          await notificationService.createNotification({
            userId: order.userId,
            type: 'NEGOTIATION_TIMEOUT',
            category: 'ORDER',
            title: 'Negociação Expirou',
            message: 'A negociação no seu pedido expirou (10min). O pedido está disponível novamente.',
            priority: 'NORMAL',
            relatedId: orderId,
            relatedType: 'ORDER',
            actionUrl: `/orders/my-orders`,
            actionLabel: 'Meus Pedidos',
          });
        } catch (error) {
          console.error('Failed to send timeout notification:', error);
        }
      });
    }

    return updatedOrder;
  }

  /**
   * Worker: Timeout de negociações que estão há 10+ minutos sem match
   */
  async timeoutStaleNegotiations(): Promise<number> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Buscar negociações em andamento há 10+ minutos
    const staleNegotiations = await prisma.order.findMany({
      where: {
        status: OrderStatus.IN_NEGOTIATION,
        negotiationStartedAt: {
          lt: tenMinutesAgo,
        },
      },
    });

    // Cancelar cada uma
    for (const order of staleNegotiations) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PENDING,
          negotiatingUserId: null,
          negotiationStartedAt: null,
        },
      });

      console.log(`⏰ Negotiation timeout: Order ${order.id} (10min expired)`);

      // Notificar owner
      try {
        await notificationService.createNotification({
          userId: order.userId,
          type: 'NEGOTIATION_TIMEOUT',
          category: 'ORDER',
          title: 'Negociação Expirou',
          message: 'A negociação no seu pedido expirou (10min). O pedido está disponível novamente.',
          priority: 'NORMAL',
          relatedId: order.id,
          relatedType: 'ORDER',
          actionUrl: `/orders/my-orders`,
          actionLabel: 'Meus Pedidos',
        });
      } catch (error) {
        console.error('Failed to send timeout notification:', error);
      }
    }

    return staleNegotiations.length;
  }

  /**
   * Verificar se usuário pode negociar um pedido
   */
  async canUserNegotiate(orderId: string, userId: string): Promise<boolean> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) return false;

    // Não pode negociar próprio pedido
    if (order.userId === userId) return false;

    // Se PENDING → pode negociar
    if (order.status === OrderStatus.PENDING) return true;

    // Se IN_NEGOTIATION → só pode se for o usuário negociando
    if (order.status === OrderStatus.IN_NEGOTIATION) {
      return order.negotiatingUserId === userId;
    }

    // Outros status → não pode negociar
    return false;
  }

  /**
   * Obter informações da negociação atual
   */
  async getNegotiationInfo(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        negotiatingUserId: true,
        negotiationStartedAt: true,
      },
    });

    if (!order) return null;

    if (order.status !== OrderStatus.IN_NEGOTIATION) {
      return {
        isNegotiating: false,
        negotiatingUserId: null,
        startedAt: null,
        remainingTime: null,
      };
    }

    const startedAt = order.negotiationStartedAt!;
    const expiresAt = new Date(startedAt.getTime() + 10 * 60 * 1000);
    const remainingMs = expiresAt.getTime() - Date.now();

    return {
      isNegotiating: true,
      negotiatingUserId: order.negotiatingUserId,
      startedAt: startedAt,
      expiresAt: expiresAt,
      remainingTime: Math.max(0, Math.floor(remainingMs / 1000)), // segundos
    };
  }
}

export default new NegotiationService();
