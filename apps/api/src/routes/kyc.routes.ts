import { Router } from 'express';
import { kycController } from '../controllers/kyc.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { kycSubmissionLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// SECURITY: Submeter KYC Level 1 com rate limiting
router.post('/level1', kycSubmissionLimiter, kycController.submitLevel1.bind(kycController));

// Obter status KYC do usuário
router.get('/status', kycController.getKYCStatus.bind(kycController));

// Verificar se pode realizar transação
router.post('/check-limit', kycController.checkTransactionLimit.bind(kycController));

// Enviar código de verificação de telefone
router.post('/send-phone-verification', kycController.sendPhoneVerification.bind(kycController));

// Verificar código de telefone
router.post('/verify-phone', kycController.verifyPhone.bind(kycController));

export default router;
