import { Request, Response } from 'express';
import negotiationService from '../services/negotiation.service';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';

export class NegotiationController {
  /**
   * Cancelar negociação voluntariamente
   * POST /api/v1/orders/:orderId/negotiation/cancel
   */
  async cancelNegotiation(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;

      const order = await negotiationService.cancelNegotiation(orderId, userId, 'user');

      // Audit log
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.NEGOTIATION_CANCELLED,
        AUDIT_RESOURCES.ORDER,
        orderId,
        { reason: 'user' }
      );

      res.json({
        success: true,
        data: order,
        message: 'Negociação cancelada. Pedido voltou para o marketplace.',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao cancelar negociação',
      });
    }
  }

  /**
   * Verificar se usuário pode negociar
   * GET /api/v1/orders/:orderId/negotiation/can-negotiate
   */
  async canNegotiate(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;

      const canNegotiate = await negotiationService.canUserNegotiate(orderId, userId);

      res.json({
        success: true,
        data: {
          canNegotiate,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao verificar permissão',
      });
    }
  }

  /**
   * Obter informações da negociação
   * GET /api/v1/orders/:orderId/negotiation/info
   */
  async getNegotiationInfo(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;

      const info = await negotiationService.getNegotiationInfo(orderId);

      res.json({
        success: true,
        data: info,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar informações',
      });
    }
  }
}

export default new NegotiationController();
