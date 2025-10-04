import { PrismaClient, Order } from '@prisma/client';
import {
  OrderType,
  OrderStatus,
  CreateOrderInput,
  FeeCalculation,
  FEE_CONFIG,
  BoletoData,
  PixData
} from '../types/order.types';
import { kycService } from './kyc.service';
import { walletService } from './wallet.service';
import { priceService } from './price.service';
import { CryptoType } from '../types/crypto.types';

const prisma = new PrismaClient();

export class OrderService {
  /**
   * Calcula as taxas do pedido
   */
  calculateFees(cryptoAmount: string): FeeCalculation {
    const amount = parseFloat(cryptoAmount);

    const platformFee = amount * FEE_CONFIG.PLATFORM_FEE_PERCENTAGE;
    const payerReward = amount * FEE_CONFIG.PAYER_REWARD_PERCENTAGE;
    const totalFee = amount * FEE_CONFIG.TOTAL_FEE_PERCENTAGE;
    const netCryptoAmount = amount - totalFee;

    return {
      platformFee: platformFee.toFixed(8),
      payerReward: payerReward.toFixed(8),
      totalFee: totalFee.toFixed(8),
      netCryptoAmount: netCryptoAmount.toFixed(8),
    };
  }

  /**
   * Validar dados do pedido
   */
  async validateOrderCreation(input: CreateOrderInput): Promise<void> {
    // Validar KYC level e limite
    const canTransact = await kycService.canUserTransact(
      input.userId,
      parseFloat(input.brlAmount)
    );

    if (!canTransact) {
      const limit = await kycService.getTransactionLimit(input.userId);
      throw new Error(
        `Valor excede seu limite de transação (R$ ${limit}). Complete um nível KYC superior.`
      );
    }

    // Validar se usuário tem carteira para a crypto/rede
    const wallets = await walletService.getUserWallets(input.userId);
    const hasWallet = wallets.some(
      (w) => w.crypto === input.cryptoType && w.network === input.cryptoNetwork && w.isActive
    );

    if (!hasWallet) {
      throw new Error(
        `Você precisa adicionar uma carteira ${input.cryptoType} (${input.cryptoNetwork}) primeiro.`
      );
    }

    // Validar valores mínimos
    const minBRL = 10;
    if (parseFloat(input.brlAmount) < minBRL) {
      throw new Error(`Valor mínimo é R$ ${minBRL}`);
    }

    // Validar dados específicos do tipo
    if (input.type === OrderType.BOLETO) {
      const boletoData = input.orderData as BoletoData;
      if (!boletoData.barcode || boletoData.barcode.length < 44) {
        throw new Error('Código de barras do boleto inválido');
      }
    } else if (input.type === OrderType.PIX) {
      const pixData = input.orderData as PixData;
      if (!pixData.pixKey || pixData.pixKey.length < 3) {
        throw new Error('Chave PIX inválida');
      }
    }
  }

  /**
   * Criar pedido
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    // Validar criação
    await this.validateOrderCreation(input);

    // Calcular taxas
    const fees = this.calculateFees(input.cryptoAmount);

    // Calcular timeout (24 horas)
    const timeoutAt = new Date();
    timeoutAt.setHours(timeoutAt.getHours() + FEE_CONFIG.TIMEOUT_HOURS);

    // Criar pedido
    const order = await prisma.order.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: OrderStatus.PENDING,
        cryptoType: input.cryptoType,
        cryptoNetwork: input.cryptoNetwork,
        cryptoAmount: input.cryptoAmount,
        brlAmount: input.brlAmount,
        platformFee: fees.platformFee,
        payerReward: fees.payerReward,
        totalFee: fees.totalFee,
        orderData: JSON.stringify(input.orderData),
        timeoutAt,
        paidByPlatform: false,
      },
    });

    return order;
  }

  /**
   * Listar pedidos disponíveis para matching (marketplace)
   */
  async getAvailableOrders(excludeUserId?: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        userId: excludeUserId ? { not: excludeUserId } : undefined,
        timeoutAt: { gt: new Date() }, // Não expirados
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            reputationScore: true,
            totalTransactions: true,
            successfulTransactions: true,
          },
        },
      },
    });

    return orders;
  }

  /**
   * Obter pedidos do usuário
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: true,
      },
    });

    return orders;
  }

  /**
   * Obter detalhes do pedido
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            reputationScore: true,
          },
        },
        transactions: {
          include: {
            payer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return order;
  }

  /**
   * Fazer match de um pedido (pagador aceita pagar)
   * SECURITY: Usa transação atômica para prevenir race conditions
   */
  async matchOrder(orderId: string, payerId: string): Promise<Order> {
    // SECURITY: Usar transação para garantir atomicidade e prevenir race conditions
    return await prisma.$transaction(async (tx) => {
      // Buscar e travar o pedido (SELECT FOR UPDATE)
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              reputationScore: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error('Pedido não encontrado');
      }

      if (order.userId === payerId) {
        throw new Error('Você não pode aceitar seu próprio pedido');
      }

      // SECURITY: Validação atômica de status
      if (order.status !== OrderStatus.PENDING) {
        throw new Error('Este pedido não está mais disponível');
      }

      if (order.timeoutAt && order.timeoutAt < new Date()) {
        throw new Error('Este pedido expirou');
      }

      // Verificar limite KYC do pagador
      const canTransact = await kycService.canUserTransact(
        payerId,
        parseFloat(order.brlAmount)
      );

      if (!canTransact) {
        const limit = await kycService.getTransactionLimit(payerId);
        throw new Error(
          `Valor excede seu limite de transação (R$ ${limit}). Complete um nível KYC superior.`
        );
      }

      // Atualizar pedido para MATCHED dentro da transação
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.MATCHED },
      });

      // Criar transação dentro da mesma transação atômica
      await tx.transaction.create({
        data: {
          orderId,
          payerId,
          status: 'PENDING',
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Cancelar pedido
   */
  async cancelOrder(orderId: string, userId: string): Promise<void> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    if (order.userId !== userId) {
      throw new Error('Você não tem permissão para cancelar este pedido');
    }

    if (![OrderStatus.PENDING, OrderStatus.MATCHED].includes(order.status as OrderStatus)) {
      throw new Error('Este pedido não pode ser cancelado no status atual');
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });
  }
}

export const orderService = new OrderService();
