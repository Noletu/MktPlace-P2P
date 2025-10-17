import presenceService from '../services/presence.service';
import { logger } from '../utils/logger';

/**
 * Worker: Auto-offline para pedidos sem heartbeat há 3+ minutos
 * Roda a cada 1 minuto
 */
export function startPresenceMonitorWorker() {
  const INTERVAL = 60 * 1000; // 1 minuto

  const check = async () => {
    try {
      const count = await presenceService.autoOfflineStaleOrders();

      if (count > 0) {
        logger.info(`[PRESENCE-MONITOR] ${count} orders marked offline (no heartbeat 3min)`, {
          count,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('[PRESENCE-MONITOR] Error checking presence:', error);
    }
  };

  // Primeira execução após 15 segundos
  setTimeout(check, 15000);

  // Depois repetir a cada minuto
  const interval = setInterval(check, INTERVAL);

  logger.info('[PRESENCE-MONITOR] Worker started - checking every 1 minute');

  return () => clearInterval(interval);
}

export const presenceMonitorWorker = { start: startPresenceMonitorWorker };
