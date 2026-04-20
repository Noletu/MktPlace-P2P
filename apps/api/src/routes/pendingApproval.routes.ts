import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { pendingApprovalController } from '../controllers/pendingApproval.controller';

const router = Router();

// Rota PÚBLICA: cancelar override via link de email (sem autenticação)
router.get('/cancel-override', pendingApprovalController.cancelViaToken.bind(pendingApprovalController));

// Todas as demais rotas requerem autenticação e role admin/master
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/',    pendingApprovalController.list.bind(pendingApprovalController));
router.get('/count', pendingApprovalController.getPendingCount.bind(pendingApprovalController));
router.get('/:id', pendingApprovalController.getOne.bind(pendingApprovalController));

router.post('/:id/approve',         pendingApprovalController.approve.bind(pendingApprovalController));
router.post('/:id/reject',          pendingApprovalController.reject.bind(pendingApprovalController));
router.post('/:id/cancel',          pendingApprovalController.cancelByInitiator.bind(pendingApprovalController));
router.post('/:id/emergency-override', pendingApprovalController.requestEmergencyOverride.bind(pendingApprovalController));
router.post('/:id/cancel-override', pendingApprovalController.cancelViaUI.bind(pendingApprovalController));

export default router;
