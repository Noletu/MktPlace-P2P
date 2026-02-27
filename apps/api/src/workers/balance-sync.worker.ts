import {PrismaClient} from '@prisma/client';
import {BlockchainService} from '../services/blockchain/blockchain.service';
import {WorkerStateService} from '../services/workerState.service';
import BigNumber from 'bignumber.js';

const prisma = new PrismaClient();

/**
 * Balance Sync Worker (Omnibus Architecture)
 *
 * Monitora APENAS PlatformWallets (hot wallets).
 * UserWallets agora usam ledger interno — saldo NUNCA é sobrescrito pelo on-chain.
 *
 * Execução: A cada 5 minutos
 *
 * Propósito:
 * - Sincronizar saldo on-chain das hot wallets (PlatformWallet)
 * - Verificação de solvência: hot wallet balance >= soma UserWallet.balance
 * - Alertar sobre insolvência (hot wallet < saldo dos usuários)
 */

export class BalanceSyncWorker {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isExecuting: boolean = false;

  static async start() {
    if (this.intervalId) {
      console.log('⚠️  Balance Sync já está rodando');
      return;
    }

    console.log('🔄 Balance Sync Worker iniciado (a cada 5min) — modo Omnibus (só PlatformWallet)');

    await WorkerStateService.setState('BalanceSyncWorker', true);

    // Executar após 1 minuto
    setTimeout(() => {
      this.run();
    }, 60000);

    // Executar a cada 5 minutos
    this.intervalId = setInterval(() => {
      this.run();
    }, 300000);
  }

  static async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isExecuting = false;
      console.log('🛑 Balance Sync Worker parado');

      await WorkerStateService.setState('BalanceSyncWorker', false);
    }
  }

  static isRunning(): boolean {
    return this.intervalId !== null;
  }

  static async run() {
    if (this.isExecuting) {
      console.log('⏭️  Balance Sync: já executando, pulando...');
      return;
    }

    this.isExecuting = true;

    try {
      console.log('\n🔄 [Balance Sync] Sincronizando hot wallets (PlatformWallet)...');

      // Buscar todas as platform wallets ativas
      const platformWallets = await prisma.platformWallet.findMany({
        where: {isActive: true},
      });

      console.log(`   Sincronizando ${platformWallets.length} hot wallets`);

      let synced = 0;

      for (const hotWallet of platformWallets) {
        try {
          await this.syncHotWalletBalance(hotWallet);
          synced++;
        } catch (error) {
          console.error(
            `   ❌ Erro ao sincronizar hot wallet ${hotWallet.cryptoType}/${hotWallet.network}:`,
            (error as Error).message
          );
        }
      }

      console.log(`   ✅ ${synced} hot wallets sincronizadas`);

      // Verificação de solvência
      await this.checkSolvency(platformWallets);
    } catch (error) {
      console.error('❌ [Balance Sync] Erro:', (error as Error).message);
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Sincroniza saldo on-chain de uma PlatformWallet (hot wallet)
   */
  private static async syncHotWalletBalance(hotWallet: any): Promise<void> {
    const onChainBalance = await BlockchainService.getBalance(
      hotWallet.address,
      hotWallet.network
    );

    const savedBalance = parseFloat(hotWallet.balance);
    const currentBalance = parseFloat(onChainBalance);

    const diff = Math.abs(currentBalance - savedBalance);
    if (diff > 0.00000001) {
      console.log(
        `   📊 Hot wallet ${hotWallet.cryptoType}/${hotWallet.network}:`,
        `${savedBalance} → ${currentBalance}`
      );
    }

    await prisma.platformWallet.update({
      where: {id: hotWallet.id},
      data: {
        balance: onChainBalance,
        availableBalance: onChainBalance,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Verificação de solvência: hot wallet balance vs soma dos saldos dos usuários
   * Se hot wallet < soma dos usuários → ALERTA CRÍTICO
   */
  private static async checkSolvency(platformWallets: any[]): Promise<void> {
    console.log('   🔍 Verificando solvência...');

    for (const hotWallet of platformWallets) {
      // Somar todos os saldos de UserWallet para esta crypto/rede
      const userWallets = await prisma.userWallet.findMany({
        where: {
          cryptoType: hotWallet.cryptoType,
          network: hotWallet.network,
          isActive: true,
        },
        select: {balance: true},
      });

      const totalUserBalance = userWallets.reduce(
        (sum, w) => sum.plus(w.balance),
        new BigNumber(0)
      );

      const hotBalance = new BigNumber(hotWallet.balance);
      const delta = hotBalance.minus(totalUserBalance);

      if (delta.lt(0)) {
        console.error(
          `   🚨 ALERTA SOLVÊNCIA: ${hotWallet.cryptoType}/${hotWallet.network}`,
          `Hot wallet: ${hotBalance.toString()}, Usuários: ${totalUserBalance.toString()},`,
          `Déficit: ${delta.abs().toString()}`
        );
      } else {
        console.log(
          `   ✅ ${hotWallet.cryptoType}/${hotWallet.network}: solvente`,
          `(hot: ${hotBalance.toString()}, users: ${totalUserBalance.toString()}, surplus: ${delta.toString()})`
        );
      }
    }
  }
}

// Worker controlado manualmente via endpoints HTTP
console.log('⏭️  BalanceSyncWorker em modo manual (controle via API) — Omnibus mode');

// Graceful shutdown
process.on('SIGINT', async () => {
  await BalanceSyncWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await BalanceSyncWorker.stop();
  process.exit(0);
});
