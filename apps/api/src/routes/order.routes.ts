import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { orderCreationLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Marketplace - listar pedidos disponíveis
router.get('/marketplace', orderController.getMarketplace.bind(orderController));

// SECURITY: Criar pedido com rate limiting
router.post('/', orderCreationLimiter, orderController.createOrder.bind(orderController));

// Listar pedidos do usuário
router.get('/my-orders', orderController.getUserOrders.bind(orderController));

// Obter detalhes do pedido
router.get('/:orderId', orderController.getOrder.bind(orderController));

// Fazer match (aceitar pedido)
router.post('/:orderId/match', orderController.matchOrder.bind(orderController));

// Cancelar pedido
router.post('/:orderId/cancel', orderController.cancelOrder.bind(orderController));

export default router;
