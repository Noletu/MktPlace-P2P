import {PrismaClient} from '@prisma/client';
import {BlockchainService} from '../services/blockchain/blockchain.service';

const prisma = new PrismaClient();

/**
 * Balance Sync Worker
 *
 * Sincroniza saldos on-chain com banco de dados periodicamente.
 *
 * Execução: A cada 5 minutos
 *
 * Propósito:
 * - Reconciliar discrepâncias entre saldo salvo e saldo real
 * - Detectar saques feitos fora da plataforma (se usuário tiver private key)
 * - Manter dados atualizados mesmo sem depósitos
 * - Alertar sobre inconsistências graves
 */

export class BalanceSyncWorker {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Inicia o worker
   */
  static start() {
    if (this.intervalId) {
      console.log('⚠️  Balance Sync já está rodando');
      return;
    }

    console.log('🔄 Balance Sync Worker iniciado (a cada 5min)');

    // Executar após 1 minuto (dar tempo do deposit monitor rodar primeiro)
    setTimeout(() => {
      this.run();
    }, 60000);

    // Executar a cada 5 minutos
    this.intervalId = setInterval(() => {
      this.run();
    }, 300000); // 5 minutos
  }

  /**
   * Para o worker
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Balance Sync Worker parado');
    }
  }

  /**
   * Verifica se o worker está rodando
   */
  static isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Executa sincronização completa
   */
  static async run() {
    if (this.isRunning) {
      console.log('⏭️  Balance Sync: já executando, pulando...');
      return;
    }

    this.isRunning = true;

    try {
      console.log('\n🔄 [Balance Sync] Sincronizando saldos...');

      // Buscar todas carteiras ativas
      const wallets = await prisma.userWallet.findMany({
        where: {isActive: true},
        include: {user: true},
      });

      console.log(`   Sincronizando ${wallets.length} carteiras`);

      let synced = 0;
      let discrepancies = 0;

      // Processar cada carteira
      for (const wallet of wallets) {
        try {
          const hasDiscrepancy = await this.syncWalletBalance(wallet);
          if (hasDiscrepancy) discrepancies++;
          synced++;
        } catch (error) {
          console.error(
            `   ❌ Erro ao sincronizar carteira ${wallet.id}:`,
            (error as Error).message
          );
        }
      }

      console.log(`   ✅ ${synced} carteiras sincronizadas`);
      if (discrepancies > 0) {
        console.log(`   ⚠️  ${discrepancies} discrepâncias encontradas`);
      }
    } catch (error) {
      console.error('❌ [Balance Sync] Erro:', (error as Error).message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sincroniza saldo de uma carteira específica
   */
  private static async syncWalletBalance(wallet: any): Promise<boolean> {
    // Consultar saldo on-chain
    const onChainBalance = await BlockchainService.getBalance(
      wallet.address,
      wallet.network
    );

    // Comparar com saldo salvo
    const savedBalance = parseFloat(wallet.balance);
    const currentBalance = parseFloat(onChainBalance);

    // Tolerância para diferenças de arredondamento
    const diff = Math.abs(currentBalance - savedBalance);
    if (diff < 0.00000001) {
      // Saldo igual, atualizar apenas lastSyncedAt
      await prisma.userWallet.update({
        where: {id: wallet.id},
        data: {lastSyncedAt: new Date()},
      });
      return false;
    }

    // Discrepância detectada!
    const changePercent = ((currentBalance - savedBalance) / savedBalance) * 100;

    console.log(
      `   ⚠️  Discrepância em ${wallet.cryptoType}/${wallet.network}:`,
      `Salvo: ${savedBalance}, Real: ${currentBalance} (${changePercent.toFixed(2)}%)`
    );

    // Verificar se é discrepância grave (>10%)
    if (Math.abs(changePercent) > 10) {
      console.error(
        `   🚨 ALERTA: Discrepância grave (>10%) em carteira ${wallet.id}!`
      );
      console.error(`      Usuário: ${wallet.userId}`);
      console.error(`      Crypto: ${wallet.cryptoType}/${wallet.network}`);
      console.error(`      Endereço: ${wallet.address}`);
      console.error(`      Saldo salvo: ${savedBalance}`);
      console.error(`      Saldo real: ${currentBalance}`);

      // TODO: Enviar alerta para admin
      // TODO: Pausar carteira para investigação
    }

    // Atualizar saldo no banco
    const newAvailableBalance = Math.max(
      0,
      currentBalance - parseFloat(wallet.lockedBalance)
    );

    await prisma.userWallet.update({
      where: {id: wallet.id},
      data: {
        balance: onChainBalance,
        availableBalance: newAvailableBalance.toString(),
        lastSyncedAt: new Date(),
      },
    });

    // Registrar reconciliação
    await this.recordReconciliation(wallet, savedBalance, currentBalance);

    return true;
  }

  /**
   * Registra reconciliação de saldo no histórico
   */
  private static async recordReconciliation(
    wallet: any,
    oldBalance: number,
    newBalance: number
  ) {
    const diff = newBalance - oldBalance;

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: wallet.userId,
        type: diff > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
        amount: Math.abs(diff).toString(),
        balanceBefore: oldBalance.toString(),
        balanceAfter: newBalance.toString(),
        description: `Reconciliação de saldo (sync automático)`,
        metadata: JSON.stringify({
          source: 'balance-sync-worker',
          timestamp: new Date().toISOString(),
          network: wallet.network,
        }),
      },
    });
  }

  /**
   * Força sincronização de uma carteira específica (uso manual/admin)
   */
  static async forceSyncWallet(walletId: string): Promise<void> {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
      include: {user: true},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    console.log(`🔄 Forçando sincronização da carteira ${walletId}...`);
    await this.syncWalletBalance(wallet);
    console.log(`✅ Carteira ${walletId} sincronizada`);
  }
}

// Worker controlado manualmente via endpoints HTTP
// Para iniciar: POST /api/v1/workers/balance-sync/start
// Para parar: POST /api/v1/workers/balance-sync/stop
console.log('⏭️  BalanceSyncWorker em modo manual (controle via API)');

// Graceful shutdown
process.on('SIGINT', () => {
  BalanceSyncWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  BalanceSyncWorker.stop();
  process.exit(0);
});
