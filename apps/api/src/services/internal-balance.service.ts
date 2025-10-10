import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}

export const internalBalanceService = new InternalBalanceService();
