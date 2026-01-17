import { Router } from 'express';
import { couponController } from '../controllers/coupon.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { adminActionLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// SECURITY: Autenticação obrigatória em todas as rotas
router.use(authMiddleware);

/**
 * USER ROUTES: Gerenciar cupons pessoais
 */
router.get('/public', couponController.getPublicCoupons.bind(couponController));
router.get('/active', couponController.getActiveCoupon.bind(couponController));
router.post('/activate', couponController.activateCoupon.bind(couponController));
router.post('/deactivate', couponController.deactivateCoupon.bind(couponController));

/**
 * ADMIN ROUTES: Gerenciar cupons (ADMIN + MASTER apenas)
 */
router.get('/', adminMiddleware, couponController.listCoupons.bind(couponController));
router.get('/stats', adminMiddleware, couponController.getCouponStats.bind(couponController));
router.get('/:id', adminMiddleware, couponController.getCouponById.bind(couponController));
router.post('/', adminMiddleware, adminActionLimiter, couponController.createCoupon.bind(couponController));
router.put('/:id', adminMiddleware, adminActionLimiter, couponController.updateCoupon.bind(couponController));
router.delete('/:id', adminMiddleware, adminActionLimiter, couponController.deleteCoupon.bind(couponController));

export default router;
