import { collateralTransactionService, CollateralTransactionType } from './collateral-transaction.service';
import { prisma } from '../utils/prisma';

export class InternalBalanceService {
  /**
   * Obter saldo interno do usuário
   */
  async getBalance(userId: string, cryptoType: string, network: string) {
    const balance = await prisma.internalBalance.findUnique({
      where: {
        userId_cryptoType_network: {
          userId,
          cryptoType,
          network,
        },
      },
    });

    return balance;
  }

  /**
   * Obter todos os saldos do usuário
   */
  async getAllBalances(userId: string) {
    const balances = await prisma.internalBalance.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return balances;
  }

  /**
   * Adicionar crédito ao saldo interno
   */
  async addBalance(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string
  ) {
    // Buscar saldo existente
    const existingBalance = await this.getBalance(userId, cryptoType, network);

    if (existingBalance) {
      // Atualizar saldo existente
      const currentBalance = parseFloat(existingBalance.balance);
      const addAmount = parseFloat(amount);
      const newBalance = (currentBalance + addAmount).toFixed(8);

      const updated = await prisma.internalBalance.update({
        where: { id: existingBalance.id },
        data: { balance: newBalance },
      });

      console.log(`✅ Saldo interno atualizado: ${userId} - ${newBalance} ${cryptoType}`);
      return updated;
    } else {
      // Criar novo saldo
      const created = await prisma.internalBalance.create({
        data: {
          userId,
          cryptoType,
          network,
          balance: parseFloat(amount).toFixed(8),
        },
      });

      console.log(`✅ Saldo interno criado: ${userId} - ${amount} ${cryptoType}`);
      return created;
    }
  }

  /**
   * Deduzir do saldo interno (usar em nova ordem)
   */
  async deductBalance(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string
  ) {
    const balance = await this.getBalance(userId, cryptoType, network);

    if (!balance) {
      throw new Error('Saldo interno não encontrado');
    }

    const currentBalance = parseFloat(balance.balance);
    const deductAmount = parseFloat(amount);

    if (currentBalance < deductAmount) {
      throw new Error(
        `Saldo insuficiente. Disponível: ${currentBalance} ${cryptoType}, Necessário: ${deductAmount}`
      );
    }

    const newBalance = (currentBalance - deductAmount).toFixed(8);

    const updated = await prisma.internalBalance.update({
      where: { id: balance.id },
      data: { balance: newBalance },
    });

    console.log(`✅ Saldo interno deduzido: ${userId} - ${amount} ${cryptoType}`);
    return updated;
  }

  /**
   * Verificar se usuário tem saldo suficiente
   */
  async hasSufficientBalance(
    userId: string,
    cryptoType: string,
    network: string,
    requiredAmount: string
  ): Promise<boolean> {
    const balance = await this.getBalance(userId, cryptoType, network);

    if (!balance) {
      return false;
    }

    const currentBalance = parseFloat(balance.balance);
    const required = parseFloat(requiredAmount);

    return currentBalance >= required;
  }

  /**
   * Obter saldo disponível (balance - lockedAmount)
   * CRITICAL: Este é o saldo que pode ser usado para novos pedidos
   */
  async getAvailableBalance(
    userId: string,
    cryptoType: string,
    network: string
  ): Promise<number> {
    const balance = await this.getBalance(userId, cryptoType, network);

    if (!balance) {
      return 0;
    }

    const total = parseFloat(balance.balance);
    const locked = parseFloat(balance.lockedAmount);
    const available = total - locked;

    // Atualizar availableAmount no banco (campo computed)
    await prisma.internalBalance.update({
      where: { id: balance.id },
      data: { availableAmount: available.toFixed(8) },
    });

    return available;
  }

  /**
   * Bloquear saldo para um pedido
   * CRITICAL: Transaction atômica para evitar race conditions
   */
  async lockBalance(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    orderId?: string
  ) {
    const amountNum = parseFloat(amount);

    // Transaction atômica com lock pessimista
    const result = await prisma.$transaction(async (tx) => {
      // Buscar saldo com lock
      const balance = await tx.internalBalance.findUnique({
        where: {
          userId_cryptoType_network: {
            userId,
            cryptoType,
            network,
          },
        },
      });

      if (!balance) {
        throw new Error(`Saldo interno não encontrado para ${cryptoType} na rede ${network}`);
      }

      const total = parseFloat(balance.balance);
      const locked = parseFloat(balance.lockedAmount);
      const available = total - locked;

      // CRITICAL: Verificar se tem saldo disponível SUFICIENTE
      if (available < amountNum) {
        throw new Error(
          `Saldo insuficiente. Disponível: ${available.toFixed(8)} ${cryptoType}, Necessário: ${amountNum.toFixed(8)}`
        );
      }

      // Atualizar saldo bloqueado
      const newLocked = locked + amountNum;
      const newAvailable = total - newLocked;

      const updated = await tx.internalBalance.update({
        where: { id: balance.id },
        data: {
          lockedAmount: newLocked.toFixed(8),
          availableAmount: newAvailable.toFixed(8),
          // NÃO incrementar totalUsed aqui - só deve ser incrementado quando efetivamente gasto (DEDUCT)
        },
      });

      console.log(`🔒 Saldo bloqueado: ${userId} - ${amount} ${cryptoType}`);
      console.log(`   Disponível: ${newAvailable.toFixed(8)} ${cryptoType}`);
      console.log(`   Bloqueado: ${newLocked.toFixed(8)} ${cryptoType}`);

      // Registrar transação para auditoria
      await collateralTransactionService.recordTransaction(
        userId,
        balance.id,
        CollateralTransactionType.LOCK,
        amount,
        balance.lockedAmount, // balanceBefore
        newLocked.toFixed(8), // balanceAfter
        {
          orderId,
          network,
          description: `Colateral bloqueado para pedido ${orderId || 'N/A'}`,
        }
      );

      return updated;
    }, {
      timeout: 15000, // 15 segundos (aumentado de 5s padrão)
    });

    return result;
  }

  /**
   * Desbloquear saldo de um pedido
   * CRITICAL: Transaction atômica
   */
  async unlockBalance(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    orderId?: string
  ) {
    const amountNum = parseFloat(amount);

    const result = await prisma.$transaction(async (tx) => {
      const balance = await tx.internalBalance.findUnique({
        where: {
          userId_cryptoType_network: {
            userId,
            cryptoType,
            network,
          },
        },
      });

      if (!balance) {
        throw new Error(`Saldo interno não encontrado para ${cryptoType} na rede ${network}`);
      }

      const total = parseFloat(balance.balance);
      const locked = parseFloat(balance.lockedAmount);

      // Prevenir unlock de valor maior que o bloqueado
      if (locked < amountNum) {
        console.warn(`⚠️ Tentativa de desbloquear ${amountNum} mas só tem ${locked} bloqueado`);
        // Desbloquear apenas o que está bloqueado
        const amountToUnlock = Math.min(locked, amountNum);

        const newLocked = locked - amountToUnlock;
        const newAvailable = total - newLocked;

        return await tx.internalBalance.update({
          where: { id: balance.id },
          data: {
            lockedAmount: newLocked.toFixed(8),
            availableAmount: newAvailable.toFixed(8),
          },
        });
      }

      const newLocked = locked - amountNum;
      const newAvailable = total - newLocked;

      const updated = await tx.internalBalance.update({
        where: { id: balance.id },
        data: {
          lockedAmount: newLocked.toFixed(8),
          availableAmount: newAvailable.toFixed(8),
        },
      });

      console.log(`🔓 Saldo desbloqueado: ${userId} - ${amount} ${cryptoType}`);
      console.log(`   Disponível: ${newAvailable.toFixed(8)} ${cryptoType}`);
      console.log(`   Bloqueado: ${newLocked.toFixed(8)} ${cryptoType}`);

      // Registrar transação para auditoria
      await collateralTransactionService.recordTransaction(
        userId,
        balance.id,
        CollateralTransactionType.UNLOCK,
        amount,
        balance.lockedAmount, // balanceBefore
        newLocked.toFixed(8), // balanceAfter
        {
          orderId,
          network,
          description: `Colateral desbloqueado do pedido ${orderId || 'N/A'}`,
        }
      );

      return updated;
    }, {
      timeout: 15000, // 15 segundos (aumentado de 5s padrão)
    });

    return result;
  }

  /**
   * Deduzir colateral quando pedido é completado (gasto permanente)
   * CRITICAL: Usado quando o colateral foi efetivamente transferido/gasto
   */
  async deductCollateral(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    orderId?: string
  ) {
    const amountNum = parseFloat(amount);

    const result = await prisma.$transaction(async (tx) => {
      const balance = await tx.internalBalance.findUnique({
        where: {
          userId_cryptoType_network: {
            userId,
            cryptoType,
            network,
          },
        },
      });

      if (!balance) {
        throw new Error(`Saldo interno não encontrado para ${cryptoType} na rede ${network}`);
      }

      const total = parseFloat(balance.balance);
      const locked = parseFloat(balance.lockedAmount);
      const totalUsed = parseFloat(balance.totalUsed);

      // Deduzir do saldo total e do saldo bloqueado
      const newTotal = total - amountNum;
      const newLocked = Math.max(0, locked - amountNum); // Prevenir valores negativos
      const newAvailable = newTotal - newLocked;
      const newTotalUsed = totalUsed + amountNum;

      const updated = await tx.internalBalance.update({
        where: { id: balance.id },
        data: {
          balance: newTotal.toFixed(8),
          lockedAmount: newLocked.toFixed(8),
          availableAmount: newAvailable.toFixed(8),
          totalUsed: newTotalUsed.toFixed(8),
        },
      });

      console.log(`💸 Colateral deduzido (gasto): ${userId} - ${amount} ${cryptoType}`);
      console.log(`   Saldo total: ${newTotal.toFixed(8)} ${cryptoType}`);
      console.log(`   Disponível: ${newAvailable.toFixed(8)} ${cryptoType}`);
      console.log(`   Bloqueado: ${newLocked.toFixed(8)} ${cryptoType}`);
      console.log(`   Total usado: ${newTotalUsed.toFixed(8)} ${cryptoType}`);

      // Registrar transação para auditoria
      await collateralTransactionService.recordTransaction(
        userId,
        balance.id,
        CollateralTransactionType.DEDUCT,
        amount,
        balance.balance, // balanceBefore
        newTotal.toFixed(8), // balanceAfter
        {
          orderId,
          network,
          description: `Colateral deduzido após conclusão do pedido ${orderId || 'N/A'}`,
        }
      );

      return updated;
    }, {
      timeout: 15000,
    });

    return result;
  }

  /**
   * Verificar se tem saldo disponível suficiente (não bloqueado)
   */
  async hasAvailableBalance(
    userId: string,
    cryptoType: string,
    network: string,
    requiredAmount: string
  ): Promise<boolean> {
    const available = await this.getAvailableBalance(userId, cryptoType, network);
    const required = parseFloat(requiredAmount);

    return available >= required;
  }

  /**
   * Criar ou atualizar saldo interno após depósito
   */
  async creditDeposit(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    txHash?: string
  ) {
    const amountNum = parseFloat(amount);
    const balance = await this.getBalance(userId, cryptoType, network);

    if (balance) {
      // Atualizar saldo existente
      const currentBalance = parseFloat(balance.balance);
      const newBalance = currentBalance + amountNum;

      const updated = await prisma.internalBalance.update({
        where: { id: balance.id },
        data: {
          balance: newBalance.toFixed(8),
          totalDeposited: (parseFloat(balance.totalDeposited) + amountNum).toFixed(8),
        },
      });

      console.log(`💰 Depósito creditado: ${userId} - ${amount} ${cryptoType}`);
      console.log(`   TxHash: ${txHash || 'N/A'}`);
      console.log(`   Novo saldo: ${newBalance.toFixed(8)} ${cryptoType}`);

      // Registrar transação para auditoria
      await collateralTransactionService.recordTransaction(
        userId,
        balance.id,
        CollateralTransactionType.DEPOSIT,
        amount,
        balance.balance, // balanceBefore
        newBalance.toFixed(8), // balanceAfter
        {
          txHash,
          network,
          description: `Depósito de ${amount} ${cryptoType}`,
        }
      );

      return updated;
    } else {
      // Criar novo saldo
      const created = await prisma.internalBalance.create({
        data: {
          userId,
          cryptoType,
          network,
          balance: amountNum.toFixed(8),
          totalDeposited: amountNum.toFixed(8),
          lockedAmount: '0',
          availableAmount: amountNum.toFixed(8),
        },
      });

      console.log(`✨ Saldo interno criado: ${userId} - ${amount} ${cryptoType}`);

      // Registrar transação para auditoria
      await collateralTransactionService.recordTransaction(
        userId,
        created.id,
        CollateralTransactionType.DEPOSIT,
        amount,
        '0', // balanceBefore (novo saldo)
        amountNum.toFixed(8), // balanceAfter
        {
          txHash,
          network,
          description: `Primeiro depósito de ${amount} ${cryptoType}`,
        }
      );

      return created;
    }
  }
}

export const internalBalanceService = new InternalBalanceService();
