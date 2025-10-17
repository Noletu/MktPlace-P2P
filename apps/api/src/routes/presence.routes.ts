import { Router } from 'express';
import presenceController from '../controllers/presence.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// POST /api/v1/presence/orders/:orderId/toggle - Toggle presença online/offline
router.post('/orders/:orderId/toggle', presenceController.togglePresence.bind(presenceController));

// POST /api/v1/presence/orders/:orderId/heartbeat - Heartbeat para manter online
router.post('/orders/:orderId/heartbeat', presenceController.sendHeartbeat.bind(presenceController));

// GET /api/v1/presence/my-online-orders - Buscar meus pedidos online
router.get('/my-online-orders', presenceController.getMyOnlineOrders.bind(presenceController));

// GET /api/v1/presence/stats - Estatísticas de presença
router.get('/stats', presenceController.getPresenceStats.bind(presenceController));

export default router;
