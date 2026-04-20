import { Router } from 'express';
import { masterDelegationController } from '../controllers/masterDelegation.controller';
import { authMiddleware, masterMiddleware } from '../middleware/auth.middleware';
import { adminActionLimiter } from '../middleware/rateLimiter.middleware';
import { require2FAMiddleware } from '../middleware/require2FA.middleware';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/v1/admin/delegations
 * Lista todas as delegações (com filtros por granteeId, grantorId, activeOnly)
 */
router.get('/', masterMiddleware, masterDelegationController.list.bind(masterDelegationController));

/**
 * GET /api/v1/admin/delegations/eligible-grantees
 * Lista usuários elegíveis para receber delegação (GERENTE e ADMIN)
 */
router.get(
  '/eligible-grantees',
  masterMiddleware,
  masterDelegationController.getEligibleGrantees.bind(masterDelegationController)
);

/**
 * GET /api/v1/admin/delegations/my-delegation
 * Permite que um delegado veja sua própria delegação ativa
 */
router.get(
  '/my-delegation',
  masterDelegationController.myDelegation.bind(masterDelegationController)
);

/**
 * POST /api/v1/admin/delegations
 * Cria uma nova delegação temporária
 */
// SECURITY: Criar delegação transfere poderes de MASTER — exige 2FA
router.post(
  '/',
  masterMiddleware,
  adminActionLimiter,
  require2FAMiddleware,
  masterDelegationController.create.bind(masterDelegationController)
);

/**
 * DELETE /api/v1/admin/delegations/:id
 * Revoga uma delegação
 */
// SECURITY: Revogar delegação remove permissões elevadas — exige 2FA
router.delete(
  '/:id',
  masterMiddleware,
  require2FAMiddleware,
  masterDelegationController.revoke.bind(masterDelegationController)
);

export default router;
