import { Request, Response } from 'express';
import { refundService } from '../services/refund.service';

export class RefundController {
  /**
   * Estimar valores de devolução
   */
  async estimateRefund(req: Request, res: Response) {
    try {
      const { orderId } = req.params;

      const estimate = await refundService.estimateRefund(orderId);

      res.json({
        success: true,
        data: estimate,
      });
    } catch (error: any) {
      console.error('Erro ao estimar devolução:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao estimar devolução',
      });
    }
  }

  /**
   * Cancelar pedido manualmente
   */
  async cancelOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const result = await refundService.cancelOrderForRefund(
        orderId,
        userId,
        'USER_CANCELLED'
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao cancelar pedido:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao cancelar pedido',
      });
    }
  }

  /**
   * Processar devolução via blockchain
   */
  async refundBlockchain(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const result = await refundService.refundToBlockchain(orderId, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao processar devolução blockchain:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao processar devolução',
      });
    }
  }

  /**
   * Processar devolução via crédito interno
   */
  async refundInternalCredit(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const result = await refundService.refundToInternalCredit(orderId, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao processar devolução crédito interno:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao processar devolução',
      });
    }
  }
}

export const refundController = new RefundController();
