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
}

export const collateralController = new CollateralController();
