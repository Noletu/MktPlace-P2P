import { Router } from 'express';
import { keysController } from '../controllers/keys.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { require2FAMiddleware } from '../middleware/require2FA.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route   POST /api/v1/keys/public-key
 * @desc    Armazenar chave pública do usuário
 * @access  Private
 */
router.post('/public-key', keysController.storePublicKey.bind(keysController));

/**
 * @route   GET /api/v1/keys/public-key/:targetUserId
 * @desc    Buscar chave pública de um usuário específico
 * @access  Private
 */
router.get('/public-key/:targetUserId', keysController.getPublicKey.bind(keysController));

/**
 * @route   POST /api/v1/keys/public-keys
 * @desc    Buscar chaves públicas de múltiplos usuários
 * @access  Private
 * @body    { userIds: string[] }
 */
router.post('/public-keys', keysController.getPublicKeys.bind(keysController));

/**
 * @route   GET /api/v1/keys/has-public-key
 * @desc    Verificar se o usuário atual possui chave pública
 * @access  Private
 */
router.get('/has-public-key', keysController.hasPublicKey.bind(keysController));

/**
 * @route   POST /api/v1/keys/private-key-backup
 * @desc    Armazenar backup da chave privada criptografada
 * @access  Private
 */
// SECURITY: Armazenar/recuperar backup de chave privada exige 2FA
router.post('/private-key-backup', require2FAMiddleware, keysController.storePrivateKeyBackup.bind(keysController));

/**
 * @route   GET /api/v1/keys/private-key-backup
 * @desc    Recuperar backup da chave privada criptografada
 * @access  Private
 */
router.get('/private-key-backup', require2FAMiddleware, keysController.getPrivateKeyBackup.bind(keysController));

export default router;
