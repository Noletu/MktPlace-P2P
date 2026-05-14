import { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service';
import { z } from 'zod';
import { prisma } from '../utils/prisma';

const SubmitProofSchema = z.object({
  transactionId: z.string(),
  comprovanteData: z.string().min(10, 'Comprovante é obrigatório').max(5_000_000, 'Comprovante muito grande (máximo 5MB)'),
  comprovanteUrl: z.string().optional(),
});

const ValidateProofSchema = z.object({
  approved: z.boolean(),
  validationScore: z.number().min(0).max(100).optional(),
  reason: z.string().optional(),
});

const DisputeSchema = z.object({
  reason: z.string().min(10, 'Motivo da disputa deve ter no mínimo 10 caracteres'),
  disputeData: z.any().optional(),
});

export class TransactionController {
  async submitProof(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const validatedData = SubmitProofSchema.parse(req.body);

      const transaction = await transactionService.submitProof({
        ...validatedData,
        userId,
      });

      // Auto-validação DESABILITADA - Requer confirmação manual do vendedor
      // setTimeout(async () => {
      //   try {
      //     await transactionService.autoValidateProof(transaction.id);
      //   } catch (error) {
      //     console.error('Erro na auto-validação:', error);
      //   }
      // }, 5000); // 5 segundos de delay

      res.json({
        success: true,
        data: transaction,
        message: 'Comprovante enviado com sucesso! Aguardando validação...',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Erro ao enviar comprovante',
      });
    }
  }

  async validateProof(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { transactionId } = req.params;
      const validatedData = ValidateProofSchema.parse(req.body);

      const transaction = await transactionService.validateProof({
        transactionId,
        validatedBy: userId,
        ...validatedData,
      });

      res.json({
        success: true,
        data: transaction,
        message: validatedData.approved
          ? 'Comprovante aprovado!'
          : 'Comprovante rejeitado',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Erro ao validar comprovante',
      });
    }
  }

  async createDispute(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { transactionId } = req.params;
      const validatedData = DisputeSchema.parse(req.body);

      const transaction = await transactionService.createDispute({
        transactionId,
        userId,
        ...validatedData,
      });

      res.json({
        success: true,
        data: transaction,
        message: 'Disputa criada. Nossa equipe irá analisar o caso.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Erro ao criar disputa',
      });
    }
  }

  async getTransaction(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { transactionId } = req.params;

      const transaction = await transactionService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }

      // Buscar order para verificar permissões
      const { prisma } = await import('../utils/prisma');
      const order = await prisma.order.findUnique({
        where: { id: transaction.orderId },
        select: { userId: true },
      });

      // SECURITY: Verificar se usuário tem permissão para ver esta transação
      const isPayer = transaction.payerId === userId;
      const isOrderOwner = order?.userId === userId;
      const isAdmin = req.user?.role === 'ADMIN';

      if (!isPayer && !isOrderOwner && !isAdmin) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      res.json({
        success: true,
        data: transaction,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar transação',
      });
    }
  }

  async getUserTransactions(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const transactions = await transactionService.getUserTransactions(userId);

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar transações',
      });
    }
  }

  /**
   * Histórico completo com filtros
   */
  async getTransactionHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { status, startDate, endDate, type, limit, offset } = req.query;

      const result = await transactionService.getTransactionHistory({
        userId,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        type: type as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: {
          transactions: result.transactions,
          total: result.total,
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar histórico',
      });
    }
  }

  /**
   * Estatísticas de transações
   */
  async getTransactionStats(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { startDate, endDate } = req.query;

      const stats = await transactionService.getTransactionStats(userId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  }

  /**
   * Timeline de atividades
   */
  async getActivityTimeline(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { limit } = req.query;

      const timeline = await transactionService.getActivityTimeline(
        userId,
        limit ? parseInt(limit as string) : 20
      );

      res.json({
        success: true,
        data: timeline,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar timeline',
      });
    }
  }

  /**
   * Vendedor confirma que recebeu o pagamento
   * Isso aprova automaticamente a transação
   */
  async confirmPaymentReceived(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { transactionId } = req.params;

      // Buscar transação com pedido
      const transaction = await transactionService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }

      // Buscar order para verificar permissões
      const { prisma } = await import('../utils/prisma');
      const order = await prisma.order.findUnique({
        where: { id: transaction.orderId },
        select: { userId: true, orderType: true, providerId: true },
      });

      // SECURITY: Verificar se usuário pode confirmar recebimento
      // SELL orders: dono do pedido (vendedor) confirma
      // BUY orders: provedor (quem forneceu liquidez) confirma
      const isBuyOrder = order?.orderType === 'BUY';
      const canConfirm = isBuyOrder
        ? order?.providerId === userId  // BUY: provedor confirma
        : order?.userId === userId;      // SELL: dono confirma

      if (!canConfirm) {
        return res.status(403).json({
          error: isBuyOrder
            ? 'Apenas o provedor de liquidez pode confirmar o recebimento do pagamento'
            : 'Apenas o vendedor pode confirmar o recebimento do pagamento',
        });
      }

      // Verificar se transação está em estado válido para confirmação
      if (transaction.status !== 'VALIDATING') {
        return res.status(400).json({
          error: 'Esta transação não está aguardando confirmação de recebimento',
        });
      }

      // Aprovar a transação
      const updatedTransaction = await transactionService.validateProof({
        transactionId,
        validatedBy: userId,
        approved: true,
        validationScore: 100,
      });

      res.json({
        success: true,
        data: updatedTransaction,
        message: 'Pagamento confirmado! A criptomoeda foi liberada.',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao confirmar recebimento',
      });
    }
  }

  /**
   * Pagador confirma que o pagamento foi feito
   * Isso muda o status do pedido para PAYMENT_SENT
   */
  async confirmPaymentMade(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { transactionId } = req.params;

      // Buscar transação com pedido
      const transaction = await transactionService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }

      // Buscar order para verificar status
      const order = await prisma.order.findUnique({
        where: { id: transaction.orderId },
        select: { status: true },
      });

      // SECURITY: Verificar se usuário é o pagador
      if (transaction.payerId !== userId) {
        return res.status(403).json({
          error: 'Apenas o pagador pode confirmar que o pagamento foi feito',
        });
      }

      // Verificar se transação está em estado válido (deve estar PENDING)
      if (transaction.status !== 'PENDING') {
        return res.status(400).json({
          error: 'Esta transação não está aguardando confirmação de pagamento',
        });
      }

      // Verificar se o pedido está MATCHED
      if (order?.status !== 'MATCHED') {
        return res.status(400).json({
          error: 'O pedido não está no status correto para confirmar pagamento',
        });
      }

      // Atualizar o status do pedido para PAYMENT_SENT
      await prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          status: 'PAYMENT_SENT',
        },
      });

      // Buscar pedido atualizado
      const updatedTransaction = await transactionService.getTransactionById(transactionId);

      res.json({
        success: true,
        data: updatedTransaction,
        message: 'Pagamento confirmado! Envie o comprovante para continuar.',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao confirmar pagamento',
      });
    }
  }
}

export const transactionController = new TransactionController();
