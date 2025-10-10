import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { proofUploadLimiter, disputeLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// SECURITY: Submeter comprovante com rate limiting
router.post('/submit-proof', proofUploadLimiter, transactionController.submitProof.bind(transactionController));

// Listar transações do usuário (simples)
router.get('/my-transactions', transactionController.getUserTransactions.bind(transactionController));

// Histórico completo com filtros
router.get('/history', transactionController.getTransactionHistory.bind(transactionController));

// Estatísticas de transações
router.get('/stats', transactionController.getTransactionStats.bind(transactionController));

// Timeline de atividades
router.get('/timeline', transactionController.getActivityTimeline.bind(transactionController));

// Obter detalhes da transação
router.get('/:transactionId', transactionController.getTransaction.bind(transactionController));

// Validar comprovante (admin/system)
router.post('/:transactionId/validate', transactionController.validateProof.bind(transactionController));

// SECURITY: Criar disputa com rate limiting
router.post('/:transactionId/dispute', disputeLimiter, transactionController.createDispute.bind(transactionController));

export default router;
