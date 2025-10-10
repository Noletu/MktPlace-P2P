import { PrismaClient } from '@prisma/client';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateChatInput {
  orderId: string;
  participant1Id: string;
  participant2Id: string;
}

export interface SendMessageInput {
  chatId: string;
  senderId: string;
  message: string;
  attachments?: string[];
  type?: 'TEXT' | 'IMAGE' | 'SYSTEM';
}

export interface GetMessagesFilters {
  limit?: number;
  before?: string; // Message ID para paginação
}

export class ChatService {
  /**
   * Criar ou recuperar chat para um pedido
   */
  async getOrCreateChat(orderId: string, userId: string) {
    // Verificar se pedido existe e usuário tem permissão
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        transactions: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Verificar se usuário é parte do pedido
    const isOrderOwner = order.userId === userId;
    const transaction = order.transactions[0];
    const isPayer = transaction?.payerId === userId;

    if (!isOrderOwner && !isPayer) {
      throw new Error('Você não tem permissão para acessar este chat');
    }

    // Verificar se chat já existe
    let chat = await prisma.chat.findUnique({
      where: { orderId },
      include: {
        participant1: {
          select: { id: true, name: true, email: true, reputationScore: true },
        },
        participant2: {
          select: { id: true, name: true, email: true, reputationScore: true },
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (chat) {
      return chat;
    }

    // Criar novo chat
    if (!transaction) {
      throw new Error('Pedido ainda não foi aceito. Chat será criado quando houver um comprador.');
    }

    const participant1Id = order.userId;
    const participant2Id = transaction.payerId;

    chat = await prisma.chat.create({
      data: {
        orderId,
        participant1Id,
        participant2Id,
      },
      include: {
        participant1: {
          select: { id: true, name: true, email: true, reputationScore: true },
        },
        participant2: {
          select: { id: true, name: true, email: true, reputationScore: true },
        },
        messages: true,
      },
    });

    // Mensagem de sistema inicial
    await this.sendMessage({
      chatId: chat.id,
      senderId: participant1Id,
      message: '🤝 Chat iniciado! Podem conversar sobre a transação aqui.',
      type: 'SYSTEM',
    });

    logger.info('[CHAT] Created', {
      chatId: chat.id,
      orderId,
      participants: [participant1Id, participant2Id],
    });

    return chat;
  }

  /**
   * Enviar mensagem
   */
  async sendMessage(input: SendMessageInput) {
    const chat = await prisma.chat.findUnique({
      where: { id: input.chatId },
      include: {
        participant1: { select: { id: true, name: true } },
        participant2: { select: { id: true, name: true } },
      },
    });

    if (!chat) {
      throw new Error('Chat não encontrado');
    }

    // Verificar se sender é participante
    if (
      chat.participant1Id !== input.senderId &&
      chat.participant2Id !== input.senderId &&
      input.type !== 'SYSTEM'
    ) {
      throw new Error('Você não tem permissão para enviar mensagens neste chat');
    }

    // Criar mensagem
    const message = await prisma.chatMessage.create({
      data: {
        chatId: input.chatId,
        senderId: input.senderId,
        message: input.message,
        attachments: input.attachments ? JSON.stringify(input.attachments) : null,
        type: input.type || 'TEXT',
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Atualizar última mensagem e contador de não lidas
    const recipientId =
      chat.participant1Id === input.senderId
        ? chat.participant2Id
        : chat.participant1Id;

    const unreadField =
      chat.participant1Id === recipientId ? 'unreadCount1' : 'unreadCount2';

    await prisma.chat.update({
      where: { id: input.chatId },
      data: {
        lastMessageAt: new Date(),
        [unreadField]: { increment: 1 },
      },
    });

    // Enviar notificação (apenas para mensagens de usuários, não sistema)
    if (input.type !== 'SYSTEM') {
      setImmediate(async () => {
        try {
          const senderName =
            chat.participant1Id === input.senderId
              ? chat.participant1.name
              : chat.participant2.name;

          await notificationService.createNotification({
            userId: recipientId,
            type: 'CHAT_MESSAGE',
            category: 'ORDER',
            title: '💬 Nova mensagem',
            message: `${senderName || 'Usuário'}: ${input.message.substring(0, 50)}${
              input.message.length > 50 ? '...' : ''
            }`,
            actionUrl: `/orders/${chat.orderId}/chat`,
            actionLabel: 'Ver Chat',
            relatedId: chat.orderId,
            relatedType: 'ORDER',
            priority: 'NORMAL',
          });
        } catch (error) {
          logger.error('[CHAT] Failed to send notification', { error });
        }
      });
    }

    logger.info('[CHAT] Message sent', {
      messageId: message.id,
      chatId: input.chatId,
      senderId: input.senderId,
    });

    return message;
  }

  /**
   * Buscar mensagens do chat
   */
  async getMessages(chatId: string, userId: string, filters?: GetMessagesFilters) {
    // Verificar permissão
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new Error('Chat não encontrado');
    }

    if (chat.participant1Id !== userId && chat.participant2Id !== userId) {
      throw new Error('Você não tem permissão para acessar este chat');
    }

    // Buscar mensagens
    const where: any = { chatId };

    if (filters?.before) {
      where.id = { lt: filters.before };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      take: filters?.limit || 50,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    return messages.reverse(); // Inverter para ordem cronológica
  }

  /**
   * Marcar mensagens como lidas
   */
  async markAsRead(chatId: string, userId: string) {
    // Verificar permissão
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new Error('Chat não encontrado');
    }

    if (chat.participant1Id !== userId && chat.participant2Id !== userId) {
      throw new Error('Você não tem permissão para acessar este chat');
    }

    // Marcar mensagens não lidas como lidas
    await prisma.chatMessage.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Resetar contador de não lidas
    const unreadField =
      chat.participant1Id === userId ? 'unreadCount1' : 'unreadCount2';

    await prisma.chat.update({
      where: { id: chatId },
      data: {
        [unreadField]: 0,
      },
    });

    return { success: true };
  }

  /**
   * Buscar chats do usuário
   */
  async getUserChats(userId: string) {
    const chats = await prisma.chat.findMany({
      where: {
        OR: [{ participant1Id: userId }, { participant2Id: userId }],
        isActive: true,
      },
      include: {
        participant1: {
          select: { id: true, name: true, reputationScore: true },
        },
        participant2: {
          select: { id: true, name: true, reputationScore: true },
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
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    // Adicionar contador de não lidas para o usuário
    const chatsWithUnread = chats.map((chat) => ({
      ...chat,
      unreadCount:
        chat.participant1Id === userId ? chat.unreadCount1 : chat.unreadCount2,
      otherParticipant:
        chat.participant1Id === userId ? chat.participant2 : chat.participant1,
    }));

    return chatsWithUnread;
  }

  /**
   * Buscar chat por ID
   */
  async getChatById(chatId: string, userId: string) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participant1: {
          select: { id: true, name: true, email: true, reputationScore: true },
        },
        participant2: {
          select: { id: true, name: true, email: true, reputationScore: true },
        },
        order: {
          select: {
            id: true,
            type: true,
            status: true,
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
            userId: true,
          },
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new Error('Chat não encontrado');
    }

    if (chat.participant1Id !== userId && chat.participant2Id !== userId) {
      throw new Error('Você não tem permissão para acessar este chat');
    }

    return {
      ...chat,
      messages: chat.messages.reverse(),
      unreadCount:
        chat.participant1Id === userId ? chat.unreadCount1 : chat.unreadCount2,
      otherParticipant:
        chat.participant1Id === userId ? chat.participant2 : chat.participant1,
    };
  }

  /**
   * Contar chats não lidos do usuário
   */
  async getUnreadChatsCount(userId: string) {
    const chats = await prisma.chat.findMany({
      where: {
        OR: [
          { participant1Id: userId, unreadCount1: { gt: 0 } },
          { participant2Id: userId, unreadCount2: { gt: 0 } },
        ],
        isActive: true,
      },
    });

    return chats.length;
  }

  /**
   * Desativar chat (admin)
   */
  async deactivateChat(chatId: string) {
    await prisma.chat.update({
      where: { id: chatId },
      data: { isActive: false },
    });

    return { success: true };
  }
}

export const chatService = new ChatService();
