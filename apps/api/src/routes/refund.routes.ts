import { Router } from 'express';
import { refundController } from '../controllers/refund.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * Estimar valores de devolução
 */
router.get('/:orderId/estimate', refundController.estimateRefund.bind(refundController));

/**
 * Cancelar pedido manualmente
 */
router.post('/:orderId/cancel', refundController.cancelOrder.bind(refundController));

/**
 * Processar devolução via blockchain
 */
router.post('/:orderId/blockchain', refundController.refundBlockchain.bind(refundController));

/**
 * Processar devolução via crédito interno
 */
router.post('/:orderId/internal-credit', refundController.refundInternalCredit.bind(refundController));

export default router;
