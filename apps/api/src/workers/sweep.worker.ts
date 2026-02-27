import { SweepService } from '../services/sweep.service';
import { logger } from '../utils/logger';

/**
 * Sweep Worker (Omnibus Architecture)
 *
 * Consolida fundos dos endereços de depósito dos usuários → hot wallet.
 *
 * Execução: A cada 2 minutos
 * Limite: 5 sweeps por ciclo (evitar sobrecarga)
 *
 * Ciclo:
 * 1. Processar SweepTransactions ativas (verificar gas funding, continuar sweeps)
 * 2. Buscar novos wallets para sweep (sweepStatus = PENDING, pendingSweepAmount > threshold)
 * 3. Criar SweepTransaction e iniciar
 */

export class SweepWorker {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isExecuting = false;
  private static readonly INTERVAL_MS = 120000; // 2 minutos
  private static readonly MAX_SWEEPS_PER_CYCLE = 5;

  static start() {
    if (this.intervalId) {
      console.log('⚠️  Sweep Worker já está rodando');
      return;
    }

    console.log('🧹 Sweep Worker iniciado (a cada 2min)');

    // Primeira execução após 2 minutos (dar tempo para deposit monitor rodar)
    setTimeout(() => {
      this.run();
    }, this.INTERVAL_MS);

    this.intervalId = setInterval(() => {
      this.run();
    }, this.INTERVAL_MS);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isExecuting = false;
      console.log('🛑 Sweep Worker parado');
    }
  }

  static isRunning(): boolean {
    return this.intervalId !== null;
  }

  static async run() {
    if (this.isExecuting) {
      console.log('⏭️  Sweep Worker: já executando, pulando...');
      return;
    }

    this.isExecuting = true;

    try {
      console.log('\n🧹 [Sweep] Verificando sweeps pendentes...');

      // 1. Processar sweeps em andamento (gas funding, confirmações)
      await SweepService.processActiveSweeps();

      // 2. Buscar novos wallets para sweep
      const walletsToSweep = await SweepService.getWalletsNeedingSweep(
        this.MAX_SWEEPS_PER_CYCLE
      );

      if (walletsToSweep.length === 0) {
        console.log('   ℹ️  Nenhum sweep pendente');
        return;
      }

      console.log(`   📋 ${walletsToSweep.length} wallets para sweep`);

      let completed = 0;
      let failed = 0;

      for (const wallet of walletsToSweep) {
        try {
          console.log(
            `   🧹 Sweeping ${wallet.cryptoType}/${wallet.network}`,
            `(user: ${wallet.user?.email}, amount: ${wallet.pendingSweepAmount})`
          );

          await SweepService.sweepWallet(wallet.id);
          completed++;
        } catch (error: any) {
          logger.error(`[SWEEP] Error sweeping wallet ${wallet.id}: ${error.message}`);
          failed++;
        }
      }

      console.log(`   ✅ Sweep cycle: ${completed} completed, ${failed} failed`);
    } catch (error: any) {
      logger.error('[SWEEP WORKER] Error:', error.message);
    } finally {
      this.isExecuting = false;
    }
  }
}
