import { Router } from 'express';
import { adminFundsController } from '../controllers/adminFunds.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Aplicar autenticação e verificação de admin em todas as rotas
router.use(authMiddleware);
router.use(adminMiddleware); // Verifica se role é ADMIN ou MASTER

/**
 * Dashboard e Overview
 */
router.get(
  '/dashboard',
  adminFundsController.getDashboard.bind(adminFundsController)
);

router.get(
  '/users/:userId/wallets',
  adminFundsController.getUserWallets.bind(adminFundsController)
);

/**
 * Freeze/Unfreeze Account
 */
router.post(
  '/freeze',
  adminFundsController.freezeAccount.bind(adminFundsController)
);

router.post(
  '/unfreeze',
  adminFundsController.unfreezeAccount.bind(adminFundsController)
);

/**
 * Internal Transfer (MASTER only - operação crítica)
 */
router.post(
  '/internal-transfer',
  adminFundsController.internalTransfer.bind(adminFundsController)
);

/**
 * Balance Adjustment (MASTER only - operação crítica)
 */
router.post(
  '/adjust-balance',
  adminFundsController.adjustBalance.bind(adminFundsController)
);

/**
 * Audit Log & Reports
 */
router.get(
  '/audit-log',
  adminFundsController.getAuditLog.bind(adminFundsController)
);

router.get(
  '/wallets/:walletId/transactions',
  adminFundsController.getWalletTransactions.bind(adminFundsController)
);

export default router;
