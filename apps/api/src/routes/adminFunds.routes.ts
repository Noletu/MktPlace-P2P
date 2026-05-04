import { Router, Request, Response, NextFunction } from 'express';
import { adminFundsController } from '../controllers/adminFunds.controller';
import { pendingApprovalController } from '../controllers/pendingApproval.controller';
import { authMiddleware, masterMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { managerMiddleware } from '../middleware/manager.middleware';
import { financialOperationsMiddleware } from '../middleware/financialOperations.middleware';
import { require2FAMiddleware } from '../middleware/require2FA.middleware';
import { adminActionLimiter, financialOperationsLimiter } from '../middleware/rateLimiter.middleware';
import { requireDualApproval } from '../middleware/requireDualApproval.middleware';
import { MasterDelegationService } from '../services/masterDelegation.service';
import { prisma } from '../utils/prisma';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// ROTAS PÚBLICAS (sem auth) — devem vir ANTES de router.use(authMiddleware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PÚBLICO: Cancelar Override de Emergência via link de e-mail (sem login)
 * GET /api/v1/admin/funds/cancel-override?token=<token>
 */
router.get('/cancel-override', pendingApprovalController.cancelViaToken.bind(pendingApprovalController));

// ─────────────────────────────────────────────────────────────────────────────
// Autenticação obrigatória em todas as rotas abaixo
// ─────────────────────────────────────────────────────────────────────────────
router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: permite acesso a MASTER ou a delegado com delegação ativa
// ─────────────────────────────────────────────────────────────────────────────
const masterOrDelegateMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // MASTER passa direto
  if (req.user && (req.user as any).level >= 100) {
    return next();
  }

  const approvalId = req.params.id;
  if (!approvalId) {
    res.status(403).json({ success: false, error: 'Acesso negado.' });
    return;
  }

  try {
    const approval = await prisma.pendingApproval.findUnique({ where: { id: approvalId } });
    if (!approval) {
      res.status(404).json({ success: false, error: 'Aprovação não encontrada.' });
      return;
    }

    const delegation = await MasterDelegationService.getActiveDelegationForUser({
      userId: req.user!.userId,
      operationType: approval.operationType,
    });

    if (!delegation) {
      res.status(403).json({
        success: false,
        error: 'Acesso negado. Você não é MASTER nem possui delegação ativa para este tipo de operação.',
      });
      return;
    }

    (req as any).activeDelegation = delegation;
    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: permite acesso a MASTER ou a delegado com QUALQUER delegação ativa
// Usado em rotas de lista onde não há approvalId para consultar o operationType
// ─────────────────────────────────────────────────────────────────────────────
const masterOrAnyDelegateMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.user && (req.user as any).level >= 100) {
    return next();
  }

  try {
    // Para lista: basta ter QUALQUER delegação ativa, independente de escopo
    const delegation = await prisma.masterDelegation.findFirst({
      where: {
        granteeId: req.user!.userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
        startsAt:  { lte: new Date() },
      },
    });

    if (!delegation) {
      res.status(403).json({
        success: false,
        error: 'Acesso negado. Você não é MASTER nem possui delegação ativa.',
      });
      return;
    }

    (req as any).activeDelegation = delegation;
    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DUAL-APPROVAL: Fila de aprovações pendentes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/funds/pending-approvals
 * Lista aprovações (MASTER ou delegado com delegação ativa)
 */
router.get(
  '/pending-approvals',
  masterOrAnyDelegateMiddleware,
  pendingApprovalController.list.bind(pendingApprovalController)
);

/**
 * GET /api/v1/admin/funds/pending-approvals/count
 * Contagem de aprovações aguardando o usuário logado
 */
router.get(
  '/pending-approvals/count',
  masterOrAnyDelegateMiddleware,
  pendingApprovalController.getPendingCount.bind(pendingApprovalController)
);

/**
 * GET /api/v1/admin/funds/pending-approvals/:id
 */
router.get(
  '/pending-approvals/:id',
  masterOrDelegateMiddleware,
  pendingApprovalController.getOne.bind(pendingApprovalController)
);

/**
 * POST /api/v1/admin/funds/pending-approvals/:id/approve
 * Aprovar e executar operação (MASTER ou delegado + 2FA)
 */
router.post(
  '/pending-approvals/:id/approve',
  masterOrDelegateMiddleware,
  require2FAMiddleware,
  pendingApprovalController.approve.bind(pendingApprovalController)
);

/**
 * POST /api/v1/admin/funds/pending-approvals/:id/reject
 */
router.post(
  '/pending-approvals/:id/reject',
  masterOrDelegateMiddleware,
  pendingApprovalController.reject.bind(pendingApprovalController)
);

/**
 * POST /api/v1/admin/funds/pending-approvals/:id/emergency-override
 * Solicitar override de emergência (apenas o iniciador original, MASTER)
 */
router.post(
  '/pending-approvals/:id/emergency-override',
  financialOperationsMiddleware,
  pendingApprovalController.requestEmergencyOverride.bind(pendingApprovalController)
);

/**
 * POST /api/v1/admin/funds/pending-approvals/:id/cancel-override
 * Cancelar override via UI autenticada (qualquer MASTER)
 */
router.post(
  '/pending-approvals/:id/cancel-override',
  masterMiddleware,
  pendingApprovalController.cancelViaUI.bind(pendingApprovalController)
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONAL: Dashboard e Overview (GERENTE + ADMIN + MASTER)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/dashboard',
  managerMiddleware,
  adminFundsController.getDashboard.bind(adminFundsController)
);

router.get(
  '/partners',
  managerMiddleware,
  adminFundsController.getPartnersFunds.bind(adminFundsController)
);

router.get(
  '/users-funds',
  managerMiddleware,
  adminFundsController.getUsersFunds.bind(adminFundsController)
);

router.get(
  '/total',
  managerMiddleware,
  adminFundsController.getTotalFunds.bind(adminFundsController)
);

router.get(
  '/users/search',
  managerMiddleware,
  adminFundsController.searchUserWallets.bind(adminFundsController)
);

router.get(
  '/users/:userId/wallets',
  managerMiddleware,
  adminFundsController.getUserWallets.bind(adminFundsController)
);

router.get(
  '/wallets/:walletId',
  managerMiddleware,
  adminFundsController.getWalletById.bind(adminFundsController)
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONAL: Freeze/Unfreeze Account (GERENTE + ADMIN + MASTER)
// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: Freeze/unfreeze de conta exige 2FA (impacto direto em operações do usuário)
router.post(
  '/freeze',
  managerMiddleware,
  adminActionLimiter,
  require2FAMiddleware,
  adminFundsController.freezeAccount.bind(adminFundsController)
);

router.post(
  '/unfreeze',
  managerMiddleware,
  adminActionLimiter,
  require2FAMiddleware,
  adminFundsController.unfreezeAccount.bind(adminFundsController)
);

router.get(
  '/frozen-accounts',
  managerMiddleware,
  adminFundsController.getFrozenAccounts.bind(adminFundsController)
);

// ─────────────────────────────────────────────────────────────────────────────
// FINANCEIRO CRÍTICO: Operações MASTER-only — agora com Dual-Approval
// Cada rota cria um PendingApproval (202) ao invés de executar imediatamente.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DUAL-APPROVAL: Internal Transfer (APENAS MASTER)
 * Requer 2FA do iniciador + cria PendingApproval → aguarda aprovação do segundo MASTER
 */
router.post(
  '/internal-transfer',
  financialOperationsMiddleware,
  require2FAMiddleware,
  financialOperationsLimiter,
  requireDualApproval('INTERNAL_TRANSFER'),
  // Controller abaixo NUNCA é atingido via HTTP (requireDualApproval é terminal)
  // Mantido para referência: execução real ocorre em PendingApprovalService.executeApprovedOperation()
  adminFundsController.internalTransfer.bind(adminFundsController)
);

/**
 * DUAL-APPROVAL: Balance Adjustment (APENAS MASTER)
 */
router.post(
  '/adjust-balance',
  financialOperationsMiddleware,
  require2FAMiddleware,
  financialOperationsLimiter,
  requireDualApproval('ADJUST_BALANCE'),
  adminFundsController.adjustBalance.bind(adminFundsController)
);

/**
 * DUAL-APPROVAL: Platform Refund (APENAS MASTER)
 */
router.post(
  '/platform-refund',
  financialOperationsMiddleware,
  require2FAMiddleware,
  financialOperationsLimiter,
  requireDualApproval('PLATFORM_REFUND'),
  adminFundsController.platformRefund.bind(adminFundsController)
);

/**
 * OPERACIONAL: Locked Balances (GERENTE + ADMIN + MASTER)
 */
router.get(
  '/locked-balances',
  managerMiddleware,
  adminFundsController.getLockedBalances.bind(adminFundsController)
);

/**
 * DUAL-APPROVAL: Lock Balance (APENAS MASTER)
 */
router.post(
  '/lock-balance',
  financialOperationsMiddleware,
  require2FAMiddleware,
  financialOperationsLimiter,
  requireDualApproval('LOCK_BALANCE'),
  adminFundsController.lockBalance.bind(adminFundsController)
);

/**
 * DUAL-APPROVAL: Unlock Balance (APENAS MASTER)
 */
router.post(
  '/unlock-balance',
  financialOperationsMiddleware,
  require2FAMiddleware,
  financialOperationsLimiter,
  requireDualApproval('UNLOCK_BALANCE'),
  adminFundsController.unlockBalance.bind(adminFundsController)
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONAL: Audit Log & Reports (GERENTE + ADMIN + MASTER)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/audit-log',
  managerMiddleware,
  adminFundsController.getAuditLog.bind(adminFundsController)
);

router.get(
  '/wallets/:walletId/transactions',
  managerMiddleware,
  adminFundsController.getWalletTransactions.bind(adminFundsController)
);

export default router;
