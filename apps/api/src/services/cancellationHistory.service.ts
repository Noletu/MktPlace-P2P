/**
 * Cancellation History Service
 *
 * Gerencia o histórico de cancelamentos de pedidos.
 * Registra detalhadamente cada cancelamento para auditoria e análise.
 */

import { PrismaClient, CancellationHistory } from '@prisma/client';
import {
  CreateCancellationHistoryInput,
  CancellationReason,
  UserRole,
} from '../types/cancellation.types';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class CancellationHistoryService {
  /**
   * Cria registro de cancelamento no histórico
   */
  async create(input: CreateCancellationHistoryInput): Promise<CancellationHistory> {
    try {
      const history = await prisma.cancellationHistory.create({
        data: {
          userId: input.userId,
          orderId: input.orderId,
          role: input.role,
          reason: input.reason,
          note: input.note,
          penaltyApplied: input.penaltyApplied,
          penaltyPoints: input.penaltyPoints,
          reputationBefore: input.reputationBefore,
          reputationAfter: input.reputationAfter,
          orderStatus: input.orderStatus,
          orderValue: input.orderValue,
        },
      });

      logger.info(`[CANCELLATION_HISTORY] Created record:`, {
        id: history.id,
        userId: input.userId,
        orderId: input.orderId,
        role: input.role,
        reason: input.reason,
        penaltyApplied: input.penaltyApplied,
        penaltyPoints: input.penaltyPoints,
      });

      return history;
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error creating record:', error);
      throw error;
    }
  }

  /**
   * Busca histórico de cancelamentos de um usuário
   */
  async getUserHistory(
    userId: string,
    options?: {
      role?: UserRole;
      limit?: number;
      offset?: number;
    }
  ): Promise<CancellationHistory[]> {
    try {
      const history = await prisma.cancellationHistory.findMany({
        where: {
          userId,
          ...(options?.role && { role: options.role }),
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit,
        skip: options?.offset,
        include: {
          order: {
            select: {
              id: true,
              type: true,
              cryptoType: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      return history;
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error getting user history:', error);
      throw error;
    }
  }

  /**
   * Busca histórico de cancelamentos de um pedido
   */
  async getOrderHistory(orderId: string): Promise<CancellationHistory[]> {
    try {
      const history = await prisma.cancellationHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              reputationScore: true,
            },
          },
        },
      });

      return history;
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error getting order history:', error);
      throw error;
    }
  }

  /**
   * Conta cancelamentos de um usuário em um período
   */
  async countUserCancellations(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    role?: UserRole
  ): Promise<number> {
    try {
      const count = await prisma.cancellationHistory.count({
        where: {
          userId,
          ...(role && { role }),
          ...(startDate && { createdAt: { gte: startDate } }),
          ...(endDate && { createdAt: { lte: endDate } }),
        },
      });

      return count;
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error counting cancellations:', error);
      throw error;
    }
  }

  /**
   * Obtém cancelamentos recentes de um usuário (últimos N dias)
   */
  async getRecentCancellations(
    userId: string,
    days: number = 30
  ): Promise<CancellationHistory[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const history = await prisma.cancellationHistory.findMany({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
      });

      return history;
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error getting recent cancellations:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de cancelamento por motivo
   */
  async getCancellationsByReason(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ reason: CancellationReason; count: number }[]> {
    try {
      const results = await prisma.cancellationHistory.groupBy({
        by: ['reason'],
        where: {
          ...(userId && { userId }),
          ...(startDate && { createdAt: { gte: startDate } }),
          ...(endDate && { createdAt: { lte: endDate } }),
        },
        _count: { reason: true },
        orderBy: { _count: { reason: 'desc' } },
      });

      return results.map((r) => ({
        reason: r.reason as CancellationReason,
        count: r._count.reason,
      }));
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error getting cancellations by reason:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de penalidades aplicadas
   */
  async getPenaltyStats(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalPenalties: number;
    totalPoints: number;
    averagePoints: number;
    maxPoints: number;
  }> {
    try {
      const stats = await prisma.cancellationHistory.aggregate({
        where: {
          ...(userId && { userId }),
          penaltyApplied: true,
          ...(startDate && { createdAt: { gte: startDate } }),
          ...(endDate && { createdAt: { lte: endDate } }),
        },
        _count: { id: true },
        _sum: { penaltyPoints: true },
        _avg: { penaltyPoints: true },
        _max: { penaltyPoints: true },
      });

      return {
        totalPenalties: stats._count.id,
        totalPoints: stats._sum.penaltyPoints || 0,
        averagePoints: stats._avg.penaltyPoints || 0,
        maxPoints: stats._max.penaltyPoints || 0,
      };
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error getting penalty stats:', error);
      throw error;
    }
  }

  /**
   * Verifica se usuário tem padrão de cancelamento suspeito
   *
   * Retorna true se:
   * - 5+ cancelamentos nos últimos 30 dias
   * - 3+ cancelamentos pelo mesmo motivo nos últimos 7 dias
   * - 10+ cancelamentos no mesmo papel (seller/buyer) nos últimos 60 dias
   */
  async hasSuspiciousCancellationPattern(userId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    details: {
      recentCount: number;
      sameReasonCount: number;
      roleBasedCount: number;
    };
  }> {
    try {
      const reasons: string[] = [];

      // 1. Verificar cancelamentos recentes (30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentCount = await this.countUserCancellations(userId, thirtyDaysAgo);
      if (recentCount >= 5) {
        reasons.push(`${recentCount} cancelamentos nos últimos 30 dias`);
      }

      // 2. Verificar mesmo motivo repetido (7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const reasonCounts = await this.getCancellationsByReason(userId, sevenDaysAgo);
      const maxSameReason = Math.max(...reasonCounts.map((r) => r.count), 0);
      if (maxSameReason >= 3) {
        const topReason = reasonCounts.find((r) => r.count === maxSameReason);
        reasons.push(
          `${maxSameReason} cancelamentos pelo motivo "${topReason?.reason}" em 7 dias`
        );
      }

      // 3. Verificar mesmo papel (60 dias)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const sellerCount = await this.countUserCancellations(
        userId,
        sixtyDaysAgo,
        undefined,
        UserRole.SELLER
      );
      const buyerCount = await this.countUserCancellations(
        userId,
        sixtyDaysAgo,
        undefined,
        UserRole.BUYER
      );
      const maxRoleCount = Math.max(sellerCount, buyerCount);

      if (maxRoleCount >= 10) {
        const role = sellerCount > buyerCount ? 'vendedor' : 'comprador';
        reasons.push(`${maxRoleCount} cancelamentos como ${role} em 60 dias`);
      }

      return {
        isSuspicious: reasons.length > 0,
        reasons,
        details: {
          recentCount,
          sameReasonCount: maxSameReason,
          roleBasedCount: maxRoleCount,
        },
      };
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error checking suspicious pattern:', error);
      throw error;
    }
  }

  /**
   * Busca todos os cancelamentos (para admin)
   */
  async getAllCancellations(options?: {
    limit?: number;
    offset?: number;
    userId?: string;
    role?: UserRole;
    penaltyApplied?: boolean;
    orderBy?: 'recent' | 'points';
  }): Promise<CancellationHistory[]> {
    try {
      const history = await prisma.cancellationHistory.findMany({
        where: {
          ...(options?.userId && { userId: options.userId }),
          ...(options?.role && { role: options.role }),
          ...(options?.penaltyApplied !== undefined && {
            penaltyApplied: options.penaltyApplied,
          }),
        },
        orderBy:
          options?.orderBy === 'points'
            ? { penaltyPoints: 'desc' }
            : { createdAt: 'desc' },
        take: options?.limit,
        skip: options?.offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              reputationScore: true,
              totalCancellations: true,
            },
          },
          order: {
            select: {
              id: true,
              type: true,
              cryptoType: true,
              status: true,
            },
          },
        },
      });

      return history;
    } catch (error) {
      logger.error('[CANCELLATION_HISTORY] Error getting all cancellations:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const cancellationHistoryService = new CancellationHistoryService();
