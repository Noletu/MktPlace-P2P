import { PrismaClient } from '@prisma/client';
import { WithdrawalProcessorService } from '../services/withdrawal-processor.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const INTERVAL_MS = 30_000; // 30 segundos
const MAX_PER_CYCLE = 3; // Máximo de saques processados por ciclo

class WithdrawalProcessorWorker {
  private isRunning = false;
  private isProcessing = false;
  private interval: NodeJS.Timeout | null = null;

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Withdrawal processor worker already running');
      return;
    }

    console.log('🚀 Starting withdrawal processor worker...');
    this.isRunning = true;

    this.interval = setInterval(() => this.tick(), INTERVAL_MS);

    // Primeira execução imediata
    await this.tick();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('🛑 Withdrawal processor worker stopped');
  }

  private async tick() {
    // Lock para evitar processamento concorrente
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      await this.processPendingWithdrawals();
      await this.checkProcessingWithdrawals();
    } catch (error: any) {
      logger.error('[WITHDRAWAL WORKER] Tick error:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Busca e processa saques PENDING
   */
  private async processPendingWithdrawals() {
    const pending = await prisma.withdrawal.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_PER_CYCLE,
    });

    if (pending.length === 0) return;

    console.log(`📤 [WITHDRAWAL WORKER] Processing ${pending.length} pending withdrawal(s)...`);

    for (const withdrawal of pending) {
      try {
        await WithdrawalProcessorService.processWithdrawal(withdrawal.id);
      } catch (error: any) {
        logger.error(`[WITHDRAWAL WORKER] Failed to process ${withdrawal.id}:`, error.message);
      }
    }
  }

  /**
   * Verifica saques PROCESSING para confirmação on-chain
   */
  private async checkProcessingWithdrawals() {
    try {
      await WithdrawalProcessorService.checkProcessingWithdrawals();
    } catch (error: any) {
      logger.error('[WITHDRAWAL WORKER] Failed to check processing withdrawals:', error.message);
    }
  }
}

// Singleton
export const withdrawalProcessorWorker = new WithdrawalProcessorWorker();
