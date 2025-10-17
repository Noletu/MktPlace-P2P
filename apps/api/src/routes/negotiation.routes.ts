import { Router } from 'express';
import negotiationController from '../controllers/negotiation.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// POST /api/v1/negotiation/orders/:orderId/cancel - Cancelar negociação
router.post('/orders/:orderId/cancel', negotiationController.cancelNegotiation.bind(negotiationController));

// GET /api/v1/negotiation/orders/:orderId/can-negotiate - Verificar se pode negociar
router.get('/orders/:orderId/can-negotiate', negotiationController.canNegotiate.bind(negotiationController));

// GET /api/v1/negotiation/orders/:orderId/info - Info da negociação
router.get('/orders/:orderId/info', negotiationController.getNegotiationInfo.bind(negotiationController));

export default router;
