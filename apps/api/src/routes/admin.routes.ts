import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { financeController } from '../controllers/finance.controller';
import { disputeController } from '../controllers/dispute.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { adminActionLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Todas as rotas requerem autenticação E permissão de admin
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * Dashboard
 */
router.get('/dashboard', adminController.getDashboard.bind(adminController));

/**
 * Finance & Analytics
 */
router.get('/finance/stats', financeController.getFinanceStats.bind(financeController));
router.get('/finance/wallet-balances', financeController.getWalletBalances.bind(financeController));

/**
 * Gestão de Endereços da Plataforma
 */
router.get('/platform-wallets', adminController.getPlatformWallets.bind(adminController));
router.get('/platform-wallets/:id', adminController.getPlatformWalletById.bind(adminController));
// SECURITY: Ações de escrita com rate limiting
router.post('/platform-wallets', adminActionLimiter, adminController.createPlatformWallet.bind(adminController));
router.put('/platform-wallets/:id', adminActionLimiter, adminController.updatePlatformWallet.bind(adminController));
router.delete('/platform-wallets/:id', adminActionLimiter, adminController.deletePlatformWallet.bind(adminController));

/**
 * Gestão de Usuários
 */
router.get('/users', adminController.getUsers.bind(adminController));
// SECURITY: Atualização de usuário com rate limiting
router.put('/users/:id', adminActionLimiter, adminController.updateUser.bind(adminController));

/**
 * Gestão de Pedidos
 */
router.get('/orders', adminController.getOrders.bind(adminController));
// SECURITY: Cancelamento de pedido com rate limiting
router.post('/orders/:id/cancel', adminActionLimiter, adminController.cancelOrder.bind(adminController));

/**
 * Audit Log
 */
router.get('/audit-log', adminController.getAuditLog.bind(adminController));

/**
 * SECURITY: Audit Log Completo (Todos os eventos do sistema)
 */
router.get('/audit-logs', adminController.getAllAuditLogs.bind(adminController));
router.get('/audit-logs/stats', adminController.getAuditStats.bind(adminController));
router.get('/audit-logs/export', adminController.exportAuditLogs.bind(adminController));

/**
 * Gestão de KYC
 */
router.get('/kyc', adminController.listPendingKYC.bind(adminController));
router.get('/kyc/stats', adminController.getKYCStats.bind(adminController));
router.get('/kyc/:userId', adminController.getKYCVerification.bind(adminController));
// SECURITY: Aprovação/Rejeição de KYC com rate limiting
router.post('/kyc/:userId/approve', adminActionLimiter, adminController.approveKYC.bind(adminController));
router.post('/kyc/:userId/reject', adminActionLimiter, adminController.rejectKYC.bind(adminController));

/**
 * Dispute Analytics
 */
router.get('/disputes/analytics', disputeController.getDisputeAnalytics.bind(disputeController));
router.get('/disputes/top-disputants', disputeController.getTopDisputants.bind(disputeController));

export default router;
