import { Router } from 'express';
import { statsController } from '../controllers/stats.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * Todas as rotas de stats requerem autenticação
 */

// GET /api/v1/stats/activity?period=7d
router.get('/activity', authMiddleware, (req, res) =>
  statsController.getActivityStats(req, res)
);

export default router;
