import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { notificationService } from '../services/notification.service';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

const BroadcastNotificationSchema = z.object({
  userIds: z.array(z.string()).min(1),
  type: z.string(),
  category: z.string(),
  title: z.string(),
  message: z.string(),
  actionUrl: z.string().optional(),
  actionLabel: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

export class NotificationController {
  /**
   * Buscar notificações do usuário
   */
  async getUserNotifications(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { category, isRead, priority, limit, offset } = req.query;

      const result = await notificationService.getUserNotifications(userId, {
        category: category as string,
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        priority: priority as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar notificações',
      });
    }
  }

  /**
   * Buscar contagem de não lidas
   */
  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const count = await notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar contagem',
      });
    }
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { notificationId } = req.params;

      const notification = await notificationService.markAsRead(notificationId, userId);

      res.json({
        success: true,
        data: notification,
        message: 'Notificação marcada como lida',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao marcar notificação como lida',
      });
    }
  }

  /**
   * Marcar todas as notificações como lidas
   */
  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'Todas as notificações foram marcadas como lidas',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao marcar todas como lidas',
      });
    }
  }

  /**
   * Deletar notificação
   */
  async deleteNotification(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { notificationId } = req.params;

      await notificationService.deleteNotification(notificationId, userId);

      res.json({
        success: true,
        message: 'Notificação deletada com sucesso',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao deletar notificação',
      });
    }
  }

  /**
   * Deletar todas as notificações lidas
   */
  async deleteAllRead(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      await notificationService.deleteAllRead(userId);

      res.json({
        success: true,
        message: 'Notificações lidas deletadas com sucesso',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao deletar notificações',
      });
    }
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  /**
   * Broadcast - Enviar notificação para múltiplos usuários (admin)
   */
  async broadcastNotification(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem enviar broadcasts',
        });
      }

      const validatedData = BroadcastNotificationSchema.parse(req.body);

      await notificationService.broadcastNotification(
        validatedData.userIds,
        {
          type: validatedData.type,
          category: validatedData.category,
          title: validatedData.title,
          message: validatedData.message,
          actionUrl: validatedData.actionUrl,
          actionLabel: validatedData.actionLabel,
          priority: validatedData.priority,
        }
      );

      res.json({
        success: true,
        message: `Notificação enviada para ${validatedData.userIds.length} usuários`,
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
        error: error.message || 'Erro ao enviar broadcast',
      });
    }
  }

  /**
   * Enviar anúncio do sistema para todos os usuários (admin)
   */
  async sendSystemAnnouncement(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem enviar anúncios',
        });
      }

      const { title, message, priority } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          error: 'Título e mensagem são obrigatórios',
        });
      }

      // Buscar todos os usuários ativos
      const prisma = require('@prisma/client');
      const db = new prisma.PrismaClient();
      const users = await db.user.findMany({
        select: { id: true },
      });

      await notificationService.broadcastNotification(
        users.map((u: any) => u.id),
        {
          type: 'SYSTEM_ANNOUNCEMENT',
          category: 'SYSTEM',
          title: `📢 ${title}`,
          message,
          priority: priority || 'NORMAL',
        }
      );

      res.json({
        success: true,
        message: `Anúncio enviado para ${users.length} usuários`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao enviar anúncio',
      });
    }
  }
  // ============================================
  // ADMIN BROADCAST (UNIFIED)
  // ============================================

  /**
   * Enviar comunicação admin unificada (notificação + email)
   */
  async sendAdminBroadcast(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem enviar comunicações',
        });
      }

      const schema = z.object({
        title: z.string().min(1).max(200),
        message: z.string().min(1).max(2000),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
        deliveryChannel: z.enum(['NOTIFICATION', 'EMAIL', 'BOTH']).default('NOTIFICATION'),
        targetMode: z.enum(['ALL', 'SELECTED']).default('ALL'),
        userIds: z.array(z.string()).optional(),
        actionUrl: z.string().url().optional().or(z.literal('')),
        actionLabel: z.string().max(50).optional(),
      });

      const data = schema.parse(req.body);

      // Clean empty actionUrl
      if (data.actionUrl === '') data.actionUrl = undefined;

      // Resolve recipient IDs
      let recipientIds: string[];
      if (data.targetMode === 'SELECTED') {
        if (!data.userIds || data.userIds.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Selecione pelo menos um destinatário',
          });
        }
        recipientIds = data.userIds;
      } else {
        const users = await prisma.user.findMany({ select: { id: true } });
        recipientIds = users.map(u => u.id);
      }

      if (recipientIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum destinatário encontrado',
        });
      }

      // Send notifications (in-app)
      if (data.deliveryChannel === 'NOTIFICATION' || data.deliveryChannel === 'BOTH') {
        await notificationService.broadcastNotification(recipientIds, {
          type: 'SYSTEM_ANNOUNCEMENT',
          category: 'SYSTEM',
          title: data.title,
          message: data.message,
          priority: data.priority,
          actionUrl: data.actionUrl,
          actionLabel: data.actionLabel,
        });
      }

      // Send emails
      if (data.deliveryChannel === 'EMAIL' || data.deliveryChannel === 'BOTH') {
        const users = await prisma.user.findMany({
          where: { id: { in: recipientIds } },
          select: { email: true },
        });

        // Batch emails with 150ms delay to avoid SMTP throttle
        for (const user of users) {
          try {
            await emailService.sendBroadcastEmail(user.email, {
              title: data.title,
              message: data.message,
              priority: data.priority,
              actionUrl: data.actionUrl,
              actionLabel: data.actionLabel,
            });
            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (emailErr: any) {
            logger.warn('[BROADCAST] Failed to send email', {
              email: user.email,
              error: emailErr.message,
            });
          }
        }
      }

      // Create audit log
      await prisma.broadcastLog.create({
        data: {
          adminId: req.user!.userId,
          adminEmail: req.user!.email || 'unknown',
          title: data.title,
          message: data.message,
          priority: data.priority,
          deliveryChannel: data.deliveryChannel,
          targetMode: data.targetMode,
          actionUrl: data.actionUrl,
          actionLabel: data.actionLabel,
          recipientCount: recipientIds.length,
          recipientIds: data.targetMode === 'SELECTED' ? JSON.stringify(recipientIds) : null,
        },
      });

      logger.info('[BROADCAST] Admin broadcast sent', {
        adminId: req.user!.userId,
        channel: data.deliveryChannel,
        targetMode: data.targetMode,
        recipientCount: recipientIds.length,
      });

      res.json({
        success: true,
        message: `Comunicação enviada para ${recipientIds.length} destinatários`,
        data: {
          recipientCount: recipientIds.length,
          channel: data.deliveryChannel,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
      }
      logger.error('[BROADCAST] Error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao enviar comunicação',
      });
    }
  }

  /**
   * Histórico de broadcasts enviados
   */
  async getBroadcastHistory(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem ver o histórico',
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.broadcastLog.findMany({
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.broadcastLog.count(),
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar histórico',
      });
    }
  }
}

export const notificationController = new NotificationController();
