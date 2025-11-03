import { Request, Response } from 'express';
import { collateralService } from '../services/collateral.service';

export class CollateralController {
  /**
   * Gera endereço de depósito para colateral
   */
  async generateDepositAddress(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        console.log('❌ UserId não encontrado no token:', req.user);
        return res.status(401).json({
          success: false,
          error: 'Não autenticado',
        });
      }

      console.log('✅ Gerando endereço de colateral para usuário:', userId);

      const { cryptoType, cryptoNetwork, expectedAmount } = req.body;

      if (!cryptoType || !cryptoNetwork || !expectedAmount) {
        return res.status(400).json({
          success: false,
          error: 'cryptoType, cryptoNetwork e expectedAmount são obrigatórios',
        });
      }

      const collateralAddress = await collateralService.generateCollateralAddress(
        userId,
        cryptoType,
        cryptoNetwork,
        expectedAmount
      );

      res.json({
        success: true,
        data: collateralAddress,
      });
    } catch (error: any) {
      console.error('Erro ao gerar endereço de colateral:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao gerar endereço de depósito',
      });
    }
  }

  /**
   * Verifica status do pagamento
   */
  async checkPaymentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const collateralAddress = await collateralService.checkCollateralPayment(id);

      res.json({
        success: true,
        data: collateralAddress,
      });
    } catch (error: any) {
      console.error('Erro ao verificar pagamento:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao verificar status do pagamento',
      });
    }
  }

  /**
   * Simula recebimento de pagamento (DESENVOLVIMENTO APENAS)
   */
  async simulatePayment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: 'Endpoint disponível apenas em desenvolvimento',
        });
      }

      const collateralAddress = await collateralService.simulatePaymentReceived(id);

      res.json({
        success: true,
        data: collateralAddress,
        message: '⚠️ Pagamento simulado com sucesso (desenvolvimento)',
      });
    } catch (error: any) {
      console.error('Erro ao simular pagamento:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao simular pagamento',
      });
    }
  }

  /**
   * Requisita saque de colateral
   */
  async requestWithdrawal(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autenticado',
        });
      }

      const { cryptoType, cryptoNetwork, amount, destinationAddress } = req.body;

      if (!cryptoType || !cryptoNetwork || !amount || !destinationAddress) {
        return res.status(400).json({
          success: false,
          error: 'cryptoType, cryptoNetwork, amount e destinationAddress são obrigatórios',
        });
      }

      const withdrawal = await collateralService.requestWithdrawal(
        userId,
        cryptoType,
        cryptoNetwork,
        amount,
        destinationAddress
      );

      res.json({
        success: true,
        data: withdrawal,
        message: 'Saque solicitado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao solicitar saque:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao solicitar saque',
      });
    }
  }

  /**
   * Simula conclusão de saque (DESENVOLVIMENTO APENAS)
   */
  async simulateWithdrawalComplete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: 'Endpoint disponível apenas em desenvolvimento',
        });
      }

      const withdrawal = await collateralService.simulateWithdrawalComplete(id);

      res.json({
        success: true,
        data: withdrawal,
        message: '⚠️ Saque simulado com sucesso (desenvolvimento)',
      });
    } catch (error: any) {
      console.error('Erro ao simular saque:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao simular saque',
      });
    }
  }
}

export const collateralController = new CollateralController();
