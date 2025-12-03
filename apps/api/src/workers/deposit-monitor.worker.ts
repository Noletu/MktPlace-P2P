import {PrismaClient} from '@prisma/client';
import {BlockchainService} from '../services/blockchain/blockchain.service';
import {NotificationService} from '../services/notification.service';

const prisma = new PrismaClient();

/**
 * Deposit Monitor Worker
 *
 * Monitora depósitos em todas as carteiras ativas dos usuários.
 *
 * Execução: A cada 30 segundos
 *
 * Fluxo:
 * 1. Buscar todas UserWallets ativas
 * 2. Para cada carteira:
 *    - Consultar saldo on-chain
 *    - Comparar com saldo salvo no banco
 *    - Se diferente: detectou depósito!
 *    - Buscar transações novas (desde lastBlockHeight)
 *    - Verificar confirmações mínimas
 *    - Creditar saldo + registrar WalletTransaction
 *    - Enviar notificação ao usuário
 * 3. Atualizar lastSyncedAt e lastBlockHeight
 */

export class DepositMonitorWorker {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Inicia o worker
   */
  static start() {
    if (this.intervalId) {
      console.log('⚠️  Deposit Monitor já está rodando');
      return;
    }

    console.log('🔍 Deposit Monitor Worker iniciado (a cada 30s)');

    // Executar imediatamente
    this.run();

    // Executar a cada 30 segundos
    this.intervalId = setInterval(() => {
      this.run();
    }, 30000); // 30 segundos
  }

  /**
   * Para o worker
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Deposit Monitor Worker parado');
    }
  }

  /**
   * Executa uma verificação completa
   */
  static async run() {
    if (this.isRunning) {
      console.log('⏭️  Deposit Monitor: já executando, pulando...');
      return;
    }

    this.isRunning = true;

    try {
      console.log('\n🔍 [Deposit Monitor] Verificando depósitos...');

      // Buscar todas carteiras ativas
      const wallets = await prisma.userWallet.findMany({
        where: {isActive: true},
        include: {user: true},
      });

      console.log(`   Monitorando ${wallets.length} carteiras`);

      let depositsDetected = 0;

      // Processar cada carteira
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
   */
  private static async checkWalletDeposits(wallet: any): Promise<boolean> {
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
      // Saldo igual, nada a fazer
      return false;
    }

    // Detectou mudança de saldo!
    console.log(
      `   💰 Depósito detectado em ${wallet.cryptoType}/${wallet.network}:`,
      `${savedBalance} → ${currentBalance} (+${(currentBalance - savedBalance).toFixed(8)})`
    );

    // Buscar transações desde último bloco verificado
    const transactions = await BlockchainService.getTransactions(
      wallet.address,
      wallet.network,
      wallet.lastBlockHeight || 0
    );

    // Filtrar apenas transações RECEBIDAS e confirmadas
    const deposits = transactions.filter(
      (tx) =>
        tx.to.toLowerCase() === wallet.address.toLowerCase() &&
        tx.confirmations >= this.getMinConfirmations(wallet.network)
    );

    if (deposits.length === 0) {
      // Saldo mudou mas sem transações confirmadas
      // Pode ser transação pendente - aguardar confirmações
      console.log(
        `   ⏳ Transações pendentes de confirmação para ${wallet.id}`
      );
      return false;
    }

    // Processar depósitos confirmados
    for (const deposit of deposits) {
      await this.processDeposit(wallet, deposit);
    }

    // Atualizar saldo e última sincronização
    await prisma.userWallet.update({
      where: {id: wallet.id},
      data: {
        balance: onChainBalance,
        availableBalance: (
          parseFloat(onChainBalance) - parseFloat(wallet.lockedBalance)
        ).toString(),
        totalDeposited: (
          parseFloat(wallet.totalDeposited) +
          (currentBalance - savedBalance)
        ).toString(),
        lastSyncedAt: new Date(),
        lastBlockHeight: deposits[0]?.blockHeight || wallet.lastBlockHeight,
      },
    });

    return true;
  }

  /**
   * Processa um depósito confirmado
   */
  private static async processDeposit(wallet: any, deposit: any) {
    const amount = parseFloat(deposit.value);

    if (amount <= 0) return;

    console.log(
      `   ✅ Processando depósito: ${amount} ${wallet.cryptoType} (tx: ${deposit.hash.slice(0, 10)}...)`
    );

    // Registrar transação de depósito
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: wallet.userId,
        type: 'DEPOSIT',
        amount: amount.toString(),
        balanceBefore: wallet.balance,
        balanceAfter: (parseFloat(wallet.balance) + amount).toString(),
        txHash: deposit.hash,
        blockHeight: deposit.blockHeight,
        confirmations: deposit.confirmations,
        description: `Depósito recebido na rede ${wallet.network}`,
        metadata: JSON.stringify({
          from: deposit.from,
          timestamp: deposit.timestamp,
        }),
      },
    });

    // Enviar notificação ao usuário
    try {
      await NotificationService.create({
        userId: wallet.userId,
        type: 'DEPOSIT_CONFIRMED',
        category: 'WALLET',
        title: 'Depósito Confirmado',
        message: `Você recebeu ${amount} ${wallet.cryptoType} na rede ${wallet.network}`,
        actionUrl: `/wallets/${wallet.id}`,
        actionLabel: 'Ver Carteira',
        priority: 'HIGH',
        metadata: JSON.stringify({
          walletId: wallet.id,
          amount,
          cryptoType: wallet.cryptoType,
          network: wallet.network,
          txHash: deposit.hash,
        }),
      });
    } catch (error) {
      console.error('   ⚠️  Erro ao enviar notificação:', (error as Error).message);
    }

    console.log(`   🔔 Notificação enviada ao usuário ${wallet.userId}`);
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
      TRC20: 19,
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
