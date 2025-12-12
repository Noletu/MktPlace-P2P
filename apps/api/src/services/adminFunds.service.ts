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

  /**
   * FASE 5/7: Visão dos Sócios (Platform Wallets - Account 0)
   * Retorna saldos agregados das platform wallets
   */
  static async getPartnersFunds() {
    const { platformWalletService } = await import('./platformWallet.service');
    const platformWallets = await platformWalletService.getAllPlatformWallets();

    // Group by crypto and aggregate
    const byCrypto: { [key: string]: any } = {};

    for (const wallet of platformWallets) {
      if (!byCrypto[wallet.cryptoType]) {
        byCrypto[wallet.cryptoType] = {
          cryptoType: wallet.cryptoType,
          networks: [],
          totalBalance: '0',
          totalFees: '0',
          totalDeposits: '0',
          totalWithdrawals: '0',
        };
      }

      byCrypto[wallet.cryptoType].networks.push({
        network: wallet.network,
        address: wallet.address,
        balance: wallet.balance,
        availableBalance: wallet.availableBalance,
        feesCollected: wallet.totalFeesCollected,
        deposited: wallet.totalDeposited,
        withdrawn: wallet.totalWithdrawn,
        lastSyncedAt: wallet.lastSyncedAt,
      });

      // Aggregate totals (string arithmetic for precision)
      const balance = new BigNumber(wallet.balance || '0');
      const fees = new BigNumber(wallet.totalFeesCollected || '0');
      const deposits = new BigNumber(wallet.totalDeposited || '0');
      const withdrawals = new BigNumber(wallet.totalWithdrawn || '0');

      byCrypto[wallet.cryptoType].totalBalance = new BigNumber(
        byCrypto[wallet.cryptoType].totalBalance
      )
        .plus(balance)
        .toString();

      byCrypto[wallet.cryptoType].totalFees = new BigNumber(
        byCrypto[wallet.cryptoType].totalFees
      )
        .plus(fees)
        .toString();

      byCrypto[wallet.cryptoType].totalDeposits = new BigNumber(
        byCrypto[wallet.cryptoType].totalDeposits
      )
        .plus(deposits)
        .toString();

      byCrypto[wallet.cryptoType].totalWithdrawals = new BigNumber(
        byCrypto[wallet.cryptoType].totalWithdrawals
      )
        .plus(withdrawals)
        .toString();
    }

    return {
      partners: Object.values(byCrypto),
      summary: {
        totalPlatformWallets: platformWallets.length,
        cryptosSupported: Object.keys(byCrypto).length,
      },
    };
  }

  /**
   * FASE 5/7: Visão dos Usuários (User Wallets - Account >= 1)
   * Retorna saldos agregados das user wallets com breakdown por usuário
   */
  static async getUsersFunds() {
    const userWallets = await prisma.userWallet.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Group by crypto
    const byCrypto: { [key: string]: any } = {};
    const byUser: { [key: string]: any } = {};

    for (const wallet of userWallets) {
      // Aggregate by crypto
      if (!byCrypto[wallet.cryptoType]) {
        byCrypto[wallet.cryptoType] = {
          cryptoType: wallet.cryptoType,
          totalBalance: '0',
          totalWallets: 0,
          networks: {},
        };
      }

      if (!byCrypto[wallet.cryptoType].networks[wallet.network]) {
        byCrypto[wallet.cryptoType].networks[wallet.network] = {
          network: wallet.network,
          balance: '0',
          walletCount: 0,
        };
      }

      const balance = new BigNumber(wallet.balance || '0');
      byCrypto[wallet.cryptoType].totalBalance = new BigNumber(
        byCrypto[wallet.cryptoType].totalBalance
      )
        .plus(balance)
        .toString();

      byCrypto[wallet.cryptoType].networks[wallet.network].balance =
        new BigNumber(byCrypto[wallet.cryptoType].networks[wallet.network].balance)
          .plus(balance)
          .toString();

      byCrypto[wallet.cryptoType].networks[wallet.network].walletCount++;
      byCrypto[wallet.cryptoType].totalWallets++;

      // Aggregate by user
      if (!byUser[wallet.userId]) {
        byUser[wallet.userId] = {
          userId: wallet.userId,
          userName: wallet.user?.name || 'Unknown',
          userEmail: wallet.user?.email || 'unknown@example.com',
          wallets: [],
          totalBalance: {},
        };
      }

      byUser[wallet.userId].wallets.push({
        cryptoType: wallet.cryptoType,
        network: wallet.network,
        address: wallet.address,
        balance: wallet.balance,
      });

      if (!byUser[wallet.userId].totalBalance[wallet.cryptoType]) {
        byUser[wallet.userId].totalBalance[wallet.cryptoType] = '0';
      }

      byUser[wallet.userId].totalBalance[wallet.cryptoType] = new BigNumber(
        byUser[wallet.userId].totalBalance[wallet.cryptoType]
      )
        .plus(balance)
        .toString();
    }

    // Convert networks object to array
    const cryptoArray = Object.values(byCrypto).map((crypto: any) => ({
      ...crypto,
      networks: Object.values(crypto.networks),
    }));

    return {
      users: {
        byCrypto: cryptoArray,
        byUser: Object.values(byUser),
      },
      summary: {
        totalUsers: Object.keys(byUser).length,
        totalUserWallets: userWallets.length,
        cryptosSupported: Object.keys(byCrypto).length,
      },
    };
  }

  /**
   * FASE 5/7: Visão Total (Sócios + Usuários)
   * Combina platform wallets e user wallets para visão consolidada
   */
  static async getTotalFunds() {
    const [partnersFunds, usersFunds] = await Promise.all([
      this.getPartnersFunds(),
      this.getUsersFunds(),
    ]);

    // Aggregate partners + users by crypto
    const totalByCrypto: { [key: string]: any } = {};

    // Add partners
    for (const crypto of partnersFunds.partners) {
      totalByCrypto[crypto.cryptoType] = {
        cryptoType: crypto.cryptoType,
        partnersBalance: crypto.totalBalance,
        usersBalance: '0',
        totalBalance: crypto.totalBalance,
      };
    }

    // Add users
    for (const crypto of usersFunds.users.byCrypto) {
      if (!totalByCrypto[crypto.cryptoType]) {
        totalByCrypto[crypto.cryptoType] = {
          cryptoType: crypto.cryptoType,
          partnersBalance: '0',
          usersBalance: '0',
          totalBalance: '0',
        };
      }

      totalByCrypto[crypto.cryptoType].usersBalance = crypto.totalBalance;

      totalByCrypto[crypto.cryptoType].totalBalance = new BigNumber(
        totalByCrypto[crypto.cryptoType].partnersBalance
      )
        .plus(crypto.totalBalance)
        .toString();
    }

    return {
      total: Object.values(totalByCrypto),
      breakdown: {
        partners: partnersFunds.partners,
        users: usersFunds.users.byCrypto,
      },
      summary: {
        totalPlatformWallets: partnersFunds.summary.totalPlatformWallets,
        totalUserWallets: usersFunds.summary.totalUserWallets,
        totalUsers: usersFunds.summary.totalUsers,
        cryptosSupported: Object.keys(totalByCrypto).length,
      },
    };
  }
}
