import { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service';
import { z } from 'zod';

const SubmitProofSchema = z.object({
  transactionId: z.string(),
  comprovanteData: z.string().min(10, 'Comprovante é obrigatório'),
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

      // Auto-validar (futuramente usar OCR/AI)
      setTimeout(async () => {
        try {
          await transactionService.autoValidateProof(transaction.id);
        } catch (error) {
          console.error('Erro na auto-validação:', error);
        }
      }, 5000); // 5 segundos de delay

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

      // SECURITY: Verificar se usuário tem permissão para ver esta transação
      const isPayer = transaction.payerId === userId;
      const isOrderOwner = transaction.order.userId === userId;
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
}

export const transactionController = new TransactionController();
