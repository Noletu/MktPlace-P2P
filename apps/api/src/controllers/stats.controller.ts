import { Request, Response } from 'express';
import { statsService } from '../services/stats.service';
import { logger } from '../utils/logger';

export class StatsController {
  /**
   * GET /api/v1/stats/activity?period=7d
   * Obter estatísticas de atividade do usuário
   */
  async getActivityStats(req: Request, res: Response) {
    try {
      const userId = (req as any).userId; // Definido pelo middleware de autenticação
      const period = (req.query.period as '7d' | '15d' | '30d' | '90d') || '7d';

      // Validar período
      const validPeriods = ['7d', '15d', '30d', '90d'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          success: false,
          message: 'Período inválido. Use: 7d, 15d, 30d ou 90d',
        });
      }

      logger.info(`[STATS] Getting activity stats for user ${userId}, period: ${period}`);

      const stats = await statsService.getActivityStats(userId, period);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('[STATS] Error getting activity stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao obter estatísticas de atividade',
        error: error.message,
      });
    }
  }
}

export const statsController = new StatsController();
