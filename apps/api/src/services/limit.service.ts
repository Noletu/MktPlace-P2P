import { prisma } from '../utils/prisma';

/**
 * Service para gerenciar limites de transacao baseados em reputacao
 *
 * Formula: limite_diario = 1000 + (reputationScore * 100) BRL
 *
 * Exemplos:
 * - Reputacao 0   -> Limite 1.000 BRL/dia
 * - Reputacao 10  -> Limite 2.000 BRL/dia
 * - Reputacao 50  -> Limite 6.000 BRL/dia
 * - Reputacao 100 -> Limite 11.000 BRL/dia (maximo)
 */
class LimitService {
  /**
   * Calcula limite diario baseado em reputacao do usuario
   */
  async getDailyLimit(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true }
    });

    if (!user) return 1000; // Limite padrao para usuario nao encontrado

    // Formula: 1000 + (reputacao * 100)
    return 1000 + (user.reputationScore * 100);
  }

  /**
   * Calcula total transacionado pelo usuario hoje
   * Considera tanto ordens criadas quanto ordens aceitas (como pagador/provedor)
   */
  async getDailyVolume(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar ordens SELL criadas pelo usuario hoje (nao canceladas/expiradas)
    const sellOrdersCreated = await prisma.order.findMany({
      where: {
        userId: userId,
        orderType: 'SELL',
        createdAt: { gte: today },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
      select: { brlAmount: true },
    });

    // Buscar ordens BUY criadas pelo usuario hoje
    const buyOrdersCreated = await prisma.order.findMany({
      where: {
        userId: userId,
        orderType: 'BUY',
        createdAt: { gte: today },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
      select: { brlAmount: true },
    });

    // Buscar transacoes onde usuario e pagador (aceitou ordem SELL)
    const transactionsAsPayer = await prisma.transaction.findMany({
      where: {
        payerId: userId,
        createdAt: { gte: today },
        status: { notIn: ['CANCELLED'] },
      },
      include: {
        order: {
          select: { brlAmount: true, orderType: true }
        }
      },
    });

    // Buscar ordens BUY onde usuario e provedor (aceitou ordem BUY de outro)
    const ordersAsProvider = await prisma.order.findMany({
      where: {
        providerId: userId,
        orderType: 'BUY',
        createdAt: { gte: today },
        status: { notIn: ['CANCELLED', 'EXPIRED', 'PENDING'] },
      },
      select: { brlAmount: true },
    });

    let total = 0;

    // Somar ordens SELL criadas
    for (const order of sellOrdersCreated) {
      total += parseFloat(order.brlAmount);
    }

    // Somar ordens BUY criadas
    for (const order of buyOrdersCreated) {
      total += parseFloat(order.brlAmount);
    }

    // Somar transacoes como pagador (apenas de ordens SELL para evitar duplicacao)
    for (const tx of transactionsAsPayer) {
      if (tx.order.orderType === 'SELL') {
        total += parseFloat(tx.order.brlAmount);
      }
    }

    // Somar ordens como provedor
    for (const order of ordersAsProvider) {
      total += parseFloat(order.brlAmount);
    }

    return total;
  }

  /**
   * Verifica se usuario pode fazer transacao de determinado valor
   * Retorna detalhes do limite para exibir na UI
   */
  async canUserTransact(userId: string, amount: number): Promise<{
    allowed: boolean;
    dailyLimit: number;
    dailyUsed: number;
    remaining: number;
    reputationScore: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true }
    });

    const reputationScore = user?.reputationScore || 0;
    const dailyLimit = 1000 + (reputationScore * 100);
    const dailyUsed = await this.getDailyVolume(userId);
    const remaining = Math.max(0, dailyLimit - dailyUsed);

    return {
      allowed: amount <= remaining,
      dailyLimit,
      dailyUsed,
      remaining,
      reputationScore,
    };
  }

  /**
   * Obtem informacoes de limite para exibir ao usuario
   */
  async getLimitInfo(userId: string): Promise<{
    dailyLimit: number;
    dailyUsed: number;
    remaining: number;
    reputationScore: number;
    nextMilestone: { reputation: number; limit: number } | null;
  }> {
    const check = await this.canUserTransact(userId, 0);

    // Calcular proximo milestone de reputacao
    let nextMilestone = null;
    if (check.reputationScore < 100) {
      const nextRep = Math.min(100, check.reputationScore + 10);
      nextMilestone = {
        reputation: nextRep,
        limit: 1000 + (nextRep * 100),
      };
    }

    return {
      dailyLimit: check.dailyLimit,
      dailyUsed: check.dailyUsed,
      remaining: check.remaining,
      reputationScore: check.reputationScore,
      nextMilestone,
    };
  }
}

export const limitService = new LimitService();
