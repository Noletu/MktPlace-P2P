import {Router} from 'express';
import {walletController} from '../controllers/wallet.controller';
import {authMiddleware} from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * Wallet Routes - HD Wallet System
 *
 * POST   /api/v1/wallets                                - Criar nova carteira HD
 * GET    /api/v1/wallets                                - Listar todas carteiras do usuário
 * GET    /api/v1/wallets/:id                            - Buscar carteira específica
 * GET    /api/v1/wallets/:id/balance                    - Obter saldo
 * GET    /api/v1/wallets/:id/transactions               - Histórico de transações
 * POST   /api/v1/wallets/:id/sync                       - Forçar sincronização
 * POST   /api/v1/wallets/:id/test-balance               - Adicionar saldo de teste (DEV ONLY)
 * POST   /api/v1/wallets/:id/withdraw                   - Solicitar saque
 * GET    /api/v1/wallets/crypto/:cryptoType/network/:network - Buscar por crypto/rede
 */

// Criar nova carteira HD
router.post('/', walletController.createWallet.bind(walletController));

// Listar todas carteiras do usuário
router.get('/', walletController.getUserWallets.bind(walletController));

// Listar saques do usuário (deve vir ANTES de /:id para não conflitar)
router.get(
  '/my-withdrawals',
  walletController.getMyWithdrawals.bind(walletController)
);

// Buscar carteira por crypto e rede (deve vir ANTES de /:id para não conflitar)
router.get(
  '/crypto/:cryptoType/network/:network',
  walletController.getWalletByUserAndCrypto.bind(walletController)
);

// Buscar carteira específica
router.get('/:id', walletController.getWallet.bind(walletController));

// Obter saldo
router.get('/:id/balance', walletController.getBalance.bind(walletController));

// Histórico de transações
router.get(
  '/:id/transactions',
  walletController.getTransactions.bind(walletController)
);

// Forçar sincronização com blockchain
router.post('/:id/sync', walletController.syncBalance.bind(walletController));

// Adicionar saldo de teste (DEV ONLY)
router.post(
  '/:id/test-balance',
  walletController.addTestBalance.bind(walletController)
);

// Estimar custos de saque
router.get(
  '/:id/withdrawal-estimate',
  walletController.getWithdrawalEstimate.bind(walletController)
);

// Solicitar saque
router.post(
  '/:id/withdraw',
  walletController.requestWithdrawal.bind(walletController)
);

export default router;
