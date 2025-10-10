import { Router } from 'express';
import { disputeController } from '../controllers/dispute.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { disputeLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route   POST /api/v1/disputes
 * @desc    Criar nova disputa
 * @access  Private
 */
router.post('/', disputeLimiter, disputeController.createDispute.bind(disputeController));

/**
 * @route   GET /api/v1/disputes/my-disputes
 * @desc    Listar disputas do usuário
 * @access  Private
 */
router.get('/my-disputes', disputeController.getUserDisputes.bind(disputeController));

/**
 * @route   GET /api/v1/disputes/:disputeId
 * @desc    Buscar disputa por ID
 * @access  Private
 */
router.get('/:disputeId', disputeController.getDispute.bind(disputeController));

/**
 * @route   POST /api/v1/disputes/:disputeId/messages
 * @desc    Adicionar mensagem/evidência à disputa
 * @access  Private
 */
router.post('/:disputeId/messages', disputeController.addMessage.bind(disputeController));

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/v1/disputes
 * @desc    Listar todas as disputas (admin)
 * @access  Admin
 */
router.get('/', adminMiddleware, disputeController.getAllDisputes.bind(disputeController));

/**
 * @route   GET /api/v1/disputes/stats
 * @desc    Estatísticas de disputas (admin)
 * @access  Admin
 */
router.get('/stats', adminMiddleware, disputeController.getDisputeStats.bind(disputeController));

/**
 * @route   POST /api/v1/disputes/:disputeId/resolve
 * @desc    Resolver disputa (admin)
 * @access  Admin
 */
router.post('/:disputeId/resolve', adminMiddleware, disputeController.resolveDispute.bind(disputeController));

export default router;
