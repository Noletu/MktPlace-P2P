import { Router } from 'express';
import { adminFundsController } from '../controllers/adminFunds.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { managerMiddleware } from '../middleware/manager.middleware';
import { financialOperationsMiddleware } from '../middleware/financialOperations.middleware';
import { require2FAMiddleware } from '../middleware/require2FA.middleware';
import { adminActionLimiter, financialOperationsLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// SECURITY: Autenticação obrigatória em todas as rotas
router.use(authMiddleware);

/**
 * OPERACIONAL: Dashboard e Overview (GERENTE + ADMIN + MASTER)
 */
router.get(
  '/dashboard',
  managerMiddleware,
  adminFundsController.getDashboard.bind(adminFundsController)
);

/**
 * OPERACIONAL: Visões Separadas (GERENTE + ADMIN + MASTER)
 */
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
  '/users/:userId/wallets',
  managerMiddleware,
  adminFundsController.getUserWallets.bind(adminFundsController)
);

/**
 * OPERACIONAL: Freeze/Unfreeze Account (GERENTE + ADMIN + MASTER)
 * GERENTE pode bloquear/desbloquear contas de usuários
 */
router.post(
  '/freeze',
  managerMiddleware,
  adminActionLimiter,
  adminFundsController.freezeAccount.bind(adminFundsController)
);

router.post(
  '/unfreeze',
  managerMiddleware,
  adminActionLimiter,
  adminFundsController.unfreezeAccount.bind(adminFundsController)
);

/**
 * FINANCEIRO CRÍTICO: Internal Transfer (APENAS MASTER)
 * Requer 2FA + Rate limiting restritivo
 */
router.post(
  '/internal-transfer',
  financialOperationsMiddleware,
  require2FAMiddleware,
  financialOperationsLimiter,
  adminFundsController.internalTransfer.bind(adminFundsController)
);

/**
 * FINANCEIRO CRÍTICO: Balance Adjustment (APENAS MASTER)
 * Requer 2FA + Rate limiting restritivo
 */
router.post(
  '/adjust-balance',
  financialOperationsMiddleware,
  require2FAMiddleware,
  financialOperationsLimiter,
  adminFundsController.adjustBalance.bind(adminFundsController)
);

/**
 * OPERACIONAL: Locked Balances (GERENTE + ADMIN + MASTER)
 * Listar carteiras com saldo bloqueado
 */
router.get(
  '/locked-balances',
  managerMiddleware,
  adminFundsController.getLockedBalances.bind(adminFundsController)
);

/**
 * FINANCEIRO CRÍTICO: Lock Balance (APENAS MASTER)
 * Bloquear saldo manualmente - Rate limiting restritivo
 * TODO: Reabilitar require2FAMiddleware quando 2FA estiver configurado
 */
router.post(
  '/lock-balance',
  financialOperationsMiddleware,
  // require2FAMiddleware, // Desabilitado temporariamente
  financialOperationsLimiter,
  adminFundsController.lockBalance.bind(adminFundsController)
);

/**
 * FINANCEIRO CRÍTICO: Unlock Balance (APENAS MASTER)
 * Desbloquear saldo manualmente - Rate limiting restritivo
 * TODO: Reabilitar require2FAMiddleware quando 2FA estiver configurado
 */
router.post(
  '/unlock-balance',
  financialOperationsMiddleware,
  // require2FAMiddleware, // Desabilitado temporariamente
  financialOperationsLimiter,
  adminFundsController.unlockBalance.bind(adminFundsController)
);

/**
 * OPERACIONAL: Audit Log & Reports (GERENTE + ADMIN + MASTER)
 */
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
