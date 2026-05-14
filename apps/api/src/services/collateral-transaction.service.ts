/**
 * Collateral Transaction Service (ADAPTER)
 *
 * MIGRADO: Este service agora é um ADAPTER que traduz chamadas antigas
 * para o novo WalletService (HD Wallet System).
 *
 * Mantém compatibilidade com código legado.
 */

import { WalletService } from './wallet.service';
import { prisma } from '../utils/prisma';

export type CollateralTransactionType =
  | 'DEPOSIT'
  | 'LOCK'
  | 'UNLOCK'
  | 'DEDUCT'
  | 'REFUND';

export class CollateralTransactionService {
  /**
   * Registrar transação de colateral (adapter - usa WalletTransaction)
   */
  async recordTransaction(data: {
    userId: string;
    cryptoType: string;
    network: string;
    type: CollateralTransactionType;
    amount: string;
    orderId?: string;
    description?: string;
    metadata?: any;
  }) {
    // Buscar carteira
    const wallet = await WalletService.getWalletByUserAndCrypto(
      data.userId,
      data.cryptoType,
      data.network
    );

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Registrar no novo sistema
    const transaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // Será atualizado pelo WalletService
        description: data.description || `${data.type} transaction`,
        metadata: JSON.stringify({
          ...data.metadata,
          orderId: data.orderId,
          legacySource: 'collateral-transaction-service',
        }),
      },
    });

    return transaction;
  }

  /**
   * Obter histórico de transações (adapter)
   */
  async getTransactionHistory(
    userId: string,
    filters?: {
      cryptoType?: string;
      network?: string;
      type?: CollateralTransactionType;
      limit?: number;
      offset?: number;
    }
  ) {
    // Buscar carteiras do usuário
    let wallets = await WalletService.getUserWallets(userId);

    // Filtrar por crypto/network se especificado
    if (filters?.cryptoType && filters?.network) {
      const wallet = await WalletService.getWalletByUserAndCrypto(
        userId,
        filters.cryptoType,
        filters.network
      );
      wallets = wallet ? [wallet] : [];
    }

    if (wallets.length === 0) {
      return [];
    }

    const walletIds = wallets.map(w => w.id);

    // Buscar transações
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: { in: walletIds },
        userId,
        ...(filters?.type && { type: filters.type }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
      include: {
        wallet: {
          select: {
            cryptoType: true,
            network: true,
            address: true,
          },
        },
      },
    });

    return transactions;
  }

  /**
   * Obter estatísticas de colateral do usuário (adapter)
   */
  async getUserCollateralStats(userId: string, cryptoType?: string, network?: string) {
    // Buscar carteiras
    let wallets;
    if (cryptoType && network) {
      const wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);
      wallets = wallet ? [wallet] : [];
    } else {
      wallets = await WalletService.getUserWallets(userId);
    }

    // Calcular estatísticas
    const stats = {
      totalBalance: wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0).toFixed(8),
      totalAvailable: wallets.reduce((sum, w) => sum + parseFloat(w.availableBalance), 0).toFixed(8),
      totalLocked: wallets.reduce((sum, w) => sum + parseFloat(w.lockedBalance), 0).toFixed(8),
      totalDeposited: wallets.reduce((sum, w) => sum + parseFloat(w.totalDeposited), 0).toFixed(8),
      totalWithdrawn: wallets.reduce((sum, w) => sum + parseFloat(w.totalWithdrawn), 0).toFixed(8),
      walletsCount: wallets.length,
    };

    return stats;
  }
}

export const collateralTransactionService = new CollateralTransactionService();
