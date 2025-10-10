import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter.middleware';
import { optionalRecaptchaMiddleware } from '../middleware/recaptcha.middleware';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Registrar novo usuário
 * @access  Public
 */
router.post('/register', registerLimiter, optionalRecaptchaMiddleware, (req, res) => authController.register(req, res));

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
router.get('/check-email', (req, res) => authController.checkEmail(req, res));

/**
 * @route   GET /api/v1/auth/check-cpf
 * @desc    Verificar se CPF está disponível
 * @access  Public
 */
router.get('/check-cpf', (req, res) => authController.checkCpf(req, res));

export default router;
