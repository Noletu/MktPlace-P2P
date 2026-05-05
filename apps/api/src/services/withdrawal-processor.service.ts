import { PrismaClient } from '@prisma/client';
import BigNumber from 'bignumber.js';
import { KeyManagementService } from './hd-wallet/key-management.service';
import { TransactionSenderService } from './blockchain/transaction-sender.service';
import { FeeEstimatorService } from './blockchain/fee-estimator.service';
import { BlockchainService } from './blockchain/blockchain.service';
import { WalletService } from './wallet.service';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';
import { PlatformWalletService } from './platformWallet.service';
import { emailService } from './email.service';

const prisma = new PrismaClient();

const MAX_RETRIES = 3;

/**
 * Withdrawal Processor Service
 *
 * Orquestra o processamento completo de saques:
 * 1. Busca Withdrawal PENDING
 * 2. Verifica se conta está bloqueada
 * 3. Estima fee de rede
 * 4. Descriptografa private key
 * 5. Envia transação on-chain
 * 6. Atualiza status e notifica usuário
 */
export class WithdrawalProcessorService {
  /**
   * Processa um saque pendente
   */
  static async processWithdrawal(withdrawalId: string): Promise<void> {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        wallet: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!withdrawal) {
      throw new Error(`Withdrawal ${withdrawalId} not found`);
    }

    if (!['PENDING', 'APPROVED'].includes(withdrawal.status)) {
      logger.info(`[WITHDRAWAL] Skipping ${withdrawalId} — status is ${withdrawal.status}`);
      return;
    }

    const { wallet } = withdrawal;
    const user = wallet.user;

    // 1. Verificar conta bloqueada (só para PENDING, APPROVED já passou pela review)
    if (withdrawal.status === 'PENDING' && user.accountFrozen) {
      logger.info(`[WITHDRAWAL] User ${user.id} has frozen account — moving to REQUIRES_APPROVAL`);
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'REQUIRES_APPROVAL' },
      });
      return;
    }

    // 2. Estimar fee de rede
    let feeEstimate;
    try {
      feeEstimate = await FeeEstimatorService.estimateFee(wallet.network, wallet.cryptoType);
    } catch (error: any) {
      logger.error(`[WITHDRAWAL] Fee estimation failed for ${withdrawalId}:`, error.message);
      await this.markFailed(withdrawalId, `Fee estimation failed: ${error.message}`);
      return;
    }

    // 3. Verificar valor mínimo (amount deve cobrir pelo menos a fee)
    const amountBN = new BigNumber(withdrawal.amount);
    const networkFeeBN = new BigNumber(feeEstimate.estimatedFee);

    // Para tokens ERC-20/SPL, a fee é paga em moeda nativa (ETH/SOL), não no token
    // Então o amount do saque não precisa cobrir a fee do gas
    const isToken = ['USDT', 'USDC'].includes(wallet.cryptoType);

    if (!isToken && amountBN.lte(networkFeeBN)) {
      logger.error(`[WITHDRAWAL] Amount ${amountBN.toFixed(8)} is less than network fee ${networkFeeBN.toFixed(8)}`);
      await this.markFailed(withdrawalId, `Withdrawal amount (${amountBN.toFixed(8)}) is less than network fee (${networkFeeBN.toFixed(8)})`);
      // Desbloquear saldo
      await this.unlockAndRefund(withdrawal);
      return;
    }

    // 4. Calcular valor a enviar
    // Para tokens: enviar o valor total (fee é paga em moeda nativa)
    // Para moeda nativa (BTC, ETH, SOL): descontar fee do valor
    const amountToSend = isToken
      ? withdrawal.amount
      : amountBN.minus(networkFeeBN).toFixed(8);

    // 5. Marcar como PROCESSING
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
        networkFee: feeEstimate.estimatedFee,
      },
    });

    // 6. Buscar hot wallet (PlatformWallet) — saques saem do hot wallet (Omnibus)
    const hotWallet = await prisma.platformWallet.findUnique({
      where: {
        cryptoType_network: {
          cryptoType: wallet.cryptoType,
          network: wallet.network,
        },
      },
    });

    if (!hotWallet) {
      logger.error(`[WITHDRAWAL] Hot wallet not found: ${wallet.cryptoType}/${wallet.network}`);
      await this.markFailed(withdrawalId, `Hot wallet not found: ${wallet.cryptoType}/${wallet.network}`);
      return;
    }

    // 7. Verificar solvência do hot wallet
    const hotBalanceBN = new BigNumber(hotWallet.balance);
    const withdrawAmountBN = new BigNumber(withdrawal.amount);
    const totalNeededBN = isToken ? withdrawAmountBN : withdrawAmountBN.plus(networkFeeBN);

    if (hotBalanceBN.lt(totalNeededBN)) {
      logger.error(
        `[WITHDRAWAL] Insufficient hot wallet balance: ${hotBalanceBN.toFixed(8)} < ${totalNeededBN.toFixed(8)} (${wallet.cryptoType}/${wallet.network})`
      );
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'REQUIRES_APPROVAL',
          lastError: `Insufficient hot wallet balance: ${hotBalanceBN.toFixed(8)} < ${totalNeededBN.toFixed(8)}`,
        },
      });
      return;
    }

    // 8. Descriptografar private key do HOT WALLET
    let privateKey: string;
    try {
      privateKey = KeyManagementService.decryptPrivateKey(
        hotWallet.encryptedPrivateKey,
        KeyManagementService.PLATFORM_ID
      );
    } catch (error: any) {
      logger.error(`[WITHDRAWAL] Failed to decrypt hot wallet key for ${wallet.cryptoType}/${wallet.network}:`, error.message);
      await this.markFailed(withdrawalId, 'Failed to decrypt hot wallet private key');
      return;
    }

    const fromAddress = hotWallet.address;

    // 9. Enviar transação on-chain DO HOT WALLET
    try {
      let result;

      switch (wallet.network) {
        case 'BITCOIN':
          result = await TransactionSenderService.sendBitcoinTransaction(
            privateKey,
            fromAddress,          // hot wallet address
            withdrawal.toAddress,
            parseFloat(amountToSend),
            feeEstimate.feeRate || 10
          );
          break;

        case 'ETHEREUM':
        case 'BASE':
        case 'ARBITRUM':
          result = await TransactionSenderService.sendEVMTransaction(
            privateKey,
            withdrawal.toAddress,
            amountToSend,
            wallet.network,
            wallet.cryptoType,
            feeEstimate.feeRate
          );
          break;

        case 'SOLANA':
          result = await TransactionSenderService.sendSolanaTransaction(
            privateKey,
            withdrawal.toAddress,
            amountToSend,
            wallet.cryptoType
          );
          break;

        default:
          throw new Error(`Unsupported network: ${wallet.network}`);
      }

      // 10-13. Transaction atômica: withdrawal COMPLETED + deduzir usuário + hot wallet + WalletTransactions
      const deductBN = new BigNumber(withdrawal.amount);
      const lockedBN = new BigNumber(wallet.lockedBalance);
      if (lockedBN.lt(deductBN)) {
        throw new Error('Insufficient locked balance');
      }

      const newLockedBalance = lockedBN.minus(deductBN).toFixed(8);
      const newBalance = new BigNumber(wallet.balance).minus(deductBN).toFixed(8);
      const newAvailableBalance = new BigNumber(newBalance).minus(newLockedBalance).toFixed(8);
      const newTotalUsed = new BigNumber(wallet.totalUsed).plus(deductBN).toFixed(8);
      const newTotalWithdrawn = new BigNumber(wallet.totalWithdrawn).plus(deductBN).toFixed(8);

      await prisma.$transaction(async (tx) => {
        // 0. Marcar withdrawal como COMPLETED (dentro da tx!)
        await tx.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            txHash: result.txHash,
            networkFee: result.networkFee,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        // 1. Deduzir do usuário (inlinado de deductBalance)
        await tx.userWallet.update({
          where: { id: wallet.id },
          data: {
            balance: newBalance,
            availableBalance: newAvailableBalance,
            lockedBalance: newLockedBalance,
            totalUsed: newTotalUsed,
            totalWithdrawn: newTotalWithdrawn,
          },
        });

        // 2. WalletTransaction DEDUCT (usuário)
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: wallet.userId,
            type: 'DEDUCT',
            amount: withdrawal.amount,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            description: `Withdrawal to ${withdrawal.toAddress}`,
            metadata: JSON.stringify({
              fromLocked: true,
              timestamp: new Date().toISOString(),
            }),
          },
        });

        // 3. Decrementar hot wallet
        const hotWalletNewBalance = hotBalanceBN.minus(withdrawAmountBN).toFixed(8);
        await tx.platformWallet.update({
          where: { id: hotWallet.id },
          data: {
            balance: hotWalletNewBalance,
            totalWithdrawn: new BigNumber(hotWallet.totalWithdrawn).plus(withdrawAmountBN).toFixed(8),
          },
        });

        // 3.1 Registrar movimentação no ledger da platform wallet
        await PlatformWalletService.recordMovement(tx, {
          platformWalletId: hotWallet.id,
          type: 'WITHDRAWAL_OUT',
          direction: 'OUT',
          amount: withdrawal.amount,
          balanceBefore: hotWallet.balance,
          balanceAfter: hotWalletNewBalance,
          description: `Saque processado para ${withdrawal.toAddress}`,
          txHash: result.txHash,
          toAddress: withdrawal.toAddress,
          userId: wallet.userId,
          metadata: {
            withdrawalId,
            networkFee: result.networkFee,
            cryptoType: wallet.cryptoType,
            network: wallet.network,
          },
        });

        // 4. WalletTransaction WITHDRAWAL (registro)
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: wallet.userId,
            type: 'WITHDRAWAL',
            amount: withdrawal.amount,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            txHash: result.txHash,
            description: `Saque para ${withdrawal.toAddress} (via hot wallet)`,
            metadata: JSON.stringify({
              toAddress: withdrawal.toAddress,
              fromAddress,
              networkFee: result.networkFee,
              amountSent: amountToSend,
              withdrawalId,
              hotWalletId: hotWallet.id,
            }),
          },
        });
      });

      // 14. Notificar usuário
      try {
        await notificationService.notifyWithdrawalProcessed(
          wallet.userId,
          withdrawal.amount,
          wallet.cryptoType,
          result.txHash
        );
      } catch (notifError) {
        logger.warn(`[WITHDRAWAL] Notification failed for ${withdrawalId}:`, notifError);
      }

      // 15. Email transacional (fire-and-forget)
      try {
        await emailService.sendIfAllowed(wallet.userId, 'WITHDRAWALS', () =>
          emailService.sendWithdrawalCompletedEmail(wallet.user.email, {
            name: wallet.user.name || 'Usuário',
            amount: withdrawal.amount,
            crypto: wallet.cryptoType,
            network: wallet.network,
            toAddress: withdrawal.toAddress,
            txHash: result.txHash,
            networkFee: result.networkFee || '0',
          })
        );
      } catch (emailError) {
        logger.warn(`[WITHDRAWAL] Email failed for ${withdrawalId}:`, emailError);
      }

      logger.info(
        `[WITHDRAWAL] Completed: ${withdrawalId}, txHash: ${result.txHash}, amount: ${amountToSend} ${wallet.cryptoType} (from hot wallet ${fromAddress})`
      );
    } catch (error: any) {
      logger.error(`[WITHDRAWAL] Transaction send failed for ${withdrawalId}:`, error.message);
      await this.markFailed(withdrawalId, error.message);
    }
  }

  /**
   * Verifica status de saques em PROCESSING (confirmação on-chain)
   */
  static async checkProcessingWithdrawals(): Promise<void> {
    const processing = await prisma.withdrawal.findMany({
      where: { status: 'PROCESSING' },
      include: { wallet: true },
    });

    for (const withdrawal of processing) {
      if (!withdrawal.txHash) continue;

      try {
        const status = await BlockchainService.getTransactionStatus(
          withdrawal.txHash,
          withdrawal.wallet.network
        );

        if (status.confirmed) {
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });
          logger.info(`[WITHDRAWAL] Confirmed on-chain: ${withdrawal.id}`);
        }
      } catch (error: any) {
        logger.warn(`[WITHDRAWAL] Failed to check tx status for ${withdrawal.id}:`, error.message);
      }
    }
  }

  /**
   * Aprova um saque que requer revisão
   */
  static async approveWithdrawal(
    withdrawalId: string,
    adminId: string,
    note?: string
  ): Promise<void> {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new Error(`Withdrawal ${withdrawalId} not found`);
    }

    if (withdrawal.status !== 'REQUIRES_APPROVAL') {
      throw new Error(`Withdrawal ${withdrawalId} is not pending approval (status: ${withdrawal.status})`);
    }

    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'PENDING', // Volta para PENDING para o worker processar
        reviewedBy: adminId,
        reviewNote: note || 'Approved by admin',
        reviewedAt: new Date(),
      },
    });

    // Notificação in-app + Email (fire-and-forget)
    try {
      const withdrawalWithUser = await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        include: { wallet: { include: { user: { select: { id: true, email: true, name: true } } } } },
      });
      if (withdrawalWithUser) {
        const { user } = withdrawalWithUser.wallet;
        await notificationService.createNotification({
          userId: user.id,
          type: 'WITHDRAWAL_APPROVED',
          category: 'WALLET',
          prefCategory: 'WITHDRAWALS',
          title: 'Saque Aprovado',
          message: `Seu saque de ${withdrawal.amount} ${withdrawalWithUser.wallet.cryptoType} foi aprovado e será processado em breve.`,
          actionUrl: '/wallets',
          actionLabel: 'Ver Carteira',
          relatedId: withdrawalId,
          relatedType: 'WITHDRAWAL',
          priority: 'NORMAL',
        });
        await emailService.sendIfAllowed(user.id, 'WITHDRAWALS', () =>
          emailService.sendWithdrawalApprovedEmail(user.email, {
            name: user.name || 'Usuário',
            amount: withdrawal.amount,
            crypto: withdrawalWithUser.wallet.cryptoType,
            network: withdrawalWithUser.wallet.network,
          })
        );
      }
    } catch (error) {
      logger.warn(`[WITHDRAWAL] Notification/email failed for approval ${withdrawalId}:`, error);
    }

    logger.info(`[WITHDRAWAL] Approved by admin ${adminId}: ${withdrawalId}`);
  }

  /**
   * Rejeita um saque — desbloqueia saldo do usuário
   */
  static async rejectWithdrawal(
    withdrawalId: string,
    adminId: string,
    note: string
  ): Promise<void> {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { wallet: true },
    });

    if (!withdrawal) {
      throw new Error(`Withdrawal ${withdrawalId} not found`);
    }

    if (withdrawal.status !== 'REQUIRES_APPROVAL') {
      throw new Error(`Withdrawal ${withdrawalId} is not pending approval (status: ${withdrawal.status})`);
    }

    // Atualizar status
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewNote: note,
        reviewedAt: new Date(),
      },
    });

    // Desbloquear saldo
    await WalletService.unlockBalance(
      withdrawal.walletId,
      withdrawal.amount,
      withdrawalId,
      `Withdrawal rejected by admin: ${note}`
    );

    // Notificar usuário
    try {
      await notificationService.createNotification({
        userId: withdrawal.wallet.userId,
        type: 'WITHDRAWAL_REJECTED',
        category: 'WALLET',
        prefCategory: 'WITHDRAWALS',
        title: 'Saque Rejeitado',
        message: `Seu saque de ${withdrawal.amount} ${withdrawal.wallet.cryptoType} foi rejeitado. Motivo: ${note}. O saldo foi desbloqueado.`,
        actionUrl: '/wallets',
        actionLabel: 'Ver Carteira',
        relatedId: withdrawalId,
        relatedType: 'WITHDRAWAL',
        priority: 'HIGH',
      });
    } catch (notifError) {
      logger.warn(`[WITHDRAWAL] Notification failed for rejection ${withdrawalId}:`, notifError);
    }

    // Email transacional (fire-and-forget)
    try {
      const userForEmail = await prisma.user.findUnique({
        where: { id: withdrawal.wallet.userId },
        select: { email: true, name: true },
      });
      if (userForEmail?.email) {
        await emailService.sendIfAllowed(withdrawal.wallet.userId, 'WITHDRAWALS', () =>
          emailService.sendWithdrawalRejectedEmail(userForEmail.email, {
            name: userForEmail.name || 'Usuário',
            amount: withdrawal.amount,
            crypto: withdrawal.wallet.cryptoType,
            reason: note,
          })
        );
      }
    } catch (emailError) {
      logger.warn(`[WITHDRAWAL] Email failed for rejection ${withdrawalId}:`, emailError);
    }

    logger.info(`[WITHDRAWAL] Rejected by admin ${adminId}: ${withdrawalId}`);
  }

  /**
   * Marca um saque como falho
   */
  private static async markFailed(withdrawalId: string, error: string): Promise<void> {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) return;

    const newRetryCount = withdrawal.retryCount + 1;

    if (newRetryCount >= MAX_RETRIES) {
      // Falhou definitivamente — desbloquear saldo
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'FAILED',
          lastError: error,
          retryCount: newRetryCount,
        },
      });
      await this.unlockAndRefund(withdrawal);
      logger.error(`[WITHDRAWAL] PERMANENTLY FAILED after ${MAX_RETRIES} retries: ${withdrawalId}`);
    } else {
      // Pode tentar novamente — volta para PENDING
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'PENDING',
          lastError: error,
          retryCount: newRetryCount,
        },
      });
      logger.warn(`[WITHDRAWAL] Retry ${newRetryCount}/${MAX_RETRIES} for ${withdrawalId}: ${error}`);
    }
  }

  /**
   * Desbloqueia saldo após falha/rejeição
   */
  private static async unlockAndRefund(withdrawal: any): Promise<void> {
    try {
      await WalletService.unlockBalance(
        withdrawal.walletId,
        withdrawal.amount,
        withdrawal.id,
        `Withdrawal failed/rejected — balance unlocked`
      );
    } catch (unlockError: any) {
      logger.error(`[WITHDRAWAL] Failed to unlock balance for ${withdrawal.id}:`, unlockError.message);
    }
  }
}
