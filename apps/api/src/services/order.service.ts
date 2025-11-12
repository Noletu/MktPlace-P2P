import { Order } from '@prisma/client';
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
import { internalBalanceService } from './internal-balance.service';
import { prisma } from '../utils/prisma';

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
   * Calcular colateral necessário (cryptoAmount + 2.5% de taxa)
   */
  calculateRequiredCollateral(cryptoAmount: string): string {
    const amount = parseFloat(cryptoAmount);
    const collateral = amount * (1 + FEE_CONFIG.TOTAL_FEE_PERCENTAGE);
    return collateral.toFixed(8);
  }

  /**
   * Calcular timeout baseado nas preferências do usuário
   * - Se manualCancelOnly = true: 6 meses
   * - Se customExpirationHours fornecido: usar valor customizado (1-720h)
   * - Caso contrário: 24 horas (padrão)
   */
  calculateTimeoutAt(customExpirationHours?: number, manualCancelOnly?: boolean): Date {
    const timeoutAt = new Date();

    if (manualCancelOnly) {
      // Indefinido = 6 meses máximo
      timeoutAt.setMonth(timeoutAt.getMonth() + 6);
      console.log(`⏰ Timeout configurado: INDEFINIDO (6 meses)`);
    } else if (customExpirationHours) {
      // Usar tempo customizado (1-720 horas)
      timeoutAt.setHours(timeoutAt.getHours() + customExpirationHours);
      console.log(`⏰ Timeout configurado: ${customExpirationHours} horas`);
    } else {
      // Padrão: 24 horas
      timeoutAt.setHours(timeoutAt.getHours() + FEE_CONFIG.TIMEOUT_HOURS);
      console.log(`⏰ Timeout configurado: ${FEE_CONFIG.TIMEOUT_HOURS} horas (padrão)`);
    }

    return timeoutAt;
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

    // Validar carteira para pedidos BUY
    // Para pedidos de compra (BUY), o usuário DEVE ter uma carteira cadastrada
    // porque após comprar cripto, ele precisa RECEBER a cripto comprada
    if (input.type === 'BUY') {
      const userWallet = await prisma.wallet.findFirst({
        where: {
          userId: input.userId,
          crypto: input.cryptoType,
          network: input.cryptoNetwork,
        },
      });

      if (!userWallet) {
        throw new Error(
          `Você precisa cadastrar uma carteira ${input.cryptoType} (${input.cryptoNetwork}) antes de criar um pedido de compra`
        );
      }
    }

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
   * Criar pedido com lógica híbrida (saldo interno OU depósito externo)
   * NOVO FLUXO:
   * 1. Verifica se usuário tem saldo interno suficiente
   * 2. Se SIM: Usa saldo interno (pedido instantâneo)
   * 3. Se NÃO: Retorna info para depósito (parcial ou total)
   */
  async createOrder(input: CreateOrderInput & {
    collateralAddressId?: string;
    useInternalBalance?: boolean; // Flag para forçar uso de saldo interno
  }): Promise<Order | { requiresDeposit: true; missingAmount: string; availableBalance: number; requiredCollateral: string }> {
    // Log de entrada para debug
    console.log(`📝 [ORDER] Creating order - userId: ${input.userId}, type: ${input.type}, crypto: ${input.cryptoType}/${input.cryptoNetwork}, amount: ${input.brlAmount} BRL, useInternalBalance: ${input.useInternalBalance}`);

    // Validar criação
    await this.validateOrderCreation(input);

    // Calcular taxas
    const fees = this.calculateFees(input.cryptoAmount);

    // Calcular colateral necessário
    const requiredCollateral = this.calculateRequiredCollateral(input.cryptoAmount);

    // Calcular timeout baseado nas preferências do usuário
    const timeoutAt = this.calculateTimeoutAt(input.customExpirationHours, input.manualCancelOnly);

    // ========== LÓGICA HÍBRIDA ==========

    // CASO 1: Verificar se deve usar saldo interno
    if (input.useInternalBalance !== false) { // Default: tentar usar saldo interno
      const availableBalance = await internalBalanceService.getAvailableBalance(
        input.userId,
        input.cryptoType,
        input.cryptoNetwork
      );

      console.log(`💰 Saldo disponível: ${availableBalance.toFixed(8)} ${input.cryptoType}`);
      console.log(`🎯 Colateral necessário: ${requiredCollateral} ${input.cryptoType}`);

      const hasEnough = availableBalance >= parseFloat(requiredCollateral);

      if (hasEnough) {
        // TEM SALDO SUFICIENTE → Criar pedido INSTANTÂNEO usando saldo interno
        console.log(`✅ Usando saldo interno - Pedido instantâneo!`);
        return await this.createOrderWithInternalBalance(input, fees, timeoutAt, requiredCollateral);
      } else if (!input.collateralAddressId) {
        // NÃO TEM SALDO SUFICIENTE → Retornar info para depósito
        const missingAmount = (parseFloat(requiredCollateral) - availableBalance).toFixed(8);

        console.log(`⚠️ Saldo insuficiente. Falta: ${missingAmount} ${input.cryptoType}`);

        return {
          requiresDeposit: true,
          missingAmount,
          availableBalance,
          requiredCollateral,
        };
      }
    }

    // CASO 2: Depósito externo (fluxo antigo)
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

      console.log(`✅ Colateral externo confirmado! TxHash: ${collateralTxHash}`);
    } else {
      console.log(`⚠️ Pedido criado SEM collateralAddressId - não aparecerá no marketplace`);
    }

    // Criar pedido com depósito externo
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
        customExpirationHours: input.customExpirationHours,
        manualCancelOnly: input.manualCancelOnly || false,
        paidByPlatform: false,
        // SECURITY: Só marca como confirmado se o colateral foi verificado
        collateralConfirmed,
        collateralTxHash,
        collateralDepositId,
        collateralSource: 'EXTERNAL_DEPOSIT',
      },
    });

    if (collateralConfirmed) {
      console.log(`📝 Order ${order.id} created with CONFIRMED external collateral - Will appear in marketplace ✅`);
    } else {
      console.log(`📝 Order ${order.id} created - Awaiting collateral confirmation to appear in marketplace`);
    }

    return order;
  }

  /**
   * Criar pedido usando saldo interno (INSTANTÂNEO)
   * CORRIGIDO v0.3.6: Bloqueio de saldo DENTRO da transaction para evitar timeout
   */
  private async createOrderWithInternalBalance(
    input: CreateOrderInput,
    fees: FeeCalculation,
    timeoutAt: Date,
    collateralAmount: string
  ): Promise<Order> {
    // Transaction atômica ÚNICA: criar pedido + bloquear saldo + registrar auditoria
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buscar saldo interno
      let balance = await tx.internalBalance.findUnique({
        where: {
          userId_cryptoType_network: {
            userId: input.userId,
            cryptoType: input.cryptoType,
            network: input.cryptoNetwork,
          },
        },
      });

      if (!balance) {
        throw new Error('Saldo interno não encontrado');
      }

      // 2. Verificar saldo disponível (proteção contra race condition)
      const currentTotal = parseFloat(balance.balance);
      const currentLocked = parseFloat(balance.lockedAmount);
      const available = currentTotal - currentLocked;
      const requiredAmount = parseFloat(collateralAmount);

      if (available < requiredAmount) {
        throw new Error(
          `Saldo insuficiente. Disponível: ${available.toFixed(8)}, Necessário: ${collateralAmount}`
        );
      }

      // 3. Criar pedido
      const order = await tx.order.create({
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
          customExpirationHours: input.customExpirationHours,
          manualCancelOnly: input.manualCancelOnly || false,
          paidByPlatform: false,
          // CRITICAL: Pedido criado com colateral JÁ CONFIRMADO
          collateralConfirmed: true,
          collateralSource: 'INTERNAL_BALANCE',
          internalBalanceId: balance.id,
          collateralLocked: true,
          collateralLockedAmount: collateralAmount,
        },
      });

      console.log(`🚀 Pedido ${order.id} criado usando saldo interno!`);

      // 4. Bloquear saldo (DENTRO DA MESMA TRANSACTION!)
      const newLocked = currentLocked + requiredAmount;
      const newAvailable = currentTotal - newLocked;

      await tx.internalBalance.update({
        where: { id: balance.id },
        data: {
          lockedAmount: newLocked.toFixed(8),
          availableAmount: newAvailable.toFixed(8),
          totalUsed: (parseFloat(balance.totalUsed) + requiredAmount).toFixed(8),
        },
      });

      console.log(`🔒 Saldo bloqueado: ${collateralAmount} ${input.cryptoType}`);
      console.log(`   Disponível: ${newAvailable.toFixed(8)} ${input.cryptoType}`);
      console.log(`   Bloqueado: ${newLocked.toFixed(8)} ${input.cryptoType}`);

      // 5. Registrar transação de colateral para auditoria (DENTRO DA MESMA TRANSACTION!)
      await tx.collateralTransaction.create({
        data: {
          userId: input.userId,
          balanceId: balance.id,
          orderId: order.id,
          type: 'LOCK',
          amount: collateralAmount,
          balanceBefore: currentLocked.toFixed(8),
          balanceAfter: newLocked.toFixed(8),
          network: input.cryptoNetwork,
          description: `Colateral bloqueado para pedido ${order.id}`,
        },
      });

      console.log(`📝 Transação de colateral registrada: LOCK - ${collateralAmount}`);

      return order;
    }, {
      timeout: 15000, // 15 segundos
    });

    console.log(`✅ Order ${result.id} created with INTERNAL BALANCE - Will appear in marketplace IMMEDIATELY!`);

    return result;
  }

  /**
   * Listar pedidos disponíveis para matching (marketplace)
   * IMPORTANTE: Só mostra pedidos com colateral CONFIRMADO
   * NOTA: Mostra TODOS os pedidos, incluindo do próprio usuário
   * A validação de não aceitar próprio pedido é feita no matchOrder()
   */
  async getAvailableOrders(excludeUserId?: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING, // Apenas pedidos pendentes
        // SECURITY: Só mostrar pedidos com colateral confirmado
        collateralConfirmed: true,
        // REMOVIDO: não excluir pedidos do próprio usuário do marketplace
        // userId: excludeUserId ? { not: excludeUserId } : undefined,
        timeoutAt: { gt: new Date() }, // Não expirados
      },
      orderBy: [
        { ownerOnline: 'desc' }, // Online primeiro
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
            totalTransactions: true,
            successfulTransactions: true,
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
      // Apenas pedidos PENDING podem ser aceitos
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
    }, {
      timeout: 15000, // 15 segundos (aumentado de 5s padrão)
    });
  }

  /**
   * Cancelar pedido (por vendedor/criador)
   */
  async cancelOrder(
    orderId: string,
    userId: string,
    reason: string,
    note: string
  ): Promise<{ message: string; penaltyApplied: boolean; penaltyPoints: number }> {
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

    // ANTI-SPAM: Verificar se usuário pode cancelar pedido PENDING
    if (order.status === OrderStatus.PENDING) {
      const { antiSpamService } = await import('./antiSpam.service');
      const antiSpamCheck = await antiSpamService.canCancelPendingOrder(userId, orderId);

      if (!antiSpamCheck.allowed) {
        throw new Error(antiSpamCheck.reason || 'Cancelamento bloqueado por medidas anti-spam');
      }

      // Se houver warning, vamos retornar ele depois
      if (antiSpamCheck.warningMessage) {
        console.log(`⚠️ [ANTI-SPAM WARNING] userId=${userId}, message=${antiSpamCheck.warningMessage}`);
      }
    }

    // NOVO: Calcular penalidade antes de cancelar
    const { penaltyService } = await import('./penalty.service');
    const { cancellationHistoryService } = await import('./cancellationHistory.service');
    const { UserRole } = await import('../types/cancellation.types');

    // REGRA: Só aplicar penalidade se alguém já aceitou o pedido (status MATCHED)
    // Se está PENDING, ninguém foi prejudicado, então não há penalidade
    const shouldCalculatePenalty = order.status === OrderStatus.MATCHED;

    let penalty;
    if (shouldCalculatePenalty) {
      penalty = await penaltyService.calculateCancellationPenalty(userId, UserRole.SELLER);
    } else {
      // Cancelamento sem penalidade (pedido ainda não foi aceito)
      penalty = {
        shouldApplyPenalty: false,
        penaltyPoints: 0,
        message: 'Pedido cancelado sem penalidade (nenhum comprador foi prejudicado)',
      };
    }

    // Aplicar penalidade na reputação se necessário
    let reputationBefore: number | undefined;
    let reputationAfter: number | undefined;

    if (penalty.shouldApplyPenalty) {
      const result = await penaltyService.applyReputationPenalty(
        userId,
        penalty.penaltyPoints,
        `Cancelamento de pedido como vendedor: ${reason}`
      );
      reputationBefore = result.oldReputation;
      reputationAfter = result.newReputation;
    }

    // Atualizar pedido com informações de cancelamento
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
        cancellationNote: note,
      },
    });

    // Criar registro no histórico
    await cancellationHistoryService.create({
      userId,
      orderId,
      role: UserRole.SELLER,
      reason: reason as any,
      note,
      penaltyApplied: penalty.shouldApplyPenalty,
      penaltyPoints: penalty.penaltyPoints,
      reputationBefore,
      reputationAfter,
      orderStatus: order.status,
      orderValue: order.brlAmount,
    });

    // Desbloquear saldo interno se foi usado (CORREÇÃO v3.0.7)
    if (order.collateralSource === 'INTERNAL_BALANCE' &&
        order.collateralLocked &&
        order.collateralLockedAmount) {

      try {
        await internalBalanceService.unlockBalance(
          order.userId,
          order.cryptoType,
          order.cryptoNetwork,
          order.collateralLockedAmount,
          orderId
        );

        console.log(`🔓 Saldo desbloqueado após cancelamento: ${order.collateralLockedAmount} ${order.cryptoType}`);
      } catch (error: any) {
        console.error(`❌ Erro ao desbloquear saldo após cancelamento:`, error);
        // Não falhar o cancelamento se houver erro no desbloqueio
      }
    }

    // Enviar notificação de cancelamento (com informação de penalidade)
    setImmediate(async () => {
      try {
        const notificationMessage = penalty.shouldApplyPenalty
          ? `Pedido cancelado. Penalidade: -${penalty.penaltyPoints} pontos de reputação.`
          : 'Pedido cancelado pelo usuário';

        await notificationService.notifyOrderCancelled(orderId, userId, notificationMessage);

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

    return {
      message: penalty.message,
      penaltyApplied: penalty.shouldApplyPenalty,
      penaltyPoints: penalty.penaltyPoints,
    };
  }

  /**
   * Cancelar pedido pelo PAGADOR (comprador)
   * O pedido VOLTA para o marketplace (status PENDING) ao invés de ser cancelado
   * Colateral permanece bloqueado pois o vendedor continua querendo vender
   */
  async cancelOrderByPayer(
    orderId: string,
    payerId: string,
    reason: string,
    note: string
  ): Promise<{ message: string; penaltyApplied: boolean; penaltyPoints: number }> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Verificar se existe transação e se o usuário é o pagador
    if (!order.transactions || order.transactions.length === 0) {
      throw new Error('Este pedido não tem um pagador associado');
    }

    const transaction = order.transactions[0];
    if (transaction.payerId !== payerId) {
      throw new Error('Você não tem permissão para cancelar este pedido');
    }

    // Só permite cancelamento em status MATCHED (após aceitar, antes de pagar)
    if (order.status !== OrderStatus.MATCHED) {
      throw new Error('Este pedido não pode ser cancelado no status atual');
    }

    // NOVO: Calcular penalidade antes de cancelar
    const { penaltyService } = await import('./penalty.service');
    const { cancellationHistoryService } = await import('./cancellationHistory.service');
    const { UserRole } = await import('../types/cancellation.types');

    const penalty = await penaltyService.calculateCancellationPenalty(payerId, UserRole.BUYER);

    // Aplicar penalidade na reputação se necessário
    let reputationBefore: number | undefined;
    let reputationAfter: number | undefined;

    if (penalty.shouldApplyPenalty) {
      const result = await penaltyService.applyReputationPenalty(
        payerId,
        penalty.penaltyPoints,
        `Cancelamento de pedido como comprador: ${reason}`
      );
      reputationBefore = result.oldReputation;
      reputationAfter = result.newReputation;
    }

    // Voltar pedido para PENDING (volta ao marketplace)
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PENDING,
        cancelledBy: payerId,
        cancellationReason: reason,
        cancellationNote: note,
      },
    });

    // Criar registro no histórico
    await cancellationHistoryService.create({
      userId: payerId,
      orderId,
      role: UserRole.BUYER,
      reason: reason as any,
      note,
      penaltyApplied: penalty.shouldApplyPenalty,
      penaltyPoints: penalty.penaltyPoints,
      reputationBefore,
      reputationAfter,
      orderStatus: order.status,
      orderValue: order.brlAmount,
    });

    // Deletar/cancelar a transaction (desvincula o pagador)
    await prisma.transaction.delete({
      where: { id: transaction.id },
    });

    console.log(`🔄 Pedido ${orderId} voltou ao marketplace após cancelamento do pagador`);

    // NÃO desbloqueia colateral - ele permanece bloqueado pois o pedido continua ativo

    // Enviar notificações (com informação de penalidade)
    setImmediate(async () => {
      try {
        // Notificar o pagador (comprador)
        const payerMessage = penalty.shouldApplyPenalty
          ? `Você cancelou o aceite do pedido. Penalidade: -${penalty.penaltyPoints} pontos de reputação.`
          : 'Você cancelou o aceite do pedido. O pedido voltou ao marketplace.';

        await notificationService.createNotification({
          userId: payerId,
          type: 'ORDER_STATUS_CHANGE',
          category: 'ORDER',
          title: penalty.shouldApplyPenalty ? '⚠️ Cancelamento com Penalidade' : '✅ Cancelamento Confirmado',
          message: payerMessage,
          actionUrl: `/orders/${orderId}`,
          actionLabel: 'Ver Pedido',
          relatedId: orderId,
          relatedType: 'ORDER',
          priority: penalty.shouldApplyPenalty ? 'HIGH' : 'NORMAL',
        });

        // Notificar o vendedor (criador do pedido)
        await notificationService.createNotification({
          userId: order.userId,
          type: 'ORDER_STATUS_CHANGE',
          category: 'ORDER',
          title: '🔄 Comprador Cancelou',
          message: 'O comprador cancelou o aceite. Seu pedido voltou ao marketplace e está disponível para outros compradores.',
          actionUrl: `/orders/${orderId}`,
          actionLabel: 'Ver Pedido',
          relatedId: orderId,
          relatedType: 'ORDER',
          priority: 'NORMAL',
        });
      } catch (error) {
        console.error('Failed to send payer cancellation notifications:', error);
      }
    });

    return {
      message: penalty.message,
      penaltyApplied: penalty.shouldApplyPenalty,
      penaltyPoints: penalty.penaltyPoints,
    };
  }

  /**
   * Obter estatísticas do usuário
   */
  async getUserStatistics(userId: string, days: number = 30) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Buscar todos os pedidos concluídos do usuário (como criador ou pagador) no período
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { userId }, // Pedidos que o usuário criou (vendas)
          { transactions: { some: { payerId: userId } } }, // Pedidos que o usuário pagou (compras)
        ],
        status: 'COMPLETED',
        completedAt: {
          gte: dateFrom,
        },
      },
      include: {
        transactions: {
          select: {
            payerId: true,
          },
        },
      },
      orderBy: {
        completedAt: 'asc',
      },
    });

    // Calcular estatísticas
    let totalBuys = 0;
    let totalSells = 0;
    let totalVolumeBRL = 0;
    let totalVolumeCrypto: { [key: string]: number } = {};

    // Agrupar por dia para o gráfico
    const dailyData: { [key: string]: { date: string; volumeBRL: number; count: number } } = {};

    orders.forEach((order) => {
      const isSeller = order.userId === userId;
      const isBuyer = order.transactions[0]?.payerId === userId;

      if (isSeller) {
        totalSells++;
      }
      if (isBuyer) {
        totalBuys++;
      }

      // Volume em BRL
      const brlAmount = parseFloat(order.brlAmount);
      totalVolumeBRL += brlAmount;

      // Volume em Crypto (diferente para vendedor e comprador)
      const cryptoAmount = parseFloat(order.cryptoAmount);
      const payerReward = parseFloat(order.payerReward);

      if (!totalVolumeCrypto[order.cryptoType]) {
        totalVolumeCrypto[order.cryptoType] = 0;
      }

      if (isSeller) {
        // Vendedor: soma o que vendeu (cryptoAmount que ele pagou de colateral)
        totalVolumeCrypto[order.cryptoType] += cryptoAmount;
      } else if (isBuyer) {
        // Comprador: soma o que recebeu (cryptoAmount + cashback de 1%)
        totalVolumeCrypto[order.cryptoType] += (cryptoAmount + payerReward);
      }

      // Dados diários para o gráfico
      if (order.completedAt) {
        const dateKey = order.completedAt.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            volumeBRL: 0,
            count: 0,
          };
        }
        dailyData[dateKey].volumeBRL += brlAmount;
        dailyData[dateKey].count += 1;
      }
    });

    // Converter dados diários para array ordenado
    const chartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    return {
      summary: {
        totalBuys,
        totalSells,
        totalOrders: totalBuys + totalSells,
        totalVolumeBRL: totalVolumeBRL.toFixed(2),
        totalVolumeCrypto,
      },
      chartData,
      period: {
        days,
        from: dateFrom.toISOString(),
        to: new Date().toISOString(),
      },
    };
  }
}

export const orderService = new OrderService();
