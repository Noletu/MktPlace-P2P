import { Request, Response } from 'express';
import { chatService } from '../services/chat.service';
import { auditLogService } from '../services/auditLog.service';

export class ChatController {
  /**
   * Obter ou criar chat para um pedido
   */
  async getOrCreateChat(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { orderId } = req.params;

      const chat = await chatService.getOrCreateChat(orderId, userId);

      res.json({
        success: true,
        data: chat,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao obter chat',
      });
    }
  }

  /**
   * Buscar chats do usuário
   */
  async getUserChats(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const chats = await chatService.getUserChats(userId);

      res.json({
        success: true,
        data: chats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar chats',
      });
    }
  }

  /**
   * Buscar chat por ID
   */
  async getChatById(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { chatId } = req.params;

      const chat = await chatService.getChatById(chatId, userId);

      res.json({
        success: true,
        data: chat,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao buscar chat',
      });
    }
  }

  /**
   * Buscar mensagens do chat
   */
  async getMessages(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { chatId } = req.params;
      const { limit, before } = req.query;

      const messages = await chatService.getMessages(chatId, userId, {
        limit: limit ? parseInt(limit as string) : undefined,
        before: before as string,
      });

      res.json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao buscar mensagens',
      });
    }
  }

  /**
   * Enviar mensagem (REST fallback)
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { chatId } = req.params;
      const { message, attachments } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Mensagem não pode estar vazia',
        });
      }

      const newMessage = await chatService.sendMessage({
        chatId,
        senderId: userId,
        message: message.trim(),
        attachments,
      });

      // SECURITY: Audit log
      auditLogService.logFromRequest(
        req,
        'SEND_CHAT_MESSAGE',
        'CHAT',
        chatId,
        { messageId: newMessage.id }
      );

      res.status(201).json({
        success: true,
        data: newMessage,
        message: 'Mensagem enviada com sucesso',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao enviar mensagem',
      });
    }
  }

  /**
   * Marcar mensagens como lidas
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

      const { chatId } = req.params;

      await chatService.markAsRead(chatId, userId);

      res.json({
        success: true,
        message: 'Mensagens marcadas como lidas',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao marcar mensagens como lidas',
      });
    }
  }

  /**
   * Contar chats não lidos
   */
  async getUnreadChatsCount(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const count = await chatService.getUnreadChatsCount(userId);

      res.json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao contar chats não lidos',
      });
    }
  }

  /**
   * Desativar chat (admin)
   */
  async deactivateChat(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'ADMIN' && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem desativar chats',
        });
      }

      const { chatId } = req.params;

      await chatService.deactivateChat(chatId);

      // SECURITY: Audit log
      auditLogService.logFromRequest(
        req,
        'DEACTIVATE_CHAT',
        'CHAT',
        chatId,
        {}
      );

      res.json({
        success: true,
        message: 'Chat desativado com sucesso',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao desativar chat',
      });
    }
  }

  /**
   * Buscar histórico completo do chat (ativas + arquivadas)
   */
  async getChatHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.userId!;
      const { chatId } = req.params;

      const history = await chatService.getChatHistory(chatId, userId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao buscar histórico',
      });
    }
  }

  /**
   * Verificar status de arquivamento do chat
   */
  async getArchiveStatus(req: Request, res: Response) {
    try {
      const { chatId } = req.params;

      const status = await chatService.getArchiveStatus(chatId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao buscar status de arquivamento',
      });
    }
  }
}

export const chatController = new ChatController();
