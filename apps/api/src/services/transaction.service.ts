import { Transaction } from '@prisma/client';
import { TransactionStatus, SubmitProofInput, ValidateProofInput, DisputeInput } from '../types/transaction.types';
import { OrderStatus } from '../types/order.types';
import { notificationService } from './notification.service';
import { prisma } from '../utils/prisma';
import { CollateralTransactionType } from './collateral-transaction.service';

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

    // Enviar notificação para o vendedor
    setImmediate(async () => {
      try {
        await notificationService.notifyPaymentSent(
          transaction.orderId,
          transaction.order.userId, // seller
          transaction.payerId // buyer
        );
      } catch (error) {
        console.error('Failed to send payment sent notification:', error);
      }
    });

    return updatedTransaction;
  }

  /**
   * Validar comprovante (manual ou automático)
   * REFATORADO: Todas as operações críticas em transação atômica única
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
      // IDEMPOTÊNCIA: Verificar se já foi processado
      const orderCheck = await prisma.order.findUnique({
        where: { id: transaction.orderId },
        select: { status: true, collateralLocked: true },
      });

      if (orderCheck?.status === OrderStatus.COMPLETED && !orderCheck.collateralLocked) {
        console.log(`⚠️ Pedido ${transaction.orderId} já foi completado anteriormente (idempotência)`);
        // Retornar transação existente sem reprocessar
        return transaction;
      }

      // TRANSAÇÃO ATÔMICA: Incluir TODAS as operações críticas
      const updatedTransaction = await prisma.$transaction(async (tx) => {
        // 1. Aprovar transação
        const approved = await tx.transaction.update({
          where: { id: input.transactionId },
          data: {
            status: TransactionStatus.APPROVED,
            validationScore: input.validationScore || 100,
            validatedBy: input.validatedBy,
            validatedAt: new Date(),
          },
        });

        // 2. Atualizar status do pedido para COMPLETED
        await tx.order.update({
          where: { id: transaction.orderId },
          data: {
            status: OrderStatus.COMPLETED,
            completedAt: new Date(),
            collateralLocked: false,
            collateralUnlockedAt: new Date(),
          },
        });

        console.log(`✅ Transação aprovada e pedido completado: ${transaction.orderId}`);

        // 3. Processar saldo interno DENTRO da mesma transação atômica
        if (transaction.order.collateralSource === 'INTERNAL_BALANCE' &&
            transaction.order.collateralLockedAmount) {

          const userId = transaction.order.userId;
          const cryptoType = transaction.order.cryptoType;
          const network = transaction.order.cryptoNetwork;
          const amountStr = transaction.order.collateralLockedAmount;
          const amountNum = parseFloat(amountStr);

          // Buscar saldo interno
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

          // Calcular novos valores
          const total = parseFloat(balance.balance);
          const locked = parseFloat(balance.lockedAmount);
          const totalUsed = parseFloat(balance.totalUsed);

          const newTotal = total - amountNum;
          const newLocked = Math.max(0, locked - amountNum);
          const newAvailable = newTotal - newLocked;
          const newTotalUsed = totalUsed + amountNum;

          // 4. Atualizar InternalBalance (deduct + unlock)
          await tx.internalBalance.update({
            where: { id: balance.id },
            data: {
              balance: newTotal.toFixed(8),
              lockedAmount: newLocked.toFixed(8),
              availableAmount: newAvailable.toFixed(8),
              totalUsed: newTotalUsed.toFixed(8),
            },
          });

          console.log(`💸 Colateral deduzido atomicamente: ${amountStr} ${cryptoType}`);
          console.log(`   Saldo total: ${newTotal.toFixed(8)} ${cryptoType}`);
          console.log(`   Disponível: ${newAvailable.toFixed(8)} ${cryptoType}`);
          console.log(`   Bloqueado: ${newLocked.toFixed(8)} ${cryptoType}`);
          console.log(`   Total usado: ${newTotalUsed.toFixed(8)} ${cryptoType}`);

          // 5. Criar registro de auditoria (CollateralTransaction)
          await tx.collateralTransaction.create({
            data: {
              userId,
              balanceId: balance.id,
              type: CollateralTransactionType.DEDUCT,
              amount: amountStr,
              balanceBefore: balance.balance,
              balanceAfter: newTotal.toFixed(8),
              orderId: transaction.orderId,
              network,
              description: `Colateral deduzido após conclusão do pedido ${transaction.orderId}`,
            },
          });

          console.log(`📝 Transação de colateral registrada para auditoria`);
        }

        return approved;
      }, {
        timeout: 60000, // 60 segundos (aumentado para operações complexas)
        maxWait: 20000, // máximo 20s esperando lock
      });

      console.log(`✅ TRANSAÇÃO ATÔMICA COMPLETA com sucesso!`);

      // Atualizar reputação dos usuários (fora da transação crítica)
      setImmediate(async () => {
        try {
          await this.updateUserReputation(transaction.payerId, true);
          await this.updateUserReputation(transaction.order.userId, true);
        } catch (error) {
          console.error('Failed to update user reputation:', error);
        }
      });

      // Enviar notificações de pagamento validado (fora da transação crítica)
      setImmediate(async () => {
        try {
          await notificationService.notifyPaymentValidated(
            transaction.orderId,
            transaction.payerId,
            transaction.order.cryptoAmount,
            transaction.order.cryptoType
          );

          await notificationService.notifyOrderCompleted(
            transaction.orderId,
            transaction.order.userId,
            true
          );

          await notificationService.notifyOrderCompleted(
            transaction.orderId,
            transaction.payerId,
            true
          );
        } catch (error) {
          console.error('Failed to send payment validated notifications:', error);
        }
      });

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
   * Histórico completo de transações com filtros avançados
   */
  async getTransactionHistory(filters: {
    userId: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    type?: string; // SENT (pagou) ou RECEIVED (recebeu)
    limit?: number;
    offset?: number;
  }) {
    const where: any = {
      OR: [
        { payerId: filters.userId }, // Transações que pagou
        { order: { userId: filters.userId } }, // Pedidos que criou e recebeu pagamento
      ],
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // Filtro por tipo
    if (filters.type === 'SENT') {
      where.OR = [{ payerId: filters.userId }];
    } else if (filters.type === 'RECEIVED') {
      where.OR = [{ order: { userId: filters.userId } }];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    // Adicionar tipo (SENT ou RECEIVED) em cada transação
    const transactionsWithType = transactions.map(tx => ({
      ...tx,
      transactionType: tx.payerId === filters.userId ? 'SENT' : 'RECEIVED',
    }));

    return { transactions: transactionsWithType, total };
  }

  /**
   * Estatísticas de transações do usuário
   */
  async getTransactionStats(userId: string, period?: { startDate?: Date; endDate?: Date }) {
    const where: any = {
      OR: [
        { payerId: userId },
        { order: { userId: userId } },
      ],
    };

    if (period?.startDate || period?.endDate) {
      where.createdAt = {};
      if (period.startDate) where.createdAt.gte = period.startDate;
      if (period.endDate) where.createdAt.lte = period.endDate;
    }

    const [
      totalTransactions,
      sentTransactions,
      receivedTransactions,
      approvedTransactions,
      rejectedTransactions,
      pendingTransactions,
      byStatus,
    ] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, payerId: userId } }),
      prisma.transaction.count({ where: { ...where, order: { userId } } }),
      prisma.transaction.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.transaction.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.transaction.count({ where: { ...where, status: 'PENDING' } }),
      prisma.transaction.groupBy({
        by: ['status'],
        where,
        _count: true,
        orderBy: {
          _count: {
            status: 'desc',
          },
        },
      }),
    ]);

    // Calcular volume total transacionado
    const sentTxs = await prisma.transaction.findMany({
      where: { payerId: userId, status: 'APPROVED' },
      include: { order: true },
    });

    const receivedTxs = await prisma.transaction.findMany({
      where: { order: { userId }, status: 'APPROVED' },
      include: { order: true },
    });

    const totalSent = sentTxs.reduce((sum, tx) => sum + parseFloat(tx.order.brlAmount), 0);
    const totalReceived = receivedTxs.reduce((sum, tx) => sum + parseFloat(tx.order.brlAmount), 0);

    return {
      totalTransactions,
      sentTransactions,
      receivedTransactions,
      approvedTransactions,
      rejectedTransactions,
      pendingTransactions,
      successRate: totalTransactions > 0 ? (approvedTransactions / totalTransactions) * 100 : 0,
      totalSent: totalSent.toFixed(2),
      totalReceived: totalReceived.toFixed(2),
      totalVolume: (totalSent + totalReceived).toFixed(2),
      byStatus,
    };
  }

  /**
   * Timeline de atividades (últimas ações do usuário)
   */
  async getActivityTimeline(userId: string, limit: number = 20) {
    // Buscar transações
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { payerId: userId },
          { order: { userId } },
        ],
      },
      include: {
        order: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        payer: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Buscar pedidos criados
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Combinar e ordenar por data
    const timeline = [
      ...transactions.map(tx => ({
        type: tx.payerId === userId ? 'PAYMENT_SENT' : 'PAYMENT_RECEIVED',
        date: tx.createdAt,
        status: tx.status,
        amount: tx.order.brlAmount,
        crypto: tx.order.cryptoType,
        orderId: tx.orderId,
        transactionId: tx.id,
        description: tx.payerId === userId
          ? `Pagamento de R$ ${tx.order.brlAmount} enviado`
          : `Pagamento de R$ ${tx.order.brlAmount} recebido`,
      })),
      ...orders.map(order => ({
        type: 'ORDER_CREATED',
        date: order.createdAt,
        status: order.status,
        amount: order.brlAmount,
        crypto: order.cryptoType,
        orderId: order.id,
        description: `Pedido de ${order.type} criado no valor de R$ ${order.brlAmount}`,
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);

    return timeline;
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
