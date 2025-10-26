import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { internalBalanceService } from '../services/internal-balance.service';
import { collateralTransactionService } from '../services/collateral-transaction.service';

const prisma = new PrismaClient();

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

      const balances = await internalBalanceService.getAllBalances(userId);

      // Enriquecer com saldo disponível calculado
      const enrichedBalances = await Promise.all(
        balances.map(async (balance) => {
          const available = await internalBalanceService.getAvailableBalance(
            userId,
            balance.cryptoType,
            balance.network
          );

          return {
            ...balance,
            availableBalance: available.toFixed(8),
          };
        })
      );

      return res.json({
        success: true,
        data: { balances: enrichedBalances },
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

      const balance = await internalBalanceService.getBalance(userId, cryptoType, network);

      if (!balance) {
        return res.json({
          success: true,
          data: {
            balance: {
              cryptoType,
              network,
              balance: '0',
              lockedAmount: '0',
              availableAmount: '0',
            },
          },
        });
      }

      const available = await internalBalanceService.getAvailableBalance(
        userId,
        cryptoType,
        network
      );

      return res.json({
        success: true,
        data: {
          balance: {
            ...balance,
            availableBalance: available.toFixed(8),
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
      const { cryptoType, network, type, limit, offset } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      const transactions = await collateralTransactionService.getTransactionHistory(userId, {
        cryptoType: cryptoType as string,
        network: network as string,
        type: type as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      return res.json({
        success: true,
        data: { transactions },
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

      const stats = await collateralTransactionService.getUserCollateralStats(
        userId,
        cryptoType as string,
        network as string
      );

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
   * Iniciar depósito para saldo interno (gerar endereço)
   */
  async initiateDeposit(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { cryptoType, network, amount } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      if (!cryptoType || !network || !amount) {
        return res.status(400).json({
          success: false,
          message: 'cryptoType, network e amount são obrigatórios',
        });
      }

      // Usar o serviço de collateral existente para gerar endereço
      const { collateralService } = require('../services/collateral.service');
      const collateralAddress = await collateralService.generateCollateralAddress(
        userId,
        cryptoType,
        network,
        amount
      );

      return res.json({
        success: true,
        data: { collateralAddress },
        message: 'Endereço de depósito gerado. Envie o pagamento para creditá-lo em seu saldo interno.',
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

      const available = await internalBalanceService.getAvailableBalance(
        userId,
        cryptoType,
        network
      );

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
   * APENAS DESENVOLVIMENTO: Simula o recebimento de depósito
   */
  async simulateDeposit(req: Request, res: Response) {
    try {
      // SECURITY: Bloquear em produção
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          message: 'Endpoint de simulação não disponível em produção',
        });
      }

      const userId = req.user?.userId;
      const { addressId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      // Buscar endereço de colateral
      const collateralAddress = await prisma.collateralAddress.findUnique({
        where: { id: addressId },
      });

      if (!collateralAddress) {
        return res.status(404).json({
          success: false,
          message: 'Endereço de colateral não encontrado',
        });
      }

      // Verificar propriedade
      if (collateralAddress.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Este endereço não pertence a você',
        });
      }

      // Verificar status
      if (collateralAddress.status !== 'AWAITING_PAYMENT') {
        return res.status(400).json({
          success: false,
          message: `Endereço já processado (status: ${collateralAddress.status})`,
        });
      }

      // Simular recebimento do depósito
      const simulatedTxHash = `0xSIMULATED${Date.now()}${Math.random().toString(36).substring(7)}`;
      const actualAmount = collateralAddress.expectedAmount;

      // Atualizar endereço
      await prisma.collateralAddress.update({
        where: { id: addressId },
        data: {
          status: 'CONFIRMED',
          txHash: simulatedTxHash,
          actualAmount: actualAmount,
          confirmedAt: new Date(),
        },
      });

      // Creditar saldo interno
      await internalBalanceService.creditDeposit(
        userId,
        collateralAddress.cryptoType,
        collateralAddress.cryptoNetwork,
        actualAmount,
        simulatedTxHash
      );

      console.log(`🧪 [SIMULAÇÃO] Depósito simulado com sucesso:`);
      console.log(`   Usuário: ${userId}`);
      console.log(`   Valor: ${actualAmount} ${collateralAddress.cryptoType}`);
      console.log(`   TxHash: ${simulatedTxHash}`);

      return res.json({
        success: true,
        message: 'Depósito simulado com sucesso!',
        data: {
          addressId,
          txHash: simulatedTxHash,
          amount: actualAmount,
          cryptoType: collateralAddress.cryptoType,
          network: collateralAddress.cryptoNetwork,
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
