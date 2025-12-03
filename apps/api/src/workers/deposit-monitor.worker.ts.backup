import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { CryptoType, NetworkType } from '@mktplace/shared';
import { blockchainService } from '../services/blockchain.service';

const prisma = new PrismaClient();

// Configuração de APIs blockchain
const BLOCKCHAIN_APIS = {
  BITCOIN: {
    url: 'https://blockchain.info/rawtx/',
    confirmationsRequired: 3,
  },
  ETHEREUM: {
    url: 'https://api.etherscan.io/api',
    apiKey: process.env.ETHERSCAN_API_KEY || '',
    confirmationsRequired: 12,
  },
  TRC20: {
    url: 'https://api.trongrid.io/v1/transactions/',
    confirmationsRequired: 19,
  },
  BASE: {
    url: 'https://api.basescan.org/api',
    apiKey: process.env.BASESCAN_API_KEY || '',
    confirmationsRequired: 12,
  },
  ARBITRUM: {
    url: 'https://api.arbiscan.io/api',
    apiKey: process.env.ARBISCAN_API_KEY || '',
    confirmationsRequired: 12,
  },
};

class DepositMonitorWorker {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Deposit monitor already running');
      return;
    }

    console.log('🚀 Starting deposit monitor worker...');
    this.isRunning = true;

    // Verificar a cada 30 segundos
    this.interval = setInterval(() => this.checkPendingDeposits(), 30000);

    // Primeira execução imediata
    await this.checkPendingDeposits();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('🛑 Deposit monitor stopped');
  }

  private async checkPendingDeposits() {
    try {
      // Buscar depósitos não confirmados
      const pendingDeposits = await prisma.deposit.findMany({
        where: {
          confirmed: false,
        },
        include: {
          wallet: true,
        },
      });

      if (pendingDeposits.length === 0) {
        return;
      }

      console.log(`🔍 Checking ${pendingDeposits.length} pending deposits...`);

      for (const deposit of pendingDeposits) {
        await this.verifyDeposit(deposit);
      }
    } catch (error) {
      console.error('❌ Error checking deposits:', error);
    }
  }

  private async verifyDeposit(deposit: any) {
    try {
      const network = deposit.wallet.network as NetworkType;
      const config = BLOCKCHAIN_APIS[network];

      if (!config) {
        console.warn(`⚠️  No API config for network: ${network}`);
        return;
      }

      let confirmations = 0;

      // Verificar confirmações conforme a rede
      switch (network) {
        case NetworkType.BITCOIN:
          confirmations = await this.checkBitcoinTx(deposit.txHash);
          break;
        case NetworkType.ETHEREUM:
        case NetworkType.BASE:
        case NetworkType.ARBITRUM:
          confirmations = await this.checkEthereumLikeTx(deposit.txHash, network);
          break;
        case NetworkType.TRC20:
          confirmations = await this.checkTronTx(deposit.txHash);
          break;
      }

      // Atualizar confirmações
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: { confirmations },
      });

      // Se atingiu confirmações necessárias, marcar como confirmado
      if (confirmations >= config.confirmationsRequired) {
        await this.confirmDeposit(deposit);
      }
    } catch (error) {
      console.error(`❌ Error verifying deposit ${deposit.id}:`, error);
    }
  }

  private async checkBitcoinTx(txHash: string): Promise<number> {
    try {
      // Usar BlockCypher API que fornece confirmações
      const response = await axios.get(`https://api.blockcypher.com/v1/btc/main/txs/${txHash}`);

      const confirmations = response.data.confirmations || 0;
      console.log(`🔗 Bitcoin tx ${txHash}: ${confirmations} confirmations`);

      return confirmations;
    } catch (error: any) {
      console.error('Error checking Bitcoin tx:', error.message);
      return 0;
    }
  }

  private async checkEthereumLikeTx(txHash: string, network: NetworkType): Promise<number> {
    try {
      const config = BLOCKCHAIN_APIS[network];
      const response = await axios.get(config.url, {
        params: {
          module: 'proxy',
          action: 'eth_getTransactionReceipt',
          txhash: txHash,
          apikey: config.apiKey,
        },
      });

      if (response.data.result && response.data.result.blockNumber) {
        // Pegar block number atual
        const currentBlockResponse = await axios.get(config.url, {
          params: {
            module: 'proxy',
            action: 'eth_blockNumber',
            apikey: config.apiKey,
          },
        });

        const currentBlock = parseInt(currentBlockResponse.data.result, 16);
        const txBlock = parseInt(response.data.result.blockNumber, 16);

        return currentBlock - txBlock;
      }

      return 0;
    } catch (error) {
      console.error(`Error checking ${network} tx:`, error);
      return 0;
    }
  }

  private async checkTronTx(txHash: string): Promise<number> {
    try {
      const response = await axios.get(`https://api.trongrid.io/wallet/gettransactionbyid`, {
        params: { value: txHash }
      });

      if (response.data && response.data.ret && response.data.ret.length > 0) {
        // Transação encontrada - pegar info do bloco
        const blockResponse = await axios.get(`https://api.trongrid.io/wallet/getnowblock`);
        const currentBlockNumber = blockResponse.data.block_header.raw_data.number;

        // Buscar info da transação no bloco
        const txInfoResponse = await axios.get(`https://api.trongrid.io/wallet/gettransactioninfobyid`, {
          params: { value: txHash }
        });

        if (txInfoResponse.data && txInfoResponse.data.blockNumber) {
          const txBlockNumber = txInfoResponse.data.blockNumber;
          const confirmations = currentBlockNumber - txBlockNumber;

          console.log(`🔗 Tron tx ${txHash}: ${confirmations} confirmations`);
          return confirmations;
        }
      }

      return 0;
    } catch (error: any) {
      console.error('Error checking Tron tx:', error.message);
      return 0;
    }
  }

  private async confirmDeposit(deposit: any) {
    console.log(`✅ Confirming deposit ${deposit.id} (${deposit.amount} ${deposit.wallet.crypto})`);

    await prisma.$transaction(async (tx) => {
      // Marcar depósito como confirmado
      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          confirmed: true,
          confirmedAt: new Date(),
        },
      });

      // Atualizar saldo da carteira
      const currentBalance = parseFloat(deposit.wallet.balance);
      const depositAmount = parseFloat(deposit.amount);
      const newBalance = (currentBalance + depositAmount).toString();

      await tx.wallet.update({
        where: { id: deposit.wallet.id },
        data: { balance: newBalance },
      });

      // Verificar se há orders aguardando colateral
      const pendingOrders = await tx.order.findMany({
        where: {
          userId: deposit.wallet.userId,
          collateralTxHash: deposit.txHash,
          collateralConfirmed: false,
        },
      });

      // Confirmar colateral das orders
      for (const order of pendingOrders) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            collateralConfirmed: true,
            collateralDepositId: deposit.id,
            status: 'PENDING', // Liberar para marketplace
          },
        });

        console.log(`✅ Order ${order.id} collateral confirmed, released to marketplace`);
      }
    });
  }
}

// Singleton instance
export const depositMonitorWorker = new DepositMonitorWorker();
