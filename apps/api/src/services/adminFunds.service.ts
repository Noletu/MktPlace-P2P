import { prisma } from '../utils/prisma';
import BigNumber from 'bignumber.js';
import { notificationService } from './notification.service';
import { PlatformWalletService } from './platformWallet.service';
import {
  LockCategory,
  LockCategoryLabels,
  LockedBalancesFilters,
  LockedWalletInfo,
  LockHistoryEntry,
} from '../types/adminLock.types';

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

    // Verificação de solvência: PlatformWallet.balance vs SUM(UserWallet.balance) por crypto/rede
    const platformWallets = await prisma.platformWallet.findMany({
      where: { isActive: true },
    });

    const solvency: Array<{
      cryptoType: string;
      network: string;
      hotWalletBalance: string;
      totalUserBalance: string;
      delta: string;
      status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    }> = [];

    for (const hotWallet of platformWallets) {
      const key = `${hotWallet.cryptoType}/${hotWallet.network}`;
      const totalForNetwork = totals[key];
      const totalUserBalance = totalForNetwork
        ? totalForNetwork.balance
        : new BigNumber(0);

      const hotBalance = new BigNumber(hotWallet.balance);
      const delta = hotBalance.minus(totalUserBalance);

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
      if (delta.lt(0)) {
        status = 'CRITICAL';
      } else if (totalUserBalance.gt(0) && delta.div(totalUserBalance).lt(0.05)) {
        status = 'WARNING'; // menos de 5% de margem
      }

      solvency.push({
        cryptoType: hotWallet.cryptoType,
        network: hotWallet.network,
        hotWalletBalance: hotBalance.toString(),
        totalUserBalance: totalUserBalance.toString(),
        delta: delta.toString(),
        status,
      });
    }

    return {
      success: true,
      data: {
        totalCustody: totalCustody.toString(),
        networkSummary,
        topUsers,
        totalUsers: userBalances.size,
        totalWallets: wallets.length,
        solvency,
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
   * Buscar wallets de um usuário por email (para lookup no frontend)
   */
  /**
   * Resolve um identificador genérico (email, userId ou walletId) para um usuário
   */
  static async resolveUserByIdentifier(query: string) {
    const trimmed = query.trim();

    // 1. Email (contém @)
    if (trimmed.includes('@')) {
      const user = await prisma.user.findUnique({
        where: { email: trimmed },
        select: { id: true, email: true, name: true },
      });
      if (user) return user;
      throw new Error('Usuário não encontrado com este email');
    }

    // 2. Tentar como userId
    const userById = await prisma.user.findUnique({
      where: { id: trimmed },
      select: { id: true, email: true, name: true },
    });
    if (userById) return userById;

    // 3. Tentar como walletId
    const wallet = await prisma.userWallet.findUnique({
      where: { id: trimmed },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (wallet) return wallet.user;

    throw new Error('Nenhum usuário encontrado com este identificador');
  }

  static async searchUserWallets(query: string) {
    const user = await this.resolveUserByIdentifier(query);

    const wallets = await prisma.userWallet.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ cryptoType: 'asc' }, { network: 'asc' }],
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
          availableBalance: w.availableBalance,
          lockedBalance: w.lockedBalance,
        })),
      },
    };
  }

  /**
   * Buscar detalhes de uma wallet por ID (para lookup no frontend)
   */
  static async getWalletById(walletId: string) {
    const wallet = await prisma.userWallet.findUnique({
      where: { id: walletId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    return {
      success: true,
      data: {
        id: wallet.id,
        cryptoType: wallet.cryptoType,
        network: wallet.network,
        address: wallet.address,
        balance: wallet.balance,
        lockedBalance: wallet.lockedBalance,
        availableBalance: wallet.availableBalance,
        isActive: wallet.isActive,
        user: wallet.user,
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
   * - Suporta freeze temporário (com auto-desbloqueio) ou permanente
   *
   * @param duration - Duração em horas para freeze temporário (opcional)
   *                   Se não fornecida, freeze é permanente (requer desbloqueio manual)
   */
  static async freezeAccount(params: {
    userId: string;
    reason: string;
    adminUserId: string;
    duration?: number; // Em horas
  }) {
    const { userId, reason, adminUserId, duration } = params;

    // Verificar se usuário existe
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    if (user.accountFrozen) {
      throw new Error('Conta já está congelada');
    }

    // Calcular frozenUntil se duration fornecida
    let frozenUntil: Date | null = null;
    let freezeType: 'PERMANENT' | 'TEMPORARY' = 'PERMANENT';

    if (duration && duration > 0) {
      frozenUntil = new Date();
      frozenUntil.setHours(frozenUntil.getHours() + duration);
      freezeType = 'TEMPORARY';
    }

    // Congelar conta
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountFrozen: true,
        frozenReason: reason,
        frozenAt: new Date(),
        frozenBy: adminUserId,
        frozenUntil, // Null para permanente, Date para temporário
      },
    });

    // Registrar no audit log
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { email: true, legacyRole: true, name: true },
    });
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        email: adminUser?.email ?? '',
        role: adminUser?.legacyRole ?? '',
        name: adminUser?.name ?? '',
        action: 'FREEZE_ACCOUNT',
        resource: 'USER',
        resourceId: userId,
        description: freezeType === 'TEMPORARY'
          ? `Admin congelou conta de ${user.email} temporariamente (${duration}h)`
          : `Admin congelou conta de ${user.email} permanentemente`,
        metadata: JSON.stringify({
          reason,
          freezeType,
          duration: duration || null,
          frozenUntil: frozenUntil ? frozenUntil.toISOString() : null,
        }),
        success: true,
      },
    });

    // NOTIFICAÇÃO: Avisar usuário sobre bloqueio
    try {
      const notificationMessage = freezeType === 'TEMPORARY'
        ? `Sua conta foi temporariamente suspensa até ${frozenUntil?.toLocaleString('pt-BR')}. Motivo: ${reason}`
        : `Sua conta foi suspensa. Motivo: ${reason}`;

      await notificationService.createNotification({
        userId: userId,
        type: 'ACCOUNT_FROZEN',
        category: 'ACCOUNT',
        title: freezeType === 'TEMPORARY' ? '⚠️ Conta Suspensa Temporariamente' : '🚫 Conta Suspensa',
        message: notificationMessage,
        priority: 'HIGH',
        actionUrl: '/support/ticket/new?appeal=true',
        actionLabel: 'Apelar da Decisão',
      });
      console.log(`✅ [Freeze] Notificação criada para usuário ${userId}`);
    } catch (notifError: any) {
      console.error('❌ [Freeze] Erro ao criar notificação:', notifError.message);
      // Não falhar o freeze se notificação falhar
    }

    return {
      success: true,
      message: freezeType === 'TEMPORARY'
        ? `Conta congelada temporariamente até ${frozenUntil?.toLocaleString('pt-BR')}`
        : 'Conta congelada permanentemente (requer desbloqueio manual)',
      data: {
        userId: updatedUser.id,
        email: updatedUser.email,
        accountFrozen: updatedUser.accountFrozen,
        frozenAt: updatedUser.frozenAt,
        frozenUntil: updatedUser.frozenUntil,
        freezeType,
        autoUnfreezeIn: duration ? `${duration} horas` : null,
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

    const unfreezeAdminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { email: true, legacyRole: true, name: true },
    });
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        email: unfreezeAdminUser?.email ?? '',
        role: unfreezeAdminUser?.legacyRole ?? '',
        name: unfreezeAdminUser?.name ?? '',
        action: 'UNFREEZE_ACCOUNT',
        resource: 'USER',
        resourceId: userId,
        description: `Admin descongelou conta de ${user.email}`,
        success: true,
      },
    });

    // NOTIFICAÇÃO: Avisar usuário sobre desbloqueio
    try {
      await notificationService.createNotification({
        userId: userId,
        type: 'ACCOUNT_UNFROZEN',
        category: 'ACCOUNT',
        title: '✅ Conta Reativada',
        message: 'Sua conta foi reativada e você já pode usar todas as funcionalidades da plataforma.',
        priority: 'NORMAL',
        actionUrl: '/dashboard',
        actionLabel: 'Ver Dashboard',
      });
      console.log(`✅ [Unfreeze] Notificação criada para usuário ${userId}`);
    } catch (notifError: any) {
      console.error('❌ [Unfreeze] Erro ao criar notificação:', notifError.message);
      // Não falhar o unfreeze se notificação falhar
    }

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
   * Listar contas com filtros de congelamento
   */
  static async getFrozenAccounts(filters?: {
    status?: 'all' | 'frozen' | 'active';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const status = filters?.status || 'all';
    const search = filters?.search?.trim() || '';
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(100, Math.max(1, filters?.limit || 20));

    // Build where clause
    const where: any = {};

    if (status === 'frozen') {
      where.accountFrozen = true;
    } else if (status === 'active') {
      where.accountFrozen = false;
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { id: search },
      ];
    }

    // Build search-only where (without status filter) for summary counts
    const searchWhere: any = {};
    if (search) {
      searchWhere.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { id: search },
      ];
    }

    const [totalFrozen, totalActive, totalFiltered, users] = await Promise.all([
      prisma.user.count({ where: { ...searchWhere, accountFrozen: true } }),
      prisma.user.count({ where: { ...searchWhere, accountFrozen: false } }),
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          accountFrozen: true,
          frozenReason: true,
          frozenAt: true,
          frozenBy: true,
          frozenUntil: true,
          _count: { select: { userWallets: true } },
        },
        orderBy: [
          { accountFrozen: 'desc' },
          { frozenAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Resolve frozenBy admin emails
    const adminIds = [...new Set(users.map((u) => u.frozenBy).filter(Boolean))] as string[];
    const admins = adminIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, email: true },
        })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, a.email]));

    return {
      success: true,
      data: {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          accountFrozen: u.accountFrozen,
          frozenReason: u.frozenReason,
          frozenAt: u.frozenAt,
          frozenBy: u.frozenBy,
          frozenByEmail: u.frozenBy ? adminMap.get(u.frozenBy) || null : null,
          frozenUntil: u.frozenUntil,
          walletCount: u._count.userWallets,
        })),
        summary: {
          totalFrozen,
          totalActive,
          total: totalFiltered,
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalFiltered / limit),
        },
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

    // Notificar ambos os usuários
    try {
      await notificationService.createNotification({
        userId: fromWallet.userId,
        type: 'INTERNAL_TRANSFER',
        category: 'WALLET',
        title: 'Transferencia Enviada',
        message: `${amount} ${fromWallet.cryptoType} foi transferido de sua carteira. Motivo: ${reason.replace(/^\[(DUAL-APPROVED|OVERRIDE)\]\s*/i, '')}`,
        priority: 'HIGH',
        actionUrl: '/wallet',
        actionLabel: 'Ver Carteira',
      });
    } catch (e) {
      console.error('[internalTransfer] Notification error (sender):', e);
    }

    try {
      await notificationService.createNotification({
        userId: toWallet.userId,
        type: 'INTERNAL_TRANSFER',
        category: 'WALLET',
        title: 'Transferencia Recebida',
        message: `Voce recebeu ${amount} ${toWallet.cryptoType} em sua carteira. Motivo: ${reason.replace(/^\[(DUAL-APPROVED|OVERRIDE)\]\s*/i, '')}`,
        priority: 'HIGH',
        actionUrl: '/wallet',
        actionLabel: 'Ver Carteira',
      });
    } catch (e) {
      console.error('[internalTransfer] Notification error (receiver):', e);
    }

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

    // Notificar o usuário sobre o ajuste
    try {
      await notificationService.createNotification({
        userId: wallet.userId,
        type: 'BALANCE_ADJUSTED',
        category: 'WALLET',
        title: adjustmentBN.gte(0) ? 'Credito Recebido' : 'Debito Aplicado',
        message: `${adjustmentBN.abs().toString()} ${wallet.cryptoType} foi ${adjustmentBN.gte(0) ? 'creditado em' : 'debitado de'} sua carteira. Motivo: ${reason.replace(/^\[(DUAL-APPROVED|OVERRIDE)\]\s*/i, '')}`,
        priority: 'HIGH',
        actionUrl: '/wallet',
        actionLabel: 'Ver Carteira',
      });
    } catch (e) {
      console.error('[adjustBalance] Notification error:', e);
    }

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
   * PLATFORM REFUND: Reembolso da PlatformWallet → UserWallet
   * ========================================
   */

  /**
   * Reembolsar fundos da PlatformWallet para um UserWallet
   * - Cenário: reversão de transação P2P → devolver fee cobrada
   * - Debita PlatformWallet, credita UserWallet
   * - Registra PlatformWalletMovement tipo REFUND_OUT
   */
  static async platformRefund(params: {
    cryptoType: string;
    network: string;
    toWalletId: string;
    amount: string;
    reason: string;
    adminUserId: string;
    direction?: 'TO_USER' | 'FROM_USER';
  }) {
    const { cryptoType, network, toWalletId, amount, reason, adminUserId, direction = 'TO_USER' } = params;

    // Validar amount
    const amountBN = new BigNumber(amount);
    if (amountBN.isNaN() || amountBN.lte(0)) {
      throw new Error('Valor inválido');
    }

    // Buscar PlatformWallet
    const platformWallet = await prisma.platformWallet.findUnique({
      where: {
        cryptoType_network: { cryptoType, network },
      },
    });

    if (!platformWallet) {
      throw new Error(`PlatformWallet não encontrada: ${cryptoType}/${network}`);
    }

    // Buscar UserWallet
    const userWallet = await prisma.userWallet.findUnique({
      where: { id: toWalletId },
      include: { user: true },
    });

    if (!userWallet) {
      throw new Error(direction === 'TO_USER' ? 'Carteira de destino não encontrada' : 'Carteira de origem não encontrada');
    }

    // Validar crypto/network match
    if (userWallet.cryptoType !== cryptoType || userWallet.network !== network) {
      throw new Error(
        `Crypto/network incompatível: PlatformWallet é ${cryptoType}/${network}, UserWallet é ${userWallet.cryptoType}/${userWallet.network}`
      );
    }

    // ========== BRANCH: FROM_USER (Cobrança: UserWallet → PlatformWallet) ==========
    if (direction === 'FROM_USER') {
      // Validar saldo suficiente no UserWallet (respeitar lockedBalance)
      const userAvailable = new BigNumber(userWallet.availableBalance);
      if (userAvailable.lt(amountBN)) {
        throw new Error(
          `Saldo disponível insuficiente na carteira do usuário: disponível ${userWallet.availableBalance}, requerido ${amount}`
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Debitar UserWallet (balance e availableBalance, respeitar lockedBalance)
        const newUserBalance = new BigNumber(userWallet.balance).minus(amountBN).toString();
        const newUserAvailable = new BigNumber(userWallet.availableBalance).minus(amountBN).toString();

        const updatedUser = await tx.userWallet.update({
          where: { id: toWalletId },
          data: {
            balance: newUserBalance,
            availableBalance: newUserAvailable,
          },
        });

        // 2. Creditar PlatformWallet (balance, availableBalance, totalCollected)
        const newPlatformBalance = new BigNumber(platformWallet.balance).plus(amountBN).toString();
        const newPlatformAvailable = new BigNumber(platformWallet.availableBalance).plus(amountBN).toString();
        const newTotalCollected = new BigNumber(platformWallet.totalCollected).plus(amountBN).toString();

        const updatedPlatform = await tx.platformWallet.update({
          where: { id: platformWallet.id },
          data: {
            balance: newPlatformBalance,
            availableBalance: newPlatformAvailable,
            totalCollected: newTotalCollected,
          },
        });

        // 3. Criar WalletTransaction tipo ADMIN_DEBIT
        const debitTx = await tx.walletTransaction.create({
          data: {
            walletId: toWalletId,
            userId: userWallet.userId,
            type: 'ADMIN_DEBIT',
            amount: amount,
            balanceBefore: userWallet.balance,
            balanceAfter: newUserBalance,
            adminUserId,
            adminReason: reason,
            description: `Cobrança da plataforma (${cryptoType}/${network})`,
          },
        });

        // 4. Criar PlatformWalletMovement tipo COLLECT_IN
        await PlatformWalletService.recordMovement(tx, {
          platformWalletId: platformWallet.id,
          type: 'COLLECT_IN',
          direction: 'IN',
          amount: amount,
          balanceBefore: platformWallet.balance,
          balanceAfter: newPlatformBalance,
          description: `Cobrança de ${userWallet.user.email} (${userWallet.cryptoType}/${userWallet.network})`,
          userId: userWallet.userId,
          metadata: {
            fromWalletId: toWalletId,
            reason,
            adminUserId,
            debitTxId: debitTx.id,
          },
        });

        // 5. Audit Log
        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'PLATFORM_COLLECT',
            resource: 'PLATFORM_WALLET',
            resourceId: platformWallet.id,
            description: `Cobrança da plataforma: ${userWallet.user.email} → ${cryptoType}/${network}`,
            metadata: JSON.stringify({
              platformWalletId: platformWallet.id,
              fromWalletId: toWalletId,
              fromUserId: userWallet.userId,
              amount,
              reason,
              platformBalanceBefore: platformWallet.balance,
              platformBalanceAfter: newPlatformBalance,
              userBalanceBefore: userWallet.balance,
              userBalanceAfter: newUserBalance,
            }),
            success: true,
          },
        });

        return { updatedPlatform, updatedUser, debitTx };
      });

      // Notificar o usuário sobre a cobrança
      try {
        await notificationService.createNotification({
          userId: userWallet.userId,
          type: 'PLATFORM_COLLECT',
          category: 'WALLET',
          title: 'Cobranca da Plataforma',
          message: `${amount} ${cryptoType} foi cobrado de sua carteira. Motivo: ${reason.replace(/^\[(DUAL-APPROVED|OVERRIDE)\]\s*/i, '')}`,
          priority: 'HIGH',
          actionUrl: '/wallet',
          actionLabel: 'Ver Carteira',
        });
      } catch (e) {
        console.error('[platformRefund/FROM_USER] Notification error:', e);
      }

      return {
        success: true,
        message: 'Cobrança da plataforma realizada com sucesso',
        data: {
          platformWallet: {
            id: platformWallet.id,
            cryptoType,
            network,
            newBalance: result.updatedPlatform.balance,
            totalCollected: result.updatedPlatform.totalCollected,
          },
          fromWallet: {
            walletId: toWalletId,
            user: userWallet.user.email,
            newBalance: result.updatedUser.balance,
          },
          amount,
          transactionId: result.debitTx.id,
        },
      };
    }

    // ========== BRANCH: TO_USER (Reembolso: PlatformWallet → UserWallet) ==========

    // Validar saldo suficiente na PlatformWallet
    const platformAvailable = new BigNumber(platformWallet.availableBalance);
    if (platformAvailable.lt(amountBN)) {
      throw new Error(
        `Saldo insuficiente na PlatformWallet: disponível ${platformWallet.availableBalance}, requerido ${amount}`
      );
    }

    // Executar reembolso (transação atômica)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Debitar PlatformWallet
      const newPlatformBalance = new BigNumber(platformWallet.balance).minus(amountBN).toString();
      const newPlatformAvailable = new BigNumber(platformWallet.availableBalance).minus(amountBN).toString();
      const newTotalRefunded = new BigNumber(platformWallet.totalRefunded).plus(amountBN).toString();

      const updatedPlatform = await tx.platformWallet.update({
        where: { id: platformWallet.id },
        data: {
          balance: newPlatformBalance,
          availableBalance: newPlatformAvailable,
          totalRefunded: newTotalRefunded,
        },
      });

      // 2. Creditar UserWallet
      const newToBalance = new BigNumber(userWallet.balance).plus(amountBN).toString();
      const newToAvailable = new BigNumber(userWallet.availableBalance).plus(amountBN).toString();

      const updatedTo = await tx.userWallet.update({
        where: { id: toWalletId },
        data: {
          balance: newToBalance,
          availableBalance: newToAvailable,
        },
      });

      // 3. Criar WalletTransaction (crédito no UserWallet)
      const creditTx = await tx.walletTransaction.create({
        data: {
          walletId: toWalletId,
          userId: userWallet.userId,
          type: 'ADMIN_CREDIT',
          amount: amount,
          balanceBefore: userWallet.balance,
          balanceAfter: newToBalance,
          adminUserId,
          adminReason: reason,
          description: `Reembolso da plataforma (${cryptoType}/${network})`,
        },
      });

      // 4. Criar PlatformWalletMovement tipo REFUND_OUT
      await PlatformWalletService.recordMovement(tx, {
        platformWalletId: platformWallet.id,
        type: 'REFUND_OUT',
        direction: 'OUT',
        amount: amount,
        balanceBefore: platformWallet.balance,
        balanceAfter: newPlatformBalance,
        description: `Reembolso para ${userWallet.user.email} (${userWallet.cryptoType}/${userWallet.network})`,
        userId: userWallet.userId,
        metadata: {
          toWalletId,
          reason,
          adminUserId,
          creditTxId: creditTx.id,
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PLATFORM_REFUND',
          resource: 'PLATFORM_WALLET',
          resourceId: platformWallet.id,
          description: `Reembolso da plataforma: ${cryptoType}/${network} → ${userWallet.user.email}`,
          metadata: JSON.stringify({
            platformWalletId: platformWallet.id,
            toWalletId,
            toUserId: userWallet.userId,
            amount,
            reason,
            platformBalanceBefore: platformWallet.balance,
            platformBalanceAfter: newPlatformBalance,
            userBalanceBefore: userWallet.balance,
            userBalanceAfter: newToBalance,
          }),
          success: true,
        },
      });

      return { updatedPlatform, updatedTo, creditTx };
    });

    // Notificar o usuário sobre o reembolso
    try {
      await notificationService.createNotification({
        userId: userWallet.userId,
        type: 'PLATFORM_REFUND',
        category: 'WALLET',
        title: 'Reembolso Recebido',
        message: `Voce recebeu um reembolso de ${amount} ${cryptoType} em sua carteira. Motivo: ${reason.replace(/^\[(DUAL-APPROVED|OVERRIDE)\]\s*/i, '')}`,
        priority: 'HIGH',
        actionUrl: '/wallet',
        actionLabel: 'Ver Carteira',
      });
    } catch (e) {
      console.error('[platformRefund/TO_USER] Notification error:', e);
    }

    return {
      success: true,
      message: 'Reembolso da plataforma realizado com sucesso',
      data: {
        platformWallet: {
          id: platformWallet.id,
          cryptoType,
          network,
          newBalance: result.updatedPlatform.balance,
          totalRefunded: result.updatedPlatform.totalRefunded,
        },
        toWallet: {
          walletId: toWalletId,
          user: userWallet.user.email,
          newBalance: result.updatedTo.balance,
        },
        amount,
        transactionId: result.creditTx.id,
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
    success?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const {
      startDate,
      endDate,
      adminUserId,
      action,
      success,
      limit = 50,
      offset = 0,
    } = params;

    const where: any = {
      action: {
        in: [
          'FREEZE_ACCOUNT',
          'UNFREEZE_ACCOUNT',
          'AUTO_UNFREEZE_ACCOUNT',
          'INTERNAL_TRANSFER',
          'BALANCE_ADJUSTMENT',
          'PLATFORM_REFUND',
          'PLATFORM_COLLECT',
          'ADMIN_LOCK_BALANCE',
          'ADMIN_UNLOCK_BALANCE',
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
    if (success !== undefined) where.success = success;

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

  /**
   * ========================================
   * LOCKED BALANCES: Gestão de saldos bloqueados
   * ========================================
   */

  /**
   * Listar carteiras com saldo bloqueado
   * Usado para identificar saldos órfãos ou gerenciar bloqueios manuais
   */
  static async getLockedBalances(filters?: LockedBalancesFilters): Promise<{
    success: boolean;
    data: {
      wallets: LockedWalletInfo[];
      summary: {
        totalWallets: number;
        totalLockedAmount: Record<string, string>;
      };
    };
  }> {
    // Construir filtros
    const where: any = {
      lockedBalance: {
        not: '0',
      },
    };

    if (filters?.cryptoType) {
      where.cryptoType = filters.cryptoType;
    }

    if (filters?.network) {
      where.network = filters.network;
    }

    if (filters?.userId) {
      const resolved = await this.resolveUserByIdentifier(filters.userId);
      where.userId = resolved.id;
    }

    // Buscar carteiras com saldo bloqueado
    const wallets = await prisma.userWallet.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        transactions: {
          where: {
            type: {
              in: ['LOCK', 'UNLOCK', 'ADMIN_LOCK', 'ADMIN_UNLOCK'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        ordersAsCollateral: {
          where: {
            status: {
              in: ['PENDING', 'MATCHED', 'IN_NEGOTIATION', 'PAYMENT_SENT', 'VALIDATING'],
            },
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Filtro numérico estrito: excluir carteiras com lockedBalance efetivamente zero
    // O filtro Prisma `not: '0'` só exclui a string exata '0', mas valores como
    // '0.00000000' passam por ele. BigNumber.gt(0) garante exclusão correta.
    let filteredWallets = wallets.filter((w) =>
      new BigNumber(w.lockedBalance).gt(0)
    );

    // Filtrar por valor mínimo se especificado
    if (filters?.minAmount) {
      const minBN = new BigNumber(filters.minAmount);
      filteredWallets = filteredWallets.filter((w) =>
        new BigNumber(w.lockedBalance).gte(minBN)
      );
    }

    // Mapear para formato de resposta
    const mappedWallets: LockedWalletInfo[] = filteredWallets.map((wallet) => {
      // Encontrar última transação de lock
      const lastLockTx = wallet.transactions.find(
        (tx) => tx.type === 'LOCK' || tx.type === 'ADMIN_LOCK'
      );

      // Mapear histórico
      const lockHistory: LockHistoryEntry[] = wallet.transactions.map((tx) => {
        let category: LockCategory | null = null;
        if (tx.metadata) {
          try {
            const meta = JSON.parse(tx.metadata);
            category = meta.category || null;
          } catch {
            // Ignorar erro de parse
          }
        }

        return {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          category,
          reason: tx.description || tx.adminReason,
          adminUserId: tx.adminUserId,
          adminEmail: null, // Seria necessário join adicional
          orderId: tx.orderId,
          createdAt: tx.createdAt,
        };
      });

      return {
        walletId: wallet.id,
        userId: wallet.userId,
        userEmail: wallet.user.email,
        userName: wallet.user.name,
        cryptoType: wallet.cryptoType,
        network: wallet.network,
        address: wallet.address,
        balance: wallet.balance,
        lockedBalance: wallet.lockedBalance,
        availableBalance: wallet.availableBalance,
        lastLockDate: lastLockTx?.createdAt || null,
        hasActiveOrder: wallet.ordersAsCollateral.length > 0,
        lockHistory,
      };
    });

    // Calcular totais por crypto
    const totalLockedAmount: Record<string, string> = {};
    for (const wallet of filteredWallets) {
      const key = wallet.cryptoType;
      if (!totalLockedAmount[key]) {
        totalLockedAmount[key] = '0';
      }
      totalLockedAmount[key] = new BigNumber(totalLockedAmount[key])
        .plus(wallet.lockedBalance)
        .toString();
    }

    return {
      success: true,
      data: {
        wallets: mappedWallets,
        summary: {
          totalWallets: mappedWallets.length,
          totalLockedAmount,
        },
      },
    };
  }

  /**
   * Bloquear saldo manualmente (Admin)
   * Move valor de availableBalance para lockedBalance SEM orderId
   */
  static async adminLockBalance(params: {
    walletId: string;
    amount: string;
    category: LockCategory;
    reason: string;
    adminUserId: string;
  }) {
    const { walletId, amount, category, reason, adminUserId } = params;

    // Validar amount
    const amountBN = new BigNumber(amount);
    if (amountBN.isNaN() || amountBN.lte(0)) {
      throw new Error('Valor inválido. Deve ser um número positivo.');
    }

    // Validar reason
    if (!reason || reason.trim().length < 20) {
      throw new Error('Justificativa deve ter pelo menos 20 caracteres.');
    }

    // Validar category
    if (!Object.values(LockCategory).includes(category)) {
      throw new Error('Categoria de bloqueio inválida.');
    }

    // Buscar carteira
    const wallet = await prisma.userWallet.findUnique({
      where: { id: walletId },
      include: { user: true },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    // Verificar saldo disponível suficiente
    const availableBN = new BigNumber(wallet.availableBalance);
    if (availableBN.lt(amountBN)) {
      throw new Error(
        `Saldo disponível insuficiente. Disponível: ${wallet.availableBalance} ${wallet.cryptoType}`
      );
    }

    // Calcular novos saldos
    const newAvailableBalance = availableBN.minus(amountBN).toString();
    const newLockedBalance = new BigNumber(wallet.lockedBalance)
      .plus(amountBN)
      .toString();

    // Executar em transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar carteira
      const updated = await tx.userWallet.update({
        where: { id: walletId },
        data: {
          availableBalance: newAvailableBalance,
          lockedBalance: newLockedBalance,
        },
      });

      // 2. Criar transação de bloqueio
      await tx.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: 'ADMIN_LOCK',
          amount: amount,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance, // Balance total não muda
          lockedBefore: wallet.lockedBalance,
          lockedAfter: newLockedBalance,
          adminUserId,
          adminReason: reason,
          description: `Bloqueio administrativo: ${LockCategoryLabels[category]}`,
          metadata: JSON.stringify({
            category,
            lockedAmount: amount,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_LOCK_BALANCE',
          resource: 'WALLET',
          resourceId: walletId,
          description: `Admin bloqueou ${amount} ${wallet.cryptoType} de ${wallet.user.email}`,
          metadata: JSON.stringify({
            walletId,
            targetUserId: wallet.userId,
            amount,
            category,
            reason,
            previousAvailable: wallet.availableBalance,
            previousLocked: wallet.lockedBalance,
            newAvailable: newAvailableBalance,
            newLocked: newLockedBalance,
          }),
          success: true,
        },
      });

      return updated;
    });

    // Notificar usuário
    try {
      await notificationService.createNotification({
        userId: wallet.userId,
        type: 'BALANCE_LOCKED',
        category: 'WALLET',
        title: '🔒 Saldo Bloqueado',
        message: `${amount} ${wallet.cryptoType} foi bloqueado em sua carteira. Motivo: ${LockCategoryLabels[category]} - ${reason.replace(/^\[(DUAL-APPROVED|OVERRIDE)\]\s*/i, '')}`,
        priority: 'HIGH',
        actionUrl: '/wallets',
        actionLabel: 'Ver Carteiras',
      });
      console.log(`✅ [AdminLock] Notificação criada para usuário ${wallet.userId}`);
    } catch (notifError: any) {
      console.error('❌ [AdminLock] Erro ao criar notificação:', notifError.message);
    }

    return {
      success: true,
      message: 'Saldo bloqueado com sucesso',
      data: {
        walletId,
        user: wallet.user.email,
        cryptoType: wallet.cryptoType,
        network: wallet.network,
        lockedAmount: amount,
        category,
        newLockedBalance,
        newAvailableBalance,
      },
    };
  }

  /**
   * Desbloquear saldo manualmente (Admin)
   * Move valor de lockedBalance para availableBalance SEM orderId
   */
  static async adminUnlockBalance(params: {
    walletId: string;
    amount: string;
    category: LockCategory;
    reason: string;
    adminUserId: string;
  }) {
    const { walletId, amount, category, reason, adminUserId } = params;

    // Validar amount
    const amountBN = new BigNumber(amount);
    if (amountBN.isNaN() || amountBN.lte(0)) {
      throw new Error('Valor inválido. Deve ser um número positivo.');
    }

    // Validar reason
    if (!reason || reason.trim().length < 20) {
      throw new Error('Justificativa deve ter pelo menos 20 caracteres.');
    }

    // Validar category
    if (!Object.values(LockCategory).includes(category)) {
      throw new Error('Categoria de desbloqueio inválida.');
    }

    // Buscar carteira
    const wallet = await prisma.userWallet.findUnique({
      where: { id: walletId },
      include: { user: true },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    // Verificar saldo bloqueado suficiente
    const lockedBN = new BigNumber(wallet.lockedBalance);
    if (lockedBN.lt(amountBN)) {
      throw new Error(
        `Saldo bloqueado insuficiente. Bloqueado: ${wallet.lockedBalance} ${wallet.cryptoType}`
      );
    }

    // Calcular novos saldos
    const newLockedBalance = lockedBN.minus(amountBN).toString();
    const newAvailableBalance = new BigNumber(wallet.availableBalance)
      .plus(amountBN)
      .toString();

    // Executar em transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar carteira
      const updated = await tx.userWallet.update({
        where: { id: walletId },
        data: {
          availableBalance: newAvailableBalance,
          lockedBalance: newLockedBalance,
        },
      });

      // 2. Criar transação de desbloqueio
      await tx.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: 'ADMIN_UNLOCK',
          amount: amount,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance, // Balance total não muda
          lockedBefore: wallet.lockedBalance,
          lockedAfter: newLockedBalance,
          adminUserId,
          adminReason: reason,
          description: `Desbloqueio administrativo: ${LockCategoryLabels[category]}`,
          metadata: JSON.stringify({
            category,
            unlockedAmount: amount,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_UNLOCK_BALANCE',
          resource: 'WALLET',
          resourceId: walletId,
          description: `Admin desbloqueou ${amount} ${wallet.cryptoType} de ${wallet.user.email}`,
          metadata: JSON.stringify({
            walletId,
            targetUserId: wallet.userId,
            amount,
            category,
            reason,
            previousAvailable: wallet.availableBalance,
            previousLocked: wallet.lockedBalance,
            newAvailable: newAvailableBalance,
            newLocked: newLockedBalance,
          }),
          success: true,
        },
      });

      return updated;
    });

    // Notificar usuário
    try {
      await notificationService.createNotification({
        userId: wallet.userId,
        type: 'BALANCE_UNLOCKED',
        category: 'WALLET',
        title: '🔓 Saldo Desbloqueado',
        message: `${amount} ${wallet.cryptoType} foi desbloqueado em sua carteira. Motivo: ${LockCategoryLabels[category]} - ${reason.replace(/^\[(DUAL-APPROVED|OVERRIDE)\]\s*/i, '')}`,
        priority: 'NORMAL',
        actionUrl: '/wallets',
        actionLabel: 'Ver Carteiras',
      });
      console.log(`✅ [AdminUnlock] Notificação criada para usuário ${wallet.userId}`);
    } catch (notifError: any) {
      console.error('❌ [AdminUnlock] Erro ao criar notificação:', notifError.message);
    }

    return {
      success: true,
      message: 'Saldo desbloqueado com sucesso',
      data: {
        walletId,
        user: wallet.user.email,
        cryptoType: wallet.cryptoType,
        network: wallet.network,
        unlockedAmount: amount,
        category,
        newLockedBalance,
        newAvailableBalance,
      },
    };
  }
}
