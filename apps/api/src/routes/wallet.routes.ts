import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Criar carteira
router.post('/', walletController.createWallet.bind(walletController));

// Listar carteiras do usuário
router.get('/', walletController.getUserWallets.bind(walletController));

// Obter carteira específica
router.get('/:walletId', walletController.getWallet.bind(walletController));

// Desativar carteira
router.delete('/:walletId', walletController.deactivateWallet.bind(walletController));

export default router;
