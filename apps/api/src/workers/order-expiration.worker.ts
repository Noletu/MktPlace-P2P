import { PrismaClient } from '@prisma/client';
import { notificationService } from '../services/notification.service';
import { WalletService } from '../services/wallet.service';

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

    // Verificar a cada 1 minuto (para timeout de 30min ser preciso)
    this.interval = setInterval(async () => {
      await this.checkExpiredOrders();
      await this.checkExpiredValidations();
      await this.checkBoletoDisputeWindows();
    }, 60 * 1000);

    // Primeira execução imediata
    await this.checkExpiredOrders();
    await this.checkExpiredValidations();
    await this.checkBoletoDisputeWindows();
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

      // Buscar pedidos expirados (PENDING ou MATCHED)
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: {
            in: ['PENDING', 'MATCHED'],
          },
          timeoutAt: {
            lt: new Date(), // Menor que agora
            not: null, // Não null (pedidos com timeout definido)
          },
          manualCancelOnly: false, // Não é só cancelamento manual
        },
        include: {
          transactions: true, // Incluir transações para pedidos MATCHED
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
      const orderData = (typeof order.orderData === 'string' ? JSON.parse(order.orderData) : order.orderData) as any;

      // MATCHED orders: return to marketplace
      if (order.status === 'MATCHED') {
        console.log(`⏰ MATCHED order expired: ${order.id} - Returning to marketplace`);

        // Desbloquear colateral do provedor (para ordens BUY)
        // Em ordens BUY, o provedor bloqueia colateral ao aceitar
        if (order.orderType === 'BUY' && order.collateralLocked && order.collateralLockedAmount && order.providerWalletId) {
          try {
            await WalletService.unlockBalance(
              order.providerWalletId,
              order.collateralLockedAmount,
              order.id,
              `Colateral desbloqueado - ordem BUY expirou sem pagamento`
            );
            console.log(`🔓 [BUY ORDER] Colateral do provedor desbloqueado: ${order.collateralLockedAmount} ${order.cryptoType}`);
          } catch (error: any) {
            console.error(`❌ Erro ao desbloquear colateral do provedor:`, error);
          }
        }

        // Resetar timeout para 24 horas (disponível novamente no marketplace)
        const newTimeout = new Date();
        newTimeout.setHours(newTimeout.getHours() + 24);

        // Retornar para PENDING e limpar dados do provedor (para ordens BUY)
        const updateData: any = {
          status: 'PENDING',
          timeoutAt: newTimeout,
        };

        // Se for ordem BUY, limpar dados do provedor
        if (order.orderType === 'BUY') {
          updateData.providerId = null;
          updateData.providerWalletId = null;
          updateData.walletId = null;
          updateData.orderData = {};
          updateData.collateralSource = null;
          updateData.collateralConfirmed = false;
          updateData.collateralLocked = false;
          updateData.collateralLockedAmount = null;
          updateData.collateralUnlockedAt = new Date();
        }

        await prisma.order.update({
          where: { id: order.id },
          data: updateData,
        });

        // Deletar transações associadas
        if (order.transactions && order.transactions.length > 0) {
          const transactionIds = order.transactions.map((t: any) => t.id);
          await prisma.transaction.deleteMany({
            where: {
              id: { in: transactionIds },
            },
          });
          console.log(`🗑️ Deleted ${transactionIds.length} transaction(s) for order ${order.id}`);
        }

        console.log(`✅ Order ${order.id} returned to PENDING - Available in marketplace again`);

        // Notificar VENDEDOR que o pedido expirou e voltou ao marketplace
        setImmediate(async () => {
          try {
            await notificationService.notifyOrderExpired(
              order.id,
              order.userId,
              'O pedido expirou após 30 minutos sem pagamento e retornou ao marketplace'
            );
            console.log(`📬 Notification sent to seller: ${order.userId}`);
          } catch (error) {
            console.error(`❌ Error sending notification to seller:`, error);
          }
        });

        // Notificar COMPRADOR (payer) que não completou o pagamento a tempo
        if (order.transactions && order.transactions.length > 0) {
          const payerId = order.transactions[0].payerId;
          setImmediate(async () => {
            try {
              await notificationService.notifyOrderExpired(
                order.id,
                payerId,
                'Você não completou o pagamento a tempo e o pedido retornou ao marketplace'
              );
              console.log(`📬 Notification sent to payer: ${payerId}`);
            } catch (error) {
              console.error(`❌ Error sending notification to payer:`, error);
            }
          });
        }

        return;
      }

      // PENDING orders: cancel definitively
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

      // Notificar VENDEDOR que o pedido PENDING expirou e foi cancelado
      setImmediate(async () => {
        try {
          const message = order.type === 'BOLETO'
            ? `Seu pedido expirou pois a data de vencimento do boleto passou. O colateral será devolvido.`
            : `Seu pedido expirou após ${order.customExpirationHours || 24} horas sem match. O colateral será devolvido.`;

          await notificationService.notifyOrderExpired(
            order.id,
            order.userId,
            message
          );
          console.log(`📬 Notification sent to seller: ${order.userId}`);
        } catch (error) {
          console.error(`❌ Error sending notification to seller:`, error);
        }
      });
    } catch (error) {
      console.error(`❌ Error processing expired order ${order.id}:`, error);
    }
  }

  /**
   * Auto-rejeitar comprovantes em VALIDATING que passaram do prazo de 24h
   * Devolve o pedido para PAYMENT_SENT → IN_NEGOTIATION para o comprador reenviar
   */
  private async checkExpiredValidations() {
    try {
      const now = new Date();

      const expiredValidations = await prisma.transaction.findMany({
        where: {
          status: 'VALIDATING',
          validationDeadline: { lt: now, not: null },
        },
        include: { order: true },
      });

      if (expiredValidations.length === 0) return;

      console.log(`⏰ [VALIDATION TIMEOUT] Found ${expiredValidations.length} expired validations`);

      for (const tx of expiredValidations) {
        try {
          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: tx.id },
              data: {
                status: 'PENDING', // Volta para PENDING → comprador pode reenviar
                validationDeadline: null,
                comprovanteData: null,
                comprovanteUrl: null,
              },
            }),
            prisma.order.update({
              where: { id: tx.orderId },
              data: { status: 'IN_NEGOTIATION' }, // Volta para negociação
            }),
          ]);

          console.log(`⏰ Transaction ${tx.id} auto-rejected: validation deadline expired`);

          setImmediate(async () => {
            try {
              await notificationService.notifyOrderExpired(
                tx.orderId,
                tx.payerId,
                'Seu comprovante não foi validado a tempo (24h). Por favor, envie novamente.'
              );
            } catch (error) {
              console.error('Failed to notify expired validation:', error);
            }
          });
        } catch (error) {
          console.error(`❌ Error rejecting expired validation ${tx.id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error checking expired validations:', error);
    }
  }

  /**
   * FEATURE (holding de boleto): notifica o COMPRADOR quando o prazo de 48h
   * do boleto expira (a partir do comprovante mais recente), uma unica vez.
   * Anti-spam via campo Order.boletoDisputeNotifiedAt.
   */
  private async checkBoletoDisputeWindows() {
    try {
      const HOLDING_MS = 48 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - HOLDING_MS);

      // Boletos aguardando, ainda nao notificados, com comprovante ja ha mais de 48h
      const candidates = await prisma.order.findMany({
        where: {
          type: 'BOLETO',
          status: { in: ['PAYMENT_SENT', 'VALIDATING'] },
          boletoDisputeNotifiedAt: null,
          transactions: {
            some: {
              comprovanteUrl: { not: null },
              createdAt: { lte: cutoff },
            },
          },
        },
        include: { transactions: true },
      });

      for (const order of candidates) {
        // Comprovante mais recente (mesmo criterio da regra de disputa)
        const comprovanteTxs = order.transactions
          .filter(t => t.comprovanteUrl || t.status === 'VALIDATING')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const paymentTx = comprovanteTxs[0];
        if (!paymentTx?.createdAt) continue;

        // Confirma que o comprovante MAIS RECENTE ja passou das 48h (e nao um antigo)
        const elapsed = Date.now() - new Date(paymentTx.createdAt).getTime();
        if (elapsed < HOLDING_MS) continue;

        // Comprador = payerId da transacao de pagamento
        const buyerId = paymentTx.payerId;

        // Marca ANTES de notificar (idempotente; evita corrida entre ciclos)
        await prisma.order.update({
          where: { id: order.id },
          data: { boletoDisputeNotifiedAt: new Date() },
        });

        await notificationService.notifyBoletoDisputeAvailable(order.id, buyerId);
        console.log(`📬 Boleto holding expirado, comprador notificado: ${order.id}`);
      }
    } catch (error) {
      console.error('❌ Error in checkBoletoDisputeWindows:', error);
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
          const orderData = (typeof order.orderData === 'string' ? JSON.parse(order.orderData) : order.orderData) as any;
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

            // Notificar vendedor sobre expiração do boleto
            setImmediate(async () => {
              try {
                await notificationService.notifyOrderExpired(
                  order.id,
                  order.userId,
                  `Seu boleto expirou. Data de vencimento: ${dueDate.toLocaleDateString()}. O colateral será devolvido.`
                );
                console.log(`📬 Notification sent for boleto: ${order.id}`);
              } catch (error) {
                console.error(`❌ Error sending notification for boleto ${order.id}:`, error);
              }
            });
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
