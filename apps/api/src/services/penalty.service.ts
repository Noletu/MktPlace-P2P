/**
 * Penalty Service
 *
 * Gerencia o sistema de penalidades por cancelamentos e má fé.
 * Implementa lógica híbrida: progressiva + frequência temporal.
 */

import { PrismaClient } from '@prisma/client';
import {
  PenaltyCalculation,
  PenaltySeverity,
  DEFAULT_PENALTY_CONFIG,
  PenaltyConfig,
  CancellationStats,
  UserRole,
} from '../types/cancellation.types';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class PenaltyService {
  private config: PenaltyConfig;

  constructor(config: PenaltyConfig = DEFAULT_PENALTY_CONFIG) {
    this.config = config;
  }

  /**
   * Calcula penalidade híbrida para um cancelamento
   *
   * Combina:
   * 1. Penalidade progressiva (baseada em total de cancelamentos)
   * 2. Penalidade por frequência (cancelamentos nos últimos 30 dias)
   *
   * Usa o MAIOR valor entre os dois métodos.
   */
  async calculateCancellationPenalty(
    userId: string,
    role: UserRole
  ): Promise<PenaltyCalculation> {
    try {
      // Buscar dados do usuário
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalCancellations: true,
          recentCancellations: true,
          lastCancellationAt: true,
          reputationScore: true,
        },
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Contar cancelamentos nos últimos 30 dias (verificação real)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.config.recentWindowDays);

      const recentCount = await prisma.cancellationHistory.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      // Atualizar contador se necessário
      if (recentCount !== user.recentCancellations) {
        await prisma.user.update({
          where: { id: userId },
          data: { recentCancellations: recentCount },
        });
      }

      // Calcular com base em PRÓXIMO cancelamento (total + 1)
      const nextTotalCount = user.totalCancellations + 1;
      const nextRecentCount = recentCount + 1;

      // 1. PENALIDADE PROGRESSIVA (baseada em total histórico)
      const progressivePenalty = this.calculateProgressivePenalty(nextTotalCount);

      // 2. PENALIDADE POR FREQUÊNCIA (baseada em últimos 30 dias)
      const frequencyPenalty = this.calculateFrequencyPenalty(nextRecentCount);

      // ESCOLHE O MAIOR (lógica híbrida)
      const penaltyPoints = Math.max(progressivePenalty, frequencyPenalty);

      // Determinar severidade
      const severity = this.determineSeverity(penaltyPoints);

      // Verificar se deve aplicar penalidade
      const shouldApplyPenalty = penaltyPoints > 0;

      // Montar mensagem explicativa
      const message = this.buildPenaltyMessage(
        severity,
        nextTotalCount,
        nextRecentCount,
        penaltyPoints,
        role
      );

      logger.info(`[PENALTY] Calculated for user ${userId}:`, {
        role,
        totalCancellations: nextTotalCount,
        recentCancellations: nextRecentCount,
        progressivePenalty,
        frequencyPenalty,
        finalPenalty: penaltyPoints,
        severity,
      });

      return {
        shouldApplyPenalty,
        penaltyPoints,
        severity,
        totalCancellations: nextTotalCount,
        recentCancellations: nextRecentCount,
        message,
        reputationImpact: -penaltyPoints,
      };
    } catch (error) {
      logger.error('[PENALTY] Error calculating penalty:', error);
      throw error;
    }
  }

  /**
   * Calcula penalidade progressiva baseada em total de cancelamentos
   */
  private calculateProgressivePenalty(totalCount: number): number {
    const { progressive } = this.config;

    if (totalCount === 1) return progressive.first; // 0
    if (totalCount === 2) return progressive.second; // 5
    if (totalCount === 3) return progressive.third; // 10
    if (totalCount === 4 || totalCount === 5) return progressive.fourthFifth; // 15
    return progressive.sixth; // 20
  }

  /**
   * Calcula penalidade por frequência (últimos 30 dias)
   */
  private calculateFrequencyPenalty(recentCount: number): number {
    const { frequency } = this.config;

    if (recentCount <= frequency.low.threshold) {
      return frequency.low.points; // 0
    }
    if (recentCount <= frequency.medium.threshold) {
      return frequency.medium.points; // 15
    }
    return frequency.high.points; // 30
  }

  /**
   * Determina severidade baseada em pontos
   */
  private determineSeverity(points: number): PenaltySeverity {
    if (points === 0) return PenaltySeverity.NONE;
    if (points <= 5) return PenaltySeverity.WARNING;
    if (points <= 15) return PenaltySeverity.MINOR;
    if (points <= 30) return PenaltySeverity.MAJOR;
    return PenaltySeverity.CRITICAL;
  }

  /**
   * Constrói mensagem explicativa da penalidade
   */
  private buildPenaltyMessage(
    severity: PenaltySeverity,
    totalCount: number,
    recentCount: number,
    points: number,
    role: UserRole
  ): string {
    const roleText = role === UserRole.SELLER ? 'vendedor' : 'comprador';

    if (severity === PenaltySeverity.NONE) {
      return `Primeira vez cancelando como ${roleText}. Sem penalidade aplicada.`;
    }

    if (severity === PenaltySeverity.WARNING) {
      return `Você cancelou ${totalCount} pedidos no total. Advertência: -${points} pontos de reputação.`;
    }

    if (severity === PenaltySeverity.MINOR) {
      if (recentCount > 2) {
        return `Você cancelou ${recentCount} pedidos nos últimos 30 dias. Penalidade: -${points} pontos de reputação.`;
      }
      return `Você acumulou ${totalCount} cancelamentos. Penalidade: -${points} pontos de reputação.`;
    }

    if (severity === PenaltySeverity.MAJOR) {
      return `⚠️ ATENÇÃO: Você cancelou ${recentCount} pedidos recentemente (30 dias). Penalidade severa: -${points} pontos de reputação. Continue assim e sua conta pode ser suspensa.`;
    }

    return `🚨 CRÍTICO: Padrão de cancelamentos abusivo detectado. Penalidade máxima: -${points} pontos.`;
  }

  /**
   * Aplica penalidade na reputação do usuário
   */
  async applyReputationPenalty(
    userId: string,
    penaltyPoints: number,
    reason: string
  ): Promise<{ oldReputation: number; newReputation: number }> {
    try {
      const { reputationService } = await import('./reputation.service');

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          reputationScore: true,
          totalCancellations: true,
          recentCancellations: true,
        },
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const oldReputation = user.reputationScore;

      // Atualizar SOMENTE contadores de cancelamento — reputacao sera recalculada
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalCancellations: user.totalCancellations + 1,
          recentCancellations: user.recentCancellations + 1,
          lastCancellationAt: new Date(),
        },
      });

      // Recalcular score composto (leva em conta cancelamentos recentes)
      const newReputation = await reputationService.recalculateAndSave(userId);

      logger.info(`[PENALTY] Applied cancellation penalty to user ${userId}:`, {
        reason,
        oldReputation,
        newReputation,
        penaltyPoints,
        totalCancellations: user.totalCancellations + 1,
      });

      return { oldReputation, newReputation };
    } catch (error) {
      logger.error('[PENALTY] Error applying reputation penalty:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de cancelamento de um usuário
   */
  async getCancellationStats(userId: string): Promise<CancellationStats> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalCancellations: true,
          recentCancellations: true,
          lastCancellationAt: true,
        },
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Contar por role
      const cancellationsAsSeller = await prisma.cancellationHistory.count({
        where: { userId, role: UserRole.SELLER },
      });

      const cancellationsAsBuyer = await prisma.cancellationHistory.count({
        where: { userId, role: UserRole.BUYER },
      });

      // Calcular pontos totais
      const penaltyData = await prisma.cancellationHistory.aggregate({
        where: { userId },
        _sum: { penaltyPoints: true },
        _avg: { penaltyPoints: true },
      });

      const totalPenaltyPoints = penaltyData._sum.penaltyPoints || 0;
      const averagePenaltyPoints = penaltyData._avg.penaltyPoints || 0;

      // Motivo mais comum
      const reasonCounts = await prisma.cancellationHistory.groupBy({
        by: ['reason'],
        where: { userId },
        _count: { reason: true },
        orderBy: { _count: { reason: 'desc' } },
        take: 1,
      });

      const mostCommonReason = reasonCounts[0]?.reason as any;

      return {
        userId,
        totalCancellations: user.totalCancellations,
        recentCancellations: user.recentCancellations,
        lastCancellationAt: user.lastCancellationAt || undefined,
        cancellationsAsSeller,
        cancellationsAsBuyer,
        totalPenaltyPoints,
        averagePenaltyPoints,
        mostCommonReason,
      };
    } catch (error) {
      logger.error('[PENALTY] Error getting cancellation stats:', error);
      throw error;
    }
  }

  /**
   * Reseta contadores de cancelamentos recentes (últimos 30 dias)
   * Deve ser executado diariamente por um worker/cron
   */
  async resetRecentCancellations(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.config.recentWindowDays);

      // Buscar usuários que têm cancelamentos recentes
      const usersWithRecentCancellations = await prisma.user.findMany({
        where: {
          recentCancellations: { gt: 0 },
        },
        select: { id: true },
      });

      let updatedCount = 0;

      // Para cada usuário, recalcular cancelamentos recentes
      for (const user of usersWithRecentCancellations) {
        const recentCount = await prisma.cancellationHistory.count({
          where: {
            userId: user.id,
            createdAt: { gte: thirtyDaysAgo },
          },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { recentCancellations: recentCount },
        });

        updatedCount++;
      }

      logger.info(`[PENALTY] Reset recent cancellations for ${updatedCount} users`);
      return updatedCount;
    } catch (error) {
      logger.error('[PENALTY] Error resetting recent cancellations:', error);
      throw error;
    }
  }

  /**
   * Verifica se usuário deve receber advertência antes de cancelar
   */
  async shouldWarnBeforeCancellation(userId: string): Promise<{
    shouldWarn: boolean;
    warningMessage?: string;
    cancellationCount: number;
    nextPenaltyPoints: number;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalCancellations: true,
          recentCancellations: true,
        },
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Calcular penalidade para próximo cancelamento
      const penalty = await this.calculateCancellationPenalty(userId, UserRole.SELLER);

      // Advertir se:
      // 1. Já tem 2+ cancelamentos E
      // 2. Próxima penalidade será >= 10 pontos
      const shouldWarn =
        user.totalCancellations >= 2 && penalty.penaltyPoints >= 10;

      let warningMessage: string | undefined;
      if (shouldWarn) {
        warningMessage = `⚠️ Você já cancelou ${user.totalCancellations} pedidos. Cancelar este pedido resultará em -${penalty.penaltyPoints} pontos de reputação.`;
      }

      return {
        shouldWarn,
        warningMessage,
        cancellationCount: user.totalCancellations,
        nextPenaltyPoints: penalty.penaltyPoints,
      };
    } catch (error) {
      logger.error('[PENALTY] Error checking warning:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const penaltyService = new PenaltyService();
