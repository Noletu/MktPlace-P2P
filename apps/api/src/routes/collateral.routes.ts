import { Router } from 'express';
import { collateralController } from '../controllers/collateral.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Gerar endereço de depósito para colateral
router.post('/generate', collateralController.generateDepositAddress.bind(collateralController));

// Verificar status do pagamento
router.get('/:id/status', collateralController.checkPaymentStatus.bind(collateralController));

// Simular pagamento (desenvolvimento apenas)
router.post('/:id/simulate-payment', collateralController.simulatePayment.bind(collateralController));

// Requisitar saque
router.post('/withdraw', collateralController.requestWithdrawal.bind(collateralController));

// Simular conclusão de saque (desenvolvimento apenas)
router.post('/withdraw/:id/simulate-complete', collateralController.simulateWithdrawalComplete.bind(collateralController));

export default router;
