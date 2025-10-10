import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route   POST /api/v1/reviews
 * @desc    Criar avaliação
 * @access  Private
 */
router.post('/', reviewController.createReview.bind(reviewController));

/**
 * @route   POST /api/v1/reviews/:reviewId/respond
 * @desc    Responder avaliação
 * @access  Private
 */
router.post('/:reviewId/respond', reviewController.respondToReview.bind(reviewController));

/**
 * @route   GET /api/v1/reviews/user/:userId
 * @desc    Buscar avaliações de um usuário
 * @access  Private
 */
router.get('/user/:userId', reviewController.getUserReviews.bind(reviewController));

/**
 * @route   GET /api/v1/reviews/user/:userId/stats
 * @desc    Estatísticas de avaliações do usuário
 * @access  Private
 */
router.get('/user/:userId/stats', reviewController.getUserReviewStats.bind(reviewController));

/**
 * @route   GET /api/v1/reviews/can-review/:orderId
 * @desc    Verificar se pode avaliar pedido
 * @access  Private
 */
router.get('/can-review/:orderId', reviewController.canReview.bind(reviewController));

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   POST /api/v1/reviews/:reviewId/suspicious
 * @desc    Marcar avaliação como suspeita
 * @access  Admin
 */
router.post('/:reviewId/suspicious', adminMiddleware, reviewController.markAsSuspicious.bind(reviewController));

/**
 * @route   POST /api/v1/reviews/:reviewId/hide
 * @desc    Ocultar avaliação
 * @access  Admin
 */
router.post('/:reviewId/hide', adminMiddleware, reviewController.hideReview.bind(reviewController));

export default router;
