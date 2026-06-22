import { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { orderQuoteService } from '../services/orderQuote.service';
import { boletoOCRService } from '../services/boleto-ocr.service';
import { OrderType, PaymentMethod } from '../types/order.types';
import { z } from 'zod';
import { gtBN } from '../utils/money';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';
import { auditLogger } from '../utils/logger';
import { Transaction } from '@prisma/client';
import { documentSchema, isValidPixKey } from '@mktplace/shared';

const BoletoDataSchema = z.object({
  barcode: z.string().refine((code) => boletoOCRService.validateBarcode(code), {
    message:
      'Código de barras inválido: use a linha digitável de 47 dígitos (boleto bancário) ou 48 dígitos (convênio/arrecadação) com dígitos verificadores válidos',
  }),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida'),
  recipientName: z.string().min(3, 'Nome do beneficiário é obrigatório'),
  recipientDocument: documentSchema,
});

const PixDataSchema = z.object({
  pixKey: z.string().min(3, 'Chave PIX é obrigatória'),
  pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
  recipientName: z.string().min(3, 'Nome do beneficiário é obrigatório'),
}).refine(
  (d) => isValidPixKey(d.pixKey, d.pixKeyType),
  { message: 'Chave PIX inválida para o tipo informado', path: ['pixKey'] }
);

// Schema para ordens SELL (criador fornece dados de pagamento)
const CreateSellOrderSchema = z.object({
  type: z.literal('SELL'),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  cryptoType: z.string().min(1, 'Tipo de criptomoeda é obrigatório'),
  cryptoNetwork: z.string().min(1, 'Rede blockchain é obrigatória'),
  cryptoAmount: z.string()
    .min(1, 'Valor em criptomoeda é obrigatório')
    .refine((val) => gtBN(val, '0'), 'Valor em criptomoeda deve ser maior que zero'),
  brlAmount: z.string()
    .min(1, 'Valor em BRL é obrigatório')
    .refine((val) => gtBN(val, '0'), 'Valor em BRL deve ser maior que zero'),
  // FEATURE (preço personalizado): opcional. Se ausente = preço de mercado (comportamento atual).
  // Sem trava de desvio de mercado (decisão de produto). Apenas validado como decimal > 0.
  unitPrice: z.string()
    .refine((val) => /^\d+(\.\d+)?$/.test(val), 'Preço unitário inválido')
    .refine((val) => gtBN(val, '0'), 'Preço unitário deve ser maior que zero')
    .optional(),
  // FEATURE (price-lock): cotação travada a consumir num pedido a preço de mercado.
  // Ausente = mercado live (comportamento atual). Ignorado quando unitPrice (custom) vier.
  quoteId: z.string().min(1).optional(),
  orderData: z.union([BoletoDataSchema, PixDataSchema]),
  collateralAddressId: z.string().optional(),
  customExpirationHours: z.number().int().min(1).max(720).optional(),
  manualCancelOnly: z.boolean().optional(),
});

// Schema para ordens BUY (criador NÃO fornece dados de pagamento - provedor fornecerá)
const CreateBuyOrderSchema = z.object({
  type: z.literal('BUY'),
  cryptoType: z.string().min(1, 'Tipo de criptomoeda é obrigatório'),
  cryptoNetwork: z.string().min(1, 'Rede blockchain é obrigatória'),
  cryptoAmount: z.string()
    .min(1, 'Valor em criptomoeda é obrigatório')
    .refine((val) => gtBN(val, '0'), 'Valor em criptomoeda deve ser maior que zero'),
  // brlAmount é calculado automaticamente pelo sistema para BUY orders
  // FEATURE (preço personalizado): opcional. Se ausente = preço de mercado (comportamento atual).
  // Sem trava de desvio de mercado (decisão de produto). Apenas validado como decimal > 0.
  unitPrice: z.string()
    .refine((val) => /^\d+(\.\d+)?$/.test(val), 'Preço unitário inválido')
    .refine((val) => gtBN(val, '0'), 'Preço unitário deve ser maior que zero')
    .optional(),
  // FEATURE (price-lock): cotação travada a consumir num pedido a preço de mercado.
  // Ausente = mercado live (comportamento atual). Ignorado quando unitPrice (custom) vier.
  quoteId: z.string().min(1).optional(),
  customExpirationHours: z.number().int().min(1).max(720).optional(),
  manualCancelOnly: z.boolean().optional(),
});

// Schema discriminado que valida diferentemente baseado no tipo
const CreateOrderSchema = z.discriminatedUnion('type', [
  CreateSellOrderSchema,
  CreateBuyOrderSchema,
]);

// Schema para criar cotação travada (price-lock). A validação contra o enum
// CryptoType acontece no service; aqui só garantimos presença/tipo do campo.
const CreateQuoteSchema = z.object({
  cryptoType: z.string().min(1, 'Tipo de criptomoeda é obrigatório'),
});

// Schema para provedor aceitar ordem BUY
const AcceptBuyOrderSchema = z.object({
  pixKey: z.string().min(3, 'Chave PIX é obrigatória'),
  pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
  recipientName: z.string().min(3, 'Nome do beneficiário é obrigatório'),
}).refine(
  (d) => isValidPixKey(d.pixKey, d.pixKeyType),
  { message: 'Chave PIX inválida para o tipo informado', path: ['pixKey'] }
);

export class OrderController {
  async createOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      // SECURITY: Verificação rápida de conta congelada (segunda camada)
      if ((req.user as any)?.accountFrozen) {
        return res.status(403).json({
          success: false,
          error: 'Sua conta está suspensa. Você não pode criar pedidos.',
          code: 'ACCOUNT_FROZEN',
        });
      }

      // Log completo do body para debug
      console.log('📦 [ORDER] Request body:', JSON.stringify(req.body, null, 2));

      const validatedData = CreateOrderSchema.parse(req.body);

      let result;

      // BUY orders usam método específico (não requer colateral nem dados de pagamento)
      if (validatedData.type === 'BUY') {
        result = await orderService.createBuyOrder({
          userId,
          cryptoType: validatedData.cryptoType,
          cryptoNetwork: validatedData.cryptoNetwork,
          cryptoAmount: validatedData.cryptoAmount,
          unitPrice: validatedData.unitPrice, // FEATURE (preço personalizado): persiste o snapshot; cálculo do brlAmount fica na Parte C
          quoteId: validatedData.quoteId, // FEATURE (price-lock): cotação travada a consumir (E.2d-2); mapeamento explícito (BUY não usa spread)
          customExpirationHours: validatedData.customExpirationHours,
          manualCancelOnly: validatedData.manualCancelOnly,
        });
      } else {
        // SELL orders usam método existente
        result = await orderService.createOrder({
          userId,
          ...validatedData,
        } as any);
      }

      // Verificar se é necessário depósito
      if ('requiresDeposit' in result && result.requiresDeposit) {
        return res.status(200).json({
          success: true,
          requiresDeposit: true,
          data: result,
          message: 'Saldo insuficiente. É necessário depositar mais colateral.',
        });
      }

      // Pedido criado com sucesso - garantir que é um Order
      if (!('id' in result)) {
        throw new Error('Falha ao criar pedido: ID não retornado');
      }
      const order = result;

      // SECURITY: Audit log - pedido criado
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ORDER_CREATE,
        AUDIT_RESOURCES.ORDER,
        order.id,
        {
          type: validatedData.type,
          cryptoAmount: validatedData.cryptoAmount,
          brlAmount: validatedData.type === 'SELL' ? validatedData.brlAmount : undefined,
        }
      );

      auditLogger.orderCreated(userId, order.id, {
        type: validatedData.type,
        brlAmount: validatedData.type === 'SELL' ? validatedData.brlAmount : undefined,
      });

      res.status(201).json({
        success: true,
        data: order,
        message: 'Pedido criado com sucesso! Aguardando matching...',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error('❌ [ORDER] Validation error - Campos inválidos:');
        error.errors.forEach((err) => {
          console.error(`  ❌ Campo: ${err.path.join('.')} - Erro: ${err.message}`);
          console.error(`     Valor recebido:`, err);
        });

        // Criar mensagem mais clara
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          received: err.code === 'invalid_type' ? err.received : undefined,
        }));

        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          message: `Erro de validação: ${fieldErrors[0].message}`,
          details: fieldErrors,
        });
      }

      // FEATURE (price-lock) — E.2d: mapear erros de consumo da cotação travada.
      // QUOTE_FORBIDDEN vira 404 (não vaza que a quote existe para outro usuário).
      // O front distingue expirada/usada pelo `code` no corpo, não pelo status.
      if (error.message === 'QUOTE_NOT_FOUND' || error.message === 'QUOTE_FORBIDDEN') {
        return res.status(404).json({
          success: false,
          error: 'Cotação não encontrada',
          code: error.message,
        });
      }
      if (error.message === 'QUOTE_EXPIRED' || error.message === 'QUOTE_ALREADY_USED') {
        return res.status(409).json({
          success: false,
          error: error.message === 'QUOTE_EXPIRED' ? 'Cotação expirada' : 'Cotação já utilizada',
          code: error.message,
        });
      }

      console.error('❌ [ORDER] Error creating order:', error.message);
      console.error('Stack trace:', error.stack);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao criar pedido',
        message: error.message || 'Ocorreu um erro ao processar seu pedido',
      });
    }
  }

  /**
   * Cria uma cotação travada (price-lock) para criação de pedido a preço de mercado.
   * Retorna { quoteId, unitPrice, expiresAt }. O consumo da quote acontece no submit
   * do pedido (E.2d). Aqui o único erro de negócio possível é INVALID_CRYPTO_TYPE.
   */
  async createQuote(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Não autorizado' });
      }

      const { cryptoType } = CreateQuoteSchema.parse(req.body);

      const quote = await orderQuoteService.createOrderQuote(userId, cryptoType);

      return res.status(201).json({
        success: true,
        data: quote, // { quoteId, unitPrice, expiresAt }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          message: `Erro de validação: ${error.errors[0]?.message}`,
        });
      }

      if (error.message === 'INVALID_CRYPTO_TYPE') {
        return res.status(400).json({
          success: false,
          error: 'Criptomoeda inválida',
          code: 'INVALID_CRYPTO_TYPE',
        });
      }

      console.error('❌ [QUOTE] Error creating quote:', error.message);
      console.error('Stack trace:', error.stack);
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar cotação',
      });
    }
  }

  async getMarketplace(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      // Filtro por tipo de ordem (BUY, SELL, ou ALL)
      const { type } = req.query;
      const orderType = type === 'BUY' || type === 'SELL' ? type : 'ALL';

      const orders = await orderService.getAvailableOrders(userId, orderType);

      console.log(`📊 Marketplace: userId=${userId}, type=${orderType}, found ${orders.length} orders`);

      res.json({
        success: true,
        data: orders,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar pedidos',
      });
    }
  }

  async getUserOrders(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const orders = await orderService.getUserOrders(userId);

      res.json({
        success: true,
        data: orders,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar pedidos',
      });
    }
  }

  async getOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;

      const order = await orderService.getOrderById(orderId);

      if (!order) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      // Buscar transactions para verificar permissão
      const transactions = await orderService.getOrderTransactions(orderId);

      // SECURITY: Verificar se usuário tem permissão para ver este pedido
      const isOwner = order.userId === userId;
      const isPayer = transactions.some((t: Transaction) => t.payerId === userId);
      const isProvider = order.providerId === userId; // BUY orders: provedor de liquidez
      const isAdmin = req.user?.role === 'ADMIN';
      const isMarketplaceOrder = ['PENDING', 'IN_NEGOTIATION'].includes(order.status);

      // Permitir acesso se:
      // 1. É owner/payer/provider/admin (sempre)
      // 2. Pedido está no marketplace (PENDING ou IN_NEGOTIATION) - qualquer usuário pode ver
      if (!isOwner && !isPayer && !isProvider && !isAdmin && !isMarketplaceOrder) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar pedido',
      });
    }
  }

  async matchOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;

      const order = await orderService.matchOrder(orderId, userId);

      // SECURITY: Audit log - order matched
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ORDER_MATCH,
        AUDIT_RESOURCES.ORDER,
        orderId,
        { payerId: userId }
      );

      auditLogger.orderMatched(orderId, userId);

      res.json({
        success: true,
        data: order,
        message: 'Match realizado! Agora você pode efetuar o pagamento.',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao fazer match',
      });
    }
  }

  async updateOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;
      const { customExpirationHours, orderData } = req.body;

      // Validar que pelo menos um campo foi enviado
      if (customExpirationHours === undefined && !orderData) {
        return res.status(400).json({
          error: 'Nenhum dado para atualizar. Forneça customExpirationHours ou orderData.',
        });
      }

      // Atualizar pedido
      const updatedOrder = await orderService.updateOrder(orderId, userId, {
        customExpirationHours,
        orderData,
      });

      // SECURITY: Audit log - order updated
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.UPDATE,
        AUDIT_RESOURCES.ORDER,
        orderId,
        { customExpirationHours, orderData }
      );

      res.json({
        success: true,
        data: updatedOrder,
        message: 'Pedido atualizado com sucesso',
      });
    } catch (error: any) {
      // SECURITY: Audit log do erro
      if (req.user) {
        auditLogService.logFromRequest(
          req,
          AUDIT_ACTIONS.UPDATE,
          AUDIT_RESOURCES.ORDER,
          req.params.orderId,
          { error: error.message },
          false,
          error.message
        );
      }

      res.status(400).json({
        error: error.message || 'Erro ao atualizar pedido',
      });
    }
  }

  async cancelOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;
      const { reason, note } = req.body;

      // Validar inputs obrigatórios
      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'Motivo do cancelamento é obrigatório' });
      }

      if (!note || typeof note !== 'string' || note.trim().length < 20) {
        return res.status(400).json({
          error: 'Por favor, forneça uma justificativa com pelo menos 20 caracteres',
        });
      }

      const result = await orderService.cancelOrder(orderId, userId, reason, note);

      // SECURITY: Audit log - order cancelled
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ORDER_CANCEL,
        AUDIT_RESOURCES.ORDER,
        orderId,
        { reason, penaltyApplied: result.penaltyApplied },
        true
      );

      res.json({
        success: true,
        message: result.message,
        penaltyApplied: result.penaltyApplied,
        penaltyPoints: result.penaltyPoints,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao cancelar pedido',
      });
    }
  }

  async cancelOrderByPayer(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;
      const { reason, note } = req.body;

      // Validar inputs obrigatórios
      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'Motivo do cancelamento é obrigatório' });
      }

      if (!note || typeof note !== 'string' || note.trim().length < 20) {
        return res.status(400).json({
          error: 'Por favor, forneça uma justificativa com pelo menos 20 caracteres',
        });
      }

      const result = await orderService.cancelOrderByPayer(orderId, userId, reason, note);

      // SECURITY: Audit log - order cancelled by payer
      auditLogService.logFromRequest(
        req,
        'ORDER_CANCEL_BY_PAYER',
        AUDIT_RESOURCES.ORDER,
        orderId,
        { reason, penaltyApplied: result.penaltyApplied },
        true
      );

      res.json({
        success: true,
        message: result.message,
        penaltyApplied: result.penaltyApplied,
        penaltyPoints: result.penaltyPoints,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao cancelar pedido',
      });
    }
  }

  async getCancellationWarning(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { penaltyService } = await import('../services/penalty.service');
      const warning = await penaltyService.shouldWarnBeforeCancellation(userId);

      res.json({
        success: true,
        data: warning,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao verificar advertência',
      });
    }
  }

  async getCancellationStats(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { penaltyService } = await import('../services/penalty.service');
      const stats = await penaltyService.getCancellationStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao buscar estatísticas de cancelamento',
      });
    }
  }

  async getCancellationHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { limit = '20', offset = '0' } = req.query;
      const { cancellationHistoryService } = await import('../services/cancellationHistory.service');

      const history = await cancellationHistoryService.getUserHistory(userId, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao buscar histórico de cancelamentos',
      });
    }
  }

  async getUserStatistics(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);

      const stats = await orderService.getUserStatistics(userId, daysNum);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  }

  // ANTI-SPAM: Obter estatísticas de cancelamento para proteção anti-spam
  async getAntiSpamStats(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { antiSpamService } = await import('../services/antiSpam.service');
      const stats = await antiSpamService.getUserCancellationStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar estatísticas anti-spam',
      });
    }
  }

  /**
   * Provedor aceita ordem BUY (fornece liquidez)
   * POST /orders/:orderId/accept-buy
   */
  async acceptBuyOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;
      const validatedData = AcceptBuyOrderSchema.parse(req.body);

      const order = await orderService.acceptBuyOrder({
        orderId,
        providerId: userId,
        ...validatedData,
      });

      // SECURITY: Audit log - BUY order accepted
      auditLogService.logFromRequest(
        req,
        'BUY_ORDER_ACCEPTED',
        AUDIT_RESOURCES.ORDER,
        orderId,
        { providerId: userId, pixKey: validatedData.pixKey }
      );

      res.json({
        success: true,
        data: order,
        message: 'Você aceitou fornecer liquidez! Aguardando pagamento do comprador.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Erro ao aceitar ordem de compra',
      });
    }
  }

  /**
   * Provedor cancela ordem BUY (desiste de fornecer liquidez)
   * POST /orders/:orderId/cancel-by-provider
   */
  async cancelOrderByProvider(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;
      const { reason, note } = req.body;

      // Validar inputs obrigatórios
      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'Motivo do cancelamento é obrigatório' });
      }

      if (!note || typeof note !== 'string' || note.trim().length < 20) {
        return res.status(400).json({
          error: 'Por favor, forneça uma justificativa com pelo menos 20 caracteres',
        });
      }

      const result = await orderService.cancelOrderByProvider(orderId, userId, reason, note);

      // SECURITY: Audit log - provider cancelled
      auditLogService.logFromRequest(
        req,
        'BUY_ORDER_CANCELLED_BY_PROVIDER',
        AUDIT_RESOURCES.ORDER,
        orderId,
        { reason, penaltyApplied: result.penaltyApplied },
        true
      );

      res.json({
        success: true,
        message: result.message,
        penaltyApplied: result.penaltyApplied,
        penaltyPoints: result.penaltyPoints,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao cancelar pedido',
      });
    }
  }
}

export const orderController = new OrderController();
