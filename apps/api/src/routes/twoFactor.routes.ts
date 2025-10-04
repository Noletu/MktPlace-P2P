import { Router } from 'express';
import { twoFactorController } from '../controllers/twoFactor.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route   GET /api/v1/2fa/status
 * @desc    Verificar status do 2FA
 * @access  Private
 */
router.get('/status', twoFactorController.status.bind(twoFactorController));

/**
 * @route   POST /api/v1/2fa/generate
 * @desc    Gerar secret e QR Code para 2FA
 * @access  Private
 */
router.post('/generate', twoFactorController.generateSecret.bind(twoFactorController));

/**
 * @route   POST /api/v1/2fa/enable
 * @desc    Habilitar 2FA
 * @access  Private
 */
router.post('/enable', twoFactorController.enable.bind(twoFactorController));

/**
 * @route   POST /api/v1/2fa/disable
 * @desc    Desabilitar 2FA
 * @access  Private
 */
router.post('/disable', twoFactorController.disable.bind(twoFactorController));

export default router;
