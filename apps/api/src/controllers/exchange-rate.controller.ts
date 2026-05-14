import {Request, Response} from 'express';
import {ExchangeRateService} from '../services/exchange-rate.service';

export class ExchangeRateController {
  /**
   * GET /api/v1/exchange-rate/health
   * Retorna métricas de saúde das fontes
   */
  async getHealth(req: Request, res: Response) {
    try {
      const metrics = ExchangeRateService.getHealthMetrics();

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar métricas',
      });
    }
  }

  /**
   * GET /api/v1/exchange-rate/validate
   * Valida consistência entre múltiplas fontes
   */
  async validateConsistency(req: Request, res: Response) {
    try {
      const validation = await ExchangeRateService.validateRateConsistency();

      res.json({
        success: true,
        data: validation,
        warning: !validation.isConsistent
          ? 'Divergência detectada entre fontes!'
          : null,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao validar consistência',
      });
    }
  }

  /**
   * GET /api/v1/exchange-rate/current
   * Retorna taxa atual
   */
  async getCurrentRate(req: Request, res: Response) {
    try {
      const rate = await ExchangeRateService.getUsdBrlRate();

      res.json({
        success: true,
        data: rate,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar taxa',
      });
    }
  }
}

export const exchangeRateController = new ExchangeRateController();
