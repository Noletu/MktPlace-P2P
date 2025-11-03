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

  /**
   * Iniciar worker
   */
  start() {
    logger.info('🔓 Collateral Release Worker starting...');

    // Executar imediatamente
    this.processLockedCollateral();

    // Executar periodicamente
    this.intervalId = setInterval(() => {
      this.processLockedCollateral();
    }, this.CHECK_INTERVAL);

    logger.info(`🔓 Collateral Release Worker started (checking every ${this.CHECK_INTERVAL / 1000}s)`);
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
    try {
      // Buscar pedidos com colateral interno bloqueado que já terminaram
      const finishedOrders = await prisma.order.findMany({
        where: {
          collateralSource: 'INTERNAL_BALANCE',
          collateralLocked: true,
          status: {
            in: ['COMPLETED', 'CANCELLED', 'TIMEOUT', 'EXPIRED'],
          },
          collateralUnlockedAt: null, // Ainda não foi desbloqueado
        },
        include: {
          internalBalance: true,
        },
      });

      if (finishedOrders.length === 0) {
        logger.debug('🔓 Nenhum colateral para liberar');
        return;
      }

      logger.info(`🔓 Encontrados ${finishedOrders.length} pedidos com colateral a ser liberado`);

      // Processar cada pedido
      for (const order of finishedOrders) {
        try {
          await this.releaseCollateral(order);
        } catch (error: any) {
          logger.error(`❌ Erro ao liberar colateral do pedido ${order.id}:`, error);
          // Continuar processando outros pedidos mesmo se houver erro
        }
      }

      logger.info(`✅ Processamento de liberação de colateral concluído`);
    } catch (error: any) {
      logger.error('❌ Erro no worker de liberação de colateral:', error);
    }
  }

  /**
   * Liberar colateral de um pedido específico
   */
  private async releaseCollateral(order: any) {
    if (!order.internalBalanceId || !order.collateralLockedAmount) {
      logger.warn(`⚠️ Pedido ${order.id} não tem internalBalanceId ou collateralLockedAmount`);
      return;
    }

    const balance = order.internalBalance;
    if (!balance) {
      logger.warn(`⚠️ InternalBalance não encontrado para pedido ${order.id}`);
      return;
    }

    logger.info(`🔓 Liberando colateral do pedido ${order.id}...`);
    logger.info(`   Status: ${order.status}`);
    logger.info(`   Valor bloqueado: ${order.collateralLockedAmount} ${order.cryptoType}`);

    // Decidir ação baseado no status do pedido
    if (order.status === 'COMPLETED') {
      // Pedido completado: deduzir colateral (gasto permanente)
      logger.info(`💸 Pedido completado - deduzindo colateral do saldo total`);
      await internalBalanceService.deductCollateral(
        order.userId,
        order.cryptoType,
        order.cryptoNetwork,
        order.collateralLockedAmount,
        order.id
      );
    } else {
      // Pedido cancelado/timeout/expired: apenas desbloquear (devolver ao disponível)
      logger.info(`↩️ Pedido ${order.status} - desbloqueando colateral (devolvendo ao disponível)`);
      await internalBalanceService.unlockBalance(
        order.userId,
        order.cryptoType,
        order.cryptoNetwork,
        order.collateralLockedAmount,
        order.id
      );
    }

    // Atualizar pedido para marcar que colateral foi liberado
    await prisma.order.update({
      where: { id: order.id },
      data: {
        collateralLocked: false,
        collateralUnlockedAt: new Date(),
      },
    });

    logger.info(`✅ Colateral processado com sucesso para pedido ${order.id}`);

    // Registrar no audit log
    await prisma.auditLog.create({
      data: {
        userId: order.userId,
        action: 'COLLATERAL_RELEASED',
        resource: 'ORDER',
        resourceId: order.id,
        description: `Colateral liberado automaticamente: ${order.collateralLockedAmount} ${order.cryptoType}`,
        metadata: JSON.stringify({
          orderId: order.id,
          orderStatus: order.status,
          cryptoType: order.cryptoType,
          network: order.cryptoNetwork,
          amount: order.collateralLockedAmount,
          releasedAt: new Date().toISOString(),
        }),
        success: true,
      },
    });
  }

  /**
   * Verificar pedidos órfãos (com colateral bloqueado há mais de 48h)
   * Função de segurança para detectar casos anormais
   */
  async checkOrphanedCollateral() {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

      const orphanedOrders = await prisma.order.findMany({
        where: {
          collateralSource: 'INTERNAL_BALANCE',
          collateralLocked: true,
          createdAt: {
            lt: twoDaysAgo,
          },
          status: {
            in: ['PENDING', 'IN_NEGOTIATION', 'MATCHED'], // Status que não deveriam durar 48h
          },
        },
        include: {
          internalBalance: true,
        },
      });

      if (orphanedOrders.length > 0) {
        logger.warn(`⚠️ ALERTA: ${orphanedOrders.length} pedidos com colateral bloqueado há mais de 48h!`);

        for (const order of orphanedOrders) {
          logger.warn(`   Pedido: ${order.id} | Status: ${order.status} | Valor: ${order.collateralLockedAmount} ${order.cryptoType}`);

          // Registrar alerta no audit log
          await prisma.auditLog.create({
            data: {
              userId: order.userId,
              action: 'ORPHANED_COLLATERAL_DETECTED',
              resource: 'ORDER',
              resourceId: order.id,
              description: `Pedido com colateral bloqueado há mais de 48h`,
              metadata: JSON.stringify({
                orderId: order.id,
                orderStatus: order.status,
                createdAt: order.createdAt,
                amount: order.collateralLockedAmount,
                cryptoType: order.cryptoType,
              }),
              success: false,
              errorMessage: 'Colateral bloqueado por tempo anormal - requer investigação manual',
            },
          });
        }
      }
    } catch (error: any) {
      logger.error('❌ Erro ao verificar colaterais órfãos:', error);
    }
  }
}

export const collateralReleaseWorker = new CollateralReleaseWorker();

// NÃO fazer auto-start aqui - o worker é iniciado manualmente no index.ts
// para evitar inicializações duplas que causam deadlock no SQLite
