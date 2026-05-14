import { PrismaClient } from '@prisma/client';
import { WalletService } from './wallet.service';
import { FeeEstimatorService } from './blockchain/fee-estimator.service';
import { TransactionSenderService } from './blockchain/transaction-sender.service';
import { platformWalletService, PlatformWalletService } from './platformWallet.service';
import { twoFactorService } from './twoFactor.service';
import { auditLogService } from './auditLog.service';
import { toBN, ltBN, gtBN, subBN } from '../utils/money';

const prisma = new PrismaClient();

export interface TransferEstimate {
  amount: string;
  networkFee: string;
  amountToReceive: string;
  isToken: boolean;
  feeNote: string;
  isValid: boolean;
  isValidAddress: boolean;
  isAboveMinimum: boolean;
  minimumAmount: string;
  estimatedTime: string;
}

export interface RequestTransferParams {
  platformWalletId: string;
  toAddress: string;
  amount: string;
  adminId: string;
  twoFactorCode: string;
  note?: string;
}

/**
 * Platform Transfer Service
 *
 * Orquestra transferências de platform wallets (hot) para endereços externos (cold wallets, etc).
 * - Valida 2FA, endereço, saldo
 * - Estima fees
 * - Assina e envia tx on-chain via TransactionSenderService
 * - Atualiza saldo via PlatformWalletService.recordWithdrawal()
 * - Registra audit log
 */
export class PlatformTransferService {
  /**
   * Solicita uma transferência de platform wallet
   * Valida 2FA, endereço, saldo e cria registro PENDING, então processa imediatamente
   */
  async requestTransfer(params: RequestTransferParams) {
    const { platformWalletId, toAddress, amount, adminId, twoFactorCode, note } = params;

    // 1. Validar 2FA do admin
    const is2FAValid = await twoFactorService.verifyToken(adminId, twoFactorCode);
    if (!is2FAValid) {
      throw new Error('Código 2FA inválido. Verifique e tente novamente.');
    }

    // 2. Buscar platform wallet
    const wallet = await prisma.platformWallet.findUnique({
      where: { id: platformWalletId },
    });

    if (!wallet) {
      throw new Error('Carteira da plataforma não encontrada');
    }

    if (!wallet.isActive) {
      throw new Error('Carteira da plataforma está inativa');
    }

    // 3. Validar endereço por rede
    const isValidAddress = WalletService.validateAddress(toAddress, wallet.network);
    if (!isValidAddress) {
      throw new Error(`Endereço inválido para a rede ${wallet.network}. Verifique o formato.`);
    }

    // 4. Validar valor mínimo
    const minimumAmount = FeeEstimatorService.getMinimumWithdrawal(wallet.network, wallet.cryptoType);
    if (!gtBN(amount, '0')) {
      throw new Error('Valor da transferência deve ser maior que zero');
    }
    if (ltBN(amount, minimumAmount)) {
      throw new Error(
        `Valor mínimo para ${wallet.cryptoType}/${wallet.network}: ${minimumAmount}`
      );
    }

    // 5. Validar saldo suficiente
    if (gtBN(amount, wallet.availableBalance)) {
      throw new Error(
        `Saldo insuficiente. Disponível: ${wallet.availableBalance}, Solicitado: ${amount}`
      );
    }

    // 6. Criar registro de transferência
    const transfer = await prisma.platformTransfer.create({
      data: {
        platformWalletId,
        toAddress,
        amount,
        status: 'PENDING',
        requestedBy: adminId,
        note: note || null,
      },
    });

    // 7. Processar transferência imediatamente
    try {
      const result = await this.processTransfer(transfer.id);
      return result;
    } catch (error: any) {
      // Se falhar, atualizar status para FAILED
      await prisma.platformTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'FAILED',
          lastError: error.message,
        },
      });
      throw error;
    }
  }

  /**
   * Processa uma transferência: assina e envia tx on-chain
   */
  async processTransfer(transferId: string) {
    // 1. Buscar transfer + wallet
    const transfer = await prisma.platformTransfer.findUnique({
      where: { id: transferId },
      include: { platformWallet: true },
    });

    if (!transfer) {
      throw new Error('Transferência não encontrada');
    }

    if (transfer.status !== 'PENDING') {
      throw new Error(`Transferência não está pendente (status: ${transfer.status})`);
    }

    const wallet = transfer.platformWallet;

    // 2. Marcar como PROCESSING
    await prisma.platformTransfer.update({
      where: { id: transferId },
      data: { status: 'PROCESSING' },
    });

    try {
      // 3. Descriptografar private key
      const privateKey = await platformWalletService.getDecryptedPrivateKey(
        wallet.cryptoType,
        wallet.network
      );

      // 4. Enviar transação via TransactionSenderService
      let txResult: { txHash: string; networkFee: string };

      switch (wallet.network) {
        case 'BITCOIN':
          const feeEstimate = await FeeEstimatorService.estimateBitcoinFee();
          txResult = await TransactionSenderService.sendBitcoinTransaction(
            privateKey,
            wallet.address,
            transfer.toAddress,
            toBN(transfer.amount).toNumber(),
            feeEstimate.feeRate || 10
          );
          break;

        case 'ETHEREUM':
        case 'BASE':
        case 'ARBITRUM':
          txResult = await TransactionSenderService.sendEVMTransaction(
            privateKey,
            transfer.toAddress,
            transfer.amount,
            wallet.network,
            wallet.cryptoType
          );
          break;

        case 'SOLANA':
          txResult = await TransactionSenderService.sendSolanaTransaction(
            privateKey,
            transfer.toAddress,
            transfer.amount,
            wallet.cryptoType
          );
          break;

        default:
          throw new Error(`Rede não suportada: ${wallet.network}`);
      }

      // 5. Atualizar transfer como COMPLETED
      const completedTransfer = await prisma.platformTransfer.update({
        where: { id: transferId },
        data: {
          status: 'COMPLETED',
          txHash: txResult.txHash,
          networkFee: txResult.networkFee,
          completedAt: new Date(),
        },
        include: { platformWallet: true },
      });

      // 6. Atualizar saldo da platform wallet
      const walletBefore = await platformWalletService.getPlatformWallet(wallet.cryptoType, wallet.network);
      await platformWalletService.recordWithdrawal(
        wallet.cryptoType,
        wallet.network,
        transfer.amount
      );
      const walletAfter = await platformWalletService.getPlatformWallet(wallet.cryptoType, wallet.network);

      // 6.1 Registrar movimentação no ledger
      if (walletBefore && walletAfter) {
        await PlatformWalletService.recordMovement(prisma, {
          platformWalletId: wallet.id,
          type: 'TRANSFER_OUT',
          direction: 'OUT',
          amount: transfer.amount,
          balanceBefore: walletBefore.balance,
          balanceAfter: walletAfter.balance,
          description: `Transferência para ${transfer.toAddress}`,
          txHash: txResult.txHash,
          toAddress: transfer.toAddress,
          metadata: {
            transferId,
            requestedBy: transfer.requestedBy,
            networkFee: txResult.networkFee,
            note: transfer.note,
          },
        });
      }

      // 7. Audit log
      auditLogService.log({
        userId: transfer.requestedBy,
        action: 'PLATFORM_TRANSFER_COMPLETED',
        resource: 'PLATFORM_TRANSFER',
        resourceId: transferId,
        metadata: {
          walletId: wallet.id,
          cryptoType: wallet.cryptoType,
          network: wallet.network,
          amount: transfer.amount,
          toAddress: transfer.toAddress,
          txHash: txResult.txHash,
          networkFee: txResult.networkFee,
        },
        success: true,
      });

      return completedTransfer;
    } catch (error: any) {
      // Falha — marcar como FAILED
      const failedTransfer = await prisma.platformTransfer.update({
        where: { id: transferId },
        data: {
          status: 'FAILED',
          lastError: error.message,
          retryCount: { increment: 1 },
        },
        include: { platformWallet: true },
      });

      // Audit log de falha
      auditLogService.log({
        userId: transfer.requestedBy,
        action: 'PLATFORM_TRANSFER_FAILED',
        resource: 'PLATFORM_TRANSFER',
        resourceId: transferId,
        metadata: {
          walletId: wallet.id,
          cryptoType: wallet.cryptoType,
          network: wallet.network,
          amount: transfer.amount,
          toAddress: transfer.toAddress,
          error: error.message,
        },
        success: false,
        errorMessage: error.message,
      });

      throw error;
    }
  }

  /**
   * Retorna estimativa de fee para uma transferência
   */
  async getTransferEstimate(
    platformWalletId: string,
    amount: string,
    toAddress: string
  ): Promise<TransferEstimate> {
    const wallet = await prisma.platformWallet.findUnique({
      where: { id: platformWalletId },
    });

    if (!wallet) {
      throw new Error('Carteira da plataforma não encontrada');
    }

    // Validar endereço
    const isValidAddress = WalletService.validateAddress(toAddress, wallet.network);

    // Estimar fee
    const feeEstimate = await FeeEstimatorService.estimateFee(wallet.network, wallet.cryptoType);
    // Para tokens (USDT/USDC), a fee é paga em moeda nativa (ETH/SOL)
    const isToken = ['USDT', 'USDC'].includes(wallet.cryptoType);
    const amountToReceive = isToken
      ? amount
      : toBN(amount).minus(toBN(feeEstimate.estimatedFee)).isNegative()
        ? '0'
        : subBN(amount, feeEstimate.estimatedFee);

    // Valor mínimo
    const minimumAmount = FeeEstimatorService.getMinimumWithdrawal(wallet.network, wallet.cryptoType);
    const isAboveMinimum = !ltBN(amount, minimumAmount);

    return {
      amount,
      networkFee: feeEstimate.estimatedFee,
      amountToReceive,
      isToken,
      feeNote: isToken
        ? `A taxa de rede é paga em ${wallet.network === 'SOLANA' ? 'SOL' : 'ETH'} (separada do valor)`
        : 'A taxa de rede será descontada do valor enviado',
      isValid: isValidAddress && isAboveMinimum && !gtBN(amount, wallet.availableBalance),
      isValidAddress,
      isAboveMinimum,
      minimumAmount,
      estimatedTime: feeEstimate.estimatedTime,
    };
  }

  /**
   * Lista transferências de uma platform wallet
   */
  async getTransfers(platformWalletId: string) {
    return prisma.platformTransfer.findMany({
      where: { platformWalletId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export const platformTransferService = new PlatformTransferService();
