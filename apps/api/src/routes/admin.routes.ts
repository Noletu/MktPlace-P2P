import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { financeController } from '../controllers/finance.controller';
import { disputeController } from '../controllers/dispute.controller';
import { adminWithdrawalController } from '../controllers/admin-withdrawal.controller';
import { authMiddleware, adminMiddleware, masterMiddleware } from '../middleware/auth.middleware';
import { managerMiddleware } from '../middleware/manager.middleware';
import { supportMiddleware } from '../middleware/support.middleware';
import { adminActionLimiter, financialOperationsLimiter } from '../middleware/rateLimiter.middleware';
import { require2FAMiddleware } from '../middleware/require2FA.middleware';
import { financialOperationsMiddleware } from '../middleware/financialOperations.middleware';
import { requireDualApproval } from '../middleware/requireDualApproval.middleware';

const router = Router();

// SECURITY: Autenticação obrigatória em todas as rotas
router.use(authMiddleware);
// Nota: Middlewares de permissão (admin/manager) aplicados individualmente por rota

/**
 * OPERACIONAL: Dashboard (SUPPORT + GERENTE + ADMIN + MASTER)
 */
router.get('/dashboard', supportMiddleware, adminController.getDashboard.bind(adminController));

/**
 * OPERACIONAL: Finance & Analytics (GERENTE + ADMIN + MASTER)
 */
router.get('/finance/stats', managerMiddleware, financeController.getFinanceStats.bind(financeController));
router.get('/finance/wallet-balances', managerMiddleware, financeController.getWalletBalances.bind(financeController));

/**
 * ADMINISTRATIVO: Gestão de Endereços da Plataforma (ADMIN + MASTER apenas)
 */
router.get('/platform-wallets', adminMiddleware, adminController.getPlatformWallets.bind(adminController));
router.get('/platform-wallets/:id', adminMiddleware, adminController.getPlatformWalletById.bind(adminController));
// SECURITY: Ações de escrita com rate limiting
router.post('/platform-wallets/create-all', adminMiddleware, adminActionLimiter, adminController.createAllPlatformWallets.bind(adminController));
router.post('/platform-wallets', adminMiddleware, adminActionLimiter, adminController.createPlatformWallet.bind(adminController));
router.put('/platform-wallets/:id', adminMiddleware, adminActionLimiter, adminController.updatePlatformWallet.bind(adminController));
router.delete('/platform-wallets/:id', adminMiddleware, adminActionLimiter, adminController.deletePlatformWallet.bind(adminController));
// Transferências de platform wallets (hot → cold / externo)
router.get('/platform-wallets/:id/transfers', adminMiddleware, adminController.getPlatformWalletTransfers.bind(adminController));
router.get('/platform-wallets/:id/movements', adminMiddleware, adminController.getPlatformWalletMovements.bind(adminController));
router.get('/platform-wallets/:id/transfer-estimate', adminMiddleware, adminController.getPlatformWalletTransferEstimate.bind(adminController));
/**
 * DUAL-APPROVAL: Platform Wallet Transfer (APENAS MASTER)
 * Envia BTC/EVM/SOL da hot wallet para endereço externo.
 * Requer aprovação de um segundo MASTER antes de executar on-chain.
 */
router.post(
  '/platform-wallets/:id/transfer',
  financialOperationsMiddleware,
  require2FAMiddleware,
  financialOperationsLimiter,
  (req, _res, next) => { req.body.platformWalletId = req.params.id; next(); },
  requireDualApproval('PLATFORM_WALLET_TRANSFER'),
  // Controller abaixo NUNCA é atingido via HTTP (requireDualApproval é terminal)
  adminController.requestPlatformWalletTransfer.bind(adminController)
);

/**
 * OPERACIONAL: Gestão de Usuários - Visualização (SUPPORT + GERENTE + ADMIN + MASTER)
 * ADMINISTRATIVO: Atualização de usuários (APENAS ADMIN + MASTER)
 */
router.get('/users', supportMiddleware, adminController.getUsers.bind(adminController));
router.get('/users/:id/details', supportMiddleware, adminController.getUserDetails.bind(adminController));
// SECURITY: Atualização de usuário (mudança de role) apenas ADMIN/MASTER
router.put('/users/:id', adminMiddleware, adminActionLimiter, require2FAMiddleware, adminController.updateUser.bind(adminController));

// FRENTE 2: Criar conta de staff (SUPPORT/GERENTE/ADMIN). APENAS MASTER. Exige 2FA.
router.post('/staff', masterMiddleware, adminActionLimiter, require2FAMiddleware, adminController.createStaffAccount.bind(adminController));

// SECURITY: Reset de senha de usuário por admin exige 2FA (pode ser vetor de account takeover)
router.post('/users/:id/reset-password', adminMiddleware, adminActionLimiter, require2FAMiddleware, adminController.adminResetUserPassword.bind(adminController));
// SECURITY: Alteração de limite financeiro exige 2FA (impacto direto em operações de saque/ordem)
router.post('/users/:id/custom-limit', adminMiddleware, adminActionLimiter, require2FAMiddleware, adminController.setCustomLimit.bind(adminController));
// Reputação: recalcular + breakdown (ADMIN + MASTER)
router.post('/users/:id/recalculate-reputation', adminMiddleware, adminActionLimiter, adminController.recalculateReputation.bind(adminController));
router.get('/users/:id/reputation-breakdown', supportMiddleware, adminController.getReputationBreakdown.bind(adminController));

/**
 * FASE 2: Relatório para Autoridades (GERENTE + ADMIN + MASTER)
 */
router.get('/users/:id/authority-report', managerMiddleware, adminController.generateAuthorityReport.bind(adminController));

/**
 * OPERACIONAL: Gestão de Pedidos - Visualização (SUPPORT + GERENTE + ADMIN + MASTER)
 * ADMINISTRATIVO: Cancelamento/Edição (GERENTE + ADMIN + MASTER)
 */
router.get('/orders', supportMiddleware, adminController.getOrders.bind(adminController));
router.get('/orders/stats', supportMiddleware, adminController.getOrdersStats.bind(adminController));
// SECURITY: Cancelamento forçado de pedido exige 2FA (impacto em transações em andamento)
router.post('/orders/:id/cancel', managerMiddleware, adminActionLimiter, require2FAMiddleware, adminController.cancelOrder.bind(adminController));
// SECURITY: God Mode de edição de pedido exige 2FA (operação sem restrições)
router.put('/orders/:id/edit', managerMiddleware, adminActionLimiter, require2FAMiddleware, adminController.editOrder.bind(adminController));

/**
 * OPERACIONAL: Audit Log (SUPPORT + GERENTE + ADMIN + MASTER)
 */
router.get('/audit-log', supportMiddleware, adminController.getAuditLog.bind(adminController));

/**
 * OPERACIONAL: Audit Log Completo (SUPPORT + GERENTE + ADMIN + MASTER)
 */
router.get('/audit-logs', supportMiddleware, adminController.getAllAuditLogs.bind(adminController));
router.get('/audit-logs/actions', supportMiddleware, adminController.getAuditActions.bind(adminController));
router.get('/audit-logs/stats', supportMiddleware, adminController.getAuditStats.bind(adminController));
router.get('/audit-logs/export', supportMiddleware, adminController.exportAuditLogs.bind(adminController));

/**
 * OPERACIONAL: Dispute Analytics (SUPPORT + GERENTE + ADMIN + MASTER)
 */
router.get('/disputes/analytics', supportMiddleware, disputeController.getDisputeAnalytics.bind(disputeController));
router.get('/disputes/top-disputants', supportMiddleware, disputeController.getTopDisputants.bind(disputeController));

/**
 * ADMINISTRATIVO: Gestão de Saques (ADMIN + MASTER)
 */
router.get('/withdrawals/pending', adminMiddleware, adminWithdrawalController.getPendingWithdrawals.bind(adminWithdrawalController));
router.get('/withdrawals/history', managerMiddleware, adminWithdrawalController.getWithdrawalHistory.bind(adminWithdrawalController));
// SECURITY: Aprovação/rejeição de saque exige 2FA (operação financeira irreversível)
router.post('/withdrawals/:id/approve', adminMiddleware, adminActionLimiter, require2FAMiddleware, adminWithdrawalController.approveWithdrawal.bind(adminWithdrawalController));
router.post('/withdrawals/:id/reject', adminMiddleware, adminActionLimiter, require2FAMiddleware, adminWithdrawalController.rejectWithdrawal.bind(adminWithdrawalController));

export default router;
