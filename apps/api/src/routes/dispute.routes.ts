import { Router } from 'express';
import { disputeController } from '../controllers/dispute.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { managerMiddleware } from '../middleware/manager.middleware';
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
 * @route   GET /api/v1/disputes/stats
 * @desc    Estatísticas de disputas (GERENTE + ADMIN + MASTER)
 * @access  Manager/Admin/Master
 */
router.get('/stats', managerMiddleware, disputeController.getDisputeStats.bind(disputeController));

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

/**
 * @route   POST /api/v1/disputes/:disputeId/respond
 * @desc    Responder à disputa (outra parte)
 * @access  Private
 */
router.post('/:disputeId/respond', disputeController.respondToDispute.bind(disputeController));

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/v1/disputes
 * @desc    Listar todas as disputas (GERENTE + ADMIN + MASTER)
 * @access  Manager/Admin/Master
 */
router.get('/', managerMiddleware, disputeController.getAllDisputes.bind(disputeController));

/**
 * @route   POST /api/v1/disputes/:disputeId/resolve
 * @desc    Resolver disputa (GERENTE + ADMIN + MASTER)
 * @access  Manager/Admin/Master
 */
router.post('/:disputeId/resolve', managerMiddleware, disputeController.resolveDispute.bind(disputeController));

export default router;
