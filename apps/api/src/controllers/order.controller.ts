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
  cryptoType: z.string(),
  cryptoNetwork: z.string(),
  cryptoAmount: z.string(),
  brlAmount: z.string(),
  orderData: z.union([BoletoDataSchema, PixDataSchema]),
});

export class OrderController {
  async createOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const validatedData = CreateOrderSchema.parse(req.body);

      const order = await orderService.createOrder({
        userId,
        ...validatedData,
      });

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
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Erro ao criar pedido',
      });
    }
  }

  async getMarketplace(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      // Excluir pedidos do próprio usuário
      const orders = await orderService.getAvailableOrders(userId);

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

      if (!isOwner && !isPayer && !isAdmin) {
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
}

export const orderController = new OrderController();
