import { Transaction } from '@prisma/client';
import { TransactionStatus, SubmitProofInput, ValidateProofInput, DisputeInput } from '../types/transaction.types';
import { OrderStatus } from '../types/order.types';
import { notificationService } from './notification.service';
import { prisma } from '../utils/prisma';
import { DerivationService } from './hd-wallet/derivation.service';
import { KeyManagementService } from './hd-wallet/key-management.service';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from './auditLog.service';
import BigNumber from 'bignumber.js';

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

        // 2. Atualizar status do pedido e transferir cripto
        const completedOrder = await tx.order.update({
          where: { id: transaction.orderId },
          data: {
            status: OrderStatus.COMPLETED,
            completedAt: new Date(),
            collateralLocked: false,
            collateralUnlockedAt: new Date(),
            // Marcar transferência de cripto
            cryptoTransferred: true,
            cryptoTransferredAt: new Date(),
            cryptoTransferredTo: transaction.payerId, // comprador
          },
        });

        console.log(`✅ Transação aprovada e pedido completado: ${transaction.orderId}`);

        // 3. TRANSFERIR CRIPTO do vendedor para o comprador

        // 3.1 Validação: verificar se ordem ainda não foi transferida (idempotência)
        if (transaction.order.cryptoTransferred) {
          console.log(`⚠️ Cripto já foi transferida para pedido ${transaction.orderId} - pulando transferência`);
          return approved;
        }

        // 3.2 Buscar carteira do VENDEDOR (onde colateral está bloqueado)
        if (!completedOrder.walletId) {
          throw new Error('Order has no wallet (collateral source)');
        }

        const sellerWallet = await tx.userWallet.findUnique({
          where: { id: completedOrder.walletId },
        });

        if (!sellerWallet) {
          throw new Error('Seller wallet not found');
        }

        // 3.3 Buscar/criar carteira do COMPRADOR (mesma crypto/network)
        let buyerWallet = await tx.userWallet.findUnique({
          where: {
            userId_cryptoType_network: {
              userId: transaction.payerId,
              cryptoType: completedOrder.cryptoType,
              network: completedOrder.cryptoNetwork,
            },
          },
        });

        // 3.4 Se comprador não tem carteira, CRIAR agora (dentro da transação)
        if (!buyerWallet) {
          console.log(`📝 Criando carteira para comprador ${transaction.payerId}...`);

          // Derivar nova carteira para o comprador
          const { address, privateKey, derivationPath } = DerivationService.deriveUserWallet(
            transaction.payerId,
            completedOrder.cryptoType,
            completedOrder.cryptoNetwork
          );

          const encryptedPrivateKey = KeyManagementService.encryptPrivateKey(
            privateKey,
            transaction.payerId
          );

          buyerWallet = await tx.userWallet.create({
            data: {
              userId: transaction.payerId,
              cryptoType: completedOrder.cryptoType,
              network: completedOrder.cryptoNetwork,
              address,
              derivationPath,
              encryptedPrivateKey,
              balance: '0',
              availableBalance: '0',
              lockedBalance: '0',
              totalDeposited: '0',
              isActive: true,
              lastSyncedAt: new Date(),
            },
          });

          console.log(`✅ Carteira criada: ${buyerWallet.address}`);
        }

        // 3.5 Calcular valor total a transferir (crypto + reward) usando BigNumber para precisao
        const cryptoAmountBN = new BigNumber(completedOrder.cryptoAmount);
        const payerRewardBN = new BigNumber(completedOrder.payerReward || '0'); // 1% cashback
        const totalToTransferBN = cryptoAmountBN.plus(payerRewardBN);

        // 3.6 Validacao: verificar se vendedor tem saldo bloqueado suficiente
        const sellerLockedBalanceBN = new BigNumber(sellerWallet.lockedBalance);
        if (sellerLockedBalanceBN.lt(totalToTransferBN)) {
          throw new Error(
            `Insufficient locked balance. Seller has ${sellerLockedBalanceBN.toFixed(8)} locked, needs ${totalToTransferBN.toFixed(8)}`
          );
        }

        // 3.7 DEDUZIR do vendedor (do saldo LOCKED)
        const sellerNewLockedBN = sellerLockedBalanceBN.minus(totalToTransferBN);
        const sellerNewBalanceBN = new BigNumber(sellerWallet.balance).minus(totalToTransferBN);

        await tx.userWallet.update({
          where: { id: sellerWallet.id },
          data: {
            balance: sellerNewBalanceBN.toFixed(8),
            lockedBalance: sellerNewLockedBN.toFixed(8),
            totalUsed: new BigNumber(sellerWallet.totalUsed).plus(totalToTransferBN).toFixed(8),
          },
        });

        // 3.8 CREDITAR no comprador (no saldo AVAILABLE)
        const buyerNewBalanceBN = new BigNumber(buyerWallet.balance).plus(totalToTransferBN);
        const buyerNewAvailableBN = new BigNumber(buyerWallet.availableBalance).plus(totalToTransferBN);

        await tx.userWallet.update({
          where: { id: buyerWallet.id },
          data: {
            balance: buyerNewBalanceBN.toFixed(8),
            availableBalance: buyerNewAvailableBN.toFixed(8),
            totalDeposited: new BigNumber(buyerWallet.totalDeposited).plus(totalToTransferBN).toFixed(8),
          },
        });

        // 3.9 Registrar transacao de DEDUCT (vendedor)
        await tx.walletTransaction.create({
          data: {
            walletId: sellerWallet.id,
            userId: sellerWallet.userId,
            orderId: completedOrder.id,
            type: 'DEDUCT',
            amount: totalToTransferBN.toFixed(8),
            balanceBefore: sellerWallet.balance,
            balanceAfter: sellerNewBalanceBN.toFixed(8),
            lockedBefore: sellerWallet.lockedBalance,
            lockedAfter: sellerNewLockedBN.toFixed(8),
            description: `Crypto transferred to buyer (Order ${completedOrder.id})`,
            metadata: JSON.stringify({
              orderId: completedOrder.id,
              buyerUserId: transaction.payerId,
              buyerWalletId: buyerWallet.id,
              cryptoAmount: completedOrder.cryptoAmount,
              payerReward: completedOrder.payerReward,
              totalTransferred: totalToTransferBN.toFixed(8),
              timestamp: new Date().toISOString(),
            }),
          },
        });

        // 3.10 Registrar transacao de CREDIT (comprador)
        await tx.walletTransaction.create({
          data: {
            walletId: buyerWallet.id,
            userId: buyerWallet.userId,
            orderId: completedOrder.id,
            type: 'CREDIT',
            amount: totalToTransferBN.toFixed(8),
            balanceBefore: buyerWallet.balance,
            balanceAfter: buyerNewBalanceBN.toFixed(8),
            description: `Crypto received from seller (Order ${completedOrder.id})`,
            metadata: JSON.stringify({
              orderId: completedOrder.id,
              sellerUserId: completedOrder.userId,
              sellerWalletId: sellerWallet.id,
              cryptoAmount: completedOrder.cryptoAmount,
              payerReward: completedOrder.payerReward,
              totalReceived: totalToTransferBN.toFixed(8),
              timestamp: new Date().toISOString(),
            }),
          },
        });

        console.log(`💸 Crypto transferida: ${totalToTransfer.toFixed(8)} ${completedOrder.cryptoType}`);
        console.log(`   Vendedor: ${sellerWallet.userId} → Comprador: ${transaction.payerId}`);

        return approved;
      }, {
        timeout: 60000, // 60 segundos (aumentado para operações complexas)
        maxWait: 20000, // máximo 20s esperando lock
      });

      console.log(`✅ TRANSAÇÃO ATÔMICA COMPLETA com sucesso!`);

      // Registrar audit logs (fora da transação crítica)
      setImmediate(async () => {
        try {
          // Buscar dados atualizados da order para os logs
          const completedOrder = await prisma.order.findUnique({
            where: { id: transaction.orderId },
            select: {
              id: true,
              userId: true,
              cryptoType: true,
              cryptoNetwork: true,
              cryptoAmount: true,
              payerReward: true,
            },
          });

          if (completedOrder) {
            const cryptoAmountLog = new BigNumber(completedOrder.cryptoAmount);
            const payerRewardLog = new BigNumber(completedOrder.payerReward || '0');
            const totalTransferred = cryptoAmountLog.plus(payerRewardLog);

            // 1. ORDER_COMPLETED - Comprador
            await auditLogService.log({
              userId: transaction.payerId,
              action: AUDIT_ACTIONS.ORDER_COMPLETED,
              resource: AUDIT_RESOURCES.TRANSACTION,
              resourceId: completedOrder.id,
              description: `Order completed - Payment validated and approved`,
              metadata: {
                orderId: completedOrder.id,
                sellerId: completedOrder.userId,
                buyerId: transaction.payerId,
                role: 'buyer',
              },
              success: true,
            });

            // 2. ORDER_COMPLETED - Vendedor
            await auditLogService.log({
              userId: completedOrder.userId,
              action: AUDIT_ACTIONS.ORDER_COMPLETED,
              resource: AUDIT_RESOURCES.TRANSACTION,
              resourceId: completedOrder.id,
              description: `Order completed - Payment received and confirmed`,
              metadata: {
                orderId: completedOrder.id,
                sellerId: completedOrder.userId,
                buyerId: transaction.payerId,
                role: 'seller',
              },
              success: true,
            });

            // 3. CRYPTO_TRANSFER - Comprador (visibilidade)
            await auditLogService.log({
              userId: transaction.payerId,
              action: AUDIT_ACTIONS.CRYPTO_TRANSFER,
              resource: AUDIT_RESOURCES.TRANSACTION,
              resourceId: completedOrder.id,
              description: `Crypto transferred: ${totalTransferred.toFixed(8)} ${completedOrder.cryptoType} from seller to buyer`,
              metadata: {
                orderId: completedOrder.id,
                fromUserId: completedOrder.userId,
                toUserId: transaction.payerId,
                cryptoType: completedOrder.cryptoType,
                network: completedOrder.cryptoNetwork,
                amount: totalTransferred.toFixed(8),
                direction: 'SELLER_TO_BUYER',
              },
              success: true,
            });

            // 4. CRYPTO_TRANSFER - Vendedor (visibilidade)
            await auditLogService.log({
              userId: completedOrder.userId,
              action: AUDIT_ACTIONS.CRYPTO_TRANSFER,
              resource: AUDIT_RESOURCES.TRANSACTION,
              resourceId: completedOrder.id,
              description: `Crypto transferred: ${totalTransferred.toFixed(8)} ${completedOrder.cryptoType} from seller to buyer`,
              metadata: {
                orderId: completedOrder.id,
                fromUserId: completedOrder.userId,
                toUserId: transaction.payerId,
                cryptoType: completedOrder.cryptoType,
                network: completedOrder.cryptoNetwork,
                amount: totalTransferred.toFixed(8),
                direction: 'SELLER_TO_BUYER',
              },
              success: true,
            });

            console.log(`📝 Audit logs: ORDER_COMPLETED (x2) + CRYPTO_TRANSFER (x2)`);
          }
        } catch (error) {
          console.error('Failed to log audit entries:', error);
        }
      });

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
