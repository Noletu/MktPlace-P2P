import { PrismaClient } from '@prisma/client';
import BigNumber from 'bignumber.js';

const prisma = new PrismaClient();

/**
 * Admin Funds Service
 *
 * CONTROLE ADMINISTRATIVO TOTAL sobre carteiras e fundos dos usuários.
 *
 * Permite aos admins MASTER e ADMIN:
 * - Congelar/Descongelar contas de usuários
 * - Transferir fundos internamente entre carteiras (sem blockchain)
 * - Ajustar saldos manualmente (correções)
 * - Visualizar todos os fundos em custódia
 * - Gerar relatórios de auditoria completos
 * - Mover fundos entre hot/cold wallets
 *
 * SEGURANÇA: Todas as operações exigem 2FA para admins MASTER
 */
export class AdminFundsService {
  /**
   * ========================================
   * OVERVIEW: Visão geral dos fundos
   * ========================================
   */

  /**
   * Dashboard completo de fundos
   * Retorna: Total em custódia, por rede, usuários com maior saldo
   */
  static async getDashboard() {
    // Buscar todas as carteiras ativas
    const wallets = await prisma.userWallet.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            accountFrozen: true,
          },
        },
      },
    });

    // Calcular totais por rede
    const totals: Record<string, { balance: BigNumber; locked: BigNumber; available: BigNumber; count: number }> = {};

    wallets.forEach((wallet) => {
      const key = `${wallet.cryptoType}/${wallet.network}`;
      if (!totals[key]) {
        totals[key] = {
          balance: new BigNumber(0),
          locked: new BigNumber(0),
          available: new BigNumber(0),
          count: 0,
        };
      }

      totals[key].balance = totals[key].balance.plus(wallet.balance);
      totals[key].locked = totals[key].locked.plus(wallet.lockedBalance);
      totals[key].available = totals[key].available.plus(wallet.availableBalance);
      totals[key].count++;
    });

    // Converter para formato de resposta
    const networkSummary = Object.entries(totals).map(([network, data]) => ({
      network,
      balance: data.balance.toString(),
      lockedBalance: data.locked.toString(),
      availableBalance: data.available.toString(),
      walletsCount: data.count,
    }));

    // Usuários com maior saldo (top 10)
    const userBalances = new Map<string, { user: any; totalBalance: BigNumber; wallets: any[] }>();

    wallets.forEach((wallet) => {
      const existing = userBalances.get(wallet.userId);
      if (existing) {
        existing.totalBalance = existing.totalBalance.plus(wallet.balance);
        existing.wallets.push(wallet);
      } else {
        userBalances.set(wallet.userId, {
          user: wallet.user,
          totalBalance: new BigNumber(wallet.balance),
          wallets: [wallet],
        });
      }
    });

    const topUsers = Array.from(userBalances.values())
      .sort((a, b) => b.totalBalance.comparedTo(a.totalBalance))
      .slice(0, 10)
      .map((item) => ({
        userId: item.user.id,
        email: item.user.email,
        name: item.user.name,
        accountFrozen: item.user.accountFrozen,
        totalBalance: item.totalBalance.toString(),
        walletsCount: item.wallets.length,
      }));

    // Total geral em custódia
    const totalCustody = Array.from(userBalances.values())
      .reduce((sum, item) => sum.plus(item.totalBalance), new BigNumber(0));

    return {
      success: true,
      data: {
        totalCustody: totalCustody.toString(),
        networkSummary,
        topUsers,
        totalUsers: userBalances.size,
        totalWallets: wallets.length,
      },
    };
  }

  /**
   * Buscar carteiras de um usuário específico (todas as redes)
   */
  static async getUserWallets(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountFrozen: true,
        frozenReason: true,
        frozenAt: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const wallets = await prisma.userWallet.findMany({
      where: { userId },
      orderBy: [{ network: 'asc' }, { cryptoType: 'asc' }],
    });

    return {
      success: true,
      data: {
        user,
        wallets: wallets.map((w) => ({
          id: w.id,
          cryptoType: w.cryptoType,
          network: w.network,
          address: w.address,
          balance: w.balance,
          lockedBalance: w.lockedBalance,
          availableBalance: w.availableBalance,
          isActive: w.isActive,
        })),
      },
    };
  }

  /**
   * ========================================
   * FREEZE/UNFREEZE: Congelamento de contas
   * ========================================
   */

  /**
   * Congelar conta de usuário
   * - Bloqueia TODAS as carteiras
   * - Impede saques e novos pedidos
   * - Pedidos ativos continuam (para não prejudicar terceiros)
   */
  static async freezeAccount(params: {
    userId: string;
    reason: string;
    adminUserId: string;
  }) {
    const { userId, reason, adminUserId } = params;

    // Verificar se usuário existe
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    if (user.accountFrozen) {
      throw new Error('Conta já está congelada');
    }

    // Congelar conta
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountFrozen: true,
        frozenReason: reason,
        frozenAt: new Date(),
        frozenBy: adminUserId,
      },
    });

    // Registrar no audit log
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'FREEZE_ACCOUNT',
        resource: 'USER',
        resourceId: userId,
        description: `Admin congelou conta de ${user.email}`,
        metadata: JSON.stringify({ reason }),
        success: true,
      },
    });

    return {
      success: true,
      message: 'Conta congelada com sucesso',
      data: {
        userId: updatedUser.id,
        email: updatedUser.email,
        accountFrozen: updatedUser.accountFrozen,
        frozenAt: updatedUser.frozenAt,
      },
    };
  }

  /**
   * Descongelar conta de usuário
   */
  static async unfreezeAccount(params: {
    userId: string;
    adminUserId: string;
  }) {
    const { userId, adminUserId } = params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    if (!user.accountFrozen) {
      throw new Error('Conta não está congelada');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountFrozen: false,
        frozenReason: null,
        frozenAt: null,
        frozenBy: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'UNFREEZE_ACCOUNT',
        resource: 'USER',
        resourceId: userId,
        description: `Admin descongelou conta de ${user.email}`,
        success: true,
      },
    });

    return {
      success: true,
      message: 'Conta descongelada com sucesso',
      data: {
        userId: updatedUser.id,
        email: updatedUser.email,
        accountFrozen: updatedUser.accountFrozen,
      },
    };
  }

  /**
   * ========================================
   * INTERNAL TRANSFER: Transferência interna
   * ========================================
   */

  /**
   * Transferir fundos entre carteiras SEM usar blockchain
   * Apenas atualiza saldos no banco de dados
   *
   * IMPORTANTE: Apenas funciona entre carteiras da MESMA rede
   */
  static async internalTransfer(params: {
    fromWalletId: string;
    toWalletId: string;
    amount: string;
    reason: string;
    adminUserId: string;
  }) {
    const { fromWalletId, toWalletId, amount, reason, adminUserId } = params;

    // Validar amount
    const amountBN = new BigNumber(amount);
    if (amountBN.isNaN() || amountBN.lte(0)) {
      throw new Error('Valor inválido');
    }

    // Buscar carteiras
    const fromWallet = await prisma.userWallet.findUnique({
      where: { id: fromWalletId },
      include: { user: true },
    });

    const toWallet = await prisma.userWallet.findUnique({
      where: { id: toWalletId },
      include: { user: true },
    });

    if (!fromWallet || !toWallet) {
      throw new Error('Carteira não encontrada');
    }

    // Validar que são da mesma rede
    if (fromWallet.network !== toWallet.network || fromWallet.cryptoType !== toWallet.cryptoType) {
      throw new Error('Transferência apenas entre carteiras da mesma rede e crypto');
    }

    // Verificar saldo disponível
    const availableBN = new BigNumber(fromWallet.availableBalance);
    if (availableBN.lt(amountBN)) {
      throw new Error('Saldo insuficiente');
    }

    // Executar transferência (transação atômica)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Debitar da carteira de origem
      const newFromBalance = new BigNumber(fromWallet.balance).minus(amountBN).toString();
      const newFromAvailable = new BigNumber(fromWallet.availableBalance).minus(amountBN).toString();

      const updatedFrom = await tx.userWallet.update({
        where: { id: fromWalletId },
        data: {
          balance: newFromBalance,
          availableBalance: newFromAvailable,
        },
      });

      // 2. Creditar na carteira de destino
      const newToBalance = new BigNumber(toWallet.balance).plus(amountBN).toString();
      const newToAvailable = new BigNumber(toWallet.availableBalance).plus(amountBN).toString();

      const updatedTo = await tx.userWallet.update({
        where: { id: toWalletId },
        data: {
          balance: newToBalance,
          availableBalance: newToAvailable,
        },
      });

      // 3. Criar transação de débito
      const debitTx = await tx.walletTransaction.create({
        data: {
          walletId: fromWalletId,
          userId: fromWallet.userId,
          type: 'ADMIN_DEBIT',
          amount: `-${amount}`,
          balanceBefore: fromWallet.balance,
          balanceAfter: newFromBalance,
          adminUserId,
          adminReason: reason,
          description: `Transferência interna para ${toWallet.user.email}`,
        },
      });

      // 4. Criar transação de crédito
      const creditTx = await tx.walletTransaction.create({
        data: {
          walletId: toWalletId,
          userId: toWallet.userId,
          type: 'ADMIN_CREDIT',
          amount: amount,
          balanceBefore: toWallet.balance,
          balanceAfter: newToBalance,
          adminUserId,
          adminReason: reason,
          relatedTxId: debitTx.id,
          description: `Transferência interna de ${fromWallet.user.email}`,
        },
      });

      // 5. Atualizar transação de débito com link
      await tx.walletTransaction.update({
        where: { id: debitTx.id },
        data: { relatedTxId: creditTx.id },
      });

      // 6. Audit log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'INTERNAL_TRANSFER',
          resource: 'WALLET',
          resourceId: fromWalletId,
          description: `Transferência interna: ${fromWallet.user.email} → ${toWallet.user.email}`,
          metadata: JSON.stringify({
            from: { walletId: fromWalletId, userId: fromWallet.userId },
            to: { walletId: toWalletId, userId: toWallet.userId },
            amount,
            reason,
          }),
          success: true,
        },
      });

      return { debitTx, creditTx, updatedFrom, updatedTo };
    });

    return {
      success: true,
      message: 'Transferência interna realizada com sucesso',
      data: {
        from: {
          walletId: fromWalletId,
          user: fromWallet.user.email,
          newBalance: result.updatedFrom.balance,
        },
        to: {
          walletId: toWalletId,
          user: toWallet.user.email,
          newBalance: result.updatedTo.balance,
        },
        amount,
        transactions: {
          debit: result.debitTx.id,
          credit: result.creditTx.id,
        },
      },
    };
  }

  /**
   * ========================================
   * BALANCE ADJUSTMENT: Ajuste manual de saldo
   * ========================================
   */

  /**
   * Ajustar saldo de carteira manualmente
   * - Pode aumentar ou diminuir saldo
   * - Registra motivo obrigatório
   * - Para correções administrativas
   */
  static async adjustBalance(params: {
    walletId: string;
    adjustment: string; // Pode ser negativo
    reason: string;
    adminUserId: string;
  }) {
    const { walletId, adjustment, reason, adminUserId } = params;

    const adjustmentBN = new BigNumber(adjustment);
    if (adjustmentBN.isNaN() || adjustmentBN.isZero()) {
      throw new Error('Ajuste inválido');
    }

    const wallet = await prisma.userWallet.findUnique({
      where: { id: walletId },
      include: { user: true },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    // Calcular novos saldos
    const newBalance = new BigNumber(wallet.balance).plus(adjustmentBN);
    const newAvailable = new BigNumber(wallet.availableBalance).plus(adjustmentBN);

    // Não permitir saldo negativo
    if (newBalance.lt(0) || newAvailable.lt(0)) {
      throw new Error('Ajuste resultaria em saldo negativo');
    }

    // Executar ajuste
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.userWallet.update({
        where: { id: walletId },
        data: {
          balance: newBalance.toString(),
          availableBalance: newAvailable.toString(),
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: 'ADMIN_ADJUSTMENT',
          amount: adjustment,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance.toString(),
          adminUserId,
          adminReason: reason,
          description: `Ajuste administrativo de saldo`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'BALANCE_ADJUSTMENT',
          resource: 'WALLET',
          resourceId: walletId,
          description: `Ajuste de saldo para ${wallet.user.email}`,
          metadata: JSON.stringify({
            walletId,
            userId: wallet.userId,
            adjustment,
            reason,
            before: wallet.balance,
            after: newBalance.toString(),
          }),
          success: true,
        },
      });

      return updated;
    });

    return {
      success: true,
      message: 'Saldo ajustado com sucesso',
      data: {
        walletId,
        user: wallet.user.email,
        network: `${wallet.cryptoType}/${wallet.network}`,
        adjustment,
        oldBalance: wallet.balance,
        newBalance: result.balance,
      },
    };
  }

  /**
   * ========================================
   * AUDIT REPORT: Relatório de auditoria
   * ========================================
   */

  /**
   * Buscar histórico de operações administrativas
   */
  static async getAdminAuditLog(params: {
    startDate?: Date;
    endDate?: Date;
    adminUserId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const {
      startDate,
      endDate,
      adminUserId,
      action,
      limit = 50,
      offset = 0,
    } = params;

    const where: any = {
      action: {
        in: [
          'FREEZE_ACCOUNT',
          'UNFREEZE_ACCOUNT',
          'INTERNAL_TRANSFER',
          'BALANCE_ADJUSTMENT',
        ],
      },
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (adminUserId) where.userId = adminUserId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          admin: log.email || log.userId,
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId,
          description: log.description,
          metadata: log.metadata ? JSON.parse(log.metadata) : null,
          success: log.success,
          createdAt: log.createdAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    };
  }

  /**
   * Buscar histórico de transações de uma carteira
   */
  static async getWalletTransactionHistory(walletId: string, limit = 50) {
    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });

    return {
      success: true,
      data: {
        walletId,
        transactions: transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          description: tx.description,
          adminReason: tx.adminReason,
          adminUserId: tx.adminUserId,
          relatedTxId: tx.relatedTxId,
          createdAt: tx.createdAt,
          user: tx.user,
        })),
      },
    };
  }
}
