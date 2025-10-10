import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class OrderExpirationWorker {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Order expiration worker already running');
      return;
    }

    console.log('🚀 Starting order expiration worker...');
    this.isRunning = true;

    // Verificar a cada hora
    this.interval = setInterval(() => this.checkExpiredOrders(), 60 * 60 * 1000);

    // Primeira execução imediata
    await this.checkExpiredOrders();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('🛑 Order expiration worker stopped');
  }

  private async checkExpiredOrders() {
    try {
      console.log('🔍 Checking for expired orders...');

      // Buscar pedidos expirados
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: 'PENDING',
          timeoutAt: {
            lt: new Date(), // Menor que agora
            not: null, // Não null (pedidos com timeout definido)
          },
          manualCancelOnly: false, // Não é só cancelamento manual
        },
      });

      if (expiredOrders.length === 0) {
        console.log('✅ No expired orders found');
        return;
      }

      console.log(`⏰ Found ${expiredOrders.length} expired orders`);

      for (const order of expiredOrders) {
        await this.processExpiredOrder(order);
      }

      console.log('✅ Expired orders processed');
    } catch (error) {
      console.error('❌ Error checking expired orders:', error);
    }
  }

  private async processExpiredOrder(order: any) {
    try {
      const orderData = JSON.parse(order.orderData);

      let cancelReason = '';

      if (order.type === 'BOLETO') {
        // Boleto expirado pela data de vencimento
        cancelReason = 'AUTO_EXPIRED_BOLETO';
        console.log(`📅 Boleto expired: ${order.id} - Due date: ${orderData.dueDate}`);
      } else if (order.type === 'PIX') {
        // PIX expirado pelo timeout customizado
        cancelReason = 'AUTO_EXPIRED_PIX';
        console.log(`⏰ PIX expired: ${order.id} - Timeout: ${order.customExpirationHours}h`);
      }

      // Cancelar e preparar para devolução
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          cancelReason,
          refundStatus: 'PENDING_USER_CHOICE', // Usuário escolhe método de devolução
        },
      });

      console.log(`✅ Order ${order.id} auto-cancelled and marked for refund`);
    } catch (error) {
      console.error(`❌ Error processing expired order ${order.id}:`, error);
    }
  }

  /**
   * Processar boletos especificamente (baseado na data de vencimento)
   * Este método pode ser chamado diariamente por um cron job separado
   */
  async checkExpiredBoletos() {
    try {
      console.log('🔍 Checking for expired boletos...');

      const now = new Date();

      // Buscar todos os pedidos BOLETO pendentes
      const pendingBoletos = await prisma.order.findMany({
        where: {
          type: 'BOLETO',
          status: 'PENDING',
        },
      });

      let expiredCount = 0;

      for (const order of pendingBoletos) {
        try {
          const orderData = JSON.parse(order.orderData);
          const dueDate = new Date(orderData.dueDate);

          // Se passou da data de vencimento
          if (dueDate < now) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                status: 'CANCELLED',
                cancelReason: 'AUTO_EXPIRED_BOLETO',
                refundStatus: 'PENDING_USER_CHOICE',
              },
            });

            console.log(`📅 Boleto ${order.id} expired - Due: ${dueDate.toISOString()}`);
            expiredCount++;
          }
        } catch (error) {
          console.error(`Error processing boleto ${order.id}:`, error);
        }
      }

      if (expiredCount > 0) {
        console.log(`✅ ${expiredCount} expired boletos processed`);
      } else {
        console.log('✅ No expired boletos found');
      }
    } catch (error) {
      console.error('❌ Error checking expired boletos:', error);
    }
  }
}

// Singleton instance
export const orderExpirationWorker = new OrderExpirationWorker();
