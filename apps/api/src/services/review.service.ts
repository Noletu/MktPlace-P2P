import { PrismaClient } from '@prisma/client';
import { notificationService } from './notification.service';

const prisma = new PrismaClient();

export interface CreateReviewInput {
  reviewerId: string;
  reviewedId: string;
  orderId: string;
  transactionId?: string;
  rating: number; // 1-5
  reliabilityRating?: number;
  communicationRating?: number;
  speedRating?: number;
  comment?: string;
}

export interface RespondReviewInput {
  reviewId: string;
  reviewedId: string; // Para verificar permissão
  response: string;
}

export class ReviewService {
  /**
   * Criar avaliação
   */
  async createReview(input: CreateReviewInput) {
    // Validar rating (1-5)
    if (input.rating < 1 || input.rating > 5) {
      throw new Error('Avaliação deve ser entre 1 e 5 estrelas');
    }

    // Verificar se pedido existe e está concluído
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        transactions: true,
      },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    if (order.status !== 'COMPLETED') {
      throw new Error('Apenas pedidos concluídos podem ser avaliados');
    }

    // Verificar se usuário participou do pedido
    const isOrderOwner = order.userId === input.reviewerId;
    const isPayer = order.transactions.some(t => t.payerId === input.reviewerId);

    if (!isOrderOwner && !isPayer) {
      throw new Error('Você não participou deste pedido');
    }

    // Verificar se está avaliando a outra parte
    const isEvaluatingCounterparty =
      (isOrderOwner && order.transactions.some(t => t.payerId === input.reviewedId)) ||
      (isPayer && order.userId === input.reviewedId);

    if (!isEvaluatingCounterparty) {
      throw new Error('Você só pode avaliar a outra parte da transação');
    }

    // Verificar se já avaliou
    const existingReview = await prisma.review.findUnique({
      where: {
        reviewerId_orderId: {
          reviewerId: input.reviewerId,
          orderId: input.orderId,
        },
      },
    });

    if (existingReview) {
      throw new Error('Você já avaliou este pedido');
    }

    // Criar review
    const review = await prisma.review.create({
      data: {
        reviewerId: input.reviewerId,
        reviewedId: input.reviewedId,
        orderId: input.orderId,
        transactionId: input.transactionId,
        rating: input.rating,
        reliabilityRating: input.reliabilityRating,
        communicationRating: input.communicationRating,
        speedRating: input.speedRating,
        comment: input.comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewed: {
          select: {
            id: true,
            name: true,
            email: true,
            reputationScore: true,
          },
        },
        order: {
          select: {
            id: true,
            type: true,
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
          },
        },
      },
    });

    // Atualizar reputação do usuário avaliado
    await this.updateUserReputation(input.reviewedId);

    // Enviar notificação para o usuário avaliado
    setImmediate(async () => {
      try {
        await notificationService.notifyReviewReceived(
          review.id,
          input.reviewedId,
          review.reviewer.name || 'Usuário',
          input.rating,
          input.orderId
        );
      } catch (error) {
        console.error('Failed to send review received notification:', error);
      }
    });

    return review;
  }

  /**
   * Responder avaliação
   */
  async respondToReview(input: RespondReviewInput) {
    const review = await prisma.review.findUnique({
      where: { id: input.reviewId },
    });

    if (!review) {
      throw new Error('Avaliação não encontrada');
    }

    // Verificar se é o usuário avaliado
    if (review.reviewedId !== input.reviewedId) {
      throw new Error('Apenas o usuário avaliado pode responder');
    }

    // Verificar se já respondeu
    if (review.response) {
      throw new Error('Você já respondeu esta avaliação');
    }

    const updatedReview = await prisma.review.update({
      where: { id: input.reviewId },
      data: {
        response: input.response,
        respondedAt: new Date(),
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewed: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Enviar notificação para o avaliador
    setImmediate(async () => {
      try {
        await notificationService.notifyReviewResponse(
          input.reviewId,
          updatedReview.reviewerId,
          updatedReview.reviewed.name || 'Usuário'
        );
      } catch (error) {
        console.error('Failed to send review response notification:', error);
      }
    });

    return updatedReview;
  }

  /**
   * Buscar avaliações de um usuário
   */
  async getUserReviews(userId: string, filters?: {
    minRating?: number;
    maxRating?: number;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {
      reviewedId: userId,
      isHidden: false,
    };

    if (filters?.minRating || filters?.maxRating) {
      where.rating = {};
      if (filters.minRating) where.rating.gte = filters.minRating;
      if (filters.maxRating) where.rating.lte = filters.maxRating;
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              reputationScore: true,
            },
          },
          order: {
            select: {
              id: true,
              type: true,
              brlAmount: true,
              cryptoType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, total };
  }

  /**
   * Estatísticas de avaliações do usuário
   */
  async getUserReviewStats(userId: string) {
    const reviews = await prisma.review.findMany({
      where: {
        reviewedId: userId,
        isHidden: false,
      },
    });

    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        },
        averageReliability: 0,
        averageCommunication: 0,
        averageSpeed: 0,
      };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / totalReviews;

    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    // Médias de categorias
    const reviewsWithReliability = reviews.filter(r => r.reliabilityRating !== null);
    const reviewsWithCommunication = reviews.filter(r => r.communicationRating !== null);
    const reviewsWithSpeed = reviews.filter(r => r.speedRating !== null);

    const averageReliability = reviewsWithReliability.length > 0
      ? reviewsWithReliability.reduce((sum, r) => sum + (r.reliabilityRating || 0), 0) / reviewsWithReliability.length
      : 0;

    const averageCommunication = reviewsWithCommunication.length > 0
      ? reviewsWithCommunication.reduce((sum, r) => sum + (r.communicationRating || 0), 0) / reviewsWithCommunication.length
      : 0;

    const averageSpeed = reviewsWithSpeed.length > 0
      ? reviewsWithSpeed.reduce((sum, r) => sum + (r.speedRating || 0), 0) / reviewsWithSpeed.length
      : 0;

    return {
      totalReviews,
      averageRating: Number(averageRating.toFixed(2)),
      ratingDistribution,
      averageReliability: Number(averageReliability.toFixed(2)),
      averageCommunication: Number(averageCommunication.toFixed(2)),
      averageSpeed: Number(averageSpeed.toFixed(2)),
    };
  }

  /**
   * Verificar se usuário pode avaliar pedido
   */
  async canReview(userId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { transactions: true },
    });

    if (!order) {
      return { canReview: false, reason: 'Pedido não encontrado' };
    }

    if (order.status !== 'COMPLETED') {
      return { canReview: false, reason: 'Pedido não foi concluído' };
    }

    const isOrderOwner = order.userId === userId;
    const isPayer = order.transactions.some(t => t.payerId === userId);

    if (!isOrderOwner && !isPayer) {
      return { canReview: false, reason: 'Você não participou deste pedido' };
    }

    // Verificar se já avaliou
    const existingReview = await prisma.review.findUnique({
      where: {
        reviewerId_orderId: {
          reviewerId: userId,
          orderId,
        },
      },
    });

    if (existingReview) {
      return { canReview: false, reason: 'Você já avaliou este pedido' };
    }

    // Identificar quem deve ser avaliado
    const reviewedId = isOrderOwner
      ? order.transactions[0]?.payerId
      : order.userId;

    return { canReview: true, reviewedId };
  }

  /**
   * Atualizar reputação do usuário baseada nas avaliações
   */
  private async updateUserReputation(userId: string) {
    const stats = await this.getUserReviewStats(userId);

    // Calcular reputação (0-100)
    // Fórmula: (média de estrelas / 5) * 100
    const reputationScore = Math.round((stats.averageRating / 5) * 100);

    await prisma.user.update({
      where: { id: userId },
      data: {
        reputationScore,
      },
    });

    return reputationScore;
  }

  /**
   * Marcar review como suspeita (admin)
   */
  async markAsSuspicious(reviewId: string) {
    return await prisma.review.update({
      where: { id: reviewId },
      data: { isSuspicious: true },
    });
  }

  /**
   * Ocultar review (admin)
   */
  async hideReview(reviewId: string) {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { isHidden: true },
    });

    // Recalcular reputação do usuário
    await this.updateUserReputation(review.reviewedId);

    return review;
  }
}

export const reviewService = new ReviewService();
