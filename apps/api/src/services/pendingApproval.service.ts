import crypto from 'node:crypto';
import { PendingApproval } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AdminFundsService } from './adminFunds.service';
import { platformTransferService } from './platform-transfer.service';
import { MasterDelegationService } from './masterDelegation.service';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
import { twoFactorService } from './twoFactor.service';
import { clearUserPermissionCache } from '../middleware/permission.middleware';
import { auditLogService } from './auditLog.service';

const OVERRIDE_MIN_WAIT_MS =
  parseInt(process.env.DUAL_APPROVAL_OVERRIDE_MIN_WAIT_MINUTES ?? '60') * 60 * 1000;
const OVERRIDE_WINDOW_MS = 30 * 60 * 1000; // 30 minutos
const APPROVAL_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 horas
const MAX_OVERRIDES_PER_24H = 3;

const OPERATION_LABELS: Record<string, string> = {
  INTERNAL_TRANSFER:        'Transferência Interna',
  ADJUST_BALANCE:           'Ajuste de Saldo',
  PLATFORM_REFUND:          'Reembolso de Plataforma',
  LOCK_BALANCE:             'Bloqueio de Saldo',
  UNLOCK_BALANCE:           'Desbloqueio de Saldo',
  DEMOTE_MASTER:            'Rebaixamento de MASTER',
  PROMOTE_MASTER:           'Promoção para MASTER',
  PLATFORM_WALLET_TRANSFER: 'Transferência de Carteira da Plataforma',
};

export class PendingApprovalService {
  /**
   * Cria um PendingApproval ao invés de executar a operação diretamente.
   * Chamado pelo middleware requireDualApproval.
   */
  static async create(params: {
    initiatorId: string;
    operationType: string;
    operationPayload: Record<string, unknown>;
    initiatorNote?: string;
  }): Promise<PendingApproval> {
    const { initiatorId, operationType, operationPayload, initiatorNote } = params;

    const expiresAt = new Date(Date.now() + APPROVAL_EXPIRY_MS);

    const approval = await prisma.pendingApproval.create({
      data: {
        initiatorId,
        operationType,
        operationPayload: JSON.stringify(operationPayload),
        initiatorNote: initiatorNote ?? null,
        expiresAt,
      },
      include: { initiator: { select: { name: true, email: true } } },
    });

    // Notifica outros MASTERs
    const otherMasters = await PendingApprovalService.getOtherMasters(initiatorId);
    const initiatorName = (approval as any).initiator?.name ?? initiatorId;

    for (const master of otherMasters) {
      try {
        await emailService.sendNewPendingApprovalEmail(master.email, {
          initiatorName,
          operationType: OPERATION_LABELS[operationType] ?? operationType,
          approvalId: approval.id,
          expiresAt,
        });
      } catch (err) {
        console.error('[PendingApprovalService] Error sending approval email:', err);
      }

      try {
        await notificationService.createNotification({
          userId: master.id,
          type: 'PENDING_APPROVAL',
          category: 'FINANCE',
          title: '🔐 Nova Operação Aguardando Aprovação',
          message: `${initiatorName} iniciou uma operação de ${OPERATION_LABELS[operationType] ?? operationType} que requer sua aprovação.`,
          actionUrl: `/admin/aprovacoes`,
          actionLabel: 'Ver aprovação',
          priority: 'HIGH',
          metadata: { approvalId: approval.id, operationType },
        });
      } catch (err) {
        console.error('[PendingApprovalService] Error sending notification:', err);
      }
    }

    return approval;
  }

  /**
   * Lista aprovações com filtros.
   */
  static async list(filters: {
    status?: string | string[];
    initiatorId?: string;
    excludeInitiatorId?: string;
    operationType?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ items: PendingApproval[]; total: number }> {
    const { status, initiatorId, excludeInitiatorId, operationType, page = 1, pageSize = 20 } = filters;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }
    if (initiatorId) where.initiatorId = initiatorId;
    if (excludeInitiatorId) where.initiatorId = { not: excludeInitiatorId };
    if (operationType) where.operationType = operationType;

    const [items, total] = await Promise.all([
      prisma.pendingApproval.findMany({
        where,
        include: {
          initiator: { select: { id: true, name: true, email: true } },
          approver:  { select: { id: true, name: true, email: true } },
          delegation: { select: { id: true, grantee: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.pendingApproval.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Retorna uma aprovação por ID.
   */
  static async getById(approvalId: string): Promise<PendingApproval | null> {
    return prisma.pendingApproval.findUnique({
      where: { id: approvalId },
      include: {
        initiator:  { select: { id: true, name: true, email: true } },
        approver:   { select: { id: true, name: true, email: true } },
        delegation: { select: { id: true, grantee: { select: { name: true } } } },
      },
    });
  }

  /**
   * Aprova uma operação pendente e a executa.
   * approverId não pode ser igual ao initiatorId.
   */
  static async approve(params: {
    approvalId: string;
    approverId: string;
    approverNote?: string;
  }): Promise<{ approval: PendingApproval; executionResult: unknown }> {
    const { approvalId, approverId, approverNote } = params;

    const approval = await prisma.pendingApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new Error('Aprovação não encontrada.');
    if (approval.status !== 'PENDING_APPROVAL') {
      throw new Error(`Operação não está aguardando aprovação (status atual: ${approval.status}).`);
    }
    if (approval.initiatorId === approverId) {
      const err: any = new Error('Você não pode aprovar sua própria operação.');
      err.statusCode = 403;
      throw err;
    }
    if (new Date() > approval.expiresAt) {
      throw new Error('Esta aprovação já expirou.');
    }

    // Verifica elegibilidade: MASTER ou delegado
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { role: { select: { level: true } } },
    });
    const approverLevel = approver?.role?.level ?? 0;

    let delegationId: string | null = null;
    if (approverLevel < 100) {
      const delegation = await MasterDelegationService.getActiveDelegationForUser({
        userId: approverId,
        operationType: approval.operationType,
      });
      if (!delegation) {
        const err: any = new Error('Sem permissão para aprovar. Você não é MASTER nem possui delegação ativa para este tipo de operação.');
        err.statusCode = 403;
        throw err;
      }
      delegationId = delegation.id;
    }

    // Executa a operação
    let executionResult: unknown;
    let executionError: string | null = null;
    try {
      executionResult = await PendingApprovalService.executeApprovedOperation(approval, 'APPROVER', approverId);
    } catch (err: any) {
      executionError = err.message ?? String(err);
      await prisma.pendingApproval.update({
        where: { id: approvalId },
        data: { status: 'EXECUTION_FAILED', executionError },
      });
      throw new Error(`Aprovação registrada, mas falha na execução: ${executionError}`);
    }

    // Atualiza o registro
    const updatedApproval = await prisma.pendingApproval.update({
      where: { id: approvalId },
      data: {
        status: 'APPROVED',
        approverId,
        approverNote: approverNote ?? null,
        delegationId,
        executedAt: new Date(),
      },
    });

    // Se via delegação: atualiza contador de uso
    if (delegationId) {
      await prisma.masterDelegation.update({
        where: { id: delegationId },
        data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
      });

      // Notifica MASTERs que uma delegação foi usada
      const approverUser = await prisma.user.findUnique({
        where: { id: approverId },
        select: { name: true },
      });
      const masters = await MasterDelegationService.getAllMasters();
      for (const master of masters) {
        try {
          await emailService.sendDelegationUsedEmail(master.email, {
            granteeName: approverUser?.name ?? approverId,
            operationType: OPERATION_LABELS[approval.operationType] ?? approval.operationType,
            approvalId,
          });
        } catch (err) {
          console.error('[PendingApprovalService] Error sending delegation used email:', err);
        }
      }
    }

    return { approval: updatedApproval, executionResult };
  }

  /**
   * Rejeita uma operação pendente.
   */
  static async reject(params: {
    approvalId: string;
    approverId: string;
    approverNote?: string;
  }): Promise<PendingApproval> {
    const { approvalId, approverId, approverNote } = params;

    const approval = await prisma.pendingApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new Error('Aprovação não encontrada.');
    if (approval.status !== 'PENDING_APPROVAL') {
      throw new Error(`Operação não está aguardando aprovação (status atual: ${approval.status}).`);
    }
    if (approval.initiatorId === approverId) {
      const err: any = new Error('Você não pode rejeitar sua própria operação.');
      err.statusCode = 403;
      throw err;
    }

    // Verifica elegibilidade
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { role: { select: { level: true } } },
    });
    const approverLevel = approver?.role?.level ?? 0;
    if (approverLevel < 100) {
      const delegation = await MasterDelegationService.getActiveDelegationForUser({
        userId: approverId,
        operationType: approval.operationType,
      });
      if (!delegation) {
        const err: any = new Error('Sem permissão para rejeitar esta operação.');
        err.statusCode = 403;
        throw err;
      }
    }

    return prisma.pendingApproval.update({
      where: { id: approvalId },
      data: {
        status: 'REJECTED',
        approverId,
        approverNote: approverNote ?? null,
      },
    });
  }

  /**
   * Cancela uma operação pendente pelo próprio iniciador.
   * Só pode cancelar enquanto status === 'PENDING_APPROVAL'.
   */
  static async cancelByInitiator(params: {
    approvalId: string;
    initiatorId: string;
  }): Promise<PendingApproval> {
    const { approvalId, initiatorId } = params;

    const approval = await prisma.pendingApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new Error('Aprovação não encontrada.');

    if (approval.initiatorId !== initiatorId) {
      const err: any = new Error('Apenas o iniciador pode cancelar esta operação.');
      err.statusCode = 403;
      throw err;
    }

    if (approval.status !== 'PENDING_APPROVAL') {
      throw new Error(`Operação não pode ser cancelada no status atual: ${approval.status}.`);
    }

    return prisma.pendingApproval.update({
      where: { id: approvalId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Solicita Override de Emergência.
   * Apenas o iniciador original pode solicitar, com espera mínima e limite de 3/24h.
   */
  static async requestEmergencyOverride(params: {
    approvalId: string;
    initiatorId: string;
    justification: string;
    twoFactorCode: string;
  }): Promise<PendingApproval> {
    const { approvalId, initiatorId, justification, twoFactorCode } = params;

    if (justification.trim().length < 50) {
      const err: any = new Error('A justificativa deve ter no mínimo 50 caracteres.');
      err.statusCode = 400;
      throw err;
    }

    const approval = await prisma.pendingApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new Error('Aprovação não encontrada.');
    if (approval.initiatorId !== initiatorId) {
      const err: any = new Error('Apenas o iniciador pode solicitar o override de emergência.');
      err.statusCode = 403;
      throw err;
    }
    if (approval.status !== 'PENDING_APPROVAL') {
      throw new Error(`Status inválido para override: ${approval.status}`);
    }

    // Tempo mínimo de espera
    const waitedMs = Date.now() - approval.createdAt.getTime();
    if (waitedMs < OVERRIDE_MIN_WAIT_MS) {
      const minutesLeft = Math.ceil((OVERRIDE_MIN_WAIT_MS - waitedMs) / 60000);
      const err: any = new Error(
        `Aguarde ${minutesLeft} minuto(s) antes de solicitar o override de emergência.`
      );
      err.statusCode = 429;
      throw err;
    }

    // Valida 2FA do iniciador
    const valid2FA = await twoFactorService.verifyToken(initiatorId, twoFactorCode);
    if (!valid2FA) {
      const err: any = new Error('Código 2FA inválido.');
      err.statusCode = 400;
      throw err;
    }

    // Limite de 3 overrides por 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentOverrides = await prisma.pendingApproval.count({
      where: {
        initiatorId,
        overrideRequestedAt: { gte: yesterday },
        status: { in: ['OVERRIDE_PENDING', 'OVERRIDE_EXECUTED', 'OVERRIDE_CANCELLED'] },
      },
    });
    if (recentOverrides >= MAX_OVERRIDES_PER_24H) {
      const err: any = new Error('Limite de overrides de emergência atingido (máx 3 por 24h).');
      err.statusCode = 429;
      throw err;
    }

    const cancelToken = crypto.randomBytes(32).toString('hex');
    const overrideExecuteAfter = new Date(Date.now() + OVERRIDE_WINDOW_MS);

    const updated = await prisma.pendingApproval.update({
      where: { id: approvalId },
      data: {
        status: 'OVERRIDE_PENDING',
        overrideRequestedAt: new Date(),
        overrideExecuteAfter,
        overrideJustification: justification.trim(),
        overrideCancelToken: cancelToken,
      },
    });

    // Notifica outros MASTERs com link de cancelamento
    const otherMasters = await PendingApprovalService.getOtherMasters(initiatorId);
    const initiator = await prisma.user.findUnique({
      where: { id: initiatorId },
      select: { name: true },
    });
    const cancelUrl = `${process.env.FRONTEND_URL}/cancel-override?token=${cancelToken}`;

    for (const master of otherMasters) {
      try {
        await emailService.sendEmergencyOverrideEmail(master.email, {
          initiatorName: initiator?.name ?? initiatorId,
          operationType: OPERATION_LABELS[approval.operationType] ?? approval.operationType,
          justification: justification.trim(),
          executeAfter: overrideExecuteAfter,
          cancelUrl,
        });
      } catch (err) {
        console.error('[PendingApprovalService] Error sending override email:', err);
      }
    }

    return updated;
  }

  /**
   * Cancela um Override de Emergência — via UI (authenticado) ou via link de email (token).
   */
  static async cancelEmergencyOverride(params: {
    approvalId?: string;
    cancelToken?: string;
    cancelledById?: string;
  }): Promise<PendingApproval> {
    const { approvalId, cancelToken, cancelledById } = params;

    let approval: PendingApproval | null = null;

    if (cancelToken) {
      approval = await prisma.pendingApproval.findUnique({
        where: { overrideCancelToken: cancelToken },
      });
      if (!approval) throw new Error('Token de cancelamento inválido ou já utilizado.');
    } else if (approvalId) {
      approval = await prisma.pendingApproval.findUnique({ where: { id: approvalId } });
      if (!approval) throw new Error('Aprovação não encontrada.');
    } else {
      throw new Error('Forneça approvalId ou cancelToken.');
    }

    if (approval.status !== 'OVERRIDE_PENDING') {
      // Se já foi executado pelo job, explica claramente; caso contrário, informa o status atual
      const msg = approval.status === 'OVERRIDE_EXECUTED'
        ? 'O override já foi executado automaticamente — a operação não pode mais ser cancelada.'
        : `Override não está mais pendente (status: ${approval.status}).`;
      throw new Error(msg);
    }

    const cancelledByValue = cancelToken ? 'EMAIL_TOKEN' : (cancelledById ?? 'UNKNOWN');

    const updated = await prisma.pendingApproval.update({
      where: { id: approval.id },
      data: {
        status: 'OVERRIDE_CANCELLED',
        overrideCancelledBy: cancelledByValue,
        overrideCancelledAt: new Date(),
        overrideCancelToken: null, // invalida o token
      },
    });

    // Notifica o iniciador
    const initiator = await prisma.user.findUnique({
      where: { id: approval.initiatorId },
      select: { email: true, name: true },
    });
    if (initiator?.email) {
      try {
        const cancelledBy = cancelToken
          ? 'via link de e-mail'
          : (await prisma.user.findUnique({ where: { id: cancelledById }, select: { name: true } }))?.name ?? cancelledById ?? 'outro sócio';

        await emailService.sendOverrideCancelledEmail(initiator.email, {
          cancelledBy: String(cancelledBy),
          operationType: OPERATION_LABELS[approval.operationType] ?? approval.operationType,
          approvalId: approval.id,
        });
      } catch (err) {
        console.error('[PendingApprovalService] Error sending override cancelled email:', err);
      }
    }

    return updated;
  }

  /**
   * Chamado pelo job a cada 5 min:
   * - Expira aprovações vencidas
   * - Auto-executa overrides maduros
   */
  static async processExpirationsAndOverrides(): Promise<void> {
    const now = new Date();

    // 1. Expirar aprovações vencidas
    const expired = await prisma.pendingApproval.updateMany({
      where: { status: 'PENDING_APPROVAL', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    if (expired.count > 0) {
      console.log(`[PendingApprovalService] Expired ${expired.count} pending approval(s).`);
    }

    // 2. Auto-executar overrides maduros
    const matureOverrides = await prisma.pendingApproval.findMany({
      where: { status: 'OVERRIDE_PENDING', overrideExecuteAfter: { lte: now } },
    });

    for (const approval of matureOverrides) {
      try {
        await PendingApprovalService.executeApprovedOperation(approval, 'OVERRIDE');
        await prisma.pendingApproval.update({
          where: { id: approval.id },
          data: {
            status: 'OVERRIDE_EXECUTED',
            executedAt: new Date(),
            overrideCancelToken: null,
          },
        });
        console.log(`[PendingApprovalService] Override executed for approval ${approval.id}`);
      } catch (err: any) {
        await prisma.pendingApproval.update({
          where: { id: approval.id },
          data: { status: 'EXECUTION_FAILED', executionError: err.message ?? String(err) },
        });
        console.error(`[PendingApprovalService] Override execution failed for ${approval.id}:`, err);
      }
    }
  }

  // ─── PRIVATE ────────────────────────────────────────────────────────────────

  /**
   * Executa a operação armazenada no PendingApproval.
   * Chama AdminFundsService diretamente (sem HTTP).
   */
  private static async executeApprovedOperation(
    approval: PendingApproval,
    executedBy: 'APPROVER' | 'OVERRIDE',
    executorId?: string,
  ): Promise<unknown> {
    const payload: Record<string, any> = JSON.parse(approval.operationPayload);
    // Para auditoria: usa o aprovador (ou o iniciador no caso de override)
    const adminUserId = executorId ?? approval.initiatorId;

    switch (approval.operationType) {
      case 'INTERNAL_TRANSFER':
        return AdminFundsService.internalTransfer({
          fromWalletId: payload.fromWalletId,
          toWalletId:   payload.toWalletId,
          amount:       payload.amount,
          reason:       `[${executedBy === 'OVERRIDE' ? 'OVERRIDE' : 'DUAL-APPROVED'}] ${payload.reason}`,
          adminUserId,
        });

      case 'ADJUST_BALANCE':
        return AdminFundsService.adjustBalance({
          walletId:   payload.walletId,
          adjustment: payload.adjustment,
          reason:     `[${executedBy === 'OVERRIDE' ? 'OVERRIDE' : 'DUAL-APPROVED'}] ${payload.reason}`,
          adminUserId,
        });

      case 'PLATFORM_REFUND':
        return AdminFundsService.platformRefund({
          cryptoType: payload.cryptoType,
          network:    payload.network,
          toWalletId: payload.toWalletId,
          amount:     payload.amount,
          reason:     `[${executedBy === 'OVERRIDE' ? 'OVERRIDE' : 'DUAL-APPROVED'}] ${payload.reason}`,
          adminUserId,
          direction:  payload.direction,
        });

      case 'LOCK_BALANCE':
        return AdminFundsService.adminLockBalance({
          walletId:   payload.walletId,
          amount:     payload.amount,
          category:   payload.category,
          reason:     `[${executedBy === 'OVERRIDE' ? 'OVERRIDE' : 'DUAL-APPROVED'}] ${payload.reason}`,
          adminUserId,
        });

      case 'UNLOCK_BALANCE':
        return AdminFundsService.adminUnlockBalance({
          walletId:   payload.walletId,
          amount:     payload.amount,
          category:   payload.category,
          reason:     `[${executedBy === 'OVERRIDE' ? 'OVERRIDE' : 'DUAL-APPROVED'}] ${payload.reason}`,
          adminUserId,
        });

      case 'DEMOTE_MASTER': {
        // payload: { targetUserId, newRole, newRoleSlug, reason, targetUserEmail, targetUserName }
        const newRoleRecord = await prisma.role.findUnique({ where: { slug: payload.newRoleSlug } });
        if (!newRoleRecord) throw new Error(`Role '${payload.newRoleSlug}' não encontrado no sistema RBAC.`);

        await prisma.user.update({
          where: { id: payload.targetUserId },
          data: { roleId: newRoleRecord.id, legacyRole: payload.newRole },
        });

        // Invalida cache de permissões do usuário rebaixado
        clearUserPermissionCache(payload.targetUserId);

        await auditLogService.log({
          userId:      adminUserId,
          action:      'USER_ROLE_CHANGE',
          resource:    'User',
          resourceId:  payload.targetUserId,
          description: `[DUAL-APPROVED] Rebaixamento de MASTER: ${payload.targetUserEmail} → ${payload.newRole}`,
          metadata: {
            previousRole: 'MASTER',
            newRole:       payload.newRole,
            reason:        payload.reason,
            executedBy,
          },
          success: true,
        });

        return { targetUserId: payload.targetUserId, newRole: payload.newRole };
      }

      case 'PROMOTE_MASTER': {
        // payload: { targetUserId, newRole, newRoleSlug, previousRole, reason, targetUserEmail, targetUserName }
        const masterRole = await prisma.role.findUnique({ where: { slug: payload.newRoleSlug } });
        if (!masterRole) throw new Error(`Role '${payload.newRoleSlug}' não encontrado no sistema RBAC.`);

        await prisma.user.update({
          where: { id: payload.targetUserId },
          data: { roleId: masterRole.id, legacyRole: payload.newRole },
        });

        clearUserPermissionCache(payload.targetUserId);

        await auditLogService.log({
          userId:      adminUserId,
          action:      'USER_ROLE_CHANGE',
          resource:    'User',
          resourceId:  payload.targetUserId,
          description: `[DUAL-APPROVED] Promoção para MASTER: ${payload.targetUserEmail} (${payload.previousRole} → MASTER)`,
          metadata: {
            previousRole: payload.previousRole,
            newRole:       payload.newRole,
            reason:        payload.reason,
            executedBy,
          },
          success: true,
        });

        return { targetUserId: payload.targetUserId, newRole: payload.newRole };
      }

      case 'PLATFORM_WALLET_TRANSFER': {
        // Re-validate available balance at execution time
        const wallet = await prisma.platformWallet.findUnique({
          where: { id: payload.platformWalletId },
        });
        if (!wallet) throw new Error('Carteira da plataforma não encontrada.');
        if (!wallet.isActive) throw new Error('Carteira da plataforma está inativa.');
        const availableBalance = parseFloat(wallet.availableBalance);
        const transferAmount = parseFloat(payload.amount);
        if (availableBalance < transferAmount) {
          throw new Error(
            `Saldo insuficiente na execução. Disponível: ${availableBalance}, Solicitado: ${transferAmount}`
          );
        }
        // Create PlatformTransfer record and execute on-chain
        const transfer = await prisma.platformTransfer.create({
          data: {
            platformWalletId: payload.platformWalletId,
            toAddress:        payload.toAddress,
            amount:           payload.amount,
            status:           'PENDING',
            requestedBy:      approval.initiatorId,
            note:             `[${executedBy === 'OVERRIDE' ? 'OVERRIDE' : 'DUAL-APPROVED'}] ${payload.note ?? ''}`.trim(),
          },
        });
        return platformTransferService.processTransfer(transfer.id);
      }

      default:
        throw new Error(`Tipo de operação desconhecido: ${approval.operationType}`);
    }
  }

  /**
   * Retorna todos os MASTERs exceto o usuário informado.
   */
  private static async getOtherMasters(
    excludeUserId: string,
  ): Promise<{ id: string; email: string; name: string | null }[]> {
    return prisma.user.findMany({
      where: {
        role: { slug: 'master' },
        id:   { not: excludeUserId },
      },
      select: { id: true, email: true, name: true },
    });
  }
}
