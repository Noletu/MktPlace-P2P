import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { collateralReleaseWorker } from '../workers/collateral-release.worker';
import { orderExpirationWorker } from '../workers/order-expiration.worker';
// import { DepositMonitorWorker } from '../workers/deposit-monitor.worker'; // Now uses static class
import { presenceMonitorWorker } from '../workers/presence-monitor.worker';
import { chatArchiveWorker } from '../workers/chat-archive.worker';

const router = Router();

// SECURITY: Require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/workers/status
 * Obter status de todos os workers
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // SECURITY: Apenas admins podem ver status dos workers
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado - apenas admins' });
    }

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
router.post('/collateral-release/check-orphaned', async (req: Request, res: Response) => {
  try {
    // SECURITY: Apenas admins podem forçar verificações
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado - apenas admins' });
    }

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
router.post('/collateral-release/process-now', async (req: Request, res: Response) => {
  try {
    // SECURITY: Apenas admins podem forçar processamento
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado - apenas admins' });
    }

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

export default router;
