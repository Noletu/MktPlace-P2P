import { PrismaClient } from '@prisma/client';
import { DerivationService } from './hd-wallet/derivation.service';
import { KeyManagementService } from './hd-wallet/key-management.service';

const prisma = new PrismaClient();

/**
 * Platform Wallet Service
 *
 * Gerencia carteiras HD da plataforma (sócios MASTER/ADMIN).
 * Account 0 é RESERVADO para platform wallets.
 *
 * Usadas para:
 * 1. Receber fees das transações
 * 2. Depósitos dos sócios (cold wallet → hot wallet)
 */
export class PlatformWalletService {
  /**
   * Cria automaticamente platform wallets para todas as redes suportadas
   * Chamado quando master seed é gerada
   */
  async createPlatformWallets(): Promise<void> {
    console.log('[PLATFORM WALLET] Creating platform wallets for all supported networks...');

    const networks = [
      { crypto: 'BTC', network: 'BITCOIN' },
      { crypto: 'USDT', network: 'ETHEREUM' },
      { crypto: 'USDT', network: 'BASE' },
      { crypto: 'USDT', network: 'ARBITRUM' },
      { crypto: 'USDT', network: 'SOLANA' },
      { crypto: 'USDC', network: 'ETHEREUM' },
      { crypto: 'USDC', network: 'BASE' },
      { crypto: 'USDC', network: 'ARBITRUM' },
      { crypto: 'USDC', network: 'SOLANA' },
    ];

    for (const { crypto, network } of networks) {
      try {
        await this.createOrUpdatePlatformWallet(crypto, network);
      } catch (error: any) {
        console.error(`[PLATFORM WALLET] Failed to create ${crypto} ${network}:`, error.message);
        // Continuar mesmo se uma rede falhar (ex: Solana pode não estar pronta)
      }
    }

    console.log('[PLATFORM WALLET] Platform wallets creation completed');
  }

  /**
   * Cria ou atualiza uma platform wallet específica
   */
  private async createOrUpdatePlatformWallet(
    cryptoType: string,
    network: string
  ): Promise<void> {
    console.log(`[PLATFORM WALLET] Deriving ${cryptoType} ${network}...`);

    // Derivar carteira da plataforma (Account 0)
    const { address, privateKey, derivationPath } = DerivationService.derivePlatformWallet(
      cryptoType,
      network
    );

    // Criptografar private key
    const encryptedPrivateKey = KeyManagementService.encryptPrivateKey(privateKey, KeyManagementService.PLATFORM_ID);

    // Upsert no banco (cria ou atualiza)
    await prisma.platformWallet.upsert({
      where: {
        cryptoType_network: {
          cryptoType,
          network,
        },
      },
      create: {
        cryptoType,
        network,
        address,
        derivationPath,
        accountIndex: 0,
        encryptedPrivateKey,
        balance: '0',
        availableBalance: '0',
        totalFeesCollected: '0',
        totalDeposited: '0',
        totalWithdrawn: '0',
        isActive: true,
      },
      update: {
        address,
        derivationPath,
        encryptedPrivateKey,
      },
    });

    console.log(`[PLATFORM WALLET] ✅ ${cryptoType} ${network}: ${address}`);
  }

  /**
   * Retorna todas as platform wallets
   */
  async getAllPlatformWallets() {
    return await prisma.platformWallet.findMany({
      orderBy: [{ cryptoType: 'asc' }, { network: 'asc' }],
    });
  }

  /**
   * Retorna platform wallet específica
   */
  async getPlatformWallet(cryptoType: string, network: string) {
    return await prisma.platformWallet.findUnique({
      where: {
        cryptoType_network: {
          cryptoType,
          network,
        },
      },
    });
  }

  /**
   * Retorna saldo total das platform wallets (fees acumuladas dos sócios)
   * Agregado por crypto
   */
  async getPlatformBalance() {
    const wallets = await prisma.platformWallet.findMany();

    // Agrupa por crypto
    const balances: Record<
      string,
      {
        cryptoType: string;
        networks: Array<{ network: string; balance: string; address: string }>;
        totalBalance: number;
        totalFees: number;
      }
    > = {};

    for (const wallet of wallets) {
      if (!balances[wallet.cryptoType]) {
        balances[wallet.cryptoType] = {
          cryptoType: wallet.cryptoType,
          networks: [],
          totalBalance: 0,
          totalFees: 0,
        };
      }

      balances[wallet.cryptoType].networks.push({
        network: wallet.network,
        balance: wallet.balance,
        address: wallet.address,
      });

      balances[wallet.cryptoType].totalBalance += parseFloat(wallet.balance || '0');
      balances[wallet.cryptoType].totalFees += parseFloat(wallet.totalFeesCollected || '0');
    }

    return Object.values(balances);
  }

  /**
   * Atualiza saldo de uma platform wallet (após sync blockchain)
   */
  async updateBalance(
    cryptoType: string,
    network: string,
    balance: string,
    blockHeight?: number
  ): Promise<void> {
    await prisma.platformWallet.update({
      where: {
        cryptoType_network: {
          cryptoType,
          network,
        },
      },
      data: {
        balance,
        availableBalance: balance, // Por enquanto, disponível = total
        lastSyncedAt: new Date(),
        lastBlockHeight: blockHeight,
      },
    });
  }

  /**
   * Registra fee recebida
   */
  async recordFeeReceived(
    cryptoType: string,
    network: string,
    feeAmount: string
  ): Promise<void> {
    const wallet = await this.getPlatformWallet(cryptoType, network);

    if (!wallet) {
      throw new Error(`Platform wallet not found: ${cryptoType} ${network}`);
    }

    const newBalance = (parseFloat(wallet.balance) + parseFloat(feeAmount)).toString();
    const newFeesCollected = (
      parseFloat(wallet.totalFeesCollected) + parseFloat(feeAmount)
    ).toString();

    await prisma.platformWallet.update({
      where: {
        cryptoType_network: {
          cryptoType,
          network,
        },
      },
      data: {
        balance: newBalance,
        availableBalance: newBalance,
        totalFeesCollected: newFeesCollected,
      },
    });
  }

  /**
   * Registra depósito dos sócios (cold → hot)
   */
  async recordDeposit(cryptoType: string, network: string, amount: string): Promise<void> {
    const wallet = await this.getPlatformWallet(cryptoType, network);

    if (!wallet) {
      throw new Error(`Platform wallet not found: ${cryptoType} ${network}`);
    }

    const newBalance = (parseFloat(wallet.balance) + parseFloat(amount)).toString();
    const newDeposited = (parseFloat(wallet.totalDeposited) + parseFloat(amount)).toString();

    await prisma.platformWallet.update({
      where: {
        cryptoType_network: {
          cryptoType,
          network,
        },
      },
      data: {
        balance: newBalance,
        availableBalance: newBalance,
        totalDeposited: newDeposited,
      },
    });
  }

  /**
   * Registra saque dos sócios (hot → cold)
   */
  async recordWithdrawal(cryptoType: string, network: string, amount: string): Promise<void> {
    const wallet = await this.getPlatformWallet(cryptoType, network);

    if (!wallet) {
      throw new Error(`Platform wallet not found: ${cryptoType} ${network}`);
    }

    const currentBalance = parseFloat(wallet.balance);
    const withdrawAmount = parseFloat(amount);

    if (currentBalance < withdrawAmount) {
      throw new Error('Insufficient balance for withdrawal');
    }

    const newBalance = (currentBalance - withdrawAmount).toString();
    const newWithdrawn = (parseFloat(wallet.totalWithdrawn) + withdrawAmount).toString();

    await prisma.platformWallet.update({
      where: {
        cryptoType_network: {
          cryptoType,
          network,
        },
      },
      data: {
        balance: newBalance,
        availableBalance: newBalance,
        totalWithdrawn: newWithdrawn,
      },
    });
  }

  /**
   * Descriptografa private key de uma platform wallet (APENAS para operações de saque)
   */
  async getDecryptedPrivateKey(cryptoType: string, network: string): Promise<string> {
    const wallet = await this.getPlatformWallet(cryptoType, network);

    if (!wallet) {
      throw new Error(`Platform wallet not found: ${cryptoType} ${network}`);
    }

    return KeyManagementService.decryptPrivateKey(wallet.encryptedPrivateKey, KeyManagementService.PLATFORM_ID);
  }
}

export const platformWalletService = new PlatformWalletService();
