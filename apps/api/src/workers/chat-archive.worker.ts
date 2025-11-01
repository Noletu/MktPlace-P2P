import cron from 'node-cron';
import { chatService } from '../services/chat.service';
import { logger } from '../utils/logger';

/**
 * Worker de limpeza de arquivos de chat expirados
 * Executa diariamente às 3h da manhã
 * Remove arquivos com mais de 1 ano (política de retenção)
 */
class ChatArchiveWorker {
  private cronJob: cron.ScheduledTask | null = null;

  /**
   * Iniciar worker
   */
  start() {
    // Executar diariamente às 3h da manhã
    this.cronJob = cron.schedule('0 3 * * *', async () => {
      logger.info('[CHAT ARCHIVE WORKER] Starting cleanup job');

      try {
        const result = await chatService.cleanupExpiredArchives();

        logger.info('[CHAT ARCHIVE WORKER] Cleanup completed', {
          deletedCount: result.deleted,
        });
      } catch (error: any) {
        logger.error('[CHAT ARCHIVE WORKER] Cleanup failed', {
          error: error.message,
          stack: error.stack,
        });
      }
    });

    logger.info('[CHAT ARCHIVE WORKER] Worker started - runs daily at 3:00 AM');

    // Executar uma vez ao iniciar (para testes/desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      logger.info('[CHAT ARCHIVE WORKER] Running initial cleanup (dev mode)');
      this.runCleanup();
    }
  }

  /**
   * Parar worker
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('[CHAT ARCHIVE WORKER] Worker stopped');
    }
  }

  /**
   * Executar limpeza manualmente (para testes)
   */
  async runCleanup() {
    try {
      logger.info('[CHAT ARCHIVE WORKER] Manual cleanup triggered');
      const result = await chatService.cleanupExpiredArchives();
      logger.info('[CHAT ARCHIVE WORKER] Manual cleanup completed', {
        deletedCount: result.deleted,
      });
      return result;
    } catch (error: any) {
      logger.error('[CHAT ARCHIVE WORKER] Manual cleanup failed', {
        error: error.message,
      });
      throw error;
    }
  }
}

export const chatArchiveWorker = new ChatArchiveWorker();
