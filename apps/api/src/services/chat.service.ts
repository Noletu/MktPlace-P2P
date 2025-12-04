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

    // Permitir acesso apenas se é owner ou payer de um pedido já aceito (MATCHED)
    // Chat só deve estar disponível APÓS aceitar o pedido
    if (!isOrderOwner && !isPayer) {
      throw new Error('Chat disponível apenas após aceitar o pedido');
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
      // RASTREABILIDADE: Mensagens nunca são deletadas, apenas arquivadas
      // Sistema de arquivamento com retenção de 1 ano implementado em ChatArchive

      // Adicionar contador de não lidas para o usuário
      const unreadCount = chat.participant1Id === userId ? chat.unreadCount1 : chat.unreadCount2;
      const otherParticipant = chat.participant1Id === userId ? chat.participant2 : chat.participant1;

      return {
        ...chat,
        unreadCount,
        otherParticipant,
        messages: chat.messages, // Histórico sempre visível para rastreabilidade
      };
    }

    // Criar novo chat
    // Chat só é criado após pedido ser aceito (MATCHED+)
    // Usa transaction.payerId para identificar o comprador
    const participant1Id = order.userId; // Owner (vendedor)
    const participant2Id = transaction ? transaction.payerId : userId; // Payer (comprador)

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
        messages: {
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new Error('Falha ao criar chat');
    }

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
            actionUrl: `/orders/${chat.orderId}?tab=chat`,
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

  /**
   * Arquivar mensagens do chat (retenção de 1 ano)
   * Chamado automaticamente quando pedido é concluído ou cancelado
   */
  async archiveChat(chatId: string, reason: string, userId?: string) {
    // Buscar chat com mensagens
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        order: {
          select: { id: true, status: true },
        },
      },
    });

    if (!chat) {
      throw new Error('Chat não encontrado');
    }

    // Criar snapshot das mensagens (JSON)
    const messagesSnapshot = JSON.stringify(chat.messages);

    // Data de expiração: 1 ano a partir de agora
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Criar arquivo
    const archive = await prisma.chatArchive.create({
      data: {
        originalChatId: chatId,
        reason,
        messagesSnapshot,
        archivedBy: userId || null,
        expiresAt,
      },
    });

    logger.info('[CHAT ARCHIVE] Chat archived', {
      chatId,
      archiveId: archive.id,
      reason,
      messageCount: chat.messages.length,
      expiresAt,
    });

    return archive;
  }

  /**
   * Buscar mensagens arquivadas de um chat
   */
  async getArchivedMessages(chatId: string) {
    const archives = await prisma.chatArchive.findMany({
      where: {
        originalChatId: chatId,
        isDeleted: false,
      },
      orderBy: { archivedAt: 'desc' },
    });

    // Parsear mensagens do snapshot
    const allArchivedMessages = archives.flatMap((archive) => {
      try {
        const messages = JSON.parse(archive.messagesSnapshot);
        return messages.map((msg: any) => ({
          ...msg,
          isArchived: true,
          archiveReason: archive.reason,
          archivedAt: archive.archivedAt,
          expiresAt: archive.expiresAt,
        }));
      } catch (error) {
        logger.error('[CHAT ARCHIVE] Failed to parse snapshot', { archiveId: archive.id, error });
        return [];
      }
    });

    return allArchivedMessages;
  }

  /**
   * Buscar histórico completo (mensagens ativas + arquivadas)
   */
  async getChatHistory(chatId: string, userId: string) {
    // Verificar permissão
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
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

    // Buscar mensagens arquivadas
    const archivedMessages = await this.getArchivedMessages(chatId);

    // Combinar mensagens ativas + arquivadas
    const allMessages = [
      ...archivedMessages,
      ...chat.messages.map((msg) => ({ ...msg, isArchived: false })),
    ];

    // Ordenar por data
    allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      chat,
      messages: allMessages,
      hasArchived: archivedMessages.length > 0,
    };
  }

  /**
   * Limpar arquivos expirados (executado pelo worker)
   * Remove arquivos com mais de 1 ano
   */
  async cleanupExpiredArchives() {
    const now = new Date();

    // Buscar arquivos expirados
    const expiredArchives = await prisma.chatArchive.findMany({
      where: {
        expiresAt: { lte: now },
        isDeleted: false,
      },
    });

    if (expiredArchives.length === 0) {
      logger.info('[CHAT ARCHIVE CLEANUP] No expired archives found');
      return { deleted: 0 };
    }

    // Marcar como deletados (soft delete)
    const result = await prisma.chatArchive.updateMany({
      where: {
        expiresAt: { lte: now },
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: now,
      },
    });

    logger.info('[CHAT ARCHIVE CLEANUP] Expired archives deleted', {
      count: result.count,
      expiredArchives: expiredArchives.map((a) => ({
        id: a.id,
        chatId: a.originalChatId,
        expiresAt: a.expiresAt,
      })),
    });

    return { deleted: result.count };
  }

  /**
   * Verificar status de arquivamento de um chat
   */
  async getArchiveStatus(chatId: string) {
    const archives = await prisma.chatArchive.findMany({
      where: {
        originalChatId: chatId,
        isDeleted: false,
      },
      orderBy: { archivedAt: 'desc' },
    });

    return {
      isArchived: archives.length > 0,
      archives: archives.map((archive) => ({
        id: archive.id,
        reason: archive.reason,
        archivedAt: archive.archivedAt,
        expiresAt: archive.expiresAt,
        messageCount: (() => {
          try {
            return JSON.parse(archive.messagesSnapshot).length;
          } catch {
            return 0;
          }
        })(),
      })),
    };
  }
}

export const chatService = new ChatService();
