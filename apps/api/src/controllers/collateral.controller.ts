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

  // CRIT-09: o endpoint POST /:id/simulate-payment foi REMOVIDO.
  // A função `collateralService.simulatePaymentReceived` permanece para uso
  // exclusivo em testes automatizados (com guard interno que lança em prod).
  // Nunca reexpor por HTTP — ela credita saldo arbitrariamente.
}

export const collateralController = new CollateralController();
