import { prisma } from '../utils/prisma';
import { reviewService } from './review.service';
import { logger } from '../utils/logger';

/**
 * ReputationService — Ponto UNICO de calculo de reputacao
 *
 * Formula composta (0-100):
 * | Componente  | Peso | Calculo                                            |
 * |-------------|------|----------------------------------------------------|
 * | Reviews     | 40%  | (avgRating / 5) * 100. Se 0 reviews → 50 (neutro)  |
 * | Transacoes  | 30%  | successRate * 100 * min(1, totalTx/5)              |
 * | Disputas    | 20%  | Base 100, -20 perdida, +5 ganha, clamp 0-100       |
 * | Maturidade  | 10%  | idade + atividade recente                          |
 */

export interface ReputationBreakdown {
  reviews: { score: number; weight: number; weighted: number; details: string };
  transactions: { score: number; weight: number; weighted: number; details: string };
  disputes: { score: number; weight: number; weighted: number; details: string };
  maturity: { score: number; weight: number; weighted: number; details: string };
  finalScore: number;
}

class ReputationService {
  /**
   * Calcula score composto e salva em user.reputationScore
   */
  async recalculateAndSave(userId: string): Promise<number> {
    const breakdown = await this.calculateCompositeScore(userId);

    await prisma.user.update({
      where: { id: userId },
      data: { reputationScore: breakdown.finalScore },
    });

    logger.info(`[REPUTATION] Recalculated for user ${userId}: ${breakdown.finalScore}`, {
      reviews: breakdown.reviews.score,
      transactions: breakdown.transactions.score,
      disputes: breakdown.disputes.score,
      maturity: breakdown.maturity.score,
    });

    return breakdown.finalScore;
  }

  /**
   * Calcula score composto + retorna breakdown detalhado (para admin)
   */
  async calculateCompositeScore(userId: string): Promise<ReputationBreakdown> {
    const [reviews, transactions, disputes, maturity] = await Promise.all([
      this.calculateReviewsComponent(userId),
      this.calculateTransactionsComponent(userId),
      this.calculateDisputesComponent(userId),
      this.calculateMaturityComponent(userId),
    ]);

    const raw = (reviews.score * 0.4) + (transactions.score * 0.3) + (disputes.score * 0.2) + (maturity.score * 0.1);
    const finalScore = Math.round(Math.max(0, Math.min(100, raw)));

    return {
      reviews: { ...reviews, weight: 0.4, weighted: Math.round(reviews.score * 0.4 * 100) / 100 },
      transactions: { ...transactions, weight: 0.3, weighted: Math.round(transactions.score * 0.3 * 100) / 100 },
      disputes: { ...disputes, weight: 0.2, weighted: Math.round(disputes.score * 0.2 * 100) / 100 },
      maturity: { ...maturity, weight: 0.1, weighted: Math.round(maturity.score * 0.1 * 100) / 100 },
      finalScore,
    };
  }

  /**
   * Componente Reviews (40%)
   * (avgRating / 5) * 100. Se 0 reviews → 50 (neutro)
   */
  async calculateReviewsComponent(userId: string): Promise<{ score: number; details: string }> {
    const stats = await reviewService.getUserReviewStats(userId);

    if (stats.totalReviews === 0) {
      return { score: 50, details: 'Sem avaliacoes (neutro)' };
    }

    const score = Math.round((stats.averageRating / 5) * 100);
    return {
      score: Math.max(0, Math.min(100, score)),
      details: `${stats.totalReviews} avaliacoes, media ${stats.averageRating.toFixed(1)}/5`,
    };
  }

  /**
   * Componente Transacoes (30%)
   * successRate * 100 * min(1, totalTx/5) — penaliza falta de dados
   * Cancelamentos recentes reduzem: -25 por cancelamento recente
   */
  async calculateTransactionsComponent(userId: string): Promise<{ score: number; details: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalTransactions: true,
        successfulTransactions: true,
        recentCancellations: true,
      },
    });

    if (!user || user.totalTransactions === 0) {
      return { score: 0, details: 'Sem transacoes' };
    }

    const successRate = user.successfulTransactions / user.totalTransactions;
    const dataFactor = Math.min(1, user.totalTransactions / 5);
    let score = successRate * 100 * dataFactor;

    // Penalidade por cancelamentos recentes
    const cancellationPenalty = user.recentCancellations * 25;
    score = Math.max(0, score - cancellationPenalty);

    return {
      score: Math.round(Math.max(0, Math.min(100, score))),
      details: `${user.successfulTransactions}/${user.totalTransactions} sucesso (${(successRate * 100).toFixed(0)}%), ${user.recentCancellations} cancelamentos recentes`,
    };
  }

  /**
   * Componente Disputas (20%)
   * Base 100, -20 por disputa perdida, +5 por disputa ganha, clamp 0-100
   * Se 0 disputas → 100
   *
   * Logica de ganhas/perdidas:
   * - RESOLVED_BUYER: buyer ganhou, seller perdeu
   * - RESOLVED_SELLER: seller ganhou, buyer perdeu
   * - BUY order: order.userId = buyer, order.providerId = seller
   * - SELL order: transaction.payerId = buyer, order.userId = seller
   */
  async calculateDisputesComponent(userId: string): Promise<{ score: number; details: string }> {
    // Buscar todas as disputas resolvidas que envolvem este usuario
    const disputes = await prisma.dispute.findMany({
      where: {
        status: { in: ['RESOLVED_BUYER', 'RESOLVED_SELLER'] },
      },
      select: {
        status: true,
        order: {
          select: {
            userId: true,
            orderType: true,
            providerId: true,
            transactions: {
              select: { payerId: true },
              take: 1,
            },
          },
        },
      },
    });

    let won = 0;
    let lost = 0;

    for (const dispute of disputes) {
      const order = dispute.order;
      let buyerId: string | null = null;
      let sellerId: string | null = null;

      if (order.orderType === 'BUY') {
        buyerId = order.userId;
        sellerId = order.providerId || null;
      } else {
        // SELL order
        sellerId = order.userId;
        buyerId = order.transactions[0]?.payerId || null;
      }

      // Verificar se este usuario esta envolvido
      const isUserBuyer = buyerId === userId;
      const isUserSeller = sellerId === userId;

      if (!isUserBuyer && !isUserSeller) continue;

      if (dispute.status === 'RESOLVED_BUYER') {
        if (isUserBuyer) won++;
        if (isUserSeller) lost++;
      } else if (dispute.status === 'RESOLVED_SELLER') {
        if (isUserSeller) won++;
        if (isUserBuyer) lost++;
      }
    }

    const totalDisputes = won + lost;
    if (totalDisputes === 0) {
      return { score: 100, details: 'Sem disputas resolvidas' };
    }

    const score = Math.max(0, Math.min(100, 100 - (lost * 20) + (won * 5)));
    return {
      score,
      details: `${won} ganhas, ${lost} perdidas (total: ${totalDisputes})`,
    };
  }

  /**
   * Componente Maturidade (10%)
   * Idade: min(50, diasDesdeRegistro / 7)
   * Atividade: min(50, txUltimos90dias * 5)
   */
  async calculateMaturityComponent(userId: string): Promise<{ score: number; details: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    if (!user) {
      return { score: 0, details: 'Usuario nao encontrado' };
    }

    // Idade da conta em dias
    const daysSinceRegistration = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const ageScore = Math.min(50, daysSinceRegistration / 7);

    // Atividade: transacoes nos ultimos 90 dias
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentTxCount = await prisma.transaction.count({
      where: {
        OR: [
          { payerId: userId },
          { order: { userId: userId } },
        ],
        createdAt: { gte: ninetyDaysAgo },
        status: 'APPROVED',
      },
    });

    const activityScore = Math.min(50, recentTxCount * 5);

    const score = Math.round(ageScore + activityScore);
    return {
      score: Math.max(0, Math.min(100, score)),
      details: `${daysSinceRegistration} dias de conta, ${recentTxCount} tx nos ultimos 90 dias`,
    };
  }
}

export const reputationService = new ReputationService();
