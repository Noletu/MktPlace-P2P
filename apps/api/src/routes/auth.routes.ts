import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authLimiter, registerLimiter, forgotPasswordLimiter, checkEmailLimiter } from '../middleware/rateLimiter.middleware';
import { optionalRecaptchaMiddleware, requiredRecaptchaMiddleware } from '../middleware/recaptcha.middleware';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Registrar novo usuário
 * @access  Public
 */
router.post('/register', registerLimiter, requiredRecaptchaMiddleware, (req, res) => authController.register(req, res));

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login de usuário
 * @access  Public
 */
router.post('/login', authLimiter, optionalRecaptchaMiddleware, (req, res) => authController.login(req, res));

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Renovar access token com refresh token
 * @access  Public
 */
router.post('/refresh', (req, res) => authController.refresh(req, res));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Obter dados do usuário autenticado
 * @access  Private
 */
router.get('/me', authMiddleware, (req, res) => authController.me(req, res));

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Atualizar perfil do usuário autenticado
 * @access  Private
 */
router.put('/profile', authMiddleware, (req, res) => authController.updateProfile(req, res));

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout de usuário (revogar refresh token)
 * @access  Private
 */
router.post('/logout', authMiddleware, (req, res) => authController.logout(req, res));

/**
 * @route   GET /api/v1/auth/check-email
 * @desc    Verificar se email está disponível
 * @access  Public
 */
router.get('/check-email', checkEmailLimiter, (req, res) => authController.checkEmail(req, res));

/**
 * @route   GET /api/v1/auth/check-cpf
 * @desc    Verificar se CPF está disponível
 * @access  Public
 */
router.get('/check-cpf', (req, res) => authController.checkCpf(req, res));

/**
 * @route   GET /api/v1/auth/public-profile/:userId
 * @desc    Obter perfil público de um usuário
 * @access  Public
 */
router.get('/public-profile/:userId', (req, res) => authController.getPublicProfile(req, res));

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Solicitar redefinicao de senha
 * @access  Public
 */
router.post('/forgot-password', forgotPasswordLimiter, (req, res) => authController.forgotPassword(req, res));

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Redefinir senha com token
 * @access  Public
 */
router.post('/reset-password', forgotPasswordLimiter, (req, res) => authController.resetPassword(req, res));

/**
 * @route   GET /api/v1/auth/socket-ticket
 * @desc    Obter ticket de curta duração (60s) para autenticação WebSocket
 * @access  Private
 */
router.get('/socket-ticket', authMiddleware, (req, res) => authController.socketTicket(req, res));

export default router;
