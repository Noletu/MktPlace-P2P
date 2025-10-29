import { prisma } from '../utils/prisma';

/**
 * Tipos de transações de colateral
 */
export enum CollateralTransactionType {
  DEPOSIT = 'DEPOSIT',       // Depósito na plataforma
  LOCK = 'LOCK',             // Bloqueio para pedido
  UNLOCK = 'UNLOCK',         // Desbloqueio após pedido cancelado/timeout
  DEDUCT = 'DEDUCT',         // Dedução após pedido completado (gasto permanente)
  REFUND = 'REFUND',         // Devolução ao usuário
  WITHDRAWAL = 'WITHDRAWAL', // Saque do saldo
  TRANSFER = 'TRANSFER',     // Transferência interna
}

export class CollateralTransactionService {
  /**
   * Registrar transação de colateral (auditoria)
   * CRITICAL: Todo lock/unlock deve ser registrado
   */
  async recordTransaction(
    userId: string,
    balanceId: string,
    type: CollateralTransactionType,
    amount: string,
    balanceBefore: string,
    balanceAfter: string,
    metadata?: {
      orderId?: string;
      txHash?: string;
      network?: string;
      description?: string;
      additionalData?: Record<string, any>;
    }
  ) {
    const transaction = await prisma.collateralTransaction.create({
      data: {
        userId,
        balanceId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        orderId: metadata?.orderId,
        txHash: metadata?.txHash,
        network: metadata?.network,
        description: metadata?.description,
        metadata: metadata?.additionalData ? JSON.stringify(metadata.additionalData) : null,
      },
    });

    console.log(`📝 Transação de colateral registrada: ${type} - ${amount}`);
    console.log(`   Usuário: ${userId}`);
    console.log(`   Antes: ${balanceBefore} → Depois: ${balanceAfter}`);
    if (metadata?.orderId) {
      console.log(`   Pedido: ${metadata.orderId}`);
    }

    return transaction;
  }

  /**
   * Obter histórico de transações do usuário
   */
  async getTransactionHistory(
    userId: string,
    options?: {
      cryptoType?: string;
      network?: string;
      type?: CollateralTransactionType;
      limit?: number;
      offset?: number;
    }
  ) {
    const transactions = await prisma.collateralTransaction.findMany({
      where: {
        userId,
        type: options?.type,
      },
      include: {
        balance: true,
        order: {
          select: {
            id: true,
            type: true,
            status: true,
            cryptoType: true,
            cryptoNetwork: true,
            brlAmount: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    // Filtrar por cripto/rede se especificado
    if (options?.cryptoType || options?.network) {
      return transactions.filter((tx) => {
        const matchCrypto = !options.cryptoType || tx.balance.cryptoType === options.cryptoType;
        const matchNetwork = !options.network || tx.balance.network === options.network;
        return matchCrypto && matchNetwork;
      });
    }

    return transactions;
  }

  /**
   * Obter transações de um pedido específico
   */
  async getOrderTransactions(orderId: string) {
    const transactions = await prisma.collateralTransaction.findMany({
      where: { orderId },
      include: {
        balance: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return transactions;
  }

  /**
   * Obter estatísticas de colateral do usuário
   */
  async getUserCollateralStats(userId: string, cryptoType?: string, network?: string) {
    const transactions = await this.getTransactionHistory(userId, {
      cryptoType,
      network,
      limit: 10000, // Pegar todas para estatísticas
    });

    const stats = {
      totalDeposits: 0,
      totalLocks: 0,
      totalUnlocks: 0,
      totalWithdrawals: 0,
      totalRefunds: 0,
      activeOrders: 0,
      completedOrders: 0,
    };

    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount);

      switch (tx.type) {
        case CollateralTransactionType.DEPOSIT:
          stats.totalDeposits += amount;
          break;
        case CollateralTransactionType.LOCK:
          stats.totalLocks += amount;
          if (tx.order && tx.order.status !== 'COMPLETED' && tx.order.status !== 'CANCELLED') {
            stats.activeOrders++;
          }
          if (tx.order && tx.order.status === 'COMPLETED') {
            stats.completedOrders++;
          }
          break;
        case CollateralTransactionType.UNLOCK:
          stats.totalUnlocks += amount;
          break;
        case CollateralTransactionType.WITHDRAWAL:
          stats.totalWithdrawals += amount;
          break;
        case CollateralTransactionType.REFUND:
          stats.totalRefunds += amount;
          break;
      }
    });

    return {
      ...stats,
      transactionCount: transactions.length,
      cryptoType: cryptoType || 'ALL',
      network: network || 'ALL',
    };
  }

  /**
   * Verificar inconsistências de saldo (reconciliação)
   * Job diário de segurança
   */
  async reconcileBalance(balanceId: string) {
    const balance = await prisma.internalBalance.findUnique({
      where: { id: balanceId },
      include: {
        collateralTransactions: {
          orderBy: { createdAt: 'asc' },
        },
        orders: {
          where: {
            collateralSource: 'INTERNAL_BALANCE',
            collateralLocked: true,
          },
        },
      },
    });

    if (!balance) {
      throw new Error('Saldo não encontrado');
    }

    // Calcular saldo esperado baseado em transações
    let expectedBalance = 0;
    balance.collateralTransactions.forEach((tx) => {
      const amount = parseFloat(tx.amount);
      if (tx.type === CollateralTransactionType.DEPOSIT) {
        expectedBalance += amount;
      } else if (tx.type === CollateralTransactionType.WITHDRAWAL) {
        expectedBalance -= amount;
      }
    });

    // Calcular locked esperado baseado em pedidos ativos
    let expectedLocked = 0;
    balance.orders.forEach((order) => {
      if (order.collateralLockedAmount) {
        expectedLocked += parseFloat(order.collateralLockedAmount);
      }
    });

    const actualBalance = parseFloat(balance.balance);
    const actualLocked = parseFloat(balance.lockedAmount);

    const balanceMatch = Math.abs(actualBalance - expectedBalance) < 0.00000001; // 1 satoshi tolerance
    const lockedMatch = Math.abs(actualLocked - expectedLocked) < 0.00000001;

    if (!balanceMatch || !lockedMatch) {
      console.error('🚨 INCONSISTÊNCIA DE SALDO DETECTADA!');
      console.error(`   Balance ID: ${balanceId}`);
      console.error(`   Esperado: ${expectedBalance.toFixed(8)}, Atual: ${actualBalance.toFixed(8)}`);
      console.error(`   Locked Esperado: ${expectedLocked.toFixed(8)}, Atual: ${actualLocked.toFixed(8)}`);

      // Registrar no AuditLog
      await prisma.auditLog.create({
        data: {
          userId: balance.userId,
          action: 'BALANCE_RECONCILIATION_FAILED',
          resource: 'INTERNAL_BALANCE',
          resourceId: balanceId,
          success: false,
          errorMessage: `Balance mismatch: expected ${expectedBalance}, got ${actualBalance}. Locked: expected ${expectedLocked}, got ${actualLocked}`,
          metadata: JSON.stringify({
            expectedBalance,
            actualBalance,
            expectedLocked,
            actualLocked,
            transactionCount: balance.collateralTransactions.length,
            activeOrders: balance.orders.length,
          }),
        },
      });

      return {
        success: false,
        balanceId,
        expectedBalance,
        actualBalance,
        expectedLocked,
        actualLocked,
        discrepancy: {
          balance: actualBalance - expectedBalance,
          locked: actualLocked - expectedLocked,
        },
      };
    }

    console.log(`✅ Reconciliação OK: ${balanceId}`);
    return {
      success: true,
      balanceId,
      balance: actualBalance,
      locked: actualLocked,
    };
  }

  /**
   * Reconciliar todos os saldos (job diário)
   */
  async reconcileAllBalances() {
    const balances = await prisma.internalBalance.findMany();

    const results = await Promise.all(
      balances.map((balance) => this.reconcileBalance(balance.id))
    );

    const failed = results.filter((r) => !r.success);

    if (failed.length > 0) {
      console.error(`🚨 ${failed.length} saldos com inconsistências detectadas!`);
    } else {
      console.log(`✅ Todos os ${results.length} saldos estão consistentes`);
    }

    return {
      total: results.length,
      success: results.length - failed.length,
      failed: failed.length,
      failedBalances: failed,
    };
  }
}

export const collateralTransactionService = new CollateralTransactionService();
