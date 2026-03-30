import {PrismaClient} from '@prisma/client';
import BigNumber from 'bignumber.js';
import {BlockchainService} from '../services/blockchain/blockchain.service';
import {NotificationService} from '../services/notification.service';

/**
 * SECURITY (H-9): Retry com exponential backoff para chamadas blockchain críticas
 * Previne perda silenciosa de depósitos por falha temporária de RPC
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  label = 'operation'
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.warn(`   ⚠️  [Retry ${attempt}/${maxRetries}] ${label} failed: ${lastError.message}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  console.error(`   ❌ [Retry] ${label} failed after ${maxRetries} attempts: ${lastError?.message}`);
  throw lastError;
}

const prisma = new PrismaClient();

/**
 * Deposit Monitor Worker (Omnibus Architecture)
 *
 * Monitora depósitos em todas as carteiras ativas dos usuários.
 * Crédito ADITIVO — saldo interno nunca é sobrescrito pelo on-chain.
 *
 * Execução: A cada 30 segundos
 *
 * Fluxo:
 * 1. Buscar todas UserWallets ativas
 * 2. Para cada carteira:
 *    - Consultar saldo on-chain
 *    - Comparar com onChainSnapshot (último on-chain conhecido)
 *    - Se on-chain > snapshot: depósito detectado!
 *    - ADICIONAR a diferença ao saldo interno (não sobrescrever)
 *    - Atualizar onChainSnapshot
 *    - Marcar sweepStatus = PENDING para consolidação futura
 */

export class DepositMonitorWorker {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  static start() {
    if (this.intervalId) {
      console.log('⚠️  Deposit Monitor já está rodando');
      return;
    }

    console.log('🔍 Deposit Monitor Worker iniciado (a cada 30s) — modo Omnibus (crédito aditivo)');

    // Executar imediatamente
    this.run();

    // Executar a cada 30 segundos
    this.intervalId = setInterval(() => {
      this.run();
    }, 30000);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Deposit Monitor Worker parado');
    }
  }

  static async run() {
    if (this.isRunning) {
      console.log('⏭️  Deposit Monitor: já executando, pulando...');
      return;
    }

    this.isRunning = true;

    try {
      console.log('\n🔍 [Deposit Monitor] Verificando depósitos...');

      const wallets = await prisma.userWallet.findMany({
        where: {isActive: true},
        include: {user: true},
      });

      console.log(`   Monitorando ${wallets.length} carteiras`);

      let depositsDetected = 0;

      for (const wallet of wallets) {
        try {
          const detected = await this.checkWalletDeposits(wallet);
          if (detected) depositsDetected++;
        } catch (error) {
          console.error(
            `   ❌ Erro ao verificar carteira ${wallet.id}:`,
            (error as Error).message
          );
        }
      }

      if (depositsDetected > 0) {
        console.log(`   ✅ ${depositsDetected} depósitos detectados`);
      } else {
        console.log(`   ℹ️  Nenhum depósito novo`);
      }
    } catch (error) {
      console.error('❌ [Deposit Monitor] Erro:', (error as Error).message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Verifica depósitos em uma carteira específica
   * Usa crédito ADITIVO — compara on-chain atual vs onChainSnapshot
   */
  private static async checkWalletDeposits(wallet: any): Promise<boolean> {
    // Consultar saldo on-chain (com retry para resiliência a falhas de RPC)
    const onChainBalance = await retryWithBackoff(
      () => BlockchainService.getBalance(wallet.address, wallet.network),
      3,
      `getBalance(${wallet.cryptoType}/${wallet.network})`
    );

    // Comparar com onChainSnapshot (último saldo on-chain conhecido)
    const savedOnChainBN = new BigNumber(wallet.onChainSnapshot || '0');
    const currentBalanceBN = new BigNumber(onChainBalance);

    // Tolerância para diferenças de arredondamento
    const diffBN = currentBalanceBN.minus(savedOnChainBN);
    if (diffBN.abs().lt('0.00000001') || diffBN.lte(0)) {
      // Saldo igual ou diminuiu (sweep aconteceu) — nada a fazer
      return false;
    }

    // Depósito detectado!
    const depositAmountBN = diffBN;

    console.log(
      `   💰 Depósito detectado em ${wallet.cryptoType}/${wallet.network}:`,
      `onChainSnapshot: ${savedOnChainBN.toFixed(8)} → on-chain: ${currentBalanceBN.toFixed(8)} (+${depositAmountBN.toFixed(8)})`
    );

    // Buscar transações desde último bloco verificado (com retry)
    const transactions = await retryWithBackoff(
      () => BlockchainService.getTransactions(wallet.address, wallet.network, wallet.lastBlockHeight || 0),
      3,
      `getTransactions(${wallet.cryptoType}/${wallet.network})`
    );

    // Filtrar apenas transações RECEBIDAS e confirmadas
    const deposits = transactions.filter(
      (tx) =>
        tx.to.toLowerCase() === wallet.address.toLowerCase() &&
        tx.confirmations >= this.getMinConfirmations(wallet.network)
    );

    if (deposits.length === 0) {
      // Saldo mudou mas sem transações confirmadas — aguardar
      console.log(
        `   ⏳ Transações pendentes de confirmação para ${wallet.id}`
      );
      return false;
    }

    // SECURITY (H-6): Anti-replay — filtrar txHashes já processados
    const candidateHashes = deposits.map((d) => d.hash).filter(Boolean);
    const existingTxs = candidateHashes.length > 0
      ? await prisma.walletTransaction.findMany({
          where: { txHash: { in: candidateHashes } },
          select: { txHash: true },
        })
      : [];
    const processedHashes = new Set(existingTxs.map((wt) => wt.txHash));
    const newDeposits = deposits.filter(
      (d) => d.hash && !processedHashes.has(d.hash) && new BigNumber(d.value).gt(0)
    );

    if (newDeposits.length === 0) {
      console.log(
        `   ℹ️  Todos os depósitos já foram registrados para ${wallet.id} (anti-replay)`
      );
      return false;
    }

    // Crédito ADITIVO: adicionar depósito ao saldo interno (não sobrescrever)
    const actualDepositBN = newDeposits.reduce(
      (sum, d) => sum.plus(d.value),
      new BigNumber(0)
    );
    const newBalance = new BigNumber(wallet.balance).plus(actualDepositBN).toFixed(8);
    const newAvailable = new BigNumber(wallet.availableBalance).plus(actualDepositBN).toFixed(8);

    // Coletar WalletTransaction creates para depósitos novos (não duplicados)
    const walletTxCreates = newDeposits.map((deposit) =>
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: wallet.userId,
          type: 'DEPOSIT',
          amount: new BigNumber(deposit.value).toFixed(8),
          balanceBefore: wallet.balance,
          balanceAfter: new BigNumber(wallet.balance).plus(deposit.value).toFixed(8),
          txHash: deposit.hash,
          blockHeight: deposit.blockHeight,
          confirmations: deposit.confirmations,
          description: `Depósito recebido na rede ${wallet.network}`,
          metadata: JSON.stringify({
            from: deposit.from,
            timestamp: deposit.timestamp,
          }),
        },
      })
    );

    // Balance update + WalletTransactions em uma única transaction atômica
    await prisma.$transaction([
      prisma.userWallet.update({
        where: {id: wallet.id},
        data: {
          balance: newBalance,                    // ADITIVO (não sobrescreve)
          availableBalance: newAvailable,         // ADITIVO
          onChainSnapshot: onChainBalance,        // Rastreia on-chain separadamente
          totalDeposited: new BigNumber(wallet.totalDeposited).plus(actualDepositBN).toFixed(8),
          lastSyncedAt: new Date(),
          lastBlockHeight: newDeposits[0]?.blockHeight || wallet.lastBlockHeight,
          sweepStatus: 'PENDING',                 // Marcar para sweep
          pendingSweepAmount: new BigNumber(wallet.pendingSweepAmount || '0').plus(actualDepositBN).toFixed(8),
        },
      }),
      ...walletTxCreates,
    ]);

    // Notificações FORA da transaction (não-críticas, fire-and-forget)
    for (const deposit of newDeposits) {
      const amountBN = new BigNumber(deposit.value);
      if (amountBN.lte(0)) continue;
      const amount = amountBN.toFixed(8);

      console.log(
        `   ✅ Depósito registrado: ${amount} ${wallet.cryptoType} (tx: ${deposit.hash.slice(0, 10)}...)`
      );

      try {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          userId: wallet.userId,
          type: 'DEPOSIT_CONFIRMED',
          category: 'WALLET',
          title: 'Depósito Confirmado',
          message: `Você recebeu ${amount} ${wallet.cryptoType} na rede ${wallet.network}`,
          actionUrl: `/wallets/${wallet.id}`,
          actionLabel: 'Ver Carteira',
          priority: 'HIGH',
          metadata: {
            walletId: wallet.id,
            amount,
            cryptoType: wallet.cryptoType,
            network: wallet.network,
            txHash: deposit.hash,
          },
        });
        console.log(`   🔔 Notificação enviada ao usuário ${wallet.userId}`);
      } catch (error) {
        console.error('   ⚠️  Erro ao enviar notificação:', (error as Error).message);
      }
    }

    return true;
  }

  /**
   * Retorna confirmações mínimas por rede
   */
  private static getMinConfirmations(network: string): number {
    const minConf: Record<string, number> = {
      BITCOIN: 3,
      ETHEREUM: 12,
      BASE: 10,
      ARBITRUM: 10,
      SOLANA: 15,
    };

    return minConf[network] || 10;
  }
}

// Auto-start quando módulo é importado (se não estiver em teste)
if (process.env.NODE_ENV !== 'test') {
  DepositMonitorWorker.start();
}

// Graceful shutdown
process.on('SIGINT', () => {
  DepositMonitorWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  DepositMonitorWorker.stop();
  process.exit(0);
});
