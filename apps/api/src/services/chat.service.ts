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
  message?: string; // Optional para mensagens antigas/não criptografadas
  encryptedContent?: string; // Para mensagens criptografadas
  isEncrypted?: boolean; // Flag de criptografia
  iv?: string; // Initialization Vector para AES-GCM
  attachments?: string[]; // Retrocompatibilidade
  attachmentUrl?: string; // URL do anexo (novo formato)
  attachmentType?: string; // Tipo MIME do anexo
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
    const isMarketplaceOrder = ['PENDING', 'IN_NEGOTIATION'].includes(order.status);

    // Permitir acesso se:
    // 1. É owner/payer (sempre)
    // 2. Pedido está no marketplace (PENDING/IN_NEGOTIATION) - comprador pode iniciar negociação
    if (!isOrderOwner && !isPayer && !isMarketplaceOrder) {
      throw new Error('Você não tem permissão para acessar este chat');
    }

    // Impedir owner de criar chat com ele mesmo
    if (isOrderOwner && !isPayer && !transaction) {
      throw new Error('Chat não disponível para seu próprio pedido');
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
      // NOVO: Limpar mensagens antigas se pedido voltou para PENDING (negociação cancelada/expirada)
      if (order.status === 'PENDING') {
        const oldMessageCount = await prisma.chatMessage.count({ where: { chatId: chat.id } });
        if (oldMessageCount > 0) {
          await prisma.chatMessage.deleteMany({ where: { chatId: chat.id } });
          console.log(`🗑️ Cleared ${oldMessageCount} old messages - order is PENDING again`);
        }
      }

      // Adicionar contador de não lidas para o usuário
      const unreadCount = chat.participant1Id === userId ? chat.unreadCount1 : chat.unreadCount2;
      const otherParticipant = chat.participant1Id === userId ? chat.participant2 : chat.participant1;

      return {
        ...chat,
        unreadCount,
        otherParticipant,
        messages: order.status === 'PENDING' ? [] : chat.messages, // Chat vazio se PENDING
      };
    }

    // Criar novo chat
    // Para pedidos no marketplace (PENDING/IN_NEGOTIATION), criar chat entre owner e comprador interessado
    // Para pedidos já aceitos (MATCHED+), usar transaction.payerId
    const participant1Id = order.userId; // Owner
    const participant2Id = transaction ? transaction.payerId : userId; // Payer (se existe) ou comprador interessado

    // Garantir que não está criando chat consigo mesmo
    if (participant1Id === participant2Id) {
      throw new Error('Não é possível criar chat consigo mesmo');
    }

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

    // Adicionar contador de não lidas e other participant
    const unreadCount = chat.participant1Id === userId ? chat.unreadCount1 : chat.unreadCount2;
    const otherParticipant = chat.participant1Id === userId ? chat.participant2 : chat.participant1;

    return {
      ...chat,
      unreadCount,
      otherParticipant,
    };
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
        order: { select: { id: true, status: true, userId: true } },
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

    // NOVO: Verificar se é a primeira mensagem e iniciar negociação
    if (input.type !== 'SYSTEM') {
      const messageCount = await prisma.chatMessage.count({
        where: { chatId: input.chatId },
      });

      console.log(`📨 Message check - chatId: ${input.chatId}, messageCount: ${messageCount}, senderId: ${input.senderId}, orderId: ${chat.order.id}, orderOwnerId: ${chat.order.userId}`);

      // Se for a primeira mensagem E o sender NÃO é o owner do pedido
      if (messageCount === 0 && chat.order.userId !== input.senderId) {
        console.log(`✅ First message conditions met - starting negotiation`);
        const negotiationService = require('./negotiation.service').default;
        try {
          await negotiationService.startNegotiation(chat.order.id, input.senderId);
          console.log(`💬 First message sent - negotiation started for order ${chat.order.id}`);
        } catch (error) {
          console.error('❌ Failed to start negotiation:', error);
          // Continuar mesmo se falhar (não bloquear o envio da mensagem)
        }
      } else {
        console.log(`⏭️ Not first message or sender is owner - skipping negotiation start`);
      }
    }

    // Criar mensagem (suporta formato híbrido)
    const message = await prisma.chatMessage.create({
      data: {
        chatId: input.chatId,
        senderId: input.senderId,
        // Mensagem não criptografada (retrocompatibilidade)
        message: input.message || null,
        // Mensagem criptografada (E2E)
        encryptedContent: input.encryptedContent || null,
        isEncrypted: input.isEncrypted || false,
        iv: input.iv || null,
        // Anexos
        attachments: input.attachments ? JSON.stringify(input.attachments) : null,
        attachmentUrl: input.attachmentUrl || null,
        attachmentType: input.attachmentType || null,
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

          // Para mensagens criptografadas, não mostrar conteúdo na notificação
          const notificationMessage = input.isEncrypted
            ? `${senderName || 'Usuário'} enviou uma mensagem` // 🔒 Mensagem criptografada
            : `${senderName || 'Usuário'}: ${input.message?.substring(0, 50) || ''}${
                input.message && input.message.length > 50 ? '...' : ''
              }`;

          await notificationService.createNotification({
            userId: recipientId,
            type: 'CHAT_MESSAGE',
            category: 'ORDER',
            title: '💬 Nova mensagem',
            message: notificationMessage,
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
