/**
 * Balance Validator Service (ADAPTER)
 *
 * MIGRADO: Agora usa WalletService em vez de InternalBalance deprecado
 */

import { WalletService } from './wallet.service';
import { internalBalanceService } from './internal-balance.service';

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

    const required = parseFloat(requiredAmount);

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
      const balance = parseFloat(wallet.balance);
      const available = parseFloat(wallet.availableBalance);
      const locked = parseFloat(wallet.lockedBalance);

      // Validar: balance = available + locked
      const expected = available + locked;
      if (Math.abs(balance - expected) > 0.00000001) {
        issues.push({
          walletId: wallet.id,
          cryptoType: wallet.cryptoType,
          network: wallet.network,
          issue: `Balance mismatch: total=${balance}, available=${available}, locked=${locked}`,
        });
      }

      // Validar valores não negativos
      if (balance < 0 || available < 0 || locked < 0) {
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
      const balance = parseFloat(wallet.balance);
      const locked = parseFloat(wallet.lockedBalance);
      const expectedAvailable = balance - locked;

      // Se available está incorreto, corrigir
      if (Math.abs(parseFloat(wallet.availableBalance) - expectedAvailable) > 0.00000001) {
        await WalletService.updateBalance(wallet.id, {
          availableBalance: expectedAvailable.toFixed(8),
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
      totalBalance: wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0).toFixed(8),
      totalAvailable: wallets.reduce((sum, w) => sum + parseFloat(w.availableBalance), 0).toFixed(8),
      totalLocked: wallets.reduce((sum, w) => sum + parseFloat(w.lockedBalance), 0).toFixed(8),
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

      const totalLocked = activeOrders.reduce(
        (sum, order) => sum + parseFloat(order.cryptoAmount),
        0
      );

      // Atualizar se diferente
      if (Math.abs(parseFloat(wallet.lockedBalance) - totalLocked) > 0.00000001) {
        const newAvailable = parseFloat(wallet.balance) - totalLocked;
        await WalletService.updateBalance(wallet.id, {
          lockedBalance: totalLocked.toFixed(8),
          availableBalance: newAvailable.toFixed(8),
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
