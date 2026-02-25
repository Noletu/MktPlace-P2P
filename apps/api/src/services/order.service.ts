import { Order } from '@prisma/client';
import {
  OrderType,
  OrderStatus,
  CreateOrderInput,
  FeeCalculation,
  FEE_CONFIG,
  BoletoData,
  PixData,
  BUY_ORDER_CONFIG,
  CreateBuyOrderInput,
  AcceptBuyOrderInput
} from '../types/order.types';
import { limitService } from './limit.service';
import { WalletService } from './wallet.service';
import { priceService } from './price.service';
import { boletoOCRService } from './boleto-ocr.service';
import { CryptoType } from '../types/crypto.types';
import { notificationService } from './notification.service';
import { prisma } from '../utils/prisma';
import { couponService } from './coupon.service';

export class OrderService {
  /**
   * Calcula as taxas do pedido (com suporte a cupons de desconto)
   */
  async calculateFees(cryptoAmount: string, userId?: string): Promise<FeeCalculation> {
    const amount = parseFloat(cryptoAmount);

    let platformFeePercentage = FEE_CONFIG.PLATFORM_FEE_PERCENTAGE; // 1.5%
    let appliedCoupon = null;

    // Verificar se usuário tem cupom ativo
    if (userId) {
      const activeCoupon = await couponService.getActiveCoupon(userId);

      if (activeCoupon) {
        const discount = activeCoupon.coupon.discountPercentage / 100;
        const originalPlatformFeePercentage = platformFeePercentage;
        platformFeePercentage = platformFeePercentage * (1 - discount);

        appliedCoupon = {
          couponId: activeCoupon.coupon.id,
          code: activeCoupon.coupon.code,
          discountPercentage: activeCoupon.coupon.discountPercentage,
          originalPlatformFee: (amount * originalPlatformFeePercentage).toFixed(8),
          discountAmount: (amount * originalPlatformFeePercentage - amount * platformFeePercentage).toFixed(8),
        };
      }
    }

    const platformFee = amount * platformFeePercentage;
    const payerReward = amount * FEE_CONFIG.PAYER_REWARD_PERCENTAGE; // 1% inalterado
    const totalFee = platformFee + payerReward;
    const netCryptoAmount = amount - totalFee;

    return {
      platformFee: platformFee.toFixed(8),
      payerReward: payerReward.toFixed(8),
      totalFee: totalFee.toFixed(8),
      netCryptoAmount: netCryptoAmount.toFixed(8),
      appliedCoupon,
    };
  }

  /**
   * Calcula o colateral necessário para criar um pedido SELL
   * Inclui: cryptoAmount + payerReward (1% cashback para o comprador)
   *
   * O payerReward precisa ser incluído porque na liberação das criptos,
   * o vendedor transfere cryptoAmount + payerReward para o comprador.
   */
  calculateRequiredCollateral(cryptoAmount: string): string {
    const amount = parseFloat(cryptoAmount);
    // Incluir payerReward (1% cashback) que será dado ao comprador
    const payerReward = amount * FEE_CONFIG.PAYER_REWARD_PERCENTAGE;
    return (amount + payerReward).toFixed(8);
  }

  /**
   * Calcula o colateral necessário para PROVEDOR em ordem BUY
   * Inclui: cryptoAmount + platformFee (1.5%)
   *
   * Em ordens BUY, não há cashback para o comprador.
   * O provedor deposita crypto + fee, recebe BRL com markup de 2.5%.
   * Lucro líquido do provedor: ~1% (2.5% markup - 1.5% fee)
   */
  calculateBuyOrderCollateral(cryptoAmount: string): string {
    const amount = parseFloat(cryptoAmount);
    // Somente platformFee (1.5%) - sem payerReward em ordens BUY
    const platformFee = amount * BUY_ORDER_CONFIG.PROVIDER_COLLATERAL_FEE;
    return (amount + platformFee).toFixed(8);
  }

  /**
   * Calcula taxas para ordem BUY (diferente de SELL)
   * - Sem cashback (payerReward = 0)
   * - Platform fee = 1.5% do cryptoAmount
   * - Comprador paga BRL com markup de 2.5%
   */
  async calculateBuyOrderFees(cryptoAmount: string): Promise<FeeCalculation> {
    const amount = parseFloat(cryptoAmount);
    const platformFee = amount * FEE_CONFIG.PLATFORM_FEE_PERCENTAGE;
    // Sem cashback em ordens BUY
    const payerReward = 0;
    const totalFee = platformFee;
    const netCryptoAmount = amount; // Comprador recebe exatamente o que pediu

    return {
      platformFee: platformFee.toFixed(8),
      payerReward: payerReward.toFixed(8),
      totalFee: totalFee.toFixed(8),
      netCryptoAmount: netCryptoAmount.toFixed(8),
      appliedCoupon: null, // Cupons não aplicam em ordens BUY por enquanto
    };
  }

  /**
   * Calcula valor em BRL para ordem BUY com markup
   * Busca cotação atual e aplica markup de 2.5%
   */
  async calculateBuyOrderBrlAmount(cryptoAmount: string, cryptoType: string): Promise<string> {
    const amount = parseFloat(cryptoAmount);
    const brlValue = await priceService.convertCryptoToBRL(amount, cryptoType as CryptoType);
    const brlBase = parseFloat(brlValue);
    const brlWithMarkup = brlBase * (1 + BUY_ORDER_CONFIG.BRL_MARKUP_PERCENTAGE);
    return brlWithMarkup.toFixed(2);
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
    // Validar limite diario baseado em reputacao
    const limitCheck = await limitService.canUserTransact(
      input.userId,
      parseFloat(input.brlAmount)
    );

    if (!limitCheck.allowed) {
      throw new Error(
        `Valor excede seu limite diario. ` +
        `Limite: R$ ${limitCheck.dailyLimit.toFixed(2)}, ` +
        `Usado hoje: R$ ${limitCheck.dailyUsed.toFixed(2)}, ` +
        `Disponivel: R$ ${limitCheck.remaining.toFixed(2)}. ` +
        `Complete mais transacoes para aumentar seu limite.`
      );
    }

    // Verificar se conta está congelada/bloqueada
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        accountFrozen: true,
        frozenReason: true,
        frozenUntil: true,
      },
    });

    if (user?.accountFrozen) {
      // Verificar se o bloqueio tem data de expiração e se já expirou
      if (user.frozenUntil && new Date(user.frozenUntil) < new Date()) {
        // Bloqueio expirou - desbloquear automaticamente
        await prisma.user.update({
          where: { id: input.userId },
          data: {
            accountFrozen: false,
            frozenReason: null,
            frozenUntil: null,
            frozenBy: null,
          },
        });
        console.log(`🔓 Conta desbloqueada automaticamente (expirou): ${input.userId}`);
      } else {
        // Conta ainda bloqueada
        const message = user.frozenUntil
          ? `Sua conta está suspensa até ${new Date(user.frozenUntil).toLocaleString('pt-BR')}. Motivo: ${user.frozenReason || 'Não especificado'}.`
          : `Sua conta está suspensa permanentemente. Motivo: ${user.frozenReason || 'Não especificado'}. Entre em contato com o suporte.`;
        throw new Error(message);
      }
    }

    // Validar carteira para pedidos BUY
    // Para pedidos de compra (BUY), o usuário DEVE ter uma carteira cadastrada
    // porque após comprar cripto, ele precisa RECEBER a cripto comprada
    if (input.type === 'BUY') {
      const userWallet = await prisma.userWallet.findUnique({
        where: {
          userId_cryptoType_network: {
            userId: input.userId,
            cryptoType: input.cryptoType,
            network: input.cryptoNetwork,
          },
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

    // Para ordens BUY, orderData não é obrigatório na criação
    // O provedor fornecerá os dados de pagamento ao aceitar a ordem
    if (input.type === 'BUY') {
      // Validação mínima para BUY - orderData pode estar vazio ou ausente
      console.log(`📝 [ORDER] Ordem BUY - dados de pagamento serão fornecidos pelo provedor`);
      return; // Não precisa validar orderData
    }

    // Validar dados específicos do método de pagamento (apenas para SELL)
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
  }): Promise<Order | { requiresDeposit: true; missingAmount: string; availableBalance: number; requiredCollateral: string; walletAddress: string }> {
    // Log de entrada para debug
    console.log(`📝 [ORDER] Creating order - userId: ${input.userId}, type: ${input.type}, crypto: ${input.cryptoType}/${input.cryptoNetwork}, amount: ${input.brlAmount} BRL, useInternalBalance: ${input.useInternalBalance}`);

    // Validar criação
    await this.validateOrderCreation(input);

    // Calcular taxas (com cupom se houver)
    const fees = await this.calculateFees(input.cryptoAmount, input.userId);

    // Calcular colateral necessário
    const requiredCollateral = this.calculateRequiredCollateral(input.cryptoAmount);

    // Calcular timeout baseado nas preferências do usuário
    const timeoutAt = this.calculateTimeoutAt(input.customExpirationHours, input.manualCancelOnly);

    // ========== LÓGICA HÍBRIDA ==========

    // CASO 1: Verificar se deve usar HD Wallet balance
    if (input.useInternalBalance !== false) { // Default: tentar usar saldo da carteira
      // Buscar UserWallet do usuário
      const wallet = await prisma.userWallet.findUnique({
        where: {
          userId_cryptoType_network: {
            userId: input.userId,
            cryptoType: input.cryptoType,
            network: input.cryptoNetwork,
          },
        },
      });

      if (wallet) {
        const availableBalance = parseFloat(wallet.availableBalance);

        console.log(`💰 Saldo disponível: ${availableBalance.toFixed(8)} ${input.cryptoType}`);
        console.log(`🎯 Colateral necessário: ${requiredCollateral} ${input.cryptoType}`);

        const hasEnough = availableBalance >= parseFloat(requiredCollateral);

        if (hasEnough) {
          // TEM SALDO SUFICIENTE → Criar pedido INSTANTÂNEO usando saldo da carteira
          console.log(`✅ Usando saldo da carteira HD - Pedido instantâneo!`);
          return await this.createOrderWithWalletBalance(input, fees, timeoutAt, requiredCollateral, wallet.id);
        } else if (!input.collateralAddressId) {
          // NÃO TEM SALDO SUFICIENTE → Retornar info para depósito
          const missingAmount = (parseFloat(requiredCollateral) - availableBalance).toFixed(8);

          console.log(`⚠️ Saldo insuficiente. Falta: ${missingAmount} ${input.cryptoType}`);

          return {
            requiresDeposit: true,
            missingAmount,
            availableBalance,
            requiredCollateral,
            walletAddress: wallet.address, // Incluir endereço para depósito
          };
        }
      } else {
        // Usuário não tem carteira - precisa criar uma primeiro
        console.log(`⚠️ Usuário não possui carteira ${input.cryptoType}/${input.cryptoNetwork}`);

        // Criar carteira HD automaticamente
        const newWallet = await WalletService.createWallet(
          input.userId,
          input.cryptoType,
          input.cryptoNetwork,
          { source: 'ORDER_SELL', details: { trigger: 'sell_order_creation' } }
        );

        console.log(`✅ Carteira HD criada: ${newWallet.address}`);

        // Retornar info para depósito
        return {
          requiresDeposit: true,
          missingAmount: requiredCollateral,
          availableBalance: 0,
          requiredCollateral,
          walletAddress: newWallet.address,
        };
      }
    }

    // CASO 2: collateralAddressId fornecido (deprecated - manter para compatibilidade temporária)
    if (input.collateralAddressId) {
      console.log(`⚠️ collateralAddressId está deprecated. Use saldo da carteira HD.`);
      throw new Error('Depósito via collateralAddress não é mais suportado. Use a carteira HD do usuário.');
    }

    // Se chegou aqui, não tem saldo e não foi fornecido collateralAddressId
    // Retornar erro genérico
    throw new Error('Saldo insuficiente. Deposite crypto na sua carteira antes de criar o pedido.');
  }

  /**
   * Criar pedido usando saldo da carteira HD (INSTANTÂNEO)
   * Usa WalletService para bloquear saldo durante criação do pedido
   */
  private async createOrderWithWalletBalance(
    input: CreateOrderInput,
    fees: FeeCalculation,
    timeoutAt: Date,
    collateralAmount: string,
    walletId: string
  ): Promise<Order> {
    // Aplicar cupom se houver (antes da transaction)
    let couponData = null;
    if (fees.appliedCoupon) {
      // Nota: usamos um orderId temporário que será substituído pelo ID real
      // O applyCouponToOrder incrementará os contadores de uso
      couponData = fees.appliedCoupon;
    }

    // Transaction atômica: criar pedido + bloquear saldo
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar pedido primeiro
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
          // Coupon tracking
          appliedCouponId: couponData?.couponId || null,
          appliedCouponCode: couponData?.code || null,
          appliedCouponDiscount: couponData?.discountPercentage || null,
          originalPlatformFee: couponData?.originalPlatformFee || null,
          discountAmount: couponData?.discountAmount || null,
          orderData: JSON.stringify(input.orderData),
          timeoutAt,
          customExpirationHours: input.customExpirationHours,
          manualCancelOnly: input.manualCancelOnly || false,
          paidByPlatform: false,
          // CRITICAL: Pedido criado com colateral JÁ CONFIRMADO
          collateralConfirmed: true,
          collateralSource: 'HD_WALLET',
          walletId: walletId,
          collateralLocked: true,
          collateralLockedAmount: collateralAmount,
        },
      });

      console.log(`🚀 Pedido ${order.id} criado usando carteira HD!`);
      if (couponData) {
        console.log(`🎟️ Cupom ${couponData.code} (${couponData.discountPercentage}%) aplicado!`);
      }

      // 2. Incrementar contadores de uso do cupom DENTRO da transaction (atomicidade)
      if (couponData) {
        const now = new Date();

        // Atualizar UserCoupon (incrementar timesUsed, definir firstUsedAt apenas se null)
        await tx.$executeRaw`
          UPDATE "UserCoupon"
          SET
            "timesUsed" = "timesUsed" + 1,
            "lastUsedAt" = ${now},
            "firstUsedAt" = COALESCE("firstUsedAt", ${now})
          WHERE "userId" = ${input.userId}
            AND "couponId" = ${couponData.couponId}
            AND "isActive" = true
        `;

        // Atualizar Coupon (incrementar totalUses)
        await tx.coupon.update({
          where: { id: couponData.couponId },
          data: {
            totalUses: { increment: 1 },
          },
        });

        console.log(`✅ Contadores do cupom ${couponData.code} incrementados (dentro da transaction)`);
      }

      return order;
    });

    // 3. Bloquear saldo usando WalletService (FORA da transaction para evitar deadlock)
    try {
      await WalletService.lockBalance(
        walletId,
        collateralAmount,
        result.id,
        `Colateral bloqueado para pedido ${result.id}`
      );

      console.log(`🔒 Saldo bloqueado: ${collateralAmount} ${input.cryptoType}`);
    } catch (error) {
      // Se falhar ao bloquear saldo, cancelar o pedido
      console.error(`❌ Erro ao bloquear saldo:`, (error as Error).message);

      await prisma.order.delete({
        where: {id: result.id},
      });

      throw new Error(`Falha ao bloquear saldo: ${(error as Error).message}`);
    }

    console.log(`✅ Order ${result.id} created with HD WALLET BALANCE - Will appear in marketplace IMMEDIATELY!`);

    return result;
  }

  /**
   * Criar ordem BUY (comprador quer comprar crypto)
   * NÃO requer colateral do criador - o provedor depositará ao aceitar
   * NÃO requer dados de pagamento - o provedor fornecerá ao aceitar
   * Sistema calcula automaticamente o valor em BRL com markup de 2.5%
   */
  async createBuyOrder(input: CreateBuyOrderInput): Promise<Order> {
    console.log(`📝 [BUY ORDER] Creating - userId: ${input.userId}, crypto: ${input.cryptoType}/${input.cryptoNetwork}, amount: ${input.cryptoAmount}`);

    // Validar limite diario baseado em reputacao (usando o brlAmount calculado)
    const brlAmount = await this.calculateBuyOrderBrlAmount(input.cryptoAmount, input.cryptoType);
    const limitCheck = await limitService.canUserTransact(input.userId, parseFloat(brlAmount));

    if (!limitCheck.allowed) {
      throw new Error(
        `Valor excede seu limite diario. ` +
        `Limite: R$ ${limitCheck.dailyLimit.toFixed(2)}, ` +
        `Usado hoje: R$ ${limitCheck.dailyUsed.toFixed(2)}, ` +
        `Disponivel: R$ ${limitCheck.remaining.toFixed(2)}. ` +
        `Complete mais transacoes para aumentar seu limite.`
      );
    }

    // Verificar se conta está congelada
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        accountFrozen: true,
        frozenReason: true,
        frozenUntil: true,
      },
    });

    if (user?.accountFrozen) {
      if (user.frozenUntil && new Date(user.frozenUntil) < new Date()) {
        await prisma.user.update({
          where: { id: input.userId },
          data: {
            accountFrozen: false,
            frozenReason: null,
            frozenUntil: null,
            frozenBy: null,
          },
        });
        console.log(`🔓 Conta desbloqueada automaticamente (expirou): ${input.userId}`);
      } else {
        const message = user.frozenUntil
          ? `Sua conta está suspensa até ${new Date(user.frozenUntil).toLocaleString('pt-BR')}. Motivo: ${user.frozenReason || 'Não especificado'}.`
          : `Sua conta está suspensa permanentemente. Motivo: ${user.frozenReason || 'Não especificado'}. Entre em contato com o suporte.`;
        throw new Error(message);
      }
    }

    // Verificar se usuário tem carteira para receber a crypto
    let buyerWallet = await prisma.userWallet.findUnique({
      where: {
        userId_cryptoType_network: {
          userId: input.userId,
          cryptoType: input.cryptoType,
          network: input.cryptoNetwork,
        },
      },
    });

    // Se não tem carteira, criar automaticamente
    if (!buyerWallet) {
      console.log(`📝 [BUY ORDER] Criando carteira HD para comprador...`);
      buyerWallet = await WalletService.createWallet(
        input.userId,
        input.cryptoType,
        input.cryptoNetwork,
        { source: 'ORDER_BUY', details: { trigger: 'buy_order_creation' } }
      );
      console.log(`✅ [BUY ORDER] Carteira criada: ${buyerWallet.address}`);
    }

    // Calcular taxas para ordem BUY
    const fees = await this.calculateBuyOrderFees(input.cryptoAmount);

    // Calcular timeout
    const timeoutAt = this.calculateTimeoutAt(input.customExpirationHours, input.manualCancelOnly);

    // Criar ordem BUY
    // NOTA: Ordem criada SEM colateral (provedor deposita ao aceitar)
    // NOTA: Ordem criada SEM orderData (provedor fornece PIX ao aceitar)
    const order = await prisma.order.create({
      data: {
        userId: input.userId,
        orderType: OrderType.BUY, // BUY = usuario quer comprar crypto
        type: 'PIX', // Payment method - BUY orders only support PIX
        status: OrderStatus.PENDING,
        cryptoType: input.cryptoType,
        cryptoNetwork: input.cryptoNetwork,
        cryptoAmount: input.cryptoAmount,
        brlAmount: brlAmount,
        platformFee: fees.platformFee,
        payerReward: fees.payerReward, // 0 para BUY
        totalFee: fees.totalFee,
        orderData: JSON.stringify({}), // Vazio - provedor preenche ao aceitar
        timeoutAt,
        customExpirationHours: input.customExpirationHours,
        manualCancelOnly: input.manualCancelOnly || false,
        paidByPlatform: false,
        // Colateral NAO confirmado ainda - provedor deposita ao aceitar
        collateralConfirmed: false,
        collateralSource: null,
        walletId: null,
        collateralLocked: false,
        collateralLockedAmount: null,
      },
    });

    console.log(`✅ [BUY ORDER] Created: ${order.id}`);
    console.log(`   Crypto: ${input.cryptoAmount} ${input.cryptoType}`);
    console.log(`   BRL (com markup 2.5%): R$ ${brlAmount}`);
    console.log(`   Aguardando provedor de liquidez...`);

    return order;
  }

  /**
   * Provedor aceita ordem BUY (fornece liquidez)
   * - Deposita colateral (cryptoAmount + 1.5% fee)
   * - Fornece dados PIX para receber BRL
   * - Cria Transaction com comprador como pagador
   */
  async acceptBuyOrder(input: AcceptBuyOrderInput): Promise<Order> {
    console.log(`🤝 [BUY ORDER] Provider ${input.providerId} accepting order ${input.orderId}`);

    return await prisma.$transaction(async (tx) => {
      // Buscar e travar a ordem
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error('Pedido não encontrado');
      }

      // Validar que e uma ordem BUY
      if (order.orderType !== OrderType.BUY) {
        throw new Error('Este metodo e apenas para ordens de compra (BUY). Use matchOrder para ordens SELL.');
      }

      // Validar status
      if (order.status !== OrderStatus.PENDING) {
        throw new Error('Este pedido não está mais disponível');
      }

      // Provedor não pode aceitar própria ordem
      if (order.userId === input.providerId) {
        throw new Error('Você não pode fornecer liquidez para seu próprio pedido');
      }

      // Verificar timeout
      if (order.timeoutAt && order.timeoutAt < new Date()) {
        throw new Error('Este pedido expirou');
      }

      // Verificar limite diario do provedor (baseado em reputacao)
      const limitCheck = await limitService.canUserTransact(
        input.providerId,
        parseFloat(order.brlAmount)
      );

      if (!limitCheck.allowed) {
        throw new Error(
          `Valor excede seu limite diario. ` +
          `Limite: R$ ${limitCheck.dailyLimit.toFixed(2)}, ` +
          `Usado hoje: R$ ${limitCheck.dailyUsed.toFixed(2)}, ` +
          `Disponivel: R$ ${limitCheck.remaining.toFixed(2)}. ` +
          `Complete mais transacoes para aumentar seu limite.`
        );
      }

      // Verificar se provedor está congelado
      const provider = await tx.user.findUnique({
        where: { id: input.providerId },
        select: {
          accountFrozen: true,
          frozenReason: true,
          frozenUntil: true,
        },
      });

      if (provider?.accountFrozen) {
        if (provider.frozenUntil && new Date(provider.frozenUntil) < new Date()) {
          await tx.user.update({
            where: { id: input.providerId },
            data: {
              accountFrozen: false,
              frozenReason: null,
              frozenUntil: null,
              frozenBy: null,
            },
          });
        } else {
          const message = provider.frozenUntil
            ? `Sua conta está suspensa até ${new Date(provider.frozenUntil).toLocaleString('pt-BR')}.`
            : `Sua conta está suspensa permanentemente. Entre em contato com o suporte.`;
          throw new Error(message);
        }
      }

      // Buscar carteira do provedor
      const providerWallet = await tx.userWallet.findUnique({
        where: {
          userId_cryptoType_network: {
            userId: input.providerId,
            cryptoType: order.cryptoType,
            network: order.cryptoNetwork,
          },
        },
      });

      if (!providerWallet) {
        throw new Error(`Você não possui carteira ${order.cryptoType} (${order.cryptoNetwork}). Crie uma carteira primeiro.`);
      }

      // Calcular colateral necessário (crypto + 1.5% fee)
      const requiredCollateral = this.calculateBuyOrderCollateral(order.cryptoAmount);
      const availableBalance = parseFloat(providerWallet.availableBalance);

      if (availableBalance < parseFloat(requiredCollateral)) {
        throw new Error(
          `Saldo insuficiente. Necessário: ${requiredCollateral} ${order.cryptoType}, Disponível: ${availableBalance.toFixed(8)} ${order.cryptoType}`
        );
      }

      // Preparar dados PIX do provedor
      const providerPixData: PixData = {
        pixKey: input.pixKey,
        pixKeyType: input.pixKeyType,
        recipientName: input.recipientName,
      };

      // Atualizar ordem com dados do provedor
      // TIMEOUT: 30 minutos para pagamento ser confirmado
      const timeout = new Date(Date.now() + 30 * 60 * 1000);

      const updatedOrder = await tx.order.update({
        where: { id: input.orderId },
        data: {
          status: OrderStatus.MATCHED,
          timeoutAt: timeout,
          // Dados do provedor
          providerId: input.providerId,
          providerWalletId: providerWallet.id,
          orderData: JSON.stringify(providerPixData),
          // Colateral
          walletId: providerWallet.id,
          collateralSource: 'HD_WALLET',
          collateralConfirmed: true,
          collateralLocked: true,
          collateralLockedAmount: requiredCollateral,
        },
      });

      // Criar Transaction
      // NOTA: Em ordens BUY, o "pagador" (payerId) é o COMPRADOR (criador da ordem)
      // que vai pagar BRL via PIX para o provedor
      const transaction = await tx.transaction.create({
        data: {
          orderId: input.orderId,
          payerId: order.userId, // Comprador é quem paga BRL
          status: 'PENDING',
        },
      });

      console.log(`✅ [BUY ORDER] Match successful!`);
      console.log(`   Provider: ${input.providerId}`);
      console.log(`   Collateral: ${requiredCollateral} ${order.cryptoType}`);
      console.log(`   PIX: ${input.pixKey} (${input.pixKeyType})`);
      console.log(`   Transaction: ${transaction.id}`);

      return { ...updatedOrder, transaction };
    }, {
      timeout: 15000,
    }).then(async (result) => {
      // Bloquear saldo do provedor FORA da transaction do Prisma
      const providerWallet = await prisma.userWallet.findUnique({
        where: {
          userId_cryptoType_network: {
            userId: input.providerId,
            cryptoType: result.cryptoType,
            network: result.cryptoNetwork,
          },
        },
      });

      if (providerWallet && result.collateralLockedAmount) {
        await WalletService.lockBalance(
          providerWallet.id,
          result.collateralLockedAmount,
          result.id,
          `Colateral bloqueado para ordem BUY ${result.id}`
        );
        console.log(`🔒 [BUY ORDER] Saldo bloqueado: ${result.collateralLockedAmount} ${result.cryptoType}`);
      }

      // Enviar notificações
      setImmediate(async () => {
        try {
          // Notificar comprador (criador da ordem)
          await notificationService.createNotification({
            userId: result.userId,
            type: 'ORDER_MATCHED',
            category: 'ORDER',
            title: '🎉 Provedor Encontrado!',
            message: `Um provedor aceitou seu pedido de compra. Pague R$ ${result.brlAmount} via PIX para receber ${result.cryptoAmount} ${result.cryptoType}.`,
            actionUrl: `/orders/${result.id}`,
            actionLabel: 'Fazer Pagamento',
            relatedId: result.id,
            relatedType: 'ORDER',
            priority: 'HIGH',
          });

          // Notificar provedor
          await notificationService.createNotification({
            userId: input.providerId,
            type: 'ORDER_MATCHED',
            category: 'ORDER',
            title: '✅ Você aceitou uma ordem de compra',
            message: `Aguardando pagamento de R$ ${result.brlAmount} do comprador. Seu colateral está bloqueado.`,
            actionUrl: `/orders/${result.id}`,
            actionLabel: 'Ver Pedido',
            relatedId: result.id,
            relatedType: 'ORDER',
            priority: 'NORMAL',
          });
        } catch (error) {
          console.error('Failed to send buy order notifications:', error);
        }
      });

      return result;
    });
  }

  /**
   * Listar pedidos disponíveis para matching (marketplace)
   *
   * SELL orders: Só mostra pedidos com colateral CONFIRMADO
   * BUY orders: Mostra pedidos PENDING aguardando provedor (sem colateral ainda)
   *
   * NOTA: Mostra TODOS os pedidos, incluindo do próprio usuário
   * A validação de não aceitar próprio pedido é feita no matchOrder()/acceptBuyOrder()
   */
  async getAvailableOrders(excludeUserId?: string, orderTypeFilter?: 'BUY' | 'SELL' | 'ALL'): Promise<Order[]> {
    // Condições base para todos os filtros
    const baseConditions = {
      status: OrderStatus.PENDING, // Apenas pedidos pendentes
      timeoutAt: { gt: new Date() }, // Não expirados
    };

    // Construir where clause baseado no tipo de ordem
    let whereClause: any;

    if (orderTypeFilter === 'BUY') {
      // BUY orders: aguardando provedor (sem colateral confirmado)
      whereClause = {
        ...baseConditions,
        orderType: 'BUY',
      };
    } else if (orderTypeFilter === 'SELL') {
      // SELL orders: com colateral confirmado
      whereClause = {
        ...baseConditions,
        orderType: 'SELL',
        collateralConfirmed: true,
      };
    } else {
      // ALL: Mostrar ambos os tipos usando AND com OR corretamente
      // SELL: precisa ter colateral confirmado
      // BUY: nao precisa (provedor deposita ao aceitar)
      whereClause = {
        AND: [
          baseConditions,
          {
            OR: [
              { orderType: 'SELL', collateralConfirmed: true },
              { orderType: 'BUY' },
            ],
          },
        ],
      };
    }

    try {
      console.log('📊 Marketplace query whereClause:', JSON.stringify(whereClause, null, 2));

      const orders = await prisma.order.findMany({
        where: whereClause,
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

      console.log(`📊 Marketplace: found ${orders.length} orders (type filter: ${orderTypeFilter || 'ALL'})`);
      return orders;
    } catch (error: any) {
      console.error('❌ Marketplace query error:', error.message);
      console.error('❌ Full error:', error);
      throw error;
    }
  }

  /**
   * Obter pedidos do usuário
   * Retorna pedidos onde o usuário é:
   * - CRIADOR (userId)
   * - PAGADOR em ordens SELL (transaction.payerId)
   * - PROVEDOR em ordens BUY (providerId)
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { userId }, // Pedidos criados pelo usuário
          { transactions: { some: { payerId: userId } } }, // Pedidos onde é pagador (SELL)
          { providerId: userId }, // Pedidos onde é provedor (BUY)
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
   * Buscar transações de um pedido
   */
  async getOrderTransactions(orderId: string) {
    return await prisma.transaction.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fazer match de um pedido SELL (pagador aceita pagar)
   * NOTA: Para ordens BUY, use acceptBuyOrder() - este método redirecionará automaticamente
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

      // Para ordens BUY, informar que deve usar acceptBuyOrder
      // O controller vai redirecionar automaticamente
      if (order.orderType === OrderType.BUY) {
        throw new Error('BUY_ORDER_REQUIRES_ACCEPT');
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

      // Verificar limite diario do pagador (baseado em reputacao)
      const limitCheck = await limitService.canUserTransact(
        payerId,
        parseFloat(order.brlAmount)
      );

      if (!limitCheck.allowed) {
        throw new Error(
          `Valor excede seu limite diario. ` +
          `Limite: R$ ${limitCheck.dailyLimit.toFixed(2)}, ` +
          `Usado hoje: R$ ${limitCheck.dailyUsed.toFixed(2)}, ` +
          `Disponivel: R$ ${limitCheck.remaining.toFixed(2)}. ` +
          `Complete mais transacoes para aumentar seu limite.`
        );
      }

      // Verificar se conta do pagador está congelada/bloqueada
      const payer = await tx.user.findUnique({
        where: { id: payerId },
        select: {
          accountFrozen: true,
          frozenReason: true,
          frozenUntil: true,
        },
      });

      if (payer?.accountFrozen) {
        // Verificar se o bloqueio tem data de expiração e se já expirou
        if (payer.frozenUntil && new Date(payer.frozenUntil) < new Date()) {
          // Bloqueio expirou - desbloquear automaticamente
          await tx.user.update({
            where: { id: payerId },
            data: {
              accountFrozen: false,
              frozenReason: null,
              frozenUntil: null,
              frozenBy: null,
            },
          });
          console.log(`🔓 Conta desbloqueada automaticamente (expirou): ${payerId}`);
        } else {
          // Conta ainda bloqueada
          const message = payer.frozenUntil
            ? `Sua conta está suspensa até ${new Date(payer.frozenUntil).toLocaleString('pt-BR')}. Motivo: ${payer.frozenReason || 'Não especificado'}.`
            : `Sua conta está suspensa permanentemente. Motivo: ${payer.frozenReason || 'Não especificado'}. Entre em contato com o suporte.`;
          throw new Error(message);
        }
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
   * Cancelar pedido (pelo criador)
   * SELL: Criador é o vendedor
   * BUY: Criador é o comprador
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

    // Determinar role baseado no tipo de ordem
    // SELL: criador e vendedor (SELLER)
    // BUY: criador e comprador (BUYER)
    const isBuyOrder = order.orderType === OrderType.BUY;
    const creatorRole = isBuyOrder ? UserRole.BUYER : UserRole.SELLER;

    // REGRA: Só aplicar penalidade se alguém já aceitou o pedido (status MATCHED)
    // Se está PENDING, ninguém foi prejudicado, então não há penalidade
    const shouldCalculatePenalty = order.status === OrderStatus.MATCHED;

    let penalty;
    if (shouldCalculatePenalty) {
      penalty = await penaltyService.calculateCancellationPenalty(userId, creatorRole);
    } else {
      // Cancelamento sem penalidade (pedido ainda não foi aceito)
      const noAffectedParty = isBuyOrder ? 'nenhum provedor foi prejudicado' : 'nenhum comprador foi prejudicado';
      penalty = {
        shouldApplyPenalty: false,
        penaltyPoints: 0,
        message: `Pedido cancelado sem penalidade (${noAffectedParty})`,
      };
    }

    // Aplicar penalidade na reputação se necessário
    let reputationBefore: number | undefined;
    let reputationAfter: number | undefined;

    if (penalty.shouldApplyPenalty) {
      const roleDescription = isBuyOrder ? 'comprador' : 'vendedor';
      const result = await penaltyService.applyReputationPenalty(
        userId,
        penalty.penaltyPoints,
        `Cancelamento de pedido como ${roleDescription}: ${reason}`
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
      role: creatorRole,
      reason: reason as any,
      note,
      penaltyApplied: penalty.shouldApplyPenalty,
      penaltyPoints: penalty.penaltyPoints,
      reputationBefore,
      reputationAfter,
      orderStatus: order.status,
      orderValue: order.brlAmount,
    });

    // Desbloquear colateral
    // SELL: colateral do criador (vendedor) em order.walletId
    // BUY: colateral do provedor em order.providerWalletId (se MATCHED)
    const walletToUnlock = isBuyOrder ? order.providerWalletId : order.walletId;

    if (order.collateralSource === 'HD_WALLET' &&
        order.collateralLocked &&
        order.collateralLockedAmount &&
        walletToUnlock) {

      try {
        await WalletService.unlockBalance(
          walletToUnlock,
          order.collateralLockedAmount,
          orderId,
          `Colateral desbloqueado - pedido cancelado pelo criador`
        );

        // Atualizar a ordem para marcar colateral como desbloqueado
        await prisma.order.update({
          where: { id: orderId },
          data: {
            collateralLocked: false,
            collateralUnlockedAt: new Date(),
          },
        });

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

        // Notificar a outra parte se o pedido estava MATCHED
        if (order.status === OrderStatus.MATCHED) {
          if (isBuyOrder && order.providerId) {
            // BUY order: notificar o provedor
            await notificationService.notifyOrderCancelled(
              orderId,
              order.providerId,
              'Pedido foi cancelado pelo comprador'
            );
          } else {
            // SELL order: notificar o comprador
            const transactions = await this.getOrderTransactions(orderId);
            if (transactions && transactions.length > 0) {
              const transaction = transactions[0];
              await notificationService.notifyOrderCancelled(
                orderId,
                transaction.payerId,
                'Pedido foi cancelado pelo vendedor'
              );
            }
          }
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

    // Buscar transações para verificar se existe transação e se o usuário é o pagador
    const transactions = await this.getOrderTransactions(orderId);
    if (!transactions || transactions.length === 0) {
      throw new Error('Este pedido não tem um pagador associado');
    }

    const transaction = transactions[0];
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
    // Resetar timeoutAt para a expiração original do pedido
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PENDING,
        cancelledBy: payerId,
        cancellationReason: reason,
        cancellationNote: note,
        timeoutAt: this.calculateTimeoutAt(order.customExpirationHours ?? undefined, order.manualCancelOnly ?? undefined),
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
   * Cancelar ordem BUY pelo PROVEDOR (quem aceitou fornecer liquidez)
   * O pedido VOLTA para o marketplace (status PENDING)
   * Colateral do provedor é desbloqueado e dados de pagamento são limpos
   */
  async cancelOrderByProvider(
    orderId: string,
    providerId: string,
    reason: string,
    note: string
  ): Promise<{ message: string; penaltyApplied: boolean; penaltyPoints: number }> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Verificar se e uma ordem BUY
    if (order.orderType !== OrderType.BUY) {
      throw new Error('Este metodo e apenas para ordens de compra (BUY)');
    }

    // Verificar se o usuário é o provedor
    if (order.providerId !== providerId) {
      throw new Error('Você não tem permissão para cancelar este pedido (não é o provedor)');
    }

    // Só permite cancelamento em status MATCHED
    if (order.status !== OrderStatus.MATCHED) {
      throw new Error('Este pedido não pode ser cancelado no status atual');
    }

    // Calcular penalidade
    const { penaltyService } = await import('./penalty.service');
    const { cancellationHistoryService } = await import('./cancellationHistory.service');
    const { UserRole } = await import('../types/cancellation.types');

    // Provedor é tratado como SELLER para fins de penalidade (quem tem o cripto)
    const penalty = await penaltyService.calculateCancellationPenalty(providerId, UserRole.SELLER);

    // Aplicar penalidade na reputação se necessário
    let reputationBefore: number | undefined;
    let reputationAfter: number | undefined;

    if (penalty.shouldApplyPenalty) {
      const result = await penaltyService.applyReputationPenalty(
        providerId,
        penalty.penaltyPoints,
        `Cancelamento de ordem BUY como provedor: ${reason}`
      );
      reputationBefore = result.oldReputation;
      reputationAfter = result.newReputation;
    }

    // Desbloquear colateral do provedor
    if (order.collateralLocked && order.collateralLockedAmount && order.providerWalletId) {
      try {
        await WalletService.unlockBalance(
          order.providerWalletId,
          order.collateralLockedAmount,
          orderId,
          `Colateral desbloqueado - provedor cancelou ordem BUY`
        );
        console.log(`🔓 [BUY ORDER] Colateral desbloqueado: ${order.collateralLockedAmount} ${order.cryptoType}`);
      } catch (error: any) {
        console.error(`❌ Erro ao desbloquear colateral do provedor:`, error);
      }
    }

    // Voltar pedido para PENDING (volta ao marketplace sem provedor)
    // Resetar timeoutAt para a expiração original do pedido
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PENDING,
        cancelledBy: providerId,
        cancellationReason: reason,
        cancellationNote: note,
        // Limpar dados do provedor
        providerId: null,
        providerWalletId: null,
        walletId: null,
        orderData: JSON.stringify({}), // Limpar dados de pagamento
        collateralSource: null,
        collateralConfirmed: false,
        collateralLocked: false,
        collateralLockedAmount: null,
        collateralUnlockedAt: new Date(),
        timeoutAt: this.calculateTimeoutAt(order.customExpirationHours ?? undefined, order.manualCancelOnly ?? undefined),
      },
    });

    // Criar registro no histórico
    await cancellationHistoryService.create({
      userId: providerId,
      orderId,
      role: UserRole.SELLER, // Provedor age como vendedor
      reason: reason as any,
      note,
      penaltyApplied: penalty.shouldApplyPenalty,
      penaltyPoints: penalty.penaltyPoints,
      reputationBefore,
      reputationAfter,
      orderStatus: order.status,
      orderValue: order.brlAmount,
    });

    // Deletar transaction se existir
    const transactions = await this.getOrderTransactions(orderId);
    if (transactions && transactions.length > 0) {
      await prisma.transaction.delete({
        where: { id: transactions[0].id },
      });
    }

    console.log(`🔄 [BUY ORDER] ${orderId} voltou ao marketplace após cancelamento do provedor`);

    // Enviar notificações
    setImmediate(async () => {
      try {
        // Notificar o provedor
        const providerMessage = penalty.shouldApplyPenalty
          ? `Você cancelou o fornecimento de liquidez. Penalidade: -${penalty.penaltyPoints} pontos de reputação.`
          : 'Você cancelou o fornecimento de liquidez. O pedido voltou ao marketplace.';

        await notificationService.createNotification({
          userId: providerId,
          type: 'ORDER_STATUS_CHANGE',
          category: 'ORDER',
          title: penalty.shouldApplyPenalty ? '⚠️ Cancelamento com Penalidade' : '✅ Cancelamento Confirmado',
          message: providerMessage,
          actionUrl: `/orders/${orderId}`,
          actionLabel: 'Ver Pedido',
          relatedId: orderId,
          relatedType: 'ORDER',
          priority: penalty.shouldApplyPenalty ? 'HIGH' : 'NORMAL',
        });

        // Notificar o comprador (criador da ordem BUY)
        await notificationService.createNotification({
          userId: order.userId,
          type: 'ORDER_STATUS_CHANGE',
          category: 'ORDER',
          title: '🔄 Provedor Cancelou',
          message: 'O provedor cancelou o fornecimento de liquidez. Seu pedido voltou ao marketplace e está aguardando outro provedor.',
          actionUrl: `/orders/${orderId}`,
          actionLabel: 'Ver Pedido',
          relatedId: orderId,
          relatedType: 'ORDER',
          priority: 'NORMAL',
        });
      } catch (error) {
        console.error('Failed to send provider cancellation notifications:', error);
      }
    });

    return {
      message: penalty.message,
      penaltyApplied: penalty.shouldApplyPenalty,
      penaltyPoints: penalty.penaltyPoints,
    };
  }

  /**
   * Atualizar pedido PENDING (antes de ser aceito)
   * Permite editar: dados de pagamento, tempo de expiração
   * NÃO permite: valores, tipo de cripto, após MATCHED
   */
  async updateOrder(
    orderId: string,
    userId: string,
    updates: {
      customExpirationHours?: number;
      orderData?: {
        pixKey?: string;
        pixKeyType?: string;
        recipientName?: string;
        barcode?: string;
        dueDate?: string;
        recipientDocument?: string;
      };
    }
  ): Promise<Order> {
    // Buscar pedido
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // SECURITY: Verificar se usuário é o dono
    if (order.userId !== userId) {
      throw new Error('Você não tem permissão para editar este pedido');
    }

    // SECURITY: Só permite editar se status PENDING (ninguém aceitou ainda)
    if (order.status !== OrderStatus.PENDING) {
      throw new Error('Só é possível editar pedidos que ainda não foram aceitos (status PENDING)');
    }

    // Preparar dados de atualização
    const updateData: any = {};

    // Atualizar tempo de expiração
    if (updates.customExpirationHours !== undefined) {
      // Validar range (1 a 720 horas = 1 a 30 dias)
      if (updates.customExpirationHours < 1 || updates.customExpirationHours > 720) {
        throw new Error('Tempo de expiração deve estar entre 1 e 720 horas (30 dias)');
      }

      // Recalcular timeoutAt
      const newTimeout = new Date();
      newTimeout.setHours(newTimeout.getHours() + updates.customExpirationHours);

      updateData.customExpirationHours = updates.customExpirationHours;
      updateData.timeoutAt = newTimeout;
    }

    // Atualizar dados de pagamento
    if (updates.orderData) {
      const currentOrderData = JSON.parse(order.orderData);
      const newOrderData = { ...currentOrderData };

      // Detectar método de pagamento pelos dados existentes
      const isPix = currentOrderData.pixKey !== undefined;
      const isBoleto = currentOrderData.barcode !== undefined;

      // Validar tipo de pedido antes de permitir edição
      if (isPix) {
        // Atualizar campos PIX
        if (updates.orderData.pixKey !== undefined) {
          if (updates.orderData.pixKey.trim().length < 3) {
            throw new Error('Chave PIX deve ter pelo menos 3 caracteres');
          }
          newOrderData.pixKey = updates.orderData.pixKey;
        }

        if (updates.orderData.pixKeyType !== undefined) {
          const validTypes = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'];
          if (!validTypes.includes(updates.orderData.pixKeyType)) {
            throw new Error('Tipo de chave PIX inválido');
          }
          newOrderData.pixKeyType = updates.orderData.pixKeyType;
        }

        if (updates.orderData.recipientName !== undefined) {
          if (updates.orderData.recipientName.trim().length < 3) {
            throw new Error('Nome do beneficiário deve ter pelo menos 3 caracteres');
          }
          newOrderData.recipientName = updates.orderData.recipientName;
        }
      } else if (isBoleto) {
        // Atualizar campos BOLETO
        if (updates.orderData.barcode !== undefined) {
          if (updates.orderData.barcode.length < 44) {
            throw new Error('Código de barras deve ter no mínimo 44 caracteres');
          }
          newOrderData.barcode = updates.orderData.barcode;
        }

        if (updates.orderData.dueDate !== undefined) {
          // Validar formato YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(updates.orderData.dueDate)) {
            throw new Error('Data de vencimento inválida (use formato YYYY-MM-DD)');
          }
          const dueDate = new Date(updates.orderData.dueDate);
          if (dueDate < new Date()) {
            throw new Error('Data de vencimento não pode estar no passado');
          }
          newOrderData.dueDate = updates.orderData.dueDate;
        }

        if (updates.orderData.recipientName !== undefined) {
          if (updates.orderData.recipientName.trim().length < 3) {
            throw new Error('Nome do beneficiário deve ter pelo menos 3 caracteres');
          }
          newOrderData.recipientName = updates.orderData.recipientName;
        }

        if (updates.orderData.recipientDocument !== undefined) {
          if (updates.orderData.recipientDocument.trim().length < 11) {
            throw new Error('CPF/CNPJ do beneficiário inválido');
          }
          newOrderData.recipientDocument = updates.orderData.recipientDocument;
        }
      }

      updateData.orderData = JSON.stringify(newOrderData);
    }

    // Se não há nada para atualizar
    if (Object.keys(updateData).length === 0) {
      throw new Error('Nenhuma alteração foi fornecida');
    }

    // Atualizar pedido
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    console.log(`✏️ Order ${orderId} updated by user ${userId}`);

    // Notificar usuário sobre atualização bem-sucedida
    setImmediate(async () => {
      try {
        await notificationService.createNotification({
          userId,
          type: 'ORDER_STATUS_CHANGE',
          category: 'ORDER',
          title: '✏️ Pedido Atualizado',
          message: 'Seu pedido foi atualizado com sucesso e continua disponível no marketplace.',
          actionUrl: `/orders/${orderId}`,
          actionLabel: 'Ver Pedido',
          relatedId: orderId,
          relatedType: 'ORDER',
          priority: 'LOW',
        });
      } catch (error) {
        console.error('Failed to send order update notification:', error);
      }
    });

    return updatedOrder;
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

    orders.forEach((order: any) => {
      const isSeller = order.userId === userId;
      const isBuyer = order.transactions?.[0]?.payerId === userId;

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
