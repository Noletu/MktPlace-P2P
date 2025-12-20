import {Router} from 'express';
import {exchangeRateController} from '../controllers/exchange-rate.controller';
import {authMiddleware} from '../middleware/auth.middleware';
import {adminMiddleware} from '../middleware/admin.middleware';

const router = Router();

// Endpoints admin apenas
router.get(
  '/health',
  authMiddleware,
  adminMiddleware,
  exchangeRateController.getHealth.bind(exchangeRateController)
);

router.get(
  '/validate',
  authMiddleware,
  adminMiddleware,
  exchangeRateController.validateConsistency.bind(exchangeRateController)
);

router.get(
  '/current',
  authMiddleware,
  adminMiddleware,
  exchangeRateController.getCurrentRate.bind(exchangeRateController)
);

export default router;
