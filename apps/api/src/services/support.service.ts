import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import {
  TicketStatus,
  TicketCategory,
  TicketPriority,
  CATEGORY_PRIORITY_MAP,
  CreateTicketInput,
  AddTicketMessageInput,
  ResolveTicketInput,
  GetTicketsFilters,
} from '../types/support.types';

// Criar instância do NotificationService
const notificationService = new NotificationService();

export class SupportService {
  /**
   * Criar novo ticket de suporte
   */
  static async createTicket(input: CreateTicketInput) {
    const { createdBy, category, subject, description, attachments } = input;

    try {
      // Determinar prioridade automática baseada na categoria
      const priority = CATEGORY_PRIORITY_MAP[category];

      // Criar ticket e primeira mensagem em uma transação
      const ticket = await prisma.$transaction(async (tx: any) => {
        // Criar ticket
        const newTicket = await tx.supportTicket.create({
          data: {
            createdBy,
            category,
            priority,
            subject,
            description,
            status: TicketStatus.OPEN,
          },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Criar primeira mensagem (descrição inicial)
        await tx.ticketMessage.create({
          data: {
            ticketId: newTicket.id,
            authorId: createdBy,
            message: description,
            attachments: attachments ? JSON.stringify(attachments) : null,
            isSupportMessage: false,
          },
        });

        return newTicket;
      });

      // Notificar equipe de suporte (level >= 40: SUPPORT, MANAGER, ADMIN, MASTER)
      await this.notifySupport(
        ticket.id,
        `Novo ticket de suporte: ${subject}`,
        category,
        priority,
        createdBy
      );

      logger.info('[SUPPORT] Ticket created', {
        ticketId: ticket.id,
        createdBy,
        category,
        priority,
      });

      return ticket;
    } catch (error) {
      logger.error('[SUPPORT] Error creating ticket:', error);
      throw error;
    }
  }

  /**
   * Adicionar mensagem ao ticket
   */
  static async addMessage(input: AddTicketMessageInput) {
    const { ticketId, authorId, message, attachments, isSupportMessage } = input;

    try {
      // Buscar ticket e verificar status
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          creator: true,
        },
      });

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      if (ticket.status === TicketStatus.CLOSED) {
        throw new Error('Não é possível adicionar mensagens em tickets fechados');
      }

      // Criar mensagem
      const newMessage = await prisma.ticketMessage.create({
        data: {
          ticketId,
          authorId,
          message,
          attachments: attachments ? JSON.stringify(attachments) : null,
          isSupportMessage: isSupportMessage || false,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Se suporte responde em ticket OPEN, mudar para UNDER_REVIEW
      if (isSupportMessage && ticket.status === TicketStatus.OPEN) {
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: { status: TicketStatus.UNDER_REVIEW },
        });

        logger.info('[SUPPORT] Ticket status updated to UNDER_REVIEW', {
          ticketId,
          supportUserId: authorId,
        });
      }

      // Notificar a outra parte
      if (isSupportMessage) {
        // Suporte respondeu -> notificar criador do ticket
        await notificationService.createNotification({
          userId: ticket.createdBy,
          type: 'SUPPORT_REPLY',
          category: 'SUPPORT',
          title: 'Nova resposta no seu ticket',
          message: `O suporte respondeu ao ticket: ${ticket.subject}`,
          metadata: { ticketId },
        });
      } else {
        // Usuário respondeu -> notificar equipe de suporte
        await this.notifySupport(
          ticketId,
          `Nova mensagem no ticket: ${ticket.subject}`,
          ticket.category as TicketCategory,
          ticket.priority as TicketPriority,
          ticket.createdBy
        );
      }

      logger.info('[SUPPORT] Message added to ticket', {
        ticketId,
        messageId: newMessage.id,
        isSupportMessage,
      });

      return newMessage;
    } catch (error) {
      logger.error('[SUPPORT] Error adding message:', error);
      throw error;
    }
  }

  /**
   * Resolver ticket (MANAGER+ apenas)
   */
  static async resolveTicket(input: ResolveTicketInput) {
    const { ticketId, resolvedBy, resolution } = input;

    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { creator: true },
      });

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
        throw new Error('Ticket já foi resolvido');
      }

      // Atualizar ticket para RESOLVED e adicionar mensagem de resolução
      const updatedTicket = await prisma.$transaction(async (tx: any) => {
        // Atualizar ticket
        const updated = await tx.supportTicket.update({
          where: { id: ticketId },
          data: {
            status: TicketStatus.RESOLVED,
            resolvedBy,
            resolution,
            resolvedAt: new Date(),
          },
          include: {
            creator: true,
            resolver: true,
          },
        });

        // Adicionar mensagem de resolução
        await tx.ticketMessage.create({
          data: {
            ticketId,
            authorId: resolvedBy,
            message: `✅ Ticket resolvido\n\nResolução: ${resolution}`,
            isSupportMessage: true,
          },
        });

        return updated;
      });

      // Notificar criador do ticket
      await notificationService.createNotification({
        userId: ticket.createdBy,
        type: 'SUPPORT_RESOLVED',
        category: 'SUPPORT',
        title: 'Ticket resolvido',
        message: `Seu ticket "${ticket.subject}" foi resolvido`,
        metadata: { ticketId, resolution },
      });

      logger.info('[SUPPORT] Ticket resolved', {
        ticketId,
        resolvedBy,
      });

      return updatedTicket;
    } catch (error) {
      logger.error('[SUPPORT] Error resolving ticket:', error);
      throw error;
    }
  }

  /**
   * Buscar ticket por ID (com permissão)
   */
  static async getTicketById(ticketId: string, userId: string, userLevel: number) {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
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
          messages: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  legacyRole: true,
                  role: {
                    select: {
                      name: true,
                      level: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      // Verificar permissão: criador OU suporte (level >= 40)
      const isCreator = ticket.createdBy === userId;
      const isSupport = userLevel >= 40;

      if (!isCreator && !isSupport) {
        throw new Error('Você não tem permissão para visualizar este ticket');
      }

      return ticket;
    } catch (error) {
      logger.error('[SUPPORT] Error getting ticket:', error);
      throw error;
    }
  }

  /**
   * Listar tickets do usuário
   */
  static async getUserTickets(userId: string, filters?: GetTicketsFilters) {
    try {
      const where: any = {
        createdBy: userId,
      };

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.category) {
        where.category = filters.category;
      }

      if (filters?.priority) {
        where.priority = filters.priority;
      }

      const tickets = await prisma.supportTicket.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      });

      return tickets;
    } catch (error) {
      logger.error('[SUPPORT] Error getting user tickets:', error);
      throw error;
    }
  }

  /**
   * Listar todos os tickets (MANAGER+ apenas)
   */
  static async getAllTickets(filters?: GetTicketsFilters) {
    try {
      const where: any = {};

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.category) {
        where.category = filters.category;
      }

      if (filters?.priority) {
        where.priority = filters.priority;
      }

      // Ordenar por prioridade (urgentes primeiro) e depois por data
      const priorityOrder: Record<TicketPriority, number> = {
        [TicketPriority.URGENT]: 1,
        [TicketPriority.HIGH]: 2,
        [TicketPriority.MEDIUM]: 3,
        [TicketPriority.LOW]: 4,
      };

      const tickets = await prisma.supportTicket.findMany({
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
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
        take: filters?.limit || 100,
        skip: filters?.offset || 0,
      });

      // Ordenar por prioridade no código (já que Prisma não suporta ORDER BY FIELD)
      tickets.sort((a: any, b: any) => {
        const priorityDiff = priorityOrder[a.priority as TicketPriority] - priorityOrder[b.priority as TicketPriority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return tickets;
    } catch (error) {
      logger.error('[SUPPORT] Error getting all tickets:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas de tickets (MANAGER+ apenas)
   */
  static async getTicketStats() {
    try {
      const [
        total,
        open,
        underReview,
        resolved,
        closed,
        byCategory,
        byPriority,
      ] = await Promise.all([
        prisma.supportTicket.count(),
        prisma.supportTicket.count({ where: { status: TicketStatus.OPEN } }),
        prisma.supportTicket.count({ where: { status: TicketStatus.UNDER_REVIEW } }),
        prisma.supportTicket.count({ where: { status: TicketStatus.RESOLVED } }),
        prisma.supportTicket.count({ where: { status: TicketStatus.CLOSED } }),
        prisma.supportTicket.groupBy({
          by: ['category'],
          _count: true,
        }),
        prisma.supportTicket.groupBy({
          by: ['priority'],
          _count: true,
        }),
      ]);

      const resolutionRate = total > 0 ? ((resolved + closed) / total) * 100 : 0;

      return {
        total,
        byStatus: {
          open,
          underReview,
          resolved,
          closed,
        },
        byCategory: byCategory.reduce((acc: Record<string, number>, item: any) => {
          acc[item.category] = item._count;
          return acc;
        }, {}),
        byPriority: byPriority.reduce((acc: Record<string, number>, item: any) => {
          acc[item.priority] = item._count;
          return acc;
        }, {}),
        resolutionRate: Math.round(resolutionRate * 100) / 100,
      };
    } catch (error) {
      logger.error('[SUPPORT] Error getting ticket stats:', error);
      throw error;
    }
  }

  /**
   * Notificar equipe de suporte (level >= 40)
   * @private
   */
  private static async notifySupport(
    ticketId: string,
    message: string,
    category: TicketCategory,
    priority: TicketPriority,
    excludeUserId?: string
  ) {
    try {
      // Buscar todos os usuários com level >= 40 (SUPPORT, MANAGER, ADMIN, MASTER)
      const supportUsers = await prisma.user.findMany({
        where: {
          role: {
            level: {
              gte: 40,
            },
          },
          id: {
            not: excludeUserId, // Não notificar o criador do ticket
          },
        },
        select: {
          id: true,
        },
      });

      // Criar notificação para cada membro da equipe de suporte
      const notifications = supportUsers.map((user: any) =>
        notificationService.createNotification({
          userId: user.id,
          type: 'SUPPORT_NEW_TICKET',
          category: 'SUPPORT',
          title: `[${priority}] Ticket de ${category}`,
          message,
          metadata: { ticketId, category, priority },
        })
      );

      await Promise.all(notifications);

      logger.info('[SUPPORT] Support team notified', {
        ticketId,
        notifiedUsers: supportUsers.length,
      });
    } catch (error) {
      logger.error('[SUPPORT] Error notifying support team:', error);
      // Não lançar erro, apenas logar (notificações não devem bloquear o fluxo)
    }
  }
}
