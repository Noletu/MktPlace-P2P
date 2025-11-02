import { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { OrderType } from '../types/order.types';
import { z } from 'zod';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';
import { auditLogger } from '../utils/logger';

const BoletoDataSchema = z.object({
  barcode: z.string().min(44, 'Código de barras do boleto deve ter no mínimo 44 caracteres'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida'),
  recipientName: z.string().min(3, 'Nome do beneficiário é obrigatório'),
  recipientDocument: z.string().min(11, 'CPF/CNPJ do beneficiário é obrigatório'),
});

const PixDataSchema = z.object({
  pixKey: z.string().min(3, 'Chave PIX é obrigatória'),
  pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
  recipientName: z.string().min(3, 'Nome do beneficiário é obrigatório'),
});

const CreateOrderSchema = z.object({
  type: z.nativeEnum(OrderType),
  paymentMethod: z.enum(['PIX', 'BOLETO']).optional(), // Método de pagamento (PIX ou Boleto)
  cryptoType: z.string().min(1, 'Tipo de criptomoeda é obrigatório'),
  cryptoNetwork: z.string().min(1, 'Rede blockchain é obrigatória'),
  cryptoAmount: z.string()
    .min(1, 'Valor em criptomoeda é obrigatório')
    .refine((val) => parseFloat(val) > 0, 'Valor em criptomoeda deve ser maior que zero'),
  brlAmount: z.string()
    .min(1, 'Valor em BRL é obrigatório')
    .refine((val) => parseFloat(val) > 0, 'Valor em BRL deve ser maior que zero'),
  orderData: z.union([BoletoDataSchema, PixDataSchema]),
  collateralAddressId: z.string().optional(), // ID do colateral confirmado
  useInternalBalance: z.boolean().optional(), // Flag para usar saldo interno
  customExpirationHours: z.number().int().min(1).max(720).optional(), // Tempo de expiração customizado (1-720 horas = 1-30 dias)
  manualCancelOnly: z.boolean().optional(), // Se true, expira após 6 meses ao invés de prazo padrão/customizado
});

export class OrderController {
  async createOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      // Log completo do body para debug
      console.log('📦 [ORDER] Request body:', JSON.stringify(req.body, null, 2));

      const validatedData = CreateOrderSchema.parse(req.body);

      const result = await orderService.createOrder({
        userId,
        ...validatedData,
      });

      // Verificar se é necessário depósito
      if ('requiresDeposit' in result && result.requiresDeposit) {
        return res.status(200).json({
          success: true,
          requiresDeposit: true,
          data: result,
          message: 'Saldo insuficiente. É necessário depositar mais colateral.',
        });
      }

      // Pedido criado com sucesso
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
          brlAmount: validatedData.brlAmount,
        }
      );

      auditLogger.orderCreated(userId, order.id, {
        type: validatedData.type,
        brlAmount: validatedData.brlAmount,
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

      console.error('❌ [ORDER] Error creating order:', error.message);
      console.error('Stack trace:', error.stack);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao criar pedido',
        message: error.message || 'Ocorreu um erro ao processar seu pedido',
      });
    }
  }

  async getMarketplace(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      // Excluir pedidos do próprio usuário
      const orders = await orderService.getAvailableOrders(userId);

      console.log(`📊 Marketplace: userId=${userId}, found ${orders.length} orders`);

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

      // SECURITY: Verificar se usuário tem permissão para ver este pedido
      const isOwner = order.userId === userId;
      const isPayer = order.transactions.some((t: any) => t.payerId === userId);
      const isAdmin = req.user?.role === 'ADMIN';
      const isMarketplaceOrder = ['PENDING', 'IN_NEGOTIATION'].includes(order.status);

      // Permitir acesso se:
      // 1. É owner/payer/admin (sempre)
      // 2. Pedido está no marketplace (PENDING ou IN_NEGOTIATION) - qualquer usuário pode ver
      if (!isOwner && !isPayer && !isAdmin && !isMarketplaceOrder) {
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

  async cancelOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { orderId } = req.params;

      await orderService.cancelOrder(orderId, userId);

      // SECURITY: Audit log - order cancelled
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ORDER_CANCEL,
        AUDIT_RESOURCES.ORDER,
        orderId
      );

      res.json({
        success: true,
        message: 'Pedido cancelado com sucesso',
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

      await orderService.cancelOrderByPayer(orderId, userId);

      // SECURITY: Audit log - order cancelled by payer
      auditLogService.logFromRequest(
        req,
        'ORDER_CANCEL_BY_PAYER',
        AUDIT_RESOURCES.ORDER,
        orderId
      );

      res.json({
        success: true,
        message: 'Pedido cancelado com sucesso. O pedido voltou ao marketplace.',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao cancelar pedido',
      });
    }
  }
}

export const orderController = new OrderController();
