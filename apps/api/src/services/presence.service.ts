import { PrismaClient, Order } from '@prisma/client';
import { OrderStatus } from '../types/order.types';

const prisma = new PrismaClient();

export class PresenceService {
  /**
   * Toggle presença online/offline para um pedido específico
   * Apenas o owner do pedido pode alterar
   */
  async togglePresence(orderId: string, userId: string, online: boolean): Promise<Order> {
    // Buscar pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Validar ownership
    if (order.userId !== userId) {
      throw new Error('Apenas o dono do pedido pode alterar a presença');
    }

    // Validar que pedido está em status válido para presença
    const validStatuses = [OrderStatus.PENDING, OrderStatus.IN_NEGOTIATION];
    if (!validStatuses.includes(order.status as OrderStatus)) {
      throw new Error('Pedido não está disponível para negociação');
    }

    // Atualizar presença
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        ownerOnline: online,
        ownerLastActivityAt: new Date(),
        ownerLastSeenAt: online ? new Date() : order.ownerLastSeenAt, // Atualizar apenas se ficar online
      },
    });

    console.log(`📡 Presence toggled: Order ${orderId} - Online: ${online}`);

    return updatedOrder;
  }

  /**
   * Enviar heartbeat para manter status online
   * Atualiza ownerLastSeenAt
   */
  async sendHeartbeat(orderId: string, userId: string): Promise<void> {
    // Buscar pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Validar ownership
    if (order.userId !== userId) {
      throw new Error('Apenas o dono do pedido pode enviar heartbeat');
    }

    // Apenas atualizar se estiver online
    if (!order.ownerOnline) {
      throw new Error('Pedido não está online');
    }

    // Atualizar lastSeenAt
    await prisma.order.update({
      where: { id: orderId },
      data: {
        ownerLastSeenAt: new Date(),
      },
    });

    // console.log(`💓 Heartbeat: Order ${orderId}`);
  }

  /**
   * Buscar todos pedidos online de um usuário
   */
  async getOnlineOrders(userId: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: {
        userId,
        ownerOnline: true,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.IN_NEGOTIATION],
        },
      },
      orderBy: {
        ownerLastSeenAt: 'desc',
      },
    });

    return orders;
  }

  /**
   * Worker: Marcar pedidos como offline se não receberam heartbeat há 3+ minutos
   * Chamado periodicamente pelo worker
   */
  async autoOfflineStaleOrders(): Promise<number> {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

    // Buscar pedidos online mas sem heartbeat há 3+ minutos
    const staleOrders = await prisma.order.findMany({
      where: {
        ownerOnline: true,
        ownerLastSeenAt: {
          lt: threeMinutesAgo,
        },
      },
    });

    // Marcar como offline
    for (const order of staleOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          ownerOnline: false,
        },
      });

      console.log(`📴 Auto-offline: Order ${order.id} (no heartbeat for 3min)`);
    }

    return staleOrders.length;
  }

  /**
   * Verificar se um pedido está online
   */
  async isOrderOnline(orderId: string): Promise<boolean> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { ownerOnline: true },
    });

    return order?.ownerOnline ?? false;
  }

  /**
   * Obter estatísticas de presença de um usuário
   */
  async getUserPresenceStats(userId: string) {
    const total = await prisma.order.count({
      where: {
        userId,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.IN_NEGOTIATION],
        },
      },
    });

    const online = await prisma.order.count({
      where: {
        userId,
        ownerOnline: true,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.IN_NEGOTIATION],
        },
      },
    });

    return {
      totalActive: total,
      online,
      offline: total - online,
    };
  }
}

export default new PresenceService();
