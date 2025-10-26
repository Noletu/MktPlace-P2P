import { Router } from 'express';
import { collateralBalanceController } from '../controllers/collateral-balance.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * GET /api/v1/collateral-balance
 * Obter todos os saldos de colateral do usuário
 */
router.get('/', collateralBalanceController.getBalances.bind(collateralBalanceController));

/**
 * GET /api/v1/collateral-balance/history
 * Obter histórico de transações
 */
router.get('/history', collateralBalanceController.getHistory.bind(collateralBalanceController));

/**
 * GET /api/v1/collateral-balance/stats
 * Obter estatísticas de colateral
 */
router.get('/stats', collateralBalanceController.getStats.bind(collateralBalanceController));

/**
 * POST /api/v1/collateral-balance/deposit
 * Iniciar depósito para saldo interno
 */
router.post('/deposit', collateralBalanceController.initiateDeposit.bind(collateralBalanceController));

/**
 * GET /api/v1/collateral-balance/check-sufficient/:cryptoType/:network/:amount
 * Verificar se tem saldo suficiente
 */
router.get(
  '/check-sufficient/:cryptoType/:network/:amount',
  collateralBalanceController.checkSufficient.bind(collateralBalanceController)
);

/**
 * POST /api/v1/collateral-balance/simulate-deposit/:addressId
 * APENAS DESENVOLVIMENTO: Simular recebimento de depósito
 */
router.post(
  '/simulate-deposit/:addressId',
  collateralBalanceController.simulateDeposit.bind(collateralBalanceController)
);

/**
 * GET /api/v1/collateral-balance/:cryptoType/:network
 * Obter saldo específico de uma cripto/rede
 */
router.get('/:cryptoType/:network', collateralBalanceController.getBalance.bind(collateralBalanceController));

export default router;
