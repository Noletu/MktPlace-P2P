import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { financeController } from '../controllers/finance.controller';
import { disputeController } from '../controllers/dispute.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { managerMiddleware } from '../middleware/manager.middleware';
import { adminActionLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// SECURITY: Autenticação obrigatória em todas as rotas
router.use(authMiddleware);
// Nota: Middlewares de permissão (admin/manager) aplicados individualmente por rota

/**
 * OPERACIONAL: Dashboard (GERENTE + ADMIN + MASTER)
 */
router.get('/dashboard', managerMiddleware, adminController.getDashboard.bind(adminController));

/**
 * OPERACIONAL: Finance & Analytics (GERENTE + ADMIN + MASTER)
 */
router.get('/finance/stats', managerMiddleware, financeController.getFinanceStats.bind(financeController));
router.get('/finance/wallet-balances', managerMiddleware, financeController.getWalletBalances.bind(financeController));

/**
 * ADMINISTRATIVO: Gestão de Endereços da Plataforma (APENAS ADMIN + MASTER)
 */
router.get('/platform-wallets', adminMiddleware, adminController.getPlatformWallets.bind(adminController));
router.get('/platform-wallets/:id', adminMiddleware, adminController.getPlatformWalletById.bind(adminController));
// SECURITY: Ações de escrita com rate limiting
router.post('/platform-wallets', adminMiddleware, adminActionLimiter, adminController.createPlatformWallet.bind(adminController));
router.put('/platform-wallets/:id', adminMiddleware, adminActionLimiter, adminController.updatePlatformWallet.bind(adminController));
router.delete('/platform-wallets/:id', adminMiddleware, adminActionLimiter, adminController.deletePlatformWallet.bind(adminController));

/**
 * OPERACIONAL: Gestão de Usuários - Visualização (GERENTE + ADMIN + MASTER)
 * ADMINISTRATIVO: Atualização de usuários (APENAS ADMIN + MASTER)
 */
router.get('/users', managerMiddleware, adminController.getUsers.bind(adminController));
router.get('/users/:id/details', managerMiddleware, adminController.getUserDetails.bind(adminController));
// SECURITY: Atualização de usuário (mudança de role) apenas ADMIN/MASTER
router.put('/users/:id', adminMiddleware, adminActionLimiter, adminController.updateUser.bind(adminController));

/**
 * FASE 2: Relatório para Autoridades (GERENTE + ADMIN + MASTER)
 */
router.get('/users/:id/authority-report', managerMiddleware, adminController.generateAuthorityReport.bind(adminController));

/**
 * OPERACIONAL: Gestão de Pedidos (GERENTE + ADMIN + MASTER)
 */
router.get('/orders', managerMiddleware, adminController.getOrders.bind(adminController));
// SECURITY: Cancelamento de pedido com rate limiting
router.post('/orders/:id/cancel', managerMiddleware, adminActionLimiter, adminController.cancelOrder.bind(adminController));
// SECURITY: Edição de pedido com rate limiting (God Mode)
router.put('/orders/:id/edit', managerMiddleware, adminActionLimiter, adminController.editOrder.bind(adminController));

/**
 * OPERACIONAL: Audit Log (GERENTE + ADMIN + MASTER)
 */
router.get('/audit-log', managerMiddleware, adminController.getAuditLog.bind(adminController));

/**
 * OPERACIONAL: Audit Log Completo (GERENTE + ADMIN + MASTER)
 */
router.get('/audit-logs', managerMiddleware, adminController.getAllAuditLogs.bind(adminController));
router.get('/audit-logs/stats', managerMiddleware, adminController.getAuditStats.bind(adminController));
router.get('/audit-logs/export', managerMiddleware, adminController.exportAuditLogs.bind(adminController));

/**
 * OPERACIONAL: Gestão de KYC (GERENTE + ADMIN + MASTER)
 */
router.get('/kyc', managerMiddleware, adminController.listPendingKYC.bind(adminController));
router.get('/kyc/stats', managerMiddleware, adminController.getKYCStats.bind(adminController));
router.get('/kyc/:userId', managerMiddleware, adminController.getKYCVerification.bind(adminController));
// SECURITY: Aprovação/Rejeição de KYC com rate limiting
router.post('/kyc/:userId/approve', managerMiddleware, adminActionLimiter, adminController.approveKYC.bind(adminController));
router.post('/kyc/:userId/reject', managerMiddleware, adminActionLimiter, adminController.rejectKYC.bind(adminController));

/**
 * OPERACIONAL: Dispute Analytics (GERENTE + ADMIN + MASTER)
 */
router.get('/disputes/analytics', managerMiddleware, disputeController.getDisputeAnalytics.bind(disputeController));
router.get('/disputes/top-disputants', managerMiddleware, disputeController.getTopDisputants.bind(disputeController));

export default router;
