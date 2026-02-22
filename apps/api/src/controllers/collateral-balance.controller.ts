import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WalletService } from '../services/wallet.service';

const prisma = new PrismaClient();

/**
 * Collateral Balance Controller (Migrado para HD Wallet System)
 *
 * MIGRAÇÃO COMPLETA: Agora usa WalletService em vez de InternalBalanceService
 * Mantém compatibilidade com API existente do frontend
 */
export class CollateralBalanceController {
  /**
   * GET /api/v1/collateral-balance
   * Obter todos os saldos de colateral do usuário
   */
  async getBalances(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      // AUTO-RECALCULO: corrigir inconsistências de lockedBalance antes de retornar
      try {
        const recalcResults = await WalletService.recalculateLockedBalance(userId);
        const corrected = recalcResults.filter((r) => r.corrected);
        if (corrected.length > 0) {
          console.log(`🔧 Auto-recalculo corrigiu ${corrected.length} carteira(s) para user ${userId}`);
        }
      } catch (recalcError) {
        console.error('⚠️ Auto-recalculo falhou (continuando com saldos existentes):', recalcError);
      }

      // Buscar carteiras (já corrigidas se o recalculo funcionou)
      const wallets = await WalletService.getUserWallets(userId);

      // Transformar para formato compatível com frontend
      const balances = wallets.map((wallet) => ({
        id: wallet.id,
        cryptoType: wallet.cryptoType,
        network: wallet.network,
        balance: wallet.balance,
        lockedBalance: wallet.lockedBalance,
        availableBalance: wallet.availableBalance,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        address: wallet.address,
        isActive: wallet.isActive,
        createdAt: wallet.createdAt,
      }));

      return res.json({
        success: true,
        data: balances,
      });
    } catch (error: any) {
      console.error('❌ Error getting collateral balances:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar saldos de colateral',
      });
    }
  }

  /**
   * GET /api/v1/collateral-balance/:cryptoType/:network
   * Obter saldo específico de uma cripto/rede
   */
  async getBalance(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { cryptoType, network } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      // Buscar carteira específica
      const wallet = await WalletService.getWalletByUserAndCrypto(
        userId,
        cryptoType,
        network
      );

      if (!wallet) {
        // Retornar saldo zerado se não existe
        return res.json({
          success: true,
          data: {
            balance: {
              cryptoType,
              network,
              balance: '0',
              lockedBalance: '0',
              availableBalance: '0',
            },
          },
        });
      }

      // Formato compatível com frontend
      return res.json({
        success: true,
        data: {
          balance: {
            id: wallet.id,
            cryptoType: wallet.cryptoType,
            network: wallet.network,
            balance: wallet.balance,
            lockedBalance: wallet.lockedBalance,
            availableBalance: wallet.availableBalance,
            address: wallet.address,
          },
        },
      });
    } catch (error: any) {
      console.error('❌ Error getting collateral balance:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar saldo de colateral',
      });
    }
  }

  /**
   * GET /api/v1/collateral-balance/history
   * Obter histórico de transações de colateral
   */
  async getHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { cryptoType, network, limit, offset } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      // Se especificou crypto/network, buscar carteira específica
      let walletIds: string[] = [];

      if (cryptoType && network) {
        const wallet = await WalletService.getWalletByUserAndCrypto(
          userId,
          cryptoType as string,
          network as string
        );
        if (wallet) {
          walletIds = [wallet.id];
        }
      } else {
        // Buscar todas as carteiras do usuário
        const wallets = await WalletService.getUserWallets(userId);
        walletIds = wallets.map((w) => w.id);
      }

      if (walletIds.length === 0) {
        return res.json({
          success: true,
          data: { transactions: [] },
        });
      }

      // Buscar transações de todas as carteiras relevantes
      const transactions = await prisma.walletTransaction.findMany({
        where: {
          walletId: { in: walletIds },
          userId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit as string) : 50,
        skip: offset ? parseInt(offset as string) : 0,
        include: {
          wallet: {
            select: {
              cryptoType: true,
              network: true,
              address: true,
            },
          },
        },
      });

      // Transformar para formato compatível
      const formattedTransactions = transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        cryptoType: tx.wallet.cryptoType,
        network: tx.wallet.network,
        address: tx.wallet.address,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        description: tx.description,
        txHash: tx.txHash,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
      }));

      return res.json({
        success: true,
        data: { transactions: formattedTransactions },
      });
    } catch (error: any) {
      console.error('❌ Error getting collateral history:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar histórico de colateral',
      });
    }
  }

  /**
   * GET /api/v1/collateral-balance/stats
   * Obter estatísticas de colateral do usuário
   */
  async getStats(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { cryptoType, network } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      // Buscar carteiras
      let wallets;
      if (cryptoType && network) {
        const wallet = await WalletService.getWalletByUserAndCrypto(
          userId,
          cryptoType as string,
          network as string
        );
        wallets = wallet ? [wallet] : [];
      } else {
        wallets = await WalletService.getUserWallets(userId);
      }

      // Calcular estatísticas
      const stats = {
        totalBalance: wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0).toString(),
        totalAvailable: wallets.reduce((sum, w) => sum + parseFloat(w.availableBalance), 0).toString(),
        totalLocked: wallets.reduce((sum, w) => sum + parseFloat(w.lockedBalance), 0).toString(),
        totalDeposited: wallets.reduce((sum, w) => sum + parseFloat(w.totalDeposited), 0).toString(),
        totalWithdrawn: wallets.reduce((sum, w) => sum + parseFloat(w.totalWithdrawn), 0).toString(),
        walletsCount: wallets.length,
      };

      return res.json({
        success: true,
        data: { stats },
      });
    } catch (error: any) {
      console.error('❌ Error getting collateral stats:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar estatísticas de colateral',
      });
    }
  }

  /**
   * POST /api/v1/collateral-balance/deposit
   * Iniciar depósito para saldo interno (retorna endereço da carteira existente)
   */
  async initiateDeposit(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { cryptoType, network } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      if (!cryptoType || !network) {
        return res.status(400).json({
          success: false,
          message: 'cryptoType e network são obrigatórios',
        });
      }

      // Buscar ou criar carteira HD
      let wallet = await WalletService.getWalletByUserAndCrypto(
        userId,
        cryptoType,
        network
      );

      if (!wallet) {
        // Criar nova carteira HD
        wallet = await WalletService.createWallet(userId, cryptoType, network);
      }

      // Retornar endereço para depósito
      return res.json({
        success: true,
        data: {
          depositAddress: {
            id: wallet.id,
            address: wallet.address,
            cryptoType: wallet.cryptoType,
            network: wallet.network,
            qrCode: `${wallet.network}:${wallet.address}`, // Formato para QR code
          },
        },
        message: `Envie ${cryptoType} para o endereço abaixo. O saldo será creditado automaticamente após confirmação on-chain.`,
      });
    } catch (error: any) {
      console.error('❌ Error initiating deposit:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao iniciar depósito',
      });
    }
  }

  /**
   * GET /api/v1/collateral-balance/check-sufficient/:cryptoType/:network/:amount
   * Verificar se usuário tem saldo suficiente
   */
  async checkSufficient(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { cryptoType, network, amount } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      const wallet = await WalletService.getWalletByUserAndCrypto(
        userId,
        cryptoType,
        network
      );

      const available = wallet ? parseFloat(wallet.availableBalance) : 0;
      const required = parseFloat(amount);
      const hasSufficient = available >= required;

      return res.json({
        success: true,
        data: {
          hasSufficient,
          available: available.toFixed(8),
          required: required.toFixed(8),
          missing: hasSufficient ? '0' : (required - available).toFixed(8),
        },
      });
    } catch (error: any) {
      console.error('❌ Error checking sufficient balance:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao verificar saldo',
      });
    }
  }

  /**
   * POST /api/v1/collateral-balance/simulate-deposit/:addressId
   * SIMULAÇÃO DE SALDO DE TESTE (Disponível em produção com aviso)
   */
  async simulateDeposit(req: Request, res: Response) {
    try {
      // Agora disponível em produção - frontend mostra aviso claro

      const userId = req.user?.userId;
      const { addressId } = req.params;
      const { amount } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      // Buscar carteira (usando addressId como walletId)
      const wallet = await prisma.userWallet.findUnique({
        where: { id: addressId },
      });

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Carteira não encontrada',
        });
      }

      // Verificar propriedade
      if (wallet.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Esta carteira não pertence a você',
        });
      }

      // Adicionar saldo de teste
      const testAmount = amount || wallet.balance || '0.1';
      await WalletService.addTestBalance(wallet.id, testAmount);

      const simulatedTxHash = `0xTEST${Date.now()}${Math.random().toString(36).substring(7)}`;

      console.log(`🧪 [SIMULAÇÃO] Saldo de teste adicionado:`);
      console.log(`   Usuário: ${userId}`);
      console.log(`   Carteira: ${wallet.id}`);
      console.log(`   Valor: ${testAmount} ${wallet.cryptoType}`);
      console.log(`   TxHash: ${simulatedTxHash}`);

      return res.json({
        success: true,
        message: 'Saldo de teste adicionado com sucesso!',
        data: {
          walletId: wallet.id,
          txHash: simulatedTxHash,
          amount: testAmount,
          cryptoType: wallet.cryptoType,
          network: wallet.network,
        },
      });
    } catch (error: any) {
      console.error('❌ Error simulating deposit:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao simular depósito',
      });
    }
  }
}

export const collateralBalanceController = new CollateralBalanceController();
