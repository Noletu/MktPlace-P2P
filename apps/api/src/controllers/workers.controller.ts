import { Request, Response } from 'express';
import { BalanceSyncWorker } from '../workers/balance-sync.worker';

/**
 * Workers Controller
 *
 * Gerencia controle de workers de background via HTTP
 */
export class WorkersController {
  /**
   * POST /api/v1/workers/balance-sync/toggle
   * Alterna estado do BalanceSyncWorker (liga/desliga)
   */
  async toggleBalanceSync(req: Request, res: Response) {
    try {
      const wasRunning = BalanceSyncWorker.isRunning();

      if (wasRunning) {
        BalanceSyncWorker.stop();
      } else {
        BalanceSyncWorker.start();
      }

      const isNowRunning = BalanceSyncWorker.isRunning();

      console.log(`🔄 [Workers] BalanceSyncWorker ${isNowRunning ? 'iniciado' : 'parado'} por admin`);

      return res.json({
        success: true,
        data: {
          worker: 'balance-sync',
          previousState: wasRunning ? 'running' : 'stopped',
          currentState: isNowRunning ? 'running' : 'stopped',
        },
        message: isNowRunning
          ? 'BalanceSyncWorker iniciado'
          : 'BalanceSyncWorker parado',
      });
    } catch (error: any) {
      console.error('❌ [Workers] Erro ao alternar worker:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao alternar worker',
      });
    }
  }

  /**
   * POST /api/v1/workers/balance-sync/start
   * Inicia o BalanceSyncWorker
   */
  async startBalanceSync(req: Request, res: Response) {
    try {
      if (BalanceSyncWorker.isRunning()) {
        return res.json({
          success: true,
          data: { worker: 'balance-sync', state: 'running' },
          message: 'Worker já está rodando',
        });
      }

      BalanceSyncWorker.start();

      console.log('▶️  [Workers] BalanceSyncWorker iniciado por admin');

      return res.json({
        success: true,
        data: { worker: 'balance-sync', state: 'running' },
        message: 'BalanceSyncWorker iniciado',
      });
    } catch (error: any) {
      console.error('❌ [Workers] Erro ao iniciar worker:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao iniciar worker',
      });
    }
  }

  /**
   * POST /api/v1/workers/balance-sync/stop
   * Para o BalanceSyncWorker
   */
  async stopBalanceSync(req: Request, res: Response) {
    try {
      if (!BalanceSyncWorker.isRunning()) {
        return res.json({
          success: true,
          data: { worker: 'balance-sync', state: 'stopped' },
          message: 'Worker já está parado',
        });
      }

      BalanceSyncWorker.stop();

      console.log('⏹️  [Workers] BalanceSyncWorker parado por admin');

      return res.json({
        success: true,
        data: { worker: 'balance-sync', state: 'stopped' },
        message: 'BalanceSyncWorker parado',
      });
    } catch (error: any) {
      console.error('❌ [Workers] Erro ao parar worker:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao parar worker',
      });
    }
  }

  /**
   * GET /api/v1/workers/balance-sync/status
   * Retorna status atual do BalanceSyncWorker
   */
  async getBalanceSyncStatus(req: Request, res: Response) {
    try {
      const isRunning = BalanceSyncWorker.isRunning();

      return res.json({
        success: true,
        data: {
          worker: 'balance-sync',
          state: isRunning ? 'running' : 'stopped',
          interval: '5 minutes',
          description: 'Sincroniza saldos on-chain com banco de dados',
        },
      });
    } catch (error: any) {
      console.error('❌ [Workers] Erro ao verificar status:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao verificar status',
      });
    }
  }
}

export const workersController = new WorkersController();
