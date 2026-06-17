import { PrismaClient } from '@prisma/client';
import { internalBalanceService } from '../services/internal-balance.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Worker de Liberação Automática de Colateral
 *
 * Monitora pedidos que terminaram (COMPLETED, CANCELLED, EXPIRED, TIMEOUT)
 * e desbloqueia automaticamente o colateral do saldo interno.
 *
 * CRITICAL: Este worker garante que o saldo nunca fique bloqueado indefinidamente
 */
class CollateralReleaseWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 1000; // Verificar a cada 1 minuto
  private executionCount = 0;
  private lastExecution: Date | null = null;

  /**
   * Iniciar worker
   */
  start() {
    logger.info('🔓 [COLLATERAL WORKER] Starting...');

    // Executar imediatamente
    this.processLockedCollateral();

    // Executar periodicamente
    this.intervalId = setInterval(() => {
      this.processLockedCollateral();
    }, this.CHECK_INTERVAL);

    logger.info(`🔓 [COLLATERAL WORKER] Started successfully (interval: ${this.CHECK_INTERVAL / 1000}s)`);
  }

  /**
   * Parar worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('🔓 Collateral Release Worker stopped');
    }
  }

  /**
   * Processar pedidos com colateral bloqueado que já terminaram
   */
  async processLockedCollateral() {
    this.executionCount++;
    this.lastExecution = new Date();

    try {
      logger.info(`🔓 [COLLATERAL WORKER] Execution #${this.executionCount} at ${this.lastExecution.toISOString()}`);

      // Buscar pedidos com colateral bloqueado que já terminaram
      // Inclui HD_WALLET (sistema atual) e INTERNAL_BALANCE (ordens legadas)
      const finishedOrders = await prisma.order.findMany({
        where: {
          collateralSource: { in: ['HD_WALLET', 'INTERNAL_BALANCE'] },
          collateralLocked: true,
          status: {
            in: ['COMPLETED', 'CANCELLED', 'TIMEOUT', 'EXPIRED'],
          },
          collateralUnlockedAt: null, // Ainda não foi desbloqueado
        },
        include: {
          user: true,
        },
      });

      if (finishedOrders.length === 0) {
        logger.info('🔓 [COLLATERAL WORKER] No collateral to release (all clean)');
        return;
      }

      logger.info(`🔓 [COLLATERAL WORKER] Found ${finishedOrders.length} orders with collateral to release`);

      // Processar cada pedido
      let successCount = 0;
      let errorCount = 0;

      for (const order of finishedOrders) {
        try {
          await this.releaseCollateral(order);
          successCount++;
        } catch (error: any) {
          errorCount++;
          logger.error(`❌ [COLLATERAL WORKER] Error releasing collateral for order ${order.id}:`, error);
          // Continuar processando outros pedidos mesmo se houver erro
        }
      }

      logger.info(`✅ [COLLATERAL WORKER] Processing completed: ${successCount} released, ${errorCount} errors`);
    } catch (error: any) {
      logger.error('❌ [COLLATERAL WORKER] Critical error in worker:', error);
    }
  }

  /**
   * Liberar colateral de um pedido específico
   */
  private async releaseCollateral(order: any) {
    // Validar que há colateral para liberar
    if (!order.collateralLockedAmount) {
      logger.warn(`⚠️ Pedido ${order.id} não tem collateralLockedAmount`);
      return;
    }

    // Validar que temos os dados necessários para desbloquear
    if (!order.userId || !order.cryptoType || !order.cryptoNetwork) {
      logger.warn(`⚠️ Pedido ${order.id} está faltando dados necessários (userId, cryptoType ou cryptoNetwork)`);
      return;
    }

    logger.info(`🔓 Liberando colateral do pedido ${order.id}...`);
    logger.info(`   Status: ${order.status}`);
    logger.info(`   Valor bloqueado: ${order.collateralLockedAmount} ${order.cryptoType}`);

    // Desbloquear saldo usando o adapter service
    // O internalBalanceService é um adapter que internamente usa WalletService
    await internalBalanceService.unlockBalance(
      order.userId,
      order.cryptoType,
      order.cryptoNetwork,
      order.collateralLockedAmount,
      order.id
    );

    // Atualizar pedido para marcar que colateral foi liberado
    await prisma.order.update({
      where: { id: order.id },
      data: {
        collateralLocked: false,
        collateralUnlockedAt: new Date(),
      },
    });

    logger.info(`✅ Colateral liberado com sucesso para pedido ${order.id}`);

    // Registrar no audit log
    await prisma.auditLog.create({
      data: {
        userId: order.userId,
        action: 'COLLATERAL_RELEASED',
        resource: 'ORDER',
        resourceId: order.id,
        description: `Colateral liberado automaticamente: ${order.collateralLockedAmount} ${order.cryptoType}`,
        metadata: {
          orderId: order.id,
          orderStatus: order.status,
          cryptoType: order.cryptoType,
          network: order.cryptoNetwork,
          amount: order.collateralLockedAmount,
          releasedAt: new Date().toISOString(),
        },
        success: true,
      },
    });
  }

  /**
   * Verificar pedidos órfãos (com colateral bloqueado há mais de 24h)
   * Função de segurança para detectar casos anormais
   */
  async checkOrphanedCollateral() {
    try {
      logger.info('🔍 [COLLATERAL WORKER] Checking for orphaned collateral (>24h)...');

      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const orphanedOrders = await prisma.order.findMany({
        where: {
          collateralSource: { in: ['HD_WALLET', 'INTERNAL_BALANCE'] },
          collateralLocked: true,
          createdAt: {
            lt: oneDayAgo,
          },
          status: {
            in: ['PENDING', 'IN_NEGOTIATION', 'MATCHED'], // Status que não deveriam durar 24h
          },
        },
        include: {
          user: true,
        },
      });

      if (orphanedOrders.length > 0) {
        logger.warn(`⚠️ [COLLATERAL WORKER] ALERT: ${orphanedOrders.length} orders with collateral locked for >24h!`);

        for (const order of orphanedOrders) {
          const hoursLocked = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60));
          logger.warn(`   Order: ${order.id} | Status: ${order.status} | Amount: ${order.collateralLockedAmount} ${order.cryptoType} | Locked for: ${hoursLocked}h`);

          // Registrar alerta no audit log
          await prisma.auditLog.create({
            data: {
              userId: order.userId,
              action: 'ORPHANED_COLLATERAL_DETECTED',
              resource: 'ORDER',
              resourceId: order.id,
              description: `Pedido com colateral bloqueado há mais de 24h (${hoursLocked}h)`,
              metadata: {
                orderId: order.id,
                orderStatus: order.status,
                createdAt: order.createdAt,
                hoursLocked,
                amount: order.collateralLockedAmount,
                cryptoType: order.cryptoType,
              },
              success: false,
              errorMessage: 'Colateral bloqueado por tempo anormal - requer investigação manual',
            },
          });
        }
      } else {
        logger.info('✅ [COLLATERAL WORKER] No orphaned collateral detected');
      }
    } catch (error: any) {
      logger.error('❌ [COLLATERAL WORKER] Error checking orphaned collateral:', error);
    }
  }

  /**
   * Obter status do worker
   */
  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      executionCount: this.executionCount,
      lastExecution: this.lastExecution,
      checkInterval: this.CHECK_INTERVAL,
    };
  }
}

export const collateralReleaseWorker = new CollateralReleaseWorker();

// Auto-start do worker quando o módulo é importado
if (process.env.NODE_ENV !== 'test') {
  collateralReleaseWorker.start();

  // Verificar pedidos órfãos a cada 6 horas
  setInterval(() => {
    collateralReleaseWorker.checkOrphanedCollateral();
  }, 6 * 60 * 60 * 1000);
}
