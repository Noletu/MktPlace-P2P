import { Request, Response } from 'express';
import presenceService from '../services/presence.service';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';

export class PresenceController {
  /**
   * Toggle presença online/offline
   * POST /api/v1/orders/:orderId/presence/toggle
   */
  async togglePresence(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;
      const { online } = req.body;

      if (typeof online !== 'boolean') {
        return res.status(400).json({ error: 'Campo "online" é obrigatório (boolean)' });
      }

      const order = await presenceService.togglePresence(orderId, userId, online);

      // Audit log
      auditLogService.logFromRequest(
        req,
        online ? AUDIT_ACTIONS.PRESENCE_ONLINE : AUDIT_ACTIONS.PRESENCE_OFFLINE,
        AUDIT_RESOURCES.ORDER,
        orderId,
        { online }
      );

      res.json({
        success: true,
        data: {
          orderId: order.id,
          ownerOnline: order.ownerOnline,
          ownerLastSeenAt: order.ownerLastSeenAt,
          ownerLastActivityAt: order.ownerLastActivityAt,
        },
        message: online ? 'Você está online para este pedido' : 'Você está offline para este pedido',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao alterar presença',
      });
    }
  }

  /**
   * Heartbeat - manter presença online
   * POST /api/v1/orders/:orderId/presence/heartbeat
   */
  async sendHeartbeat(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;

      await presenceService.sendHeartbeat(orderId, userId);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao enviar heartbeat',
      });
    }
  }

  /**
   * Buscar pedidos online do usuário
   * GET /api/v1/presence/my-online-orders
   */
  async getMyOnlineOrders(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const orders = await presenceService.getOnlineOrders(userId);

      res.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar pedidos online',
      });
    }
  }

  /**
   * Estatísticas de presença do usuário
   * GET /api/v1/presence/stats
   */
  async getPresenceStats(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const stats = await presenceService.getUserPresenceStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  }
}

export default new PresenceController();
