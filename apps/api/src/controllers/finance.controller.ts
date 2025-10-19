import { Request, Response } from 'express';
import { financeService } from '../services/finance.service';

export class FinanceController {
  async getFinanceStats(req: Request, res: Response) {
    try {
      const stats = await financeService.getFinanceStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas financeiras:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getWalletBalances(req: Request, res: Response) {
    try {
      const balances = await financeService.getWalletBalances();
      res.json(balances);
    } catch (error: any) {
      console.error('Erro ao buscar saldos de carteiras:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const financeController = new FinanceController();
