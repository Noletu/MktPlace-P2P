import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { financeController } from '../controllers/finance.controller';
import { disputeController } from '../controllers/dispute.controller';
import { adminWithdrawalController } from '../controllers/admin-withdrawal.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { managerMiddleware } from '../middleware/manager.middleware';
import { supportMiddleware } from '../middleware/support.middleware';
import { adminActionLimiter } from '../middleware/rateLimiter.middleware';

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
router.get('/platform-wallets/:id/transfer-estimate', adminMiddleware, adminController.getPlatformWalletTransferEstimate.bind(adminController));
router.post('/platform-wallets/:id/transfer', adminMiddleware, adminActionLimiter, adminController.requestPlatformWalletTransfer.bind(adminController));

/**
 * OPERACIONAL: Gestão de Usuários - Visualização (SUPPORT + GERENTE + ADMIN + MASTER)
 * ADMINISTRATIVO: Atualização de usuários (APENAS ADMIN + MASTER)
 */
router.get('/users', supportMiddleware, adminController.getUsers.bind(adminController));
router.get('/users/:id/details', supportMiddleware, adminController.getUserDetails.bind(adminController));
// SECURITY: Atualização de usuário (mudança de role) apenas ADMIN/MASTER
router.put('/users/:id', adminMiddleware, adminActionLimiter, adminController.updateUser.bind(adminController));

// Resetar senha de usuario (ADMIN + MASTER)
router.post('/users/:id/reset-password', adminMiddleware, adminActionLimiter, adminController.adminResetUserPassword.bind(adminController));
// Limite personalizado (ADMIN + MASTER)
router.post('/users/:id/custom-limit', adminMiddleware, adminActionLimiter, adminController.setCustomLimit.bind(adminController));
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
// SECURITY: Cancelamento de pedido com rate limiting
router.post('/orders/:id/cancel', managerMiddleware, adminActionLimiter, adminController.cancelOrder.bind(adminController));
// SECURITY: Edição de pedido com rate limiting (God Mode)
router.put('/orders/:id/edit', managerMiddleware, adminActionLimiter, adminController.editOrder.bind(adminController));

/**
 * OPERACIONAL: Audit Log (SUPPORT + GERENTE + ADMIN + MASTER)
 */
router.get('/audit-log', supportMiddleware, adminController.getAuditLog.bind(adminController));

/**
 * OPERACIONAL: Audit Log Completo (SUPPORT + GERENTE + ADMIN + MASTER)
 */
router.get('/audit-logs', supportMiddleware, adminController.getAllAuditLogs.bind(adminController));
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
// SECURITY: Aprovação/rejeição com rate limiting
router.post('/withdrawals/:id/approve', adminMiddleware, adminActionLimiter, adminWithdrawalController.approveWithdrawal.bind(adminWithdrawalController));
router.post('/withdrawals/:id/reject', adminMiddleware, adminActionLimiter, adminWithdrawalController.rejectWithdrawal.bind(adminWithdrawalController));

export default router;
