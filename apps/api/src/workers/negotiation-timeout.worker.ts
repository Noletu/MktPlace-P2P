import negotiationService from '../services/negotiation.service';
import { logger } from '../utils/logger';

/**
 * Worker: Timeout de negociações que estão há 10+ minutos sem match
 * Roda a cada 1 minuto
 */
export function startNegotiationTimeoutWorker() {
  const INTERVAL = 60 * 1000; // 1 minuto

  const check = async () => {
    try {
      const count = await negotiationService.timeoutStaleNegotiations();

      if (count > 0) {
        logger.info(`[NEGOTIATION-TIMEOUT] ${count} negotiations timed out (10min)`, {
          count,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('[NEGOTIATION-TIMEOUT] Error checking timeouts:', error);
    }
  };

  // Primeira execução após 10 segundos
  setTimeout(check, 10000);

  // Depois repetir a cada minuto
  const interval = setInterval(check, INTERVAL);

  logger.info('[NEGOTIATION-TIMEOUT] Worker started - checking every 1 minute');

  return () => clearInterval(interval);
}

export const negotiationTimeoutWorker = { start: startNegotiationTimeoutWorker };
