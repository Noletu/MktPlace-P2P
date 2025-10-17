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
import { boletoOCRService } from './boleto-ocr.service';
import { CryptoType } from '../types/crypto.types';
import { notificationService } from './notification.service';

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

    // NOTA: Não validamos se o usuário tem carteira aqui porque:
    // - O colateral é depositado na carteira DA PLATAFORMA (não do usuário)
    // - A carteira do usuário só é necessária para RECEBER as cripto após vender o PIX/Boleto
    // - Essa validação será feita no momento do saque/recebimento

    // Validar valores mínimos
    const minBRL = 10;
    if (parseFloat(input.brlAmount) < minBRL) {
      throw new Error(`Valor mínimo é R$ ${minBRL}`);
    }

    // Validar dados específicos do método de pagamento
    // Determinar tipo de pagamento pela presença de campos
    if ('barcode' in input.orderData) {
      // É um boleto
      const boletoData = input.orderData as BoletoData;
      if (!boletoData.barcode) {
        throw new Error('Código de barras do boleto é obrigatório');
      }

      // Validar código de barras usando o serviço de OCR
      // TODO: Em produção, ativar validação estrita de dígitos verificadores
      const isValid = boletoOCRService.validateBarcode(boletoData.barcode);
      if (!isValid && process.env.NODE_ENV === 'production') {
        throw new Error('Código de barras do boleto inválido. Verifique se digitou corretamente.');
      }

      if (!isValid) {
        console.log('⚠️ [DEV] Código de barras com dígitos verificadores inválidos - permitido em desenvolvimento');
      }

      // Extrair e validar valor do boleto
      const boletoValue = boletoOCRService.extractValue(boletoData.barcode);
      if (boletoValue > 0) {
        const expectedValue = parseFloat(input.brlAmount);
        // Permitir 1% de diferença devido a arredondamentos
        if (Math.abs(boletoValue - expectedValue) > expectedValue * 0.01) {
          console.log(`⚠️ Valor do boleto (R$ ${boletoValue}) difere do valor do pedido (R$ ${expectedValue})`);
        }
      }
    } else if ('pixKey' in input.orderData) {
      // É um PIX
      const pixData = input.orderData as PixData;
      if (!pixData.pixKey || pixData.pixKey.length < 3) {
        throw new Error('Chave PIX inválida');
      }
    }
  }

  /**
   * Criar pedido
   * IMPORTANTE: O pedido só irá para o marketplace após o colateral ser confirmado
   */
  async createOrder(input: CreateOrderInput & { collateralAddressId?: string }): Promise<Order> {
    // Validar criação
    await this.validateOrderCreation(input);

    // Calcular taxas
    const fees = this.calculateFees(input.cryptoAmount);

    // Calcular timeout (24 horas)
    const timeoutAt = new Date();
    timeoutAt.setHours(timeoutAt.getHours() + FEE_CONFIG.TIMEOUT_HOURS);

    // VERIFICAR COLATERAL CONFIRMADO
    let collateralConfirmed = false;
    let collateralTxHash = null;
    let collateralDepositId = null;

    if (input.collateralAddressId) {
      // Buscar registro de colateral
      const collateralAddress = await prisma.collateralAddress.findUnique({
        where: { id: input.collateralAddressId },
      });

      if (!collateralAddress) {
        throw new Error('Endereço de colateral não encontrado');
      }

      if (collateralAddress.userId !== input.userId) {
        throw new Error('Endereço de colateral não pertence ao usuário');
      }

      if (collateralAddress.status !== 'CONFIRMED') {
        throw new Error('Colateral ainda não foi confirmado na blockchain. Aguarde a confirmação do depósito.');
      }

      // Colateral confirmado! Criar pedido já liberado para marketplace
      collateralConfirmed = true;
      collateralTxHash = collateralAddress.txHash;

      console.log(`✅ Colateral confirmado! TxHash: ${collateralTxHash}`);
    } else {
      console.log(`⚠️ Pedido criado SEM collateralAddressId - não aparecerá no marketplace`);
    }

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
        // SECURITY: Só marca como confirmado se o colateral foi verificado
        collateralConfirmed,
        collateralTxHash,
        collateralDepositId,
      },
    });

    if (collateralConfirmed) {
      console.log(`📝 Order ${order.id} created with CONFIRMED collateral - Will appear in marketplace ✅`);
    } else {
      console.log(`📝 Order ${order.id} created - Awaiting collateral confirmation to appear in marketplace`);
    }

    return order;
  }

  /**
   * Listar pedidos disponíveis para matching (marketplace)
   * IMPORTANTE: Só mostra pedidos com colateral CONFIRMADO na blockchain
   * NOTA: Mostra TODOS os pedidos, incluindo do próprio usuário
   * A validação de não aceitar próprio pedido é feita no matchOrder()
   */
  async getAvailableOrders(excludeUserId?: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PENDING, OrderStatus.IN_NEGOTIATION], // Incluir negociações
        },
        // SECURITY: Só mostrar pedidos com colateral confirmado na blockchain
        collateralConfirmed: true,
        // REMOVIDO: não excluir pedidos do próprio usuário do marketplace
        // userId: excludeUserId ? { not: excludeUserId } : undefined,
        timeoutAt: { gt: new Date() }, // Não expirados
      },
      orderBy: [
        { ownerOnline: 'desc' }, // Online primeiro
        { status: 'asc' }, // PENDING antes de IN_NEGOTIATION
        { ownerLastSeenAt: 'desc' }, // Mais recente primeiro
        { createdAt: 'desc' }, // Mais novo primeiro
      ],
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

    console.log(`📊 Marketplace: found ${orders.length} orders (online prioritized)`);

    return orders;
  }

  /**
   * Obter pedidos do usuário
   * Retorna pedidos onde o usuário é o CRIADOR ou o PAGADOR
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { userId }, // Pedidos criados pelo usuário
          { transactions: { some: { payerId: userId } } }, // Pedidos onde é pagador
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            reputationScore: true,
          },
        },
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
      // TIMEOUT: 30 minutos para pagamento ser confirmado
      const timeout = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.MATCHED,
          timeoutAt: timeout,
        },
      });

      // Criar transação dentro da mesma transação atômica
      const createdTransaction = await tx.transaction.create({
        data: {
          orderId,
          payerId,
          status: 'PENDING',
        },
      });

      // Enviar notificações após transação commit (fora do tx)
      setImmediate(async () => {
        try {
          await notificationService.notifyOrderMatched(
            orderId,
            order.userId, // seller
            payerId, // buyer
            {
              brlAmount: order.brlAmount,
              cryptoAmount: order.cryptoAmount,
              cryptoType: order.cryptoType,
              type: order.type,
            }
          );
        } catch (error) {
          console.error('Failed to send order matched notifications:', error);
        }
      });

      return { ...updatedOrder, transaction: createdTransaction };
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

    // Enviar notificação de cancelamento
    setImmediate(async () => {
      try {
        await notificationService.notifyOrderCancelled(
          orderId,
          userId,
          'Pedido cancelado pelo usuário'
        );

        // Se tem transação matched, notificar o comprador também
        if (order.transactions && order.transactions.length > 0) {
          const transaction = order.transactions[0];
          await notificationService.notifyOrderCancelled(
            orderId,
            transaction.payerId,
            'Pedido foi cancelado pelo vendedor'
          );
        }
      } catch (error) {
        console.error('Failed to send order cancelled notifications:', error);
      }
    });
  }
}

export const orderService = new OrderService();
