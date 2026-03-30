import { prisma } from '../utils/prisma';

/**
 * Service para gerenciar limites de transacao baseados em reputacao
 *
 * Formula padrao: limite_diario = 1000 + (reputationScore * 100) BRL
 * Se customDailyLimit definido por admin: usa o override manual
 *
 * Exemplos (formula):
 * - Reputacao 0   -> Limite 1.000 BRL/dia
 * - Reputacao 10  -> Limite 2.000 BRL/dia
 * - Reputacao 50  -> Limite 6.000 BRL/dia
 * - Reputacao 100 -> Limite 11.000 BRL/dia (maximo)
 */
class LimitService {
  /**
   * Calcula limite pela formula padrao (sem override)
   */
  private calculateFormulaLimit(reputationScore: number): number {
    return 1000 + (reputationScore * 100);
  }

  /**
   * Calcula limite diario baseado em reputacao do usuario
   * Respeita customDailyLimit se definido por admin
   */
  async getDailyLimit(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true, customDailyLimit: true, customDailyLimitStr: true }
    });

    if (!user) return 1000;

    // MIGRATION (H-8): Preferir customDailyLimitStr (preciso) sobre customDailyLimit (Float)
    if (user.customDailyLimitStr !== null && user.customDailyLimitStr !== undefined) {
      return parseFloat(user.customDailyLimitStr);
    }
    if (user.customDailyLimit !== null && user.customDailyLimit !== undefined) {
      return user.customDailyLimit;
    }

    return this.calculateFormulaLimit(user.reputationScore);
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
    isCustomLimit: boolean;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true, customDailyLimit: true, customDailyLimitStr: true }
    });

    const reputationScore = user?.reputationScore || 0;
    // MIGRATION (H-8): Preferir customDailyLimitStr se disponível
    const isCustomLimit = (user?.customDailyLimitStr != null) || (user?.customDailyLimit != null);
    const customValue = user?.customDailyLimitStr != null
      ? parseFloat(user.customDailyLimitStr)
      : user?.customDailyLimit ?? null;
    const dailyLimit = isCustomLimit && customValue !== null
      ? customValue
      : this.calculateFormulaLimit(reputationScore);
    const dailyUsed = await this.getDailyVolume(userId);
    const remaining = Math.max(0, dailyLimit - dailyUsed);

    return {
      allowed: amount <= remaining,
      dailyLimit,
      dailyUsed,
      remaining,
      reputationScore,
      isCustomLimit,
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
    isCustomLimit: boolean;
    customLimitNote?: string;
    formulaLimit: number;
    nextMilestone: { reputation: number; limit: number } | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        reputationScore: true,
        customDailyLimit: true,
        customDailyLimitStr: true,
        customLimitNote: true,
      }
    });

    const reputationScore = user?.reputationScore || 0;
    const formulaLimit = this.calculateFormulaLimit(reputationScore);
    // MIGRATION (H-8): Preferir customDailyLimitStr se disponível
    const isCustomLimit = (user?.customDailyLimitStr != null) || (user?.customDailyLimit != null);
    const customValue = user?.customDailyLimitStr != null
      ? parseFloat(user.customDailyLimitStr)
      : user?.customDailyLimit ?? null;
    const dailyLimit = isCustomLimit && customValue !== null ? customValue : formulaLimit;
    const dailyUsed = await this.getDailyVolume(userId);
    const remaining = Math.max(0, dailyLimit - dailyUsed);

    // Calcular proximo milestone de reputacao
    let nextMilestone = null;
    if (reputationScore < 100) {
      const nextRep = Math.min(100, reputationScore + 10);
      nextMilestone = {
        reputation: nextRep,
        limit: this.calculateFormulaLimit(nextRep),
      };
    }

    return {
      dailyLimit,
      dailyUsed,
      remaining,
      reputationScore,
      isCustomLimit,
      customLimitNote: isCustomLimit ? (user?.customLimitNote || undefined) : undefined,
      formulaLimit,
      nextMilestone,
    };
  }
}

export const limitService = new LimitService();
