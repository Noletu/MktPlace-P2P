import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { masterMiddleware } from '../middleware/master.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter específico para operações de role (mais restritivo)
const roleOperationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // Máximo 20 operações por hora
  message: 'Muitas operações de role. Tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Todas as rotas requerem autenticação
router.use(authMiddleware);

// SECURITY: Todas as rotas de role são exclusivas de MASTER
router.use(masterMiddleware);

/**
 * GET /api/v1/roles
 * Listar todos os roles
 */
router.get('/', roleController.listRoles.bind(roleController));

/**
 * GET /api/v1/roles/:id
 * Buscar role específico por ID ou slug
 */
router.get('/:id', roleController.getRoleById.bind(roleController));

/**
 * POST /api/v1/roles
 * Criar novo role customizado
 * SECURITY: Rate limited
 */
router.post('/', roleOperationsLimiter, roleController.createRole.bind(roleController));

/**
 * PUT /api/v1/roles/:id
 * Atualizar role existente
 * SECURITY: Rate limited
 */
router.put('/:id', roleOperationsLimiter, roleController.updateRole.bind(roleController));

/**
 * DELETE /api/v1/roles/:id
 * Deletar role customizado (não pode deletar roles de sistema)
 * SECURITY: Rate limited
 */
router.delete('/:id', roleOperationsLimiter, roleController.deleteRole.bind(roleController));

/**
 * GET /api/v1/permissions
 * Listar todas as permissões disponíveis (agrupadas por categoria)
 */
router.get('/permissions/all', roleController.listPermissions.bind(roleController));

/**
 * POST /api/v1/roles/:id/permissions
 * Atribuir permissão a role
 * SECURITY: Rate limited
 */
router.post('/:id/permissions', roleOperationsLimiter, roleController.assignPermission.bind(roleController));

/**
 * DELETE /api/v1/roles/:id/permissions/:permissionId
 * Remover permissão de role
 * SECURITY: Rate limited
 */
router.delete(
  '/:id/permissions/:permissionId',
  roleOperationsLimiter,
  roleController.removePermission.bind(roleController)
);

/**
 * PUT /api/v1/roles/:id/permissions
 * Atualizar todas as permissões de um role (substituir)
 * SECURITY: Rate limited
 */
router.put('/:id/permissions', roleOperationsLimiter, roleController.updateRolePermissions.bind(roleController));

export default router;
