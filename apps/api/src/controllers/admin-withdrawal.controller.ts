import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WithdrawalProcessorService } from '../services/withdrawal-processor.service';
import { z } from 'zod';

const prisma = new PrismaClient();

const ReviewSchema = z.object({
  note: z.string().min(1, 'Nota é obrigatória').optional(),
});

export class AdminWithdrawalController {
  /**
   * GET /api/v1/admin/withdrawals/pending
   * Lista saques pendentes de aprovação
   */
  async getPendingWithdrawals(req: Request, res: Response) {
    try {
      const withdrawals = await prisma.withdrawal.findMany({
        where: {
          status: { in: ['REQUIRES_APPROVAL', 'PENDING', 'PROCESSING'] },
        },
        include: {
          wallet: {
            select: {
              id: true,
              userId: true,
              cryptoType: true,
              network: true,
              address: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  accountFrozen: true,
                  frozenReason: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        success: true,
        data: withdrawals,
        counts: {
          requiresApproval: withdrawals.filter(w => w.status === 'REQUIRES_APPROVAL').length,
          pending: withdrawals.filter(w => w.status === 'PENDING').length,
          processing: withdrawals.filter(w => w.status === 'PROCESSING').length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Error fetching pending withdrawals',
      });
    }
  }

  /**
   * GET /api/v1/admin/withdrawals/history
   * Lista histórico completo de saques
   */
  async getWithdrawalHistory(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      const where: any = {};
      if (status) {
        where.status = status;
      }

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          where,
          include: {
            wallet: {
              select: {
                id: true,
                userId: true,
                cryptoType: true,
                network: true,
                address: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.withdrawal.count({ where }),
      ]);

      res.json({
        success: true,
        data: withdrawals,
        pagination: { total, limit, offset },
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Error fetching withdrawal history',
      });
    }
  }

  /**
   * POST /api/v1/admin/withdrawals/:id/approve
   * Aprova um saque pendente de aprovação
   */
  async approveWithdrawal(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const body = ReviewSchema.parse(req.body);

      await WithdrawalProcessorService.approveWithdrawal(
        id,
        adminId,
        body.note
      );

      res.json({
        success: true,
        message: 'Withdrawal approved. Will be processed by the worker.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid data',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Error approving withdrawal',
      });
    }
  }

  /**
   * POST /api/v1/admin/withdrawals/:id/reject
   * Rejeita um saque — desbloqueia saldo do usuário
   */
  async rejectWithdrawal(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { note } = req.body;

      if (!note || typeof note !== 'string' || note.trim().length === 0) {
        return res.status(400).json({
          error: 'A note/reason is required when rejecting a withdrawal',
        });
      }

      await WithdrawalProcessorService.rejectWithdrawal(
        id,
        adminId,
        note.trim()
      );

      res.json({
        success: true,
        message: 'Withdrawal rejected. Balance has been unlocked.',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Error rejecting withdrawal',
      });
    }
  }
}

export const adminWithdrawalController = new AdminWithdrawalController();
