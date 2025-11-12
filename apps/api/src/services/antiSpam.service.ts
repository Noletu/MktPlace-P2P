import { prisma } from '../utils/prisma';
import { OrderStatus } from '@mktplace/shared';

/**
 * Serviço Anti-Spam para Cancelamentos
 *
 * Implementa 3 medidas de proteção:
 * 1. Rate Limiting: Máximo 3 cancelamentos PENDING por dia
 * 2. Cooldown: Mínimo 15 minutos entre criação e cancelamento
 * 3. Soft Warning: Alertas progressivos após muitos cancelamentos
 */

// Configurações
const CONFIG = {
  // Rate Limiting
  MAX_PENDING_CANCELLATIONS_PER_DAY: 3,
  RATE_LIMIT_WINDOW_HOURS: 24,

  // Cooldown
  MIN_MINUTES_BEFORE_CANCEL: 15,

  // Soft Warning
  WARNING_THRESHOLD: 5,      // 5 cancelamentos em 7 dias = aviso
  RESTRICTION_THRESHOLD: 10, // 10 cancelamentos em 7 dias = cooldown 24h
  PENALTY_THRESHOLD: 15,     // 15 cancelamentos em 7 dias = penalidade reputação
  WARNING_WINDOW_DAYS: 7,
  RESTRICTION_COOLDOWN_HOURS: 24,
  PENALTY_POINTS: 5,
};

export interface AntiSpamCheckResult {
  allowed: boolean;
  reason?: string;
  warningMessage?: string;
  cooldownUntil?: Date;
  pendingCancellationsToday?: number;
  recentCancellationsCount?: number;
}

export class AntiSpamService {
  /**
   * Verificar se usuário pode cancelar pedido PENDING
   */
  async canCancelPendingOrder(
    userId: string,
    orderId: string
  ): Promise<AntiSpamCheckResult> {
    // 1. Verificar cooldown de criação
    const cooldownCheck = await this.checkCreationCooldown(orderId);
    if (!cooldownCheck.allowed) {
      return cooldownCheck;
    }

    // 2. Verificar rate limiting (3 por dia)
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck;
    }

    // 3. Verificar soft warning progressivo
    const warningCheck = await this.checkSoftWarning(userId);
    if (!warningCheck.allowed) {
      return warningCheck;
    }

    // Tudo OK, mas incluir warning se estiver próximo do limite
    return {
      allowed: true,
      warningMessage: warningCheck.warningMessage,
      pendingCancellationsToday: rateLimitCheck.pendingCancellationsToday,
      recentCancellationsCount: warningCheck.recentCancellationsCount,
    };
  }

  /**
   * 1. COOLDOWN: Pedido só pode ser cancelado após 15 minutos da criação
   */
  private async checkCreationCooldown(orderId: string): Promise<AntiSpamCheckResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { createdAt: true },
    });

    if (!order) {
      return { allowed: false, reason: 'Pedido não encontrado' };
    }

    const now = new Date();
    const createdAt = new Date(order.createdAt);
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / 1000 / 60;

    if (minutesSinceCreation < CONFIG.MIN_MINUTES_BEFORE_CANCEL) {
      const remainingMinutes = Math.ceil(CONFIG.MIN_MINUTES_BEFORE_CANCEL - minutesSinceCreation);
      return {
        allowed: false,
        reason: `Por favor, aguarde ${remainingMinutes} minuto(s) antes de cancelar este pedido. Isso evita cancelamentos impulsivos.`,
      };
    }

    return { allowed: true };
  }

  /**
   * 2. RATE LIMITING: Máximo 3 cancelamentos PENDING por dia
   */
  private async checkRateLimit(userId: string): Promise<AntiSpamCheckResult> {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - CONFIG.RATE_LIMIT_WINDOW_HOURS);

    // Contar cancelamentos PENDING nas últimas 24h
    const recentCancellations = await prisma.cancellationHistory.count({
      where: {
        userId,
        createdAt: { gte: last24Hours },
        orderStatus: OrderStatus.PENDING, // Só contar cancelamentos de pedidos PENDING
      },
    });

    if (recentCancellations >= CONFIG.MAX_PENDING_CANCELLATIONS_PER_DAY) {
      return {
        allowed: false,
        reason: `Você atingiu o limite de ${CONFIG.MAX_PENDING_CANCELLATIONS_PER_DAY} cancelamentos por dia. Tente novamente em 24 horas. Isso evita spam no marketplace.`,
        pendingCancellationsToday: recentCancellations,
      };
    }

    // Aviso se estiver próximo do limite
    let warningMessage: string | undefined;
    if (recentCancellations === CONFIG.MAX_PENDING_CANCELLATIONS_PER_DAY - 1) {
      warningMessage = `⚠️ Atenção: Este é seu último cancelamento permitido hoje (${recentCancellations + 1}/${CONFIG.MAX_PENDING_CANCELLATIONS_PER_DAY}).`;
    }

    return {
      allowed: true,
      warningMessage,
      pendingCancellationsToday: recentCancellations,
    };
  }

  /**
   * 3. SOFT WARNING: Alertas progressivos após muitos cancelamentos
   */
  private async checkSoftWarning(userId: string): Promise<AntiSpamCheckResult> {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - CONFIG.WARNING_WINDOW_DAYS);

    // Contar cancelamentos PENDING nos últimos 7 dias
    const recentCancellations = await prisma.cancellationHistory.count({
      where: {
        userId,
        createdAt: { gte: last7Days },
        orderStatus: OrderStatus.PENDING,
      },
    });

    // NÍVEL 3: 15+ cancelamentos = PENALIDADE DE REPUTAÇÃO
    if (recentCancellations >= CONFIG.PENALTY_THRESHOLD) {
      // Aplicar penalidade de reputação (apenas uma vez)
      await this.applySpamPenalty(userId, recentCancellations);

      return {
        allowed: false,
        reason: `Você cancelou ${recentCancellations} pedidos em 7 dias. Por comportamento suspeito de spam, você foi penalizado com -${CONFIG.PENALTY_POINTS} pontos de reputação e não pode criar novos pedidos por 24 horas.`,
        recentCancellationsCount: recentCancellations,
      };
    }

    // NÍVEL 2: 10-14 cancelamentos = BLOQUEIO TEMPORÁRIO (24h)
    if (recentCancellations >= CONFIG.RESTRICTION_THRESHOLD) {
      // Verificar se já existe um cooldown ativo
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true }, // Vamos usar um campo customizado se necessário
      });

      return {
        allowed: false,
        reason: `Você cancelou ${recentCancellations} pedidos em 7 dias. Por segurança, você precisa aguardar 24 horas antes de cancelar mais pedidos. Isso evita comportamento de spam.`,
        recentCancellationsCount: recentCancellations,
      };
    }

    // NÍVEL 1: 5-9 cancelamentos = AVISO
    if (recentCancellations >= CONFIG.WARNING_THRESHOLD) {
      return {
        allowed: true,
        warningMessage: `⚠️ Aviso: Você cancelou ${recentCancellations} pedidos nos últimos 7 dias. Se continuar, poderá sofrer restrições temporárias.`,
        recentCancellationsCount: recentCancellations,
      };
    }

    // Tudo OK
    return {
      allowed: true,
      recentCancellationsCount: recentCancellations,
    };
  }

  /**
   * Aplicar penalidade de reputação por spam
   */
  private async applySpamPenalty(userId: string, cancellationCount: number): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true, totalCancellations: true },
    });

    if (!user) return;

    // Só aplicar penalidade uma vez (verificar se já foi aplicada recentemente)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const recentSpamPenalty = await prisma.cancellationHistory.findFirst({
      where: {
        userId,
        createdAt: { gte: last24Hours },
        note: { contains: 'SPAM_PENALTY' },
      },
    });

    if (recentSpamPenalty) {
      // Já foi penalizado nas últimas 24h, não aplicar novamente
      return;
    }

    // Aplicar penalidade
    const newReputation = Math.max(0, user.reputationScore - CONFIG.PENALTY_POINTS);

    await prisma.user.update({
      where: { id: userId },
      data: { reputationScore: newReputation },
    });

    // Registrar no histórico
    await prisma.cancellationHistory.create({
      data: {
        userId,
        orderId: 'SPAM_DETECTION', // Identificador especial
        role: 'SELLER',
        reason: 'OTHER',
        note: `SPAM_PENALTY: ${cancellationCount} cancelamentos em 7 dias. Penalidade: -${CONFIG.PENALTY_POINTS} pontos.`,
        penaltyApplied: true,
        penaltyPoints: CONFIG.PENALTY_POINTS,
        reputationBefore: user.reputationScore,
        reputationAfter: newReputation,
        orderStatus: OrderStatus.PENDING,
        orderValue: '0',
      },
    });

    console.log(`🚨 [ANTI-SPAM] Penalidade aplicada: userId=${userId}, cancelamentos=${cancellationCount}, penalidade=-${CONFIG.PENALTY_POINTS}`);
  }

  /**
   * Obter estatísticas de cancelamento do usuário (para exibir no frontend)
   */
  async getUserCancellationStats(userId: string): Promise<{
    pendingCancellationsToday: number;
    pendingCancellationsLast7Days: number;
    totalCancellations: number;
    canCancel: boolean;
    warningLevel: 'none' | 'warning' | 'restricted' | 'penalized';
  }> {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const [pendingCancellationsToday, pendingCancellationsLast7Days, user] = await Promise.all([
      prisma.cancellationHistory.count({
        where: {
          userId,
          createdAt: { gte: last24Hours },
          orderStatus: OrderStatus.PENDING,
        },
      }),
      prisma.cancellationHistory.count({
        where: {
          userId,
          createdAt: { gte: last7Days },
          orderStatus: OrderStatus.PENDING,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { totalCancellations: true },
      }),
    ]);

    // Determinar nível de aviso
    let warningLevel: 'none' | 'warning' | 'restricted' | 'penalized' = 'none';
    let canCancel = true;

    if (pendingCancellationsLast7Days >= CONFIG.PENALTY_THRESHOLD) {
      warningLevel = 'penalized';
      canCancel = false;
    } else if (pendingCancellationsLast7Days >= CONFIG.RESTRICTION_THRESHOLD) {
      warningLevel = 'restricted';
      canCancel = false;
    } else if (pendingCancellationsLast7Days >= CONFIG.WARNING_THRESHOLD) {
      warningLevel = 'warning';
    }

    if (pendingCancellationsToday >= CONFIG.MAX_PENDING_CANCELLATIONS_PER_DAY) {
      canCancel = false;
    }

    return {
      pendingCancellationsToday,
      pendingCancellationsLast7Days,
      totalCancellations: user?.totalCancellations || 0,
      canCancel,
      warningLevel,
    };
  }
}

export const antiSpamService = new AntiSpamService();
