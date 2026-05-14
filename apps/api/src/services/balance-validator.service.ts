/**
 * Balance Validator Service (ADAPTER)
 *
 * MIGRADO: Agora usa WalletService em vez de InternalBalance deprecado
 */

import BigNumber from 'bignumber.js';
import { WalletService } from './wallet.service';
import { internalBalanceService } from './internal-balance.service';
import { toBN } from '../utils/money';

export class BalanceValidatorService {
  /**
   * Validar se usuário tem saldo suficiente
   */
  async validateSufficientBalance(
    userId: string,
    cryptoType: string,
    network: string,
    requiredAmount: string
  ): Promise<{ valid: boolean; message?: string }> {
    const available = await internalBalanceService.getAvailableBalance(
      userId,
      cryptoType,
      network
    );

    const required = toBN(requiredAmount).toNumber();

    if (available < required) {
      return {
        valid: false,
        message: `Saldo insuficiente. Disponível: ${available.toFixed(8)} ${cryptoType}, Necessário: ${required.toFixed(8)} ${cryptoType}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validar integridade dos saldos
   */
  async validateBalanceIntegrity(userId: string): Promise<{
    valid: boolean;
    issues?: Array<{
      walletId: string;
      cryptoType: string;
      network: string;
      issue: string;
    }>;
  }> {
    const wallets = await WalletService.getUserWallets(userId);
    const issues: Array<any> = [];

    for (const wallet of wallets) {
      const balanceBN = new BigNumber(wallet.balance);
      const availableBN = new BigNumber(wallet.availableBalance);
      const lockedBN = new BigNumber(wallet.lockedBalance);

      // Validar: balance = available + locked
      const expectedBN = availableBN.plus(lockedBN);
      if (!balanceBN.minus(expectedBN).abs().lt('0.00000001')) {
        issues.push({
          walletId: wallet.id,
          cryptoType: wallet.cryptoType,
          network: wallet.network,
          issue: `Balance mismatch: total=${balanceBN.toFixed(8)}, available=${availableBN.toFixed(8)}, locked=${lockedBN.toFixed(8)}`,
        });
      }

      // Validar valores não negativos
      if (balanceBN.isNegative() || availableBN.isNegative() || lockedBN.isNegative()) {
        issues.push({
          walletId: wallet.id,
          cryptoType: wallet.cryptoType,
          network: wallet.network,
          issue: `Negative balance detected`,
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Recalcular saldos disponíveis
   */
  async recalculateAvailableBalances(userId: string): Promise<{
    success: boolean;
    walletsUpdated: number;
  }> {
    const wallets = await WalletService.getUserWallets(userId);
    let updated = 0;

    for (const wallet of wallets) {
      const balanceBN = new BigNumber(wallet.balance);
      const lockedBN = new BigNumber(wallet.lockedBalance);
      const expectedAvailableBN = balanceBN.minus(lockedBN);

      // Se available está incorreto, corrigir
      if (!new BigNumber(wallet.availableBalance).minus(expectedAvailableBN).abs().lt('0.00000001')) {
        await WalletService.updateBalance(wallet.id, {
          availableBalance: expectedAvailableBN.toFixed(8),
        });
        updated++;
      }
    }

    return {
      success: true,
      walletsUpdated: updated,
    };
  }

  /**
   * Obter resumo de saldos do usuário
   */
  async getUserBalanceSummary(userId: string) {
    const wallets = await WalletService.getUserWallets(userId);

    const summary = wallets.map(w => ({
      walletId: w.id,
      cryptoType: w.cryptoType,
      network: w.network,
      address: w.address,
      balance: w.balance,
      availableBalance: w.availableBalance,
      lockedBalance: w.lockedBalance,
      totalDeposited: w.totalDeposited,
      totalWithdrawn: w.totalWithdrawn,
    }));

    const totals = {
      totalBalance: wallets.reduce((sum, w) => sum.plus(w.balance), new BigNumber(0)).toFixed(8),
      totalAvailable: wallets.reduce((sum, w) => sum.plus(w.availableBalance), new BigNumber(0)).toFixed(8),
      totalLocked: wallets.reduce((sum, w) => sum.plus(w.lockedBalance), new BigNumber(0)).toFixed(8),
    };

    return {
      wallets: summary,
      totals,
    };
  }

  /**
   * Validar saldo de um usuário específico (adapter)
   */
  async validateUserBalance(userId: string) {
    return await this.validateBalanceIntegrity(userId);
  }

  /**
   * Validar saldos de todos os usuários (adapter)
   */
  async validateAllUserBalances() {
    const { prisma } = await import('../utils/prisma');
    const users = await prisma.user.findMany({ select: { id: true } });

    const results = await Promise.all(
      users.map(async (user) => ({
        userId: user.id,
        validation: await this.validateBalanceIntegrity(user.id),
      }))
    );

    const invalid = results.filter(r => !r.validation.valid);

    return {
      total: results.length,
      valid: results.length - invalid.length,
      invalid: invalid.length,
      issues: invalid,
    };
  }

  /**
   * Recalcular valores bloqueados (adapter)
   */
  async recalculateLockedAmount(userId: string) {
    const { prisma } = await import('../utils/prisma');
    const wallets = await WalletService.getUserWallets(userId);
    let updated = 0;

    for (const wallet of wallets) {
      // Recalcular locked amount baseado em ordens ativas
      const activeOrders = await prisma.order.findMany({
        where: {
          userId,
          cryptoType: wallet.cryptoType,
          cryptoNetwork: wallet.network,
          status: {
            in: ['PENDING_PAYMENT', 'PAYMENT_RECEIVED', 'IN_DISPUTE'],
          },
        },
      });

      const orderLockedBN = activeOrders.reduce(
        (sum, order) => sum.plus(order.cryptoAmount),
        new BigNumber(0)
      );

      // Incluir bloqueios manuais de admin para não sobrescrever ADMIN_LOCK
      const { prisma: db } = await import('../utils/prisma');
      const adminLockTxs = await db.walletTransaction.findMany({
        where: { walletId: wallet.id, type: { in: ['ADMIN_LOCK', 'ADMIN_UNLOCK'] } },
        select: { type: true, amount: true },
      });
      const netAdminLockedBN = BigNumber.max(
        0,
        adminLockTxs.reduce((sum, tx) => {
          return tx.type === 'ADMIN_LOCK' ? sum.plus(tx.amount) : sum.minus(tx.amount);
        }, new BigNumber(0))
      );
      const totalLockedBN = orderLockedBN.plus(netAdminLockedBN);

      // Atualizar se diferente
      if (!new BigNumber(wallet.lockedBalance).minus(totalLockedBN).abs().lt('0.00000001')) {
        const newAvailableBN = new BigNumber(wallet.balance).minus(totalLockedBN);
        await WalletService.updateBalance(wallet.id, {
          lockedBalance: totalLockedBN.toFixed(8),
          availableBalance: newAvailableBN.toFixed(8),
        });
        updated++;
      }
    }

    return {
      success: true,
      walletsUpdated: updated,
    };
  }

  /**
   * Validar todos os saldos do sistema (adapter)
   */
  async validateAllBalances() {
    return await this.validateAllUserBalances();
  }
}

export const balanceValidatorService = new BalanceValidatorService();
