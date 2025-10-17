import { PrismaClient } from '@prisma/client';
import { notificationService } from './notification.service';
import {
  DisputeStatus,
  DisputeCategory,
  ResolutionType,
  CreateDisputeInput as CreateDisputeInputType,
  RespondDisputeInput,
  ResolveDisputeInput as ResolveDisputeInputType,
  DISPUTE_DEADLINES,
  DISPUTE_REPUTATION,
} from '../types/dispute.types';
import { OrderStatus } from '../types/order.types';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Keep backwards compatibility with old interfaces
export interface CreateDisputeInput {
  orderId: string;
  transactionId?: string;
  createdBy: string;
  category: 'PAYMENT_NOT_RECEIVED' | 'PAYMENT_ISSUE' | 'FRAUD' | 'OTHER';
  title: string;
  description: string;
  attachments?: string[]; // URLs de evidências
}

export interface AddMessageInput {
  disputeId: string;
  authorId: string;
  message: string;
  attachments?: string[];
  isAdminMessage?: boolean;
}

export interface ResolveDisputeInput {
  disputeId: string;
  resolvedBy: string; // Admin ID
  resolution: string; // Descrição da resolução
  resolutionType: 'REFUND_BUYER' | 'RELEASE_SELLER' | 'PARTIAL_REFUND' | 'CANCELLED';
}

export class DisputeService {
  /**
   * Criar nova disputa
   */
  async createDispute(input: CreateDisputeInput) {
    // Verificar se order existe e usuário tem permissão
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        transactions: true,
      },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Verificar se usuário é parte do pedido
    const isOrderOwner = order.userId === input.createdBy;
    const isPayer = order.transactions.some(t => t.payerId === input.createdBy);

    if (!isOrderOwner && !isPayer) {
      throw new Error('Você não tem permissão para criar disputa neste pedido');
    }

    // Verificar se já existe disputa aberta para este pedido
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        orderId: input.orderId,
        status: {
          in: ['OPEN', 'UNDER_REVIEW'],
        },
      },
    });

    if (existingDispute) {
      throw new Error('Já existe uma disputa aberta para este pedido');
    }

    // Criar disputa
    const dispute = await prisma.dispute.create({
      data: {
        orderId: input.orderId,
        transactionId: input.transactionId,
        createdBy: input.createdBy,
        category: input.category,
        title: input.title,
        description: input.description,
        status: 'OPEN',
        messages: {
          create: {
            authorId: input.createdBy,
            message: input.description,
            attachments: input.attachments ? JSON.stringify(input.attachments) : null,
            isAdminMessage: false,
          },
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            type: true,
            status: true,
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
          },
        },
        messages: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Atualizar status do pedido para DISPUTED
    await prisma.order.update({
      where: { id: input.orderId },
      data: { status: 'DISPUTED' },
    });

    // Enviar notificação para a outra parte
    setImmediate(async () => {
      try {
        // Identificar a outra parte (counterparty)
        const counterpartyId = isOrderOwner
          ? order.transactions[0]?.payerId
          : order.userId;

        if (counterpartyId) {
          await notificationService.notifyDisputeCreated(
            dispute.id,
            input.orderId,
            counterpartyId,
            dispute.creator.name || 'Usuário'
          );
        }
      } catch (error) {
        console.error('Failed to send dispute created notification:', error);
      }
    });

    return dispute;
  }

  /**
   * Outra parte responde à disputa
   */
  async respondToDispute(userId: string, disputeId: string, input: RespondDisputeInput) {
    // Buscar disputa
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        creator: { select: { id: true, name: true } },
        order: {
          include: {
            transactions: true,
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!dispute) {
      throw new Error('Disputa não encontrada');
    }

    // Validar que usuário é a outra parte (não o criador)
    const transaction = dispute.order.transactions[0];
    const otherPartyId =
      dispute.createdBy === dispute.order.userId ? transaction?.payerId : dispute.order.userId;

    if (userId !== otherPartyId) {
      throw new Error('Apenas a outra parte pode responder à disputa');
    }

    // Validar status
    if (dispute.status !== 'OPEN') {
      throw new Error('Esta disputa não está mais aberta para respostas');
    }

    // Validar deadline (24h)
    const timeSinceCreated = Date.now() - dispute.createdAt.getTime();
    if (timeSinceCreated > DISPUTE_DEADLINES.RESPONSE_TIME) {
      throw new Error('Prazo para responder expirou (24h)');
    }

    // Validar campos
    if (!input.contestation || input.contestation.length < 50) {
      throw new Error('Contestação deve ter no mínimo 50 caracteres');
    }

    // Adicionar mensagem de resposta
    await prisma.disputeMessage.create({
      data: {
        disputeId,
        authorId: userId,
        message: input.contestation,
        attachments: input.counterEvidences ? JSON.stringify(input.counterEvidences) : null,
        isAdminMessage: false,
      },
    });

    // Atualizar status para UNDER_REVIEW
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'UNDER_REVIEW',
      },
      include: {
        creator: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            type: true,
            brlAmount: true,
            cryptoAmount: true,
          },
        },
      },
    });

    // Notificar criador da disputa
    await notificationService.createNotification({
      userId: dispute.createdBy,
      type: 'DISPUTE_RESPONDED',
      category: 'DISPUTE',
      title: '💬 Resposta Recebida',
      message: 'A outra parte respondeu à disputa. Nossa equipe está analisando o caso.',
      actionUrl: `/disputes/${disputeId}`,
      actionLabel: 'Ver Disputa',
      relatedId: disputeId,
      relatedType: 'DISPUTE',
      priority: 'HIGH',
    });

    // Notificar admins
    await this.notifyAdmins(disputeId, 'Disputa precisa de análise');

    logger.info('[DISPUTE] Response added', {
      disputeId,
      respondedBy: userId,
    });

    return updatedDispute;
  }

  /**
   * Adicionar mensagem/evidência à disputa
   */
  async addMessage(input: AddMessageInput) {
    // Verificar se disputa existe
    const dispute = await prisma.dispute.findUnique({
      where: { id: input.disputeId },
      include: {
        order: true,
      },
    });

    if (!dispute) {
      throw new Error('Disputa não encontrada');
    }

    // Verificar se disputa ainda está aberta
    if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
      throw new Error('Disputa já foi resolvida');
    }

    // Verificar permissão (criador, payer ou admin)
    const order = await prisma.order.findUnique({
      where: { id: dispute.orderId },
      include: { transactions: true },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const isOrderOwner = order.userId === input.authorId;
    const isPayer = order.transactions.some(t => t.payerId === input.authorId);

    // Buscar usuário para verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: input.authorId },
      select: { role: true },
    });

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MASTER';

    if (!isOrderOwner && !isPayer && !isAdmin) {
      throw new Error('Você não tem permissão para adicionar mensagens nesta disputa');
    }

    // Criar mensagem
    const message = await prisma.disputeMessage.create({
      data: {
        disputeId: input.disputeId,
        authorId: input.authorId,
        message: input.message,
        attachments: input.attachments ? JSON.stringify(input.attachments) : null,
        isAdminMessage: input.isAdminMessage || isAdmin,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Se for admin adicionando mensagem, mudar status para UNDER_REVIEW
    if (isAdmin && dispute.status === 'OPEN') {
      await prisma.dispute.update({
        where: { id: input.disputeId },
        data: { status: 'UNDER_REVIEW' },
      });
    }

    // Enviar notificação para outras partes da disputa
    setImmediate(async () => {
      try {
        const isOrderOwner = order.userId === input.authorId;
        const isPayer = order.transactions.some(t => t.payerId === input.authorId);

        // Notificar a outra parte (não o autor da mensagem)
        const recipientId = isOrderOwner
          ? order.transactions[0]?.payerId
          : isPayer
          ? order.userId
          : null;

        if (recipientId) {
          await notificationService.notifyDisputeMessage(
            input.disputeId,
            recipientId,
            message.author.name || 'Usuário',
            isAdmin
          );
        }
      } catch (error) {
        console.error('Failed to send dispute message notification:', error);
      }
    });

    return message;
  }

  /**
   * Resolver disputa (apenas admin)
   */
  async resolveDispute(input: ResolveDisputeInput) {
    // Verificar se é admin
    const admin = await prisma.user.findUnique({
      where: { id: input.resolvedBy },
      select: { role: true },
    });

    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'MASTER')) {
      throw new Error('Apenas administradores podem resolver disputas');
    }

    // Buscar disputa
    const dispute = await prisma.dispute.findUnique({
      where: { id: input.disputeId },
      include: {
        order: true,
      },
    });

    if (!dispute) {
      throw new Error('Disputa não encontrada');
    }

    if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
      throw new Error('Disputa já foi resolvida');
    }

    // Atualizar disputa
    const resolvedDispute = await prisma.dispute.update({
      where: { id: input.disputeId },
      data: {
        status: this.getResolvedStatus(input.resolutionType),
        resolvedBy: input.resolvedBy,
        resolution: input.resolution,
        resolutionType: input.resolutionType,
        resolvedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: true,
        messages: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Atualizar status do pedido baseado na resolução
    let newOrderStatus = dispute.order.status;

    if (input.resolutionType === 'RELEASE_SELLER') {
      newOrderStatus = 'COMPLETED';
    } else if (input.resolutionType === 'REFUND_BUYER') {
      newOrderStatus = 'CANCELLED';
    } else if (input.resolutionType === 'CANCELLED') {
      newOrderStatus = 'CANCELLED';
    }

    await prisma.order.update({
      where: { id: dispute.orderId },
      data: { status: newOrderStatus },
    });

    // Adicionar mensagem de resolução
    await prisma.disputeMessage.create({
      data: {
        disputeId: input.disputeId,
        authorId: input.resolvedBy,
        message: `Disputa resolvida: ${input.resolution}`,
        isAdminMessage: true,
      },
    });

    // Enviar notificações para ambas as partes
    setImmediate(async () => {
      try {
        const order = await prisma.order.findUnique({
          where: { id: dispute.orderId },
          include: { transactions: true },
        });

        if (order) {
          // Notificar criador da disputa
          await notificationService.notifyDisputeResolved(
            input.disputeId,
            dispute.createdBy,
            input.resolution,
            input.resolutionType
          );

          // Notificar a outra parte
          const isCreatorOrderOwner = order.userId === dispute.createdBy;
          const counterpartyId = isCreatorOrderOwner
            ? order.transactions[0]?.payerId
            : order.userId;

          if (counterpartyId) {
            await notificationService.notifyDisputeResolved(
              input.disputeId,
              counterpartyId,
              input.resolution,
              input.resolutionType
            );
          }
        }
      } catch (error) {
        console.error('Failed to send dispute resolved notifications:', error);
      }
    });

    return resolvedDispute;
  }

  /**
   * Buscar disputa por ID
   */
  async getDisputeById(disputeId: string) {
    return await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
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
        },
        transaction: true,
        messages: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  /**
   * Listar disputas do usuário
   */
  async getUserDisputes(userId: string) {
    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { order: { userId: userId } },
          { order: { transactions: { some: { payerId: userId } } } },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            type: true,
            status: true,
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return disputes;
  }

  /**
   * Listar todas as disputas (admin)
   */
  async getAllDisputes(filters?: {
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          resolver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          order: {
            select: {
              id: true,
              type: true,
              status: true,
              brlAmount: true,
              cryptoAmount: true,
              cryptoType: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.dispute.count({ where }),
    ]);

    return { disputes, total };
  }

  /**
   * Estatísticas de disputas (admin)
   */
  async getDisputeStats() {
    const [
      total,
      open,
      underReview,
      resolved,
      byCategory,
      byResolutionType,
    ] = await Promise.all([
      prisma.dispute.count(),
      prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.dispute.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.dispute.count({
        where: {
          status: {
            in: ['RESOLVED_BUYER', 'RESOLVED_SELLER', 'CANCELLED'],
          },
        },
      }),
      prisma.dispute.groupBy({
        by: ['category'],
        _count: true,
        orderBy: {
          _count: {
            category: 'desc',
          },
        },
      }),
      prisma.dispute.groupBy({
        by: ['resolutionType'],
        where: {
          resolutionType: { not: null },
        },
        _count: true,
        orderBy: {
          _count: {
            resolutionType: 'desc',
          },
        },
      }),
    ]);

    return {
      total,
      open,
      underReview,
      resolved,
      byCategory,
      byResolutionType,
      resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
    };
  }

  /**
   * Helper: Converter resolutionType em status
   */
  private getResolvedStatus(resolutionType: string): string {
    switch (resolutionType) {
      case 'REFUND_BUYER':
        return 'RESOLVED_BUYER';
      case 'RELEASE_SELLER':
        return 'RESOLVED_SELLER';
      case 'PARTIAL_REFUND':
        return 'RESOLVED_BUYER';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'RESOLVED_BUYER';
    }
  }

  /**
   * Helper: Ajustar reputação de usuário
   */
  private async adjustReputation(userId: string, adjustment: number, reason: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });

    if (!user) return;

    const newScore = Math.max(0, user.reputationScore + adjustment); // Não pode ser negativo

    await prisma.user.update({
      where: { id: userId },
      data: { reputationScore: newScore },
    });

    logger.info('[REPUTATION] Adjusted', {
      userId,
      adjustment,
      newScore,
      reason,
    });
  }

  /**
   * Helper: Notificar todos os admins
   */
  private async notifyAdmins(disputeId: string, message: string) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MASTER'] } },
      select: { id: true },
    });

    for (const admin of admins) {
      await notificationService.createNotification({
        userId: admin.id,
        type: 'ADMIN_DISPUTE',
        category: 'DISPUTE',
        title: '🚨 Disputa Precisa de Análise',
        message,
        actionUrl: `/admin/disputes/${disputeId}`,
        actionLabel: 'Analisar',
        relatedId: disputeId,
        relatedType: 'DISPUTE',
        priority: 'HIGH',
      });
    }
  }
}

export const disputeService = new DisputeService();
