import { Request, Response } from 'express';
import { z } from 'zod';
import { SupportService } from '../services/support.service';
import { logger } from '../utils/logger';
import { TicketCategory, TicketStatus, TicketPriority } from '../types/support.types';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';

// Zod Validation Schemas
const CreateTicketSchema = z.object({
  category: z.nativeEnum(TicketCategory, {
    errorMap: () => ({ message: 'Categoria inválida' }),
  }),
  subject: z
    .string()
    .min(5, 'Assunto deve ter no mínimo 5 caracteres')
    .max(200, 'Assunto deve ter no máximo 200 caracteres'),
  description: z
    .string()
    .min(20, 'Descrição deve ter no mínimo 20 caracteres'),
  attachments: z.array(z.string()).optional(),
});

const AddMessageSchema = z.object({
  message: z.string().min(1, 'Mensagem não pode estar vazia'),
  attachments: z.array(z.string()).optional(),
});

const ResolveTicketSchema = z.object({
  resolution: z
    .string()
    .min(20, 'Resolução deve ter no mínimo 20 caracteres'),
});

const GetTicketsQuerySchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

export class SupportController {
  /**
   * POST /api/v1/support
   * Criar novo ticket de suporte
   */
  static async createTicket(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      // Validar body
      const validation = CreateTicketSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error.errors,
        });
      }

      const { category, subject, description, attachments } = validation.data;

      // Criar ticket
      const ticket = await SupportService.createTicket({
        createdBy: userId,
        category,
        subject,
        description,
        attachments,
      });

      logger.info('[SUPPORT] Ticket created successfully', {
        ticketId: ticket.id,
        userId,
      });

      // Registrar no audit log
      await auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.SUPPORT_TICKET_CREATE,
        AUDIT_RESOURCES.SUPPORT_TICKET,
        ticket.id,
        {
          category: ticket.category,
          priority: ticket.priority,
          subject: ticket.subject.substring(0, 100),
          status: ticket.status,
        }
      );

      return res.status(201).json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      logger.error('[SUPPORT] Error creating ticket:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar ticket',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/support/:ticketId/messages
   * Adicionar mensagem ao ticket
   */
  static async addMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const userLevel = (req as any).user.level || 0;
      const { ticketId } = req.params;

      // Validar body
      const validation = AddMessageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error.errors,
        });
      }

      const { message, attachments } = validation.data;

      // Determinar se é mensagem do suporte (level >= 40)
      const isSupportMessage = userLevel >= 40;

      // Adicionar mensagem
      const newMessage = await SupportService.addMessage({
        ticketId,
        authorId: userId,
        message,
        attachments,
        isSupportMessage,
      });

      logger.info('[SUPPORT] Message added to ticket', {
        ticketId,
        messageId: newMessage.id,
        userId,
        isSupportMessage,
      });

      return res.status(201).json({
        success: true,
        data: newMessage,
      });
    } catch (error: any) {
      logger.error('[SUPPORT] Error adding message:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao adicionar mensagem',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/support/:ticketId/resolve
   * Resolver ticket (MANAGER+ apenas)
   */
  static async resolveTicket(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { ticketId } = req.params;

      // Validar body
      const validation = ResolveTicketSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error.errors,
        });
      }

      const { resolution } = validation.data;

      // Resolver ticket
      const ticket = await SupportService.resolveTicket({
        ticketId,
        resolvedBy: userId,
        resolution,
      });

      logger.info('[SUPPORT] Ticket resolved', {
        ticketId,
        resolvedBy: userId,
      });

      // Registrar no audit log
      await auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.SUPPORT_TICKET_RESOLVE,
        AUDIT_RESOURCES.SUPPORT_TICKET,
        ticket.id,
        {
          resolution: resolution.substring(0, 200),
          category: ticket.category,
          previousStatus: 'UNDER_REVIEW',
          newStatus: 'RESOLVED',
        }
      );

      return res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      logger.error('[SUPPORT] Error resolving ticket:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao resolver ticket',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/support/:ticketId
   * Buscar ticket por ID (com permissão)
   */
  static async getTicket(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const userLevel = (req as any).user.level || 0;
      const { ticketId } = req.params;

      const ticket = await SupportService.getTicketById(ticketId, userId, userLevel);

      return res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      logger.error('[SUPPORT] Error getting ticket:', error);

      if (error.message.includes('permissão')) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message.includes('não encontrado')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar ticket',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/support/my-tickets
   * Listar tickets do usuário
   */
  static async getMyTickets(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      // Validar query params
      const validation = GetTicketsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros inválidos',
          details: validation.error.errors,
        });
      }

      const filters = validation.data;

      const tickets = await SupportService.getUserTickets(userId, filters);

      return res.status(200).json({
        success: true,
        data: tickets,
        count: tickets.length,
      });
    } catch (error: any) {
      logger.error('[SUPPORT] Error getting user tickets:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar tickets',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/support
   * Listar todos os tickets (MANAGER+ apenas)
   */
  static async getAllTickets(req: Request, res: Response) {
    try {
      // Validar query params
      const validation = GetTicketsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros inválidos',
          details: validation.error.errors,
        });
      }

      const filters = validation.data;

      const tickets = await SupportService.getAllTickets(filters);

      return res.status(200).json({
        success: true,
        data: tickets,
        count: tickets.length,
      });
    } catch (error: any) {
      logger.error('[SUPPORT] Error getting all tickets:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar tickets',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/support/stats
   * Estatísticas de tickets (MANAGER+ apenas)
   */
  static async getTicketStats(req: Request, res: Response) {
    try {
      const stats = await SupportService.getTicketStats();

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('[SUPPORT] Error getting ticket stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter estatísticas',
        message: error.message,
      });
    }
  }
}
