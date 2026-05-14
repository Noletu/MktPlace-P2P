import { Router } from 'express';
import { masterSeedAdminController } from '../controllers/masterSeedAdmin.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { adminActionLimiter } from '../middleware/rateLimiter.middleware';
import { require2FAMiddleware } from '../middleware/require2FA.middleware';

const router = Router();

// Todas as rotas requerem autenticação E permissão de admin
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /admin/master-seed/status
 * Retorna status da master seed (sem dados sensíveis)
 */
router.get('/status', masterSeedAdminController.getStatus.bind(masterSeedAdminController));

/**
 * POST /admin/master-seed/generate
 * Gera nova master seed (REQUER 2FA - OBRIGATÓRIO)
 * SECURITY: Rate limiting + 2FA obrigatório
 */
router.post('/generate', adminActionLimiter, require2FAMiddleware, masterSeedAdminController.generateMasterSeed.bind(masterSeedAdminController));

/**
 * POST /admin/master-seed/recover
 * Recupera seed a partir de mnemonic (REQUER 2FA - OBRIGATÓRIO)
 * SECURITY: Rate limiting + 2FA obrigatório
 */
router.post('/recover', adminActionLimiter, require2FAMiddleware, masterSeedAdminController.recoverFromMnemonic.bind(masterSeedAdminController));

/**
 * POST /admin/master-seed/test-derivation
 * Testa derivação sem modificar nada
 */
router.post('/test-derivation', masterSeedAdminController.testDerivation.bind(masterSeedAdminController));

/**
 * GET /admin/master-seed/audit-log
 * Retorna audit trail de operações com master seed (REQUER 2FA)
 */
router.get('/audit-log', require2FAMiddleware, masterSeedAdminController.getAuditLog.bind(masterSeedAdminController));

/**
 * POST /admin/master-seed/rotate-key
 * Rotaciona a encryption key da master seed (REQUER 2FA - OBRIGATÓRIO)
 * SECURITY: Rate limiting + 2FA obrigatório
 */
router.post('/rotate-key', adminActionLimiter, require2FAMiddleware, masterSeedAdminController.rotateEncryptionKey.bind(masterSeedAdminController));

/**
 * POST /admin/master-seed/reset
 * Reset completo da master seed (REQUER 2FA - OBRIGATÓRIO)
 * SECURITY: Rate limiting + 2FA obrigatório — operação DESTRUTIVA
 */
router.post('/reset', adminActionLimiter, require2FAMiddleware, masterSeedAdminController.resetMasterSeed.bind(masterSeedAdminController));

export default router;
