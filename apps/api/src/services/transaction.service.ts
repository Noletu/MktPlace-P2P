import { PrismaClient, Transaction } from '@prisma/client';
import { TransactionStatus, SubmitProofInput, ValidateProofInput, DisputeInput } from '../types/transaction.types';
import { OrderStatus } from '../types/order.types';

const prisma = new PrismaClient();

export class TransactionService {
  /**
   * Submeter comprovante de pagamento
   */
  async submitProof(input: SubmitProofInput): Promise<Transaction> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      include: { order: true },
    });

    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    if (transaction.payerId !== input.userId) {
      throw new Error('Você não tem permissão para enviar comprovante desta transação');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Esta transação não está aguardando comprovante');
    }

    // Atualizar transação com comprovante
    const updatedTransaction = await prisma.transaction.update({
      where: { id: input.transactionId },
      data: {
        comprovanteData: input.comprovanteData,
        comprovanteUrl: input.comprovanteUrl,
        status: TransactionStatus.VALIDATING,
      },
    });

    // Atualizar status do pedido
    await prisma.order.update({
      where: { id: transaction.orderId },
      data: { status: OrderStatus.PAYMENT_SENT },
    });

    return updatedTransaction;
  }

  /**
   * Validar comprovante (manual ou automático)
   */
  async validateProof(input: ValidateProofInput): Promise<Transaction> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      include: { order: true },
    });

    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    if (transaction.status !== TransactionStatus.VALIDATING) {
      throw new Error('Esta transação não está em validação');
    }

    if (input.approved) {
      // Aprovar transação
      const updatedTransaction = await prisma.transaction.update({
        where: { id: input.transactionId },
        data: {
          status: TransactionStatus.APPROVED,
          validationScore: input.validationScore || 100,
          validatedBy: input.validatedBy,
          validatedAt: new Date(),
        },
      });

      // Atualizar status do pedido para COMPLETED
      await prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Atualizar reputação dos usuários
      await this.updateUserReputation(transaction.payerId, true);
      await this.updateUserReputation(transaction.order.userId, true);

      // TODO: Criar Fee records e transferir crypto

      return updatedTransaction;
    } else {
      // Rejeitar transação
      const updatedTransaction = await prisma.transaction.update({
        where: { id: input.transactionId },
        data: {
          status: TransactionStatus.REJECTED,
          validationScore: input.validationScore || 0,
          validatedBy: input.validatedBy,
          validatedAt: new Date(),
        },
      });

      // Atualizar status do pedido para PENDING novamente
      await prisma.order.update({
        where: { id: transaction.orderId },
        data: { status: OrderStatus.PENDING },
      });

      return updatedTransaction;
    }
  }

  /**
   * Criar disputa
   */
  async createDispute(input: DisputeInput): Promise<Transaction> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      include: { order: true },
    });

    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    // Verificar se o usuário é parte da transação
    const isParticipant =
      transaction.payerId === input.userId ||
      transaction.order.userId === input.userId;

    if (!isParticipant) {
      throw new Error('Você não tem permissão para disputar esta transação');
    }

    // Atualizar transação para status DISPUTED
    const updatedTransaction = await prisma.transaction.update({
      where: { id: input.transactionId },
      data: {
        status: TransactionStatus.DISPUTED,
        disputeReason: input.reason,
        disputeData: input.disputeData ? JSON.stringify(input.disputeData) : null,
      },
    });

    // Atualizar pedido para DISPUTED
    await prisma.order.update({
      where: { id: transaction.orderId },
      data: { status: OrderStatus.DISPUTED },
    });

    return updatedTransaction;
  }

  /**
   * Atualizar reputação do usuário
   */
  async updateUserReputation(userId: string, success: boolean): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const newTotalTransactions = user.totalTransactions + 1;
    const newSuccessfulTransactions = success
      ? user.successfulTransactions + 1
      : user.successfulTransactions;

    // Calcular novo score (0-100)
    const successRate = newSuccessfulTransactions / newTotalTransactions;
    const reputationScore = Math.round(successRate * 100);

    await prisma.user.update({
      where: { id: userId },
      data: {
        totalTransactions: newTotalTransactions,
        successfulTransactions: newSuccessfulTransactions,
        reputationScore,
      },
    });
  }

  /**
   * Obter transação por ID
   */
  async getTransactionById(transactionId: string): Promise<Transaction | null> {
    return await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                reputationScore: true,
              },
            },
          },
        },
        payer: {
          select: {
            id: true,
            name: true,
            email: true,
            reputationScore: true,
          },
        },
        fees: true,
      },
    });
  }

  /**
   * Obter transações do usuário
   */
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return await prisma.transaction.findMany({
      where: { payerId: userId },
      include: {
        order: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Auto-validar comprovante (validação básica automática)
   * TODO: Implementar validação mais sofisticada com OCR/AI
   */
  async autoValidateProof(transactionId: string): Promise<void> {
    const transaction = await this.getTransactionById(transactionId);

    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    // Validação básica: verificar se comprovante existe
    if (!transaction.comprovanteData && !transaction.comprovanteUrl) {
      throw new Error('Comprovante não encontrado');
    }

    // Auto-aprovar com score baixo (será melhorado com validação real)
    await this.validateProof({
      transactionId,
      validatedBy: 'SYSTEM_AUTO',
      approved: true,
      validationScore: 70, // Score baixo para validação automática
    });
  }
}

export const transactionService = new TransactionService();
