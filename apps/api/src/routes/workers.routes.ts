import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { supportMiddleware } from '../middleware/support.middleware';
import { collateralReleaseWorker } from '../workers/collateral-release.worker';
import { orderExpirationWorker } from '../workers/order-expiration.worker';
// import { DepositMonitorWorker } from '../workers/deposit-monitor.worker'; // Now uses static class
import { presenceMonitorWorker } from '../workers/presence-monitor.worker';
import { chatArchiveWorker } from '../workers/chat-archive.worker';
import { workersController } from '../controllers/workers.controller';

const router = Router();

// SECURITY: Require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/workers/status
 * Obter status de todos os workers
 */
router.get('/status', supportMiddleware, async (req: Request, res: Response) => {
  try {
    const workersStatus = {
      collateralRelease: collateralReleaseWorker.getStatus(),
      orderExpiration: {
        isRunning: true, // orderExpirationWorker não tem getStatus ainda
        note: 'Status method not implemented',
      },
      depositMonitor: {
        isRunning: true,
        note: 'Status method not implemented',
      },
      presenceMonitor: {
        isRunning: true,
        note: 'Status method not implemented',
      },
      chatArchive: {
        isRunning: true,
        note: 'Status method not implemented',
      },
    };

    res.json({
      success: true,
      data: workersStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Erro ao buscar status dos workers',
    });
  }
});

/**
 * POST /api/v1/workers/collateral-release/check-orphaned
 * Forçar verificação de colaterais órfãos
 */
router.post('/collateral-release/check-orphaned', supportMiddleware, async (req: Request, res: Response) => {
  try {
    await collateralReleaseWorker.checkOrphanedCollateral();

    res.json({
      success: true,
      message: 'Verificação de colaterais órfãos concluída',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Erro ao verificar colaterais órfãos',
    });
  }
});

/**
 * POST /api/v1/workers/collateral-release/process-now
 * Forçar processamento de colaterais bloqueados
 */
router.post('/collateral-release/process-now', supportMiddleware, async (req: Request, res: Response) => {
  try {
    await collateralReleaseWorker.processLockedCollateral();

    res.json({
      success: true,
      message: 'Processamento de colaterais bloqueados iniciado',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Erro ao processar colaterais',
    });
  }
});

/**
 * BalanceSyncWorker Controls
 * SECURITY: SUPPORT+ (level >= 40) podem controlar workers
 */

// GET /api/v1/workers/balance-sync/status
router.get('/balance-sync/status', supportMiddleware, workersController.getBalanceSyncStatus.bind(workersController));

// POST /api/v1/workers/balance-sync/start
router.post('/balance-sync/start', supportMiddleware, workersController.startBalanceSync.bind(workersController));

// POST /api/v1/workers/balance-sync/stop
router.post('/balance-sync/stop', supportMiddleware, workersController.stopBalanceSync.bind(workersController));

// POST /api/v1/workers/balance-sync/toggle
router.post('/balance-sync/toggle', supportMiddleware, workersController.toggleBalanceSync.bind(workersController));

export default router;
