import { Request, Response } from 'express';
import { disputeService } from '../services/dispute.service';
import { auditLogService } from '../services/auditLog.service';
import { z } from 'zod';

const CreateDisputeSchema = z.object({
  orderId: z.string().min(1, 'ID do pedido é obrigatório'),
  transactionId: z.string().optional(),
  category: z.enum([
    'PAYMENT_SENT_NOT_CONFIRMED',
    'CRYPTO_NOT_RELEASED',
    'PAYMENT_NOT_RECEIVED',
    'FAKE_RECEIPT',
    'WRONG_AMOUNT',
    'WRONG_RECIPIENT',
    'OTHER'
  ]),
  title: z.string().min(10, 'Título deve ter no mínimo 10 caracteres'),
  description: z.string().min(20, 'Descrição deve ter no mínimo 20 caracteres'),
  attachments: z.array(z.string()).optional(), // Mudado de z.string().url() para z.string() para aceitar base64
});

const AddMessageSchema = z.object({
  message: z.string().min(1, 'Mensagem não pode ser vazia'),
  attachments: z.array(z.string().url()).optional(),
});

const RespondDisputeSchema = z.object({
  contestation: z.string().min(50, 'Contestação deve ter no mínimo 50 caracteres'),
  counterEvidences: z.array(z.string().url()).optional(),
});

const ResolveDisputeSchema = z.object({
  resolution: z.string().min(20, 'Resolução deve ter no mínimo 20 caracteres'),
  resolutionType: z.enum([
    'REFUND_BUYER_FULL',
    'REFUND_BUYER_PARTIAL',
    'RELEASE_SELLER',
    'CANCEL_NO_PENALTY',
    'PENALTY_BUYER',
    'PENALTY_SELLER'
  ]),
});

export class DisputeController {
  /**
   * Criar nova disputa
   */
  async createDispute(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const validatedData = CreateDisputeSchema.parse(req.body);

      const dispute = await disputeService.createDispute({
        ...validatedData,
        createdBy: userId,
      });

      // SECURITY: Audit log
      auditLogService.logFromRequest(
        req,
        'CREATE_DISPUTE',
        'DISPUTE',
        dispute.id,
        {
          orderId: validatedData.orderId,
          category: validatedData.category,
        }
      );

      res.status(201).json({
        success: true,
        data: dispute,
        message: 'Disputa criada com sucesso! Nossa equipe irá analisar o caso.',
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
        success: false,
        error: error.message || 'Erro ao criar disputa',
      });
    }
  }

  /**
   * Adicionar mensagem/evidência
   */
  async addMessage(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { disputeId } = req.params;
      const validatedData = AddMessageSchema.parse(req.body);

      const message = await disputeService.addMessage({
        disputeId,
        authorId: userId,
        ...validatedData,
      });

      res.json({
        success: true,
        data: message,
        message: 'Mensagem adicionada com sucesso',
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
        success: false,
        error: error.message || 'Erro ao adicionar mensagem',
      });
    }
  }

  /**
   * Responder à disputa (outra parte)
   */
  async respondToDispute(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { disputeId } = req.params;
      const validatedData = RespondDisputeSchema.parse(req.body);

      const dispute = await disputeService.respondToDispute(userId, disputeId, validatedData);

      // SECURITY: Audit log
      auditLogService.logFromRequest(
        req,
        'RESPOND_DISPUTE',
        'DISPUTE',
        disputeId,
        {
          userId,
        }
      );

      res.json({
        success: true,
        data: dispute,
        message: 'Resposta enviada com sucesso. Nossa equipe está analisando o caso.',
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
        success: false,
        error: error.message || 'Erro ao responder disputa',
      });
    }
  }

  /**
   * Resolver disputa (admin apenas)
   */
  async resolveDispute(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId || (userRole !== 'ADMIN' && userRole !== 'MASTER')) {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem resolver disputas',
        });
      }

      const { disputeId } = req.params;
      const validatedData = ResolveDisputeSchema.parse(req.body);

      const dispute = await disputeService.resolveDispute({
        disputeId,
        resolvedBy: userId,
        ...validatedData,
      });

      // SECURITY: Audit log
      auditLogService.logFromRequest(
        req,
        'RESOLVE_DISPUTE',
        'DISPUTE',
        disputeId,
        {
          resolutionType: validatedData.resolutionType,
        }
      );

      res.json({
        success: true,
        data: dispute,
        message: 'Disputa resolvida com sucesso',
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
        success: false,
        error: error.message || 'Erro ao resolver disputa',
      });
    }
  }

  /**
   * Buscar disputa por ID
   */
  async getDispute(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { disputeId } = req.params;

      const dispute = await disputeService.getDisputeById(disputeId);

      if (!dispute) {
        return res.status(404).json({
          success: false,
          error: 'Disputa não encontrada',
        });
      }

      // SECURITY: Verificar se usuário tem permissão
      const isAdmin = userRole === 'ADMIN' || userRole === 'MASTER';
      const isCreator = dispute.createdBy === userId;
      const isOrderOwner = dispute.order.userId === userId;
      const isPayer = dispute.order.transactions.some(t => t.payerId === userId);

      if (!isAdmin && !isCreator && !isOrderOwner && !isPayer) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para visualizar esta disputa',
        });
      }

      res.json({
        success: true,
        data: dispute,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar disputa',
      });
    }
  }

  /**
   * Listar disputas do usuário
   */
  async getUserDisputes(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const disputes = await disputeService.getUserDisputes(userId);

      res.json({
        success: true,
        data: disputes,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar disputas',
      });
    }
  }

  /**
   * Listar todas as disputas (admin)
   */
  async getAllDisputes(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem visualizar todas as disputas',
        });
      }

      const { status, category, limit, offset } = req.query;

      const result = await disputeService.getAllDisputes({
        status: status as string,
        category: category as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: {
          disputes: result.disputes,
          total: result.total,
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar disputas',
      });
    }
  }

  /**
   * Estatísticas de disputas (admin)
   */
  async getDisputeStats(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem visualizar estatísticas',
        });
      }

      const stats = await disputeService.getDisputeStats();

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
   * Analytics de disputas por período (admin)
   */
  async getDisputeAnalytics(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem visualizar analytics',
        });
      }

      const { days } = req.query;
      const daysNum = days ? parseInt(days as string) : 30;

      const analytics = await disputeService.getDisputeAnalytics(daysNum);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar analytics',
      });
    }
  }

  /**
   * Top disputantes (admin)
   */
  async getTopDisputants(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem visualizar top disputantes',
        });
      }

      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 10;

      const topDisputants = await disputeService.getTopDisputants(limitNum);

      res.json({
        success: true,
        data: topDisputants,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar top disputantes',
      });
    }
  }
}

export const disputeController = new DisputeController();
