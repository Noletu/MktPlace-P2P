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

// Obter estatísticas do usuário
router.get('/statistics', orderController.getUserStatistics.bind(orderController));

// ANTI-SPAM: Obter estatísticas de proteção anti-spam
router.get('/anti-spam/stats', orderController.getAntiSpamStats.bind(orderController));

// Obter estatísticas de cancelamentos do usuário
router.get('/cancellation/stats', orderController.getCancellationStats.bind(orderController));

// Obter histórico de cancelamentos do usuário
router.get('/cancellation/history', orderController.getCancellationHistory.bind(orderController));

// Verificar se deve receber advertência antes de cancelar
router.get('/cancellation/warning', orderController.getCancellationWarning.bind(orderController));

// Obter detalhes do pedido
router.get('/:orderId', orderController.getOrder.bind(orderController));

// Atualizar pedido (somente se PENDING)
router.patch('/:orderId', orderController.updateOrder.bind(orderController));

// Fazer match (aceitar pedido)
router.post('/:orderId/match', orderController.matchOrder.bind(orderController));

// Cancelar pedido
router.post('/:orderId/cancel', orderController.cancelOrder.bind(orderController));

// Cancelar pedido pelo pagador (comprador) - pedido volta ao marketplace
router.post('/:orderId/cancel-by-payer', orderController.cancelOrderByPayer.bind(orderController));

export default router;
