import { PrismaClient } from '@prisma/client';
import { KeyManagementService } from './hd-wallet/key-management.service';
import { TransactionSenderService } from './blockchain/transaction-sender.service';
import { FeeEstimatorService } from './blockchain/fee-estimator.service';
import { BlockchainService } from './blockchain/blockchain.service';
import { WalletService } from './wallet.service';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';

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
    const amount = parseFloat(withdrawal.amount);
    const networkFee = parseFloat(feeEstimate.estimatedFee);

    // Para tokens ERC-20/SPL, a fee é paga em moeda nativa (ETH/SOL), não no token
    // Então o amount do saque não precisa cobrir a fee do gas
    const isToken = ['USDT', 'USDC'].includes(wallet.cryptoType);

    if (!isToken && amount <= networkFee) {
      logger.error(`[WITHDRAWAL] Amount ${amount} is less than network fee ${networkFee}`);
      await this.markFailed(withdrawalId, `Withdrawal amount (${amount}) is less than network fee (${networkFee})`);
      // Desbloquear saldo
      await this.unlockAndRefund(withdrawal);
      return;
    }

    // 4. Calcular valor a enviar
    // Para tokens: enviar o valor total (fee é paga em moeda nativa)
    // Para moeda nativa (BTC, ETH, SOL): descontar fee do valor
    const amountToSend = isToken
      ? withdrawal.amount
      : (amount - networkFee).toFixed(8);

    // 5. Marcar como PROCESSING
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
        networkFee: feeEstimate.estimatedFee,
      },
    });

    // 6. Descriptografar private key
    let privateKey: string;
    try {
      privateKey = KeyManagementService.decryptPrivateKey(
        wallet.encryptedPrivateKey,
        wallet.userId
      );
    } catch (error: any) {
      logger.error(`[WITHDRAWAL] Failed to decrypt key for wallet ${wallet.id}:`, error.message);
      await this.markFailed(withdrawalId, 'Failed to decrypt private key');
      return;
    }

    // 7. Enviar transação on-chain
    try {
      let result;

      switch (wallet.network) {
        case 'BITCOIN':
          result = await TransactionSenderService.sendBitcoinTransaction(
            privateKey,
            wallet.address,
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

      // 8. Atualizar Withdrawal com txHash
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          txHash: result.txHash,
          networkFee: result.networkFee,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // 9. Deduzir do saldo total (o lockBalance já reservou o valor)
      await WalletService.deductBalance(
        wallet.id,
        withdrawal.amount,
        `Withdrawal to ${withdrawal.toAddress}`,
        true // from locked balance
      );

      // Atualizar totalWithdrawn
      await prisma.userWallet.update({
        where: { id: wallet.id },
        data: {
          totalWithdrawn: (
            parseFloat(wallet.totalWithdrawn) + parseFloat(withdrawal.amount)
          ).toString(),
        },
      });

      // 10. Registrar transação de saque
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: wallet.userId,
          type: 'WITHDRAWAL',
          amount: withdrawal.amount,
          balanceBefore: wallet.balance,
          balanceAfter: (parseFloat(wallet.balance) - parseFloat(withdrawal.amount)).toString(),
          txHash: result.txHash,
          description: `Saque para ${withdrawal.toAddress}`,
          metadata: JSON.stringify({
            toAddress: withdrawal.toAddress,
            networkFee: result.networkFee,
            amountSent: amountToSend,
            withdrawalId,
          }),
        },
      });

      // 11. Notificar usuário
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

      logger.info(
        `[WITHDRAWAL] Completed: ${withdrawalId}, txHash: ${result.txHash}, amount: ${amountToSend} ${wallet.cryptoType}`
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
