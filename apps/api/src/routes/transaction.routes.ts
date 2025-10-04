import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { proofUploadLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// SECURITY: Submeter comprovante com rate limiting
router.post('/submit-proof', proofUploadLimiter, transactionController.submitProof.bind(transactionController));

// Listar transações do usuário
router.get('/my-transactions', transactionController.getUserTransactions.bind(transactionController));

// Obter detalhes da transação
router.get('/:transactionId', transactionController.getTransaction.bind(transactionController));

// Validar comprovante (admin/system)
router.post('/:transactionId/validate', transactionController.validateProof.bind(transactionController));

// Criar disputa
router.post('/:transactionId/dispute', transactionController.createDispute.bind(transactionController));

export default router;
