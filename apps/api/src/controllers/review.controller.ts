import { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { auditLogService } from '../services/auditLog.service';
import { z } from 'zod';

const CreateReviewSchema = z.object({
  reviewedId: z.string().min(1, 'ID do usuário avaliado é obrigatório'),
  orderId: z.string().min(1, 'ID do pedido é obrigatório'),
  transactionId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  reliabilityRating: z.number().int().min(1).max(5).optional(),
  communicationRating: z.number().int().min(1).max(5).optional(),
  speedRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
});

const RespondReviewSchema = z.object({
  response: z.string().min(10, 'Resposta deve ter no mínimo 10 caracteres').max(500),
});

export class ReviewController {
  /**
   * Criar avaliação
   */
  async createReview(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const validatedData = CreateReviewSchema.parse(req.body);

      const review = await reviewService.createReview({
        reviewerId: userId,
        ...validatedData,
      });

      // SECURITY: Audit log
      auditLogService.logFromRequest(
        req,
        'CREATE_REVIEW',
        'REVIEW',
        review.id,
        {
          orderId: validatedData.orderId,
          rating: validatedData.rating,
        }
      );

      res.status(201).json({
        success: true,
        data: review,
        message: 'Avaliação criada com sucesso!',
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
        error: error.message || 'Erro ao criar avaliação',
      });
    }
  }

  /**
   * Responder avaliação
   */
  async respondToReview(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { reviewId } = req.params;
      const validatedData = RespondReviewSchema.parse(req.body);

      const review = await reviewService.respondToReview({
        reviewId,
        reviewedId: userId,
        response: validatedData.response,
      });

      res.json({
        success: true,
        data: review,
        message: 'Resposta publicada com sucesso!',
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
        error: error.message || 'Erro ao responder avaliação',
      });
    }
  }

  /**
   * Buscar avaliações de um usuário
   */
  async getUserReviews(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { minRating, maxRating, limit, offset } = req.query;

      const result = await reviewService.getUserReviews(userId, {
        minRating: minRating ? parseInt(minRating as string) : undefined,
        maxRating: maxRating ? parseInt(maxRating as string) : undefined,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: {
          reviews: result.reviews,
          total: result.total,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar avaliações',
      });
    }
  }

  /**
   * Estatísticas de avaliações do usuário
   */
  async getUserReviewStats(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const stats = await reviewService.getUserReviewStats(userId);

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
   * Verificar se pode avaliar pedido
   */
  async canReview(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { orderId } = req.params;

      const result = await reviewService.canReview(userId, orderId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao verificar permissão',
      });
    }
  }

  /**
   * Marcar como suspeita (admin)
   */
  async markAsSuspicious(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem marcar avaliações como suspeitas',
        });
      }

      const { reviewId } = req.params;

      const review = await reviewService.markAsSuspicious(reviewId);

      res.json({
        success: true,
        data: review,
        message: 'Avaliação marcada como suspeita',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao marcar avaliação',
      });
    }
  }

  /**
   * Ocultar avaliação (admin)
   */
  async hideReview(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem ocultar avaliações',
        });
      }

      const { reviewId } = req.params;

      const review = await reviewService.hideReview(reviewId);

      res.json({
        success: true,
        data: review,
        message: 'Avaliação ocultada com sucesso',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao ocultar avaliação',
      });
    }
  }
}

export const reviewController = new ReviewController();
