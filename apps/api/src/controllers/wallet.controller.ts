import {Request, Response} from 'express';
import {WalletService} from '../services/wallet.service';
import {z} from 'zod';

/**
 * Wallet Controller
 *
 * Gerencia endpoints HTTP para carteiras HD
 */

// Validation schemas
const CreateWalletSchema = z.object({
  cryptoType: z.string().min(1),
  network: z.string().min(1),
});

const WithdrawalRequestSchema = z.object({
  toAddress: z.string().min(10),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});

export class WalletController {
  /**
   * POST /api/v1/wallets
   * Cria uma nova carteira HD para o usuário
   */
  async createWallet(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const validatedData = CreateWalletSchema.parse(req.body);

      const wallet = await WalletService.createWallet(
        userId,
        validatedData.cryptoType,
        validatedData.network
      );

      res.status(201).json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid data',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Error creating wallet',
      });
    }
  }

  /**
   * GET /api/v1/wallets
   * Lista todas as carteiras do usuário
   */
  async getUserWallets(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      // AUTO-RECALCULO: corrigir inconsistências de lockedBalance antes de retornar
      try {
        await WalletService.recalculateLockedBalance(userId);
      } catch (recalcError) {
        console.error('⚠️ Auto-recalculo falhou em /wallets:', recalcError);
      }

      const wallets = await WalletService.getUserWallets(userId);

      res.json({
        success: true,
        data: wallets,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Error fetching wallets',
      });
    }
  }

  /**
   * GET /api/v1/wallets/:id
   * Busca uma carteira específica
   */
  async getWallet(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const {id} = req.params;

      const wallet = await WalletService.getWallet(id);

      // Verificar ownership
      if (wallet.userId !== userId) {
        return res.status(403).json({error: 'Forbidden'});
      }

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Error fetching wallet',
      });
    }
  }

  /**
   * GET /api/v1/wallets/:id/balance
   * Obtém saldo da carteira
   */
  async getBalance(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const {id} = req.params;

      // Verificar ownership
      const wallet = await WalletService.getWallet(id);
      if (wallet.userId !== userId) {
        return res.status(403).json({error: 'Forbidden'});
      }

      const balance = await WalletService.getBalance(id);

      res.json({
        success: true,
        data: balance,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Error fetching balance',
      });
    }
  }

  /**
   * GET /api/v1/wallets/:id/transactions
   * Obtém histórico de transações
   */
  async getTransactions(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const {id} = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Verificar ownership
      const wallet = await WalletService.getWallet(id);
      if (wallet.userId !== userId) {
        return res.status(403).json({error: 'Forbidden'});
      }

      const transactions = await WalletService.getTransactions(
        id,
        limit,
        offset
      );

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Error fetching transactions',
      });
    }
  }

  /**
   * POST /api/v1/wallets/:id/sync
   * Força sincronização do saldo com blockchain
   */
  async syncBalance(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const {id} = req.params;

      // Verificar ownership
      const wallet = await WalletService.getWallet(id);
      if (wallet.userId !== userId) {
        return res.status(403).json({error: 'Forbidden'});
      }

      const result = await WalletService.syncBalanceFromBlockchain(id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Error syncing balance',
      });
    }
  }

  /**
  /**
   * POST /api/v1/wallets/:id/test-balance
   * Adiciona saldo de teste (DEV ONLY)
   */
  async addTestBalance(req: Request, res: Response) {
    try {
      // Verificar ambiente
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          error: 'Test balance feature is disabled in production',
        });
      }

      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const {id} = req.params;
      const {amount} = req.body;

      // Validar amount
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          error: 'Invalid amount. Must be a positive number.',
        });
      }

      // Verificar ownership
      const wallet = await WalletService.getWallet(id);
      if (wallet.userId !== userId) {
        return res.status(403).json({error: 'Forbidden'});
      }

      // Adicionar saldo de teste
      const result = await WalletService.addTestBalance(id, amount);

      res.status(200).json({
        success: true,
        message: 'Test balance added successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Error adding test balance',
      });
    }
  }

  /**
   * POST /api/v1/wallets/:id/withdraw
   * Solicita saque da carteira
   */
  async requestWithdrawal(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const {id} = req.params;
      const validatedData = WithdrawalRequestSchema.parse(req.body);

      // Verificar ownership
      const wallet = await WalletService.getWallet(id);
      if (wallet.userId !== userId) {
        return res.status(403).json({error: 'Forbidden'});
      }

      const withdrawal = await WalletService.requestWithdrawal(
        id,
        validatedData.toAddress,
        validatedData.amount
      );

      res.status(201).json({
        success: true,
        data: withdrawal,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid data',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Error requesting withdrawal',
      });
    }
  }

  /**
   * GET /api/v1/wallets/crypto/:cryptoType/network/:network
   * Busca carteira específica por crypto e rede
   */
  async getWalletByUserAndCrypto(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const {cryptoType, network} = req.params;

      const wallet = await WalletService.getWalletByUserAndCrypto(
        userId,
        cryptoType,
        network
      );

      if (!wallet) {
        return res.status(404).json({
          error: 'Wallet not found',
        });
      }

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Error fetching wallet',
      });
    }
  }
}

export const walletController = new WalletController();
