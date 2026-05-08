import { prisma } from '../utils/prisma';
import { OrderStatus } from '@mktplace/shared';

/**
 * Serviço Anti-Spam para Cancelamentos
 *
 * Implementa 3 medidas de proteção:
 * 1. Burst Cooldown: 5 cancelamentos em 15 min → cooldown de 15 min
 * 2. Rate Limiting: Máximo de cancelamentos PENDING por dia
 * 3. Soft Warning: Alertas progressivos após muitos cancelamentos em 7 dias
 */

// Configurações
const CONFIG = {
  // Burst Cooldown (substitui o antigo cooldown por pedido)
  BURST_MAX_CANCELLATIONS: 5,     // Máx cancelamentos permitidos na janela
  BURST_WINDOW_MINUTES: 15,       // Janela de detecção (15 min)
  BURST_COOLDOWN_MINUTES: 15,     // Cooldown após estourar o burst

  // Rate Limiting
  MAX_PENDING_CANCELLATIONS_PER_DAY: 10,
  RATE_LIMIT_WINDOW_HOURS: 24,

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
    _orderId: string
  ): Promise<AntiSpamCheckResult> {
    // 1. Verificar burst cooldown (5 cancelamentos em 15 min → esperar 15 min)
    const burstCheck = await this.checkBurstCooldown(userId);
    if (!burstCheck.allowed) {
      return burstCheck;
    }

    // 2. Verificar rate limiting diário
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
      warningMessage: burstCheck.warningMessage || warningCheck.warningMessage,
      pendingCancellationsToday: rateLimitCheck.pendingCancellationsToday,
      recentCancellationsCount: warningCheck.recentCancellationsCount,
    };
  }

  /**
   * 1. BURST COOLDOWN: Se cancelou 5x em 15 min, bloqueia por 15 min
   * Permite cancelamentos rápidos para corrigir erros de preenchimento,
   * mas impede spam de criar/cancelar repetidamente.
   */
  private async checkBurstCooldown(userId: string): Promise<AntiSpamCheckResult> {
    const burstWindow = new Date();
    burstWindow.setMinutes(burstWindow.getMinutes() - CONFIG.BURST_WINDOW_MINUTES);

    // Contar cancelamentos PENDING na janela de burst
    const recentCancellations = await prisma.cancellationHistory.findMany({
      where: {
        userId,
        createdAt: { gte: burstWindow },
        orderStatus: OrderStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (recentCancellations.length >= CONFIG.BURST_MAX_CANCELLATIONS) {
      // Calcular quando o cooldown termina (15 min após o 5º cancelamento)
      const oldestInBurst = recentCancellations[recentCancellations.length - 1];
      const cooldownEnd = new Date(oldestInBurst.createdAt.getTime() + CONFIG.BURST_COOLDOWN_MINUTES * 60 * 1000);
      const now = new Date();

      if (now < cooldownEnd) {
        const remainingMinutes = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000 / 60);
        return {
          allowed: false,
          reason: `Você cancelou ${CONFIG.BURST_MAX_CANCELLATIONS} pedidos em menos de ${CONFIG.BURST_WINDOW_MINUTES} minutos. Aguarde ${remainingMinutes} minuto(s) antes de cancelar novamente.`,
          cooldownUntil: cooldownEnd,
        };
      }
    }

    // Aviso se estiver próximo do limite de burst
    if (recentCancellations.length === CONFIG.BURST_MAX_CANCELLATIONS - 1) {
      return {
        allowed: true,
        warningMessage: `⚠️ Atenção: Mais um cancelamento e você entrará em cooldown de ${CONFIG.BURST_COOLDOWN_MINUTES} minutos.`,
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
    burstCancellationsRecent: number;
    totalCancellations: number;
    canCancel: boolean;
    warningLevel: 'none' | 'warning' | 'restricted' | 'penalized';
  }> {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const burstWindow = new Date();
    burstWindow.setMinutes(burstWindow.getMinutes() - CONFIG.BURST_WINDOW_MINUTES);

    const [pendingCancellationsToday, pendingCancellationsLast7Days, burstCancellationsRecent, user] = await Promise.all([
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
      prisma.cancellationHistory.count({
        where: {
          userId,
          createdAt: { gte: burstWindow },
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

    if (burstCancellationsRecent >= CONFIG.BURST_MAX_CANCELLATIONS) {
      canCancel = false;
    }

    return {
      pendingCancellationsToday,
      pendingCancellationsLast7Days,
      burstCancellationsRecent,
      totalCancellations: user?.totalCancellations || 0,
      canCancel,
      warningLevel,
    };
  }
}

export const antiSpamService = new AntiSpamService();
