import { PrismaClient } from '@prisma/client';
import { KeyManagementService } from './hd-wallet/key-management.service';
import { TransactionSenderService } from './blockchain/transaction-sender.service';
import { BlockchainService } from './blockchain/blockchain.service';
import { logger } from '../utils/logger';
import { PlatformWalletService } from './platformWallet.service';

const prisma = new PrismaClient();

/**
 * Sweep Service (Omnibus Architecture)
 *
 * Consolida fundos dos endereços de depósito dos usuários → hot wallet (PlatformWallet Account 0).
 *
 * Algoritmo por rede:
 * - Bitcoin: 1 passo (UTXO direto, fee paga pelo UTXO)
 * - EVM Native (ETH): 1 passo (send balance - gas)
 * - EVM Token (USDT/USDC): 2 passos (fund gas → sweep token)
 * - Solana Native (SOL): 1 passo (send balance - fee)
 * - Solana Token (USDT/USDC): 2 passos (fund SOL → sweep token)
 */
export class SweepService {
  /** Valor mínimo para acionar sweep (evitar gas > valor) */
  static readonly MIN_SWEEP_THRESHOLD: Record<string, number> = {
    BTC: 0.0001,
    USDT: 1,
    USDC: 1,
    ETH: 0.001,
    SOL: 0.01,
  };

  /** Máximo de gas funding por sweep (segurança contra drain) */
  static readonly MAX_GAS_FUNDING: Record<string, number> = {
    ETH: 0.01,      // Para redes EVM (ETH mainnet)
    BASE_ETH: 0.0005, // Para Base L2
    ARB_ETH: 0.001,  // Para Arbitrum L2
    SOL: 0.1,        // Para Solana
  };

  /** Valores de gas a enviar para user address (por rede) */
  static readonly GAS_AMOUNTS: Record<string, number> = {
    ETHEREUM: 0.003,
    BASE: 0.00005,
    ARBITRUM: 0.0001,
    SOLANA: 0.005,
  };

  static readonly MAX_RETRIES = 3;

  /**
   * Busca UserWallets que precisam de sweep
   */
  static async getWalletsNeedingSweep(limit: number = 5) {
    return prisma.userWallet.findMany({
      where: {
        sweepStatus: 'PENDING',
        isActive: true,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Orquestra sweep de uma wallet — despacha para método específico por rede
   */
  static async sweepWallet(walletId: string): Promise<void> {
    const wallet = await prisma.userWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    // Verificar threshold mínimo
    const pendingAmount = parseFloat(wallet.pendingSweepAmount || '0');
    const threshold = this.MIN_SWEEP_THRESHOLD[wallet.cryptoType] || 0.001;

    if (pendingAmount < threshold) {
      logger.info(`[SWEEP] ${wallet.cryptoType}/${wallet.network}: ${pendingAmount} below threshold ${threshold}, skipping`);
      return;
    }

    // Buscar hot wallet correspondente
    const hotWallet = await prisma.platformWallet.findUnique({
      where: {
        cryptoType_network: {
          cryptoType: wallet.cryptoType,
          network: wallet.network,
        },
      },
    });

    if (!hotWallet) {
      throw new Error(`Hot wallet not found for ${wallet.cryptoType}/${wallet.network}`);
    }

    // Verificar saldo on-chain real antes de sweep
    const onChainBalance = await BlockchainService.getBalance(
      wallet.address,
      wallet.network
    );
    const realBalance = parseFloat(onChainBalance);

    if (realBalance < threshold) {
      logger.info(`[SWEEP] ${wallet.cryptoType}/${wallet.network}: on-chain balance ${realBalance} below threshold, skipping`);
      // Resetar sweep status
      await prisma.userWallet.update({
        where: { id: walletId },
        data: { sweepStatus: 'NONE', pendingSweepAmount: '0' },
      });
      return;
    }

    // Criar SweepTransaction
    const sweepTx = await prisma.sweepTransaction.create({
      data: {
        userWalletId: walletId,
        platformWalletId: hotWallet.id,
        cryptoType: wallet.cryptoType,
        network: wallet.network,
        amount: realBalance.toString(),
        status: 'PENDING',
      },
    });

    try {
      // Despachar por tipo de ativo/rede
      const isToken = ['USDT', 'USDC'].includes(wallet.cryptoType);
      const isSolana = wallet.network === 'SOLANA';
      const isBitcoin = wallet.network === 'BITCOIN';

      if (isBitcoin) {
        await this.sweepBitcoin(wallet, hotWallet, sweepTx.id);
      } else if (isSolana && isToken) {
        await this.sweepSolanaToken(wallet, hotWallet, sweepTx.id);
      } else if (isSolana && !isToken) {
        await this.sweepSolanaNative(wallet, hotWallet, sweepTx.id);
      } else if (!isSolana && isToken) {
        await this.sweepEVMToken(wallet, hotWallet, sweepTx.id);
      } else {
        await this.sweepEVMNative(wallet, hotWallet, sweepTx.id);
      }
    } catch (error: any) {
      logger.error(`[SWEEP] Failed for wallet ${walletId}: ${error.message}`);
      await this.markSweepFailed(sweepTx.id, walletId, error.message);
    }
  }

  /**
   * Bitcoin: 1 passo — UTXO direto, fee deduzida do UTXO
   */
  private static async sweepBitcoin(
    wallet: any,
    hotWallet: any,
    sweepTxId: string
  ): Promise<void> {
    logger.info(`[SWEEP] Bitcoin sweep: ${wallet.address} → ${hotWallet.address}`);

    // Decrypt chave do usuário
    const privateKey = KeyManagementService.decryptPrivateKey(
      wallet.encryptedPrivateKey,
      wallet.userId
    );

    // Verificar saldo on-chain
    const onChainBalance = await BlockchainService.getBalance(wallet.address, 'BITCOIN');
    const balance = parseFloat(onChainBalance);

    await prisma.$transaction([
      prisma.sweepTransaction.update({
        where: { id: sweepTxId },
        data: { status: 'SWEEPING', amount: balance.toString() },
      }),
      prisma.userWallet.update({
        where: { id: wallet.id },
        data: { sweepStatus: 'SWEEPING' },
      }),
    ]);

    // Enviar tudo para hot wallet (fee deduzida automaticamente pelo UTXO builder)
    const result = await TransactionSenderService.sendBitcoinTransaction(
      privateKey,
      wallet.address,
      hotWallet.address,
      balance,
      10 // fee rate em sat/vByte
    );

    await this.completeSweep(sweepTxId, wallet.id, hotWallet.id, result.txHash, balance.toString());
    logger.info(`[SWEEP] Bitcoin sweep completed: ${result.txHash}`);
  }

  /**
   * EVM Native (ETH): 1 passo — send (balance - gas cost)
   */
  private static async sweepEVMNative(
    wallet: any,
    hotWallet: any,
    sweepTxId: string
  ): Promise<void> {
    logger.info(`[SWEEP] EVM Native sweep (${wallet.network}): ${wallet.address} → ${hotWallet.address}`);

    const privateKey = KeyManagementService.decryptPrivateKey(
      wallet.encryptedPrivateKey,
      wallet.userId
    );

    const onChainBalance = await BlockchainService.getBalance(wallet.address, wallet.network);
    const balance = parseFloat(onChainBalance);

    // Gas para transferência simples: 21000 gas
    // Reservar margem generosa para gas
    const gasReserve = this.GAS_AMOUNTS[wallet.network] || 0.003;
    const amountToSend = balance - gasReserve;

    if (amountToSend <= 0) {
      logger.warn(`[SWEEP] EVM Native: balance ${balance} too low to cover gas ${gasReserve}`);
      await this.markSweepFailed(sweepTxId, wallet.id, 'Balance too low to cover gas');
      return;
    }

    await prisma.$transaction([
      prisma.sweepTransaction.update({
        where: { id: sweepTxId },
        data: { status: 'SWEEPING', amount: amountToSend.toFixed(8) },
      }),
      prisma.userWallet.update({
        where: { id: wallet.id },
        data: { sweepStatus: 'SWEEPING' },
      }),
    ]);

    const result = await TransactionSenderService.sendEVMTransaction(
      privateKey,
      hotWallet.address,
      amountToSend.toFixed(8),
      wallet.network,
      'ETH'
    );

    await this.completeSweep(sweepTxId, wallet.id, hotWallet.id, result.txHash, amountToSend.toFixed(8));
    logger.info(`[SWEEP] EVM Native sweep completed: ${result.txHash}`);
  }

  /**
   * EVM Token (USDT/USDC): 2 passos
   * 1. Hot wallet envia gas (ETH) para user address
   * 2. User address envia tokens para hot wallet
   */
  private static async sweepEVMToken(
    wallet: any,
    hotWallet: any,
    sweepTxId: string
  ): Promise<void> {
    logger.info(`[SWEEP] EVM Token sweep (${wallet.cryptoType}/${wallet.network}): ${wallet.address} → ${hotWallet.address}`);

    // Verificar saldo do token on-chain
    const tokenBalance = await BlockchainService.getBalance(wallet.address, wallet.network);
    const tokenAmount = parseFloat(tokenBalance);

    // Passo 1: Enviar gas do hot wallet para user address
    const gasAmount = this.GAS_AMOUNTS[wallet.network] || 0.003;
    const maxGas = this.getMaxGasFunding(wallet.network);

    if (gasAmount > maxGas) {
      throw new Error(`Gas funding ${gasAmount} exceeds max ${maxGas} for ${wallet.network}`);
    }

    // Decrypt chave do hot wallet
    const hotPrivateKey = KeyManagementService.decryptPrivateKey(
      hotWallet.encryptedPrivateKey,
      KeyManagementService.PLATFORM_ID
    );

    await prisma.$transaction([
      prisma.sweepTransaction.update({
        where: { id: sweepTxId },
        data: {
          status: 'GAS_FUNDING',
          gasFundingAmount: gasAmount.toFixed(8),
          gasFundingStatus: 'PENDING',
          amount: tokenAmount.toString(),
        },
      }),
      prisma.userWallet.update({
        where: { id: wallet.id },
        data: { sweepStatus: 'GAS_FUNDING' },
      }),
    ]);

    // Enviar ETH do hot wallet para user address (para gas)
    const gasFundingResult = await TransactionSenderService.sendEVMTransaction(
      hotPrivateKey,
      wallet.address,
      gasAmount.toFixed(8),
      wallet.network,
      'ETH'
    );

    await prisma.sweepTransaction.update({
      where: { id: sweepTxId },
      data: {
        gasFundingTxHash: gasFundingResult.txHash,
        gasFundingStatus: 'CONFIRMED',
        status: 'GAS_CONFIRMED',
      },
    });

    // Passo 2: User address envia tokens para hot wallet
    const userPrivateKey = KeyManagementService.decryptPrivateKey(
      wallet.encryptedPrivateKey,
      wallet.userId
    );

    await prisma.$transaction([
      prisma.sweepTransaction.update({
        where: { id: sweepTxId },
        data: { status: 'SWEEPING' },
      }),
      prisma.userWallet.update({
        where: { id: wallet.id },
        data: { sweepStatus: 'SWEEPING' },
      }),
    ]);

    const sweepResult = await TransactionSenderService.sendEVMTransaction(
      userPrivateKey,
      hotWallet.address,
      tokenAmount.toString(),
      wallet.network,
      wallet.cryptoType
    );

    await this.completeSweep(sweepTxId, wallet.id, hotWallet.id, sweepResult.txHash, tokenAmount.toString());
    logger.info(`[SWEEP] EVM Token sweep completed: ${sweepResult.txHash}`);
  }

  /**
   * Solana Native (SOL): 1 passo — send (balance - fee)
   */
  private static async sweepSolanaNative(
    wallet: any,
    hotWallet: any,
    sweepTxId: string
  ): Promise<void> {
    logger.info(`[SWEEP] Solana Native sweep: ${wallet.address} → ${hotWallet.address}`);

    const privateKey = KeyManagementService.decryptPrivateKey(
      wallet.encryptedPrivateKey,
      wallet.userId
    );

    const onChainBalance = await BlockchainService.getBalance(wallet.address, 'SOLANA');
    const balance = parseFloat(onChainBalance);

    const solFee = 0.000005; // 5000 lamports
    const amountToSend = balance - solFee;

    if (amountToSend <= 0) {
      await this.markSweepFailed(sweepTxId, wallet.id, 'Balance too low to cover Solana fee');
      return;
    }

    await prisma.$transaction([
      prisma.sweepTransaction.update({
        where: { id: sweepTxId },
        data: { status: 'SWEEPING', amount: amountToSend.toString() },
      }),
      prisma.userWallet.update({
        where: { id: wallet.id },
        data: { sweepStatus: 'SWEEPING' },
      }),
    ]);

    const result = await TransactionSenderService.sendSolanaTransaction(
      privateKey,
      hotWallet.address,
      amountToSend.toString(),
      'SOL'
    );

    await this.completeSweep(sweepTxId, wallet.id, hotWallet.id, result.txHash, amountToSend.toString());
    logger.info(`[SWEEP] Solana Native sweep completed: ${result.txHash}`);
  }

  /**
   * Solana Token (USDT/USDC): 2 passos
   * 1. Hot wallet envia SOL para user address (para gas)
   * 2. User address envia tokens para hot wallet
   */
  private static async sweepSolanaToken(
    wallet: any,
    hotWallet: any,
    sweepTxId: string
  ): Promise<void> {
    logger.info(`[SWEEP] Solana Token sweep (${wallet.cryptoType}): ${wallet.address} → ${hotWallet.address}`);

    const tokenBalance = await BlockchainService.getBalance(wallet.address, 'SOLANA');
    const tokenAmount = parseFloat(tokenBalance);

    // Passo 1: Enviar SOL do hot wallet para user address
    const solForGas = this.GAS_AMOUNTS['SOLANA'] || 0.005;

    const hotPrivateKey = KeyManagementService.decryptPrivateKey(
      hotWallet.encryptedPrivateKey,
      KeyManagementService.PLATFORM_ID
    );

    await prisma.$transaction([
      prisma.sweepTransaction.update({
        where: { id: sweepTxId },
        data: {
          status: 'GAS_FUNDING',
          gasFundingAmount: solForGas.toString(),
          gasFundingStatus: 'PENDING',
          amount: tokenAmount.toString(),
        },
      }),
      prisma.userWallet.update({
        where: { id: wallet.id },
        data: { sweepStatus: 'GAS_FUNDING' },
      }),
    ]);

    // Enviar SOL para gas
    const gasFundingResult = await TransactionSenderService.sendSolanaTransaction(
      hotPrivateKey,
      wallet.address,
      solForGas.toString(),
      'SOL'
    );

    await prisma.sweepTransaction.update({
      where: { id: sweepTxId },
      data: {
        gasFundingTxHash: gasFundingResult.txHash,
        gasFundingStatus: 'CONFIRMED',
        status: 'GAS_CONFIRMED',
      },
    });

    // Passo 2: User address envia tokens para hot wallet
    const userPrivateKey = KeyManagementService.decryptPrivateKey(
      wallet.encryptedPrivateKey,
      wallet.userId
    );

    await prisma.$transaction([
      prisma.sweepTransaction.update({
        where: { id: sweepTxId },
        data: { status: 'SWEEPING' },
      }),
      prisma.userWallet.update({
        where: { id: wallet.id },
        data: { sweepStatus: 'SWEEPING' },
      }),
    ]);

    const sweepResult = await TransactionSenderService.sendSolanaTransaction(
      userPrivateKey,
      hotWallet.address,
      tokenAmount.toString(),
      wallet.cryptoType
    );

    await this.completeSweep(sweepTxId, wallet.id, hotWallet.id, sweepResult.txHash, tokenAmount.toString());
    logger.info(`[SWEEP] Solana Token sweep completed: ${sweepResult.txHash}`);
  }

  /**
   * Marca sweep como completo — atualiza SweepTransaction, UserWallet e PlatformWallet
   */
  private static async completeSweep(
    sweepTxId: string,
    walletId: string,
    hotWalletId: string,
    txHash: string,
    amount: string
  ): Promise<void> {
    const amountNum = parseFloat(amount);

    // Buscar hot wallet ANTES da transaction para calcular novos valores
    const hotWallet = await prisma.platformWallet.findUnique({
      where: { id: hotWalletId },
    });

    if (!hotWallet) {
      logger.error(`[SWEEP] Hot wallet ${hotWalletId} not found during completeSweep`);
      return;
    }

    // Transaction atômica: SweepTransaction + UserWallet + PlatformWallet + Movement
    const newBalance = (parseFloat(hotWallet.balance) + amountNum).toString();
    await prisma.$transaction(async (tx) => {
      await tx.sweepTransaction.update({
        where: { id: sweepTxId },
        data: {
          sweepTxHash: txHash,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      await tx.userWallet.update({
        where: { id: walletId },
        data: {
          sweepStatus: 'COMPLETED',
          lastSweptAt: new Date(),
          pendingSweepAmount: '0',
          onChainSnapshot: '0',
        },
      });
      await tx.platformWallet.update({
        where: { id: hotWalletId },
        data: {
          balance: newBalance,
          availableBalance: newBalance,
          totalDeposited: (parseFloat(hotWallet.totalDeposited) + amountNum).toString(),
        },
      });
      // Registrar movimentação no ledger
      await PlatformWalletService.recordMovement(tx, {
        platformWalletId: hotWalletId,
        type: 'SWEEP_IN',
        direction: 'IN',
        amount: amountNum.toString(),
        balanceBefore: hotWallet.balance,
        balanceAfter: newBalance,
        description: `Sweep recebido de user wallet ${walletId}`,
        txHash,
        userId: walletId,
        metadata: {
          sweepTxId,
          userWalletId: walletId,
          cryptoType: hotWallet.cryptoType,
          network: hotWallet.network,
        },
      });
    });
  }

  /**
   * Marca sweep como falho — incrementa retry ou marca FAILED
   */
  private static async markSweepFailed(
    sweepTxId: string,
    walletId: string,
    error: string
  ): Promise<void> {
    const sweepTx = await prisma.sweepTransaction.findUnique({
      where: { id: sweepTxId },
    });

    const newRetryCount = (sweepTx?.retryCount || 0) + 1;

    if (newRetryCount >= this.MAX_RETRIES) {
      // Falhou definitivamente — transaction atômica
      await prisma.$transaction([
        prisma.sweepTransaction.update({
          where: { id: sweepTxId },
          data: {
            status: 'FAILED',
            lastError: error,
            retryCount: newRetryCount,
          },
        }),
        prisma.userWallet.update({
          where: { id: walletId },
          data: { sweepStatus: 'FAILED' },
        }),
      ]);

      logger.error(`[SWEEP] PERMANENTLY FAILED after ${this.MAX_RETRIES} retries: wallet ${walletId}`);
    } else {
      // Pode tentar novamente — transaction atômica
      await prisma.$transaction([
        prisma.sweepTransaction.update({
          where: { id: sweepTxId },
          data: {
            status: 'PENDING',
            lastError: error,
            retryCount: newRetryCount,
          },
        }),
        prisma.userWallet.update({
          where: { id: walletId },
          data: { sweepStatus: 'PENDING' },
        }),
      ]);

      logger.warn(`[SWEEP] Retry ${newRetryCount}/${this.MAX_RETRIES} for wallet ${walletId}: ${error}`);
    }
  }

  /**
   * Processa SweepTransactions ativas (que estão em estágio intermediário)
   * Chamado pelo SweepWorker para retomar sweeps em andamento
   */
  static async processActiveSweeps(): Promise<void> {
    const activeSweeps = await prisma.sweepTransaction.findMany({
      where: {
        status: {
          in: ['GAS_FUNDING', 'GAS_CONFIRMED', 'SWEEPING'],
        },
      },
      include: {
        userWallet: true,
        platformWallet: true,
      },
    });

    for (const sweep of activeSweeps) {
      try {
        if (sweep.status === 'GAS_FUNDING' && sweep.gasFundingTxHash) {
          // Verificar se gas funding foi confirmado
          const status = await BlockchainService.getTransactionStatus(
            sweep.gasFundingTxHash,
            sweep.network
          );

          if (status.confirmed) {
            await prisma.sweepTransaction.update({
              where: { id: sweep.id },
              data: {
                gasFundingStatus: 'CONFIRMED',
                status: 'GAS_CONFIRMED',
              },
            });
            logger.info(`[SWEEP] Gas funding confirmed for sweep ${sweep.id}`);
          }
        }

        if (sweep.status === 'SWEEPING' && sweep.sweepTxHash) {
          // Verificar se sweep tx foi confirmado
          const status = await BlockchainService.getTransactionStatus(
            sweep.sweepTxHash,
            sweep.network
          );

          if (status.confirmed) {
            await this.completeSweep(
              sweep.id,
              sweep.userWalletId,
              sweep.platformWalletId,
              sweep.sweepTxHash,
              sweep.amount
            );
            logger.info(`[SWEEP] Sweep confirmed on-chain: ${sweep.id}`);
          }
        }
      } catch (error: any) {
        logger.warn(`[SWEEP] Error processing active sweep ${sweep.id}: ${error.message}`);
      }
    }
  }

  /**
   * Helper: máximo de gas funding permitido por rede
   */
  private static getMaxGasFunding(network: string): number {
    switch (network) {
      case 'ETHEREUM': return this.MAX_GAS_FUNDING['ETH'];
      case 'BASE': return this.MAX_GAS_FUNDING['BASE_ETH'];
      case 'ARBITRUM': return this.MAX_GAS_FUNDING['ARB_ETH'];
      case 'SOLANA': return this.MAX_GAS_FUNDING['SOL'];
      default: return this.MAX_GAS_FUNDING['ETH'];
    }
  }
}
