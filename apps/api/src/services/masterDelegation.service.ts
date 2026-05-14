import { MasterDelegation } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { emailService } from './email.service';

export class MasterDelegationService {
  /**
   * Cria uma delegação temporária de aprovação.
   * grantor deve ser MASTER; grantee deve ser GERENTE ou ADMIN (nível 60-80).
   */
  static async create(params: {
    grantorId: string;
    granteeId: string;
    operationScope: string[];
    reason: string;
    expiryHours: number;
  }): Promise<MasterDelegation> {
    const { grantorId, granteeId, operationScope, reason, expiryHours } = params;

    if (expiryHours < 1 || expiryHours > 720) {
      throw new Error('O prazo deve ser entre 1 hora e 720 horas (30 dias).');
    }

    // Verifica grantee
    const grantee = await prisma.user.findUnique({
      where: { id: granteeId },
      select: { id: true, name: true, email: true, role: { select: { level: true, slug: true } } },
    });
    if (!grantee) throw new Error('Usuário delegado não encontrado.');
    const granteeLevel = grantee.role?.level ?? 0;
    if (granteeLevel < 60 || granteeLevel >= 100) {
      throw new Error('O delegado deve ter nível GERENTE ou ADMIN (60-80).');
    }

    // Não pode ter delegação ativa
    const existing = await prisma.masterDelegation.findFirst({
      where: { granteeId, isRevoked: false, expiresAt: { gt: new Date() } },
    });
    if (existing) throw new Error('Este usuário já possui uma delegação ativa.');

    // Grantor info para email
    const grantor = await prisma.user.findUnique({
      where: { id: grantorId },
      select: { name: true, email: true },
    });

    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const delegation = await prisma.masterDelegation.create({
      data: {
        grantorId,
        granteeId,
        operationScope: JSON.stringify(operationScope),
        reason,
        expiresAt,
      },
    });

    // Notifica todos os MASTERs
    const masters = await MasterDelegationService.getAllMasters();
    for (const master of masters) {
      try {
        await emailService.sendDelegationCreatedEmail(master.email!, {
          grantorName: grantor?.name ?? grantorId,
          granteeName: grantee.name ?? granteeId,
          scope: operationScope,
          expiresAt,
          reason,
        });
      } catch (err) {
        console.error('[MasterDelegationService] Error sending delegation email:', err);
      }
    }

    return delegation;
  }

  /**
   * Revoga uma delegação imediatamente.
   * Qualquer MASTER pode revogar qualquer delegação ativa.
   */
  static async revoke(params: {
    delegationId: string;
    revokedById: string;
    revokeReason: string;
  }): Promise<MasterDelegation> {
    const { delegationId, revokedById, revokeReason } = params;

    const delegation = await prisma.masterDelegation.findUnique({
      where: { id: delegationId },
    });
    if (!delegation) throw new Error('Delegação não encontrada.');
    if (delegation.isRevoked) throw new Error('Delegação já está revogada.');

    return prisma.masterDelegation.update({
      where: { id: delegationId },
      data: {
        isRevoked: true,
        revokedById,
        revokedAt: new Date(),
        revokeReason,
      },
    });
  }

  /**
   * Lista delegações com filtros opcionais.
   */
  static async list(filters: {
    granteeId?: string;
    grantorId?: string;
    activeOnly?: boolean;
  } = {}): Promise<MasterDelegation[]> {
    const where: Record<string, unknown> = {};
    if (filters.granteeId) where.granteeId = filters.granteeId;
    if (filters.grantorId) where.grantorId = filters.grantorId;
    if (filters.activeOnly) {
      where.isRevoked = false;
      where.expiresAt = { gt: new Date() };
    }

    return prisma.masterDelegation.findMany({
      where,
      include: {
        grantor: { select: { id: true, name: true, email: true } },
        grantee: { select: { id: true, name: true, email: true, role: { select: { slug: true, level: true } } } },
        revokedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Verifica se um usuário tem delegação ativa que cobre um operationType específico.
   * Retorna a delegação ou null.
   */
  static async getActiveDelegationForUser(params: {
    userId: string;
    operationType: string;
  }): Promise<MasterDelegation | null> {
    const { userId, operationType } = params;

    const delegation = await prisma.masterDelegation.findFirst({
      where: {
        granteeId: userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
        startsAt: { lte: new Date() },
      },
    });

    if (!delegation) return null;

    // Verifica escopo: [] = todos os tipos
    const scope: string[] = JSON.parse(delegation.operationScope);
    if (scope.length === 0 || scope.includes(operationType)) {
      return delegation;
    }

    return null;
  }

  /**
   * Job: expira delegações vencidas (chamado a cada 5 min).
   */
  static async expireOldDelegations(): Promise<void> {
    const result = await prisma.masterDelegation.updateMany({
      where: {
        isRevoked: false,
        expiresAt: { lte: new Date() },
      },
      data: { isRevoked: true, revokedAt: new Date(), revokeReason: 'EXPIRED' },
    });
    if (result.count > 0) {
      console.log(`[MasterDelegationService] Expired ${result.count} delegation(s).`);
    }
  }

  /**
   * Retorna todos os usuários com role MASTER.
   */
  static async getAllMasters(): Promise<{ id: string; name: string | null; email: string }[]> {
    return prisma.user.findMany({
      where: { role: { slug: 'master' } },
      select: { id: true, name: true, email: true },
    });
  }
}
