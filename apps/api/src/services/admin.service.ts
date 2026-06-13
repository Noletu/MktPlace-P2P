import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from './auditLog.service';
import { notificationService } from './notification.service';
import { emailService } from './email.service';
import { clearUserPermissionCache } from '../middleware/permission.middleware';
import { WalletService } from './wallet.service';
import { PendingApprovalService } from './pendingApproval.service';
import { toBN, sumBN, gtBN } from '../utils/money';

const prisma = new PrismaClient();

export class AdminService {
  /**
   * ============================================
   * GESTÃO DE ENDEREÇOS DA PLATAFORMA
   * ============================================
   */

  /**
   * Listar todos os endereços da plataforma
   */
  async getPlatformWallets(filters?: {
    cryptoType?: string;
    network?: string;
    isActive?: boolean;
  }) {
    const wallets = await prisma.platformWallet.findMany({
      where: {
        cryptoType: filters?.cryptoType,
        network: filters?.network,
        isActive: filters?.isActive,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return wallets;
  }

  /**
   * Obter endereço da plataforma por ID
   */
  async getPlatformWalletById(id: string) {
    const wallet = await prisma.platformWallet.findUnique({
      where: { id },
    });

    if (!wallet) {
      throw new Error('Endereço não encontrado');
    }

    return wallet;
  }

  /**
   * Criar novo endereço da plataforma
   */
  async createPlatformWallet(
    data: {
      cryptoType: string;
      network: string;
      address: string;
      label?: string;
    },
    adminId: string
  ) {
    // Verificar se endereço já existe para essa combinação crypto/network
    const existing = await prisma.platformWallet.findUnique({
      where: {
        cryptoType_network: {
          cryptoType: data.cryptoType,
          network: data.network,
        },
      },
    });

    if (existing) {
      throw new Error('Este endereço já está cadastrado');
    }

    const wallet = await prisma.platformWallet.create({
      data: {
        ...data,
        createdBy: adminId,
      },
    });

    // Registrar ação admin
    await this.logAdminAction({
      adminId,
      action: 'CREATE',
      resource: 'PLATFORM_WALLET',
      resourceId: wallet.id,
      metadata: JSON.stringify({ address: data.address, cryptoType: data.cryptoType }),
    });

    console.log(`✅ Endereço da plataforma criado: ${wallet.address}`);

    return wallet;
  }

  /**
   * Atualizar endereço da plataforma
   */
  async updatePlatformWallet(
    id: string,
    data: {
      label?: string;
      isActive?: boolean;
    },
    adminId: string
  ) {
    const wallet = await prisma.platformWallet.update({
      where: { id },
      data,
    });

    // Registrar ação admin
    await this.logAdminAction({
      adminId,
      action: 'UPDATE',
      resource: 'PLATFORM_WALLET',
      resourceId: wallet.id,
      metadata: JSON.stringify(data),
    });

    console.log(`✅ Endereço da plataforma atualizado: ${wallet.address}`);

    return wallet;
  }

  /**
   * Deletar endereço da plataforma
   */
  async deletePlatformWallet(id: string, adminId: string) {
    const wallet = await prisma.platformWallet.delete({
      where: { id },
    });

    // Registrar ação admin
    await this.logAdminAction({
      adminId,
      action: 'DELETE',
      resource: 'PLATFORM_WALLET',
      resourceId: id,
      metadata: JSON.stringify({ address: wallet.address }),
    });

    console.log(`🗑️ Endereço da plataforma removido: ${wallet.address}`);

    return wallet;
  }

  /**
   * Buscar endereço ativo da plataforma para uma cripto/rede específica
   */
  async getActivePlatformWallet(cryptoType: string, network: string) {
    console.log(`🔍 Buscando endereço da plataforma para: cryptoType="${cryptoType}", network="${network}", isActive=true`);

    // Buscar TODOS os endereços para debug
    const allWallets = await prisma.platformWallet.findMany();
    console.log(`📊 Total de endereços cadastrados: ${allWallets.length}`);
    allWallets.forEach(w => {
      console.log(`   - ${w.cryptoType} / ${w.network} / isActive=${w.isActive} / address=${w.address}`);
    });

    const wallet = await prisma.platformWallet.findFirst({
      where: {
        cryptoType,
        network,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc', // Pegar o mais recente
      },
    });

    if (wallet) {
      console.log(`✅ Endereço encontrado: ${wallet.address}`);
    } else {
      console.log(`❌ Nenhum endereço encontrado com os critérios especificados`);
    }

    return wallet;
  }

  /**
   * ============================================
   * ESTATÍSTICAS DO DASHBOARD
   * ============================================
   */

  async getDashboardStats() {
    // Buscar dados em paralelo
    const [
      totalUsers,
      totalOrders,
      totalTransactions,
      pendingDisputes,
      activeOrders,
      completedOrders,
      recentUsers,
      recentOrders,
    ] = await Promise.all([
      // Total de usuários
      prisma.user.count(),

      // Total de pedidos
      prisma.order.count(),

      // Total de transações
      prisma.transaction.count(),

      // Disputas pendentes
      prisma.order.count({
        where: {
          status: 'DISPUTED',
        },
      }),

      // Pedidos ativos
      prisma.order.count({
        where: {
          status: {
            in: ['PENDING', 'MATCHED', 'PAYMENT_SENT', 'VALIDATING'],
          },
        },
      }),

      // Pedidos completados
      prisma.order.count({
        where: {
          status: 'COMPLETED',
        },
      }),

      // Usuários recentes (últimos 7 dias)
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Pedidos recentes (últimos 7 dias)
      prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calcular volume total (soma dos brlAmount como strings)
    const orders = await prisma.order.findMany({
      where: { status: 'COMPLETED' },
      select: { brlAmount: true },
    });

    const totalVolume = toBN(sumBN(orders.map(o => o.brlAmount))).toNumber();

    return {
      users: {
        total: totalUsers,
        recent: recentUsers,
      },
      orders: {
        total: totalOrders,
        active: activeOrders,
        completed: completedOrders,
        recent: recentOrders,
      },
      transactions: {
        total: totalTransactions,
      },
      disputes: {
        pending: pendingDisputes,
      },
      volume: {
        totalBRL: totalVolume.toFixed(2),
      },
    };
  }

  /**
   * ============================================
   * GESTÃO DE USUÁRIOS
   * ============================================
   */

  async getUsers(filters?: {
    role?: string;
    search?: string;
  }) {
    const users = await prisma.user.findMany({
      where: {
        legacyRole: filters?.role, // RBAC: Usar legacyRole temporariamente para filtro
        OR: filters?.search
          ? [
              { email: { contains: filters.search } },
              { name: { contains: filters.search } },
            ]
          : undefined,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        email: true,
        name: true,
        legacyRole: true,
        reputationScore: true,
        totalTransactions: true,
        successfulTransactions: true,
        createdAt: true,
        accountFrozen: true,
        frozenReason: true,
        frozenAt: true,
        frozenUntil: true,
        customDailyLimit: true,
        twoFactorEnabled: true,
        // RBAC: Incluir role relation
        role: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });

    // RBAC: Mapear para retornar role como string (compatibilidade frontend)
    return users.map(user => {
      const userRole = user.role?.slug?.toUpperCase() || user.legacyRole;
      const { role: roleObject, legacyRole, customDailyLimit, ...rest } = user;

      const formulaLimit = 1000 + (user.reputationScore * 100);
      const effectiveCustom = customDailyLimit != null ? customDailyLimit.toNumber() : null;
      const dailyLimit = effectiveCustom != null ? effectiveCustom : formulaLimit;

      return {
        ...rest,
        role: userRole,
        customDailyLimit: effectiveCustom ?? undefined,
        dailyLimit,
      };
    });
  }

  async updateUser(
    userId: string,
    data: {
      role?: string;
    },
    adminId: string
  ) {
    // Buscar admin que está fazendo a mudança (com role RBAC)
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      include: {
        role: {
          select: { slug: true, level: true },
        },
      },
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          select: { slug: true, level: true },
        },
      },
    });

    if (!admin || !targetUser) {
      throw new Error('Usuário não encontrado');
    }

    // RBAC: Extrair roles como strings
    const adminRole = admin.role?.slug?.toUpperCase() || admin.legacyRole;
    const targetRole = targetUser.role?.slug?.toUpperCase() || targetUser.legacyRole;

    // Regras de hierarquia para mudança de role
    if (data.role) {
      const roleHierarchy: Record<string, number> = {
        USER: 0,
        SUPPORT: 40,
        GERENTE: 60,
        ADMIN: 80,
        MASTER: 100,
      };

      const adminLevel = admin.role?.level || roleHierarchy[adminRole] || 0;
      const targetLevel = targetUser.role?.level || roleHierarchy[targetRole] || 0;
      const newLevel = roleHierarchy[data.role] || 0;

      // 1. Ninguém pode alterar o próprio role
      if (adminId === userId) {
        throw new Error('Você não pode alterar seu próprio role');
      }

      // 2. Não pode promover alguém acima do seu próprio nível
      // Exceção: MASTER pode promover outro usuário para MASTER (mesmo nível)
      if (newLevel >= adminLevel && !(adminRole === 'MASTER' && data.role === 'MASTER')) {
        throw new Error(`Apenas usuários MASTER podem promover para ${data.role}`);
      }

      // 3. Não pode alterar alguém de nível superior ou igual.
      // Exceção: MASTER pode iniciar demoção de outro MASTER (enfileirada para aprovação dupla).
      if (targetLevel >= adminLevel && !(adminRole === 'MASTER' && targetRole === 'MASTER')) {
        throw new Error('Você não tem permissão para alterar este usuário');
      }

      // 4. Apenas MASTER pode criar outro MASTER
      if (data.role === 'MASTER' && adminRole !== 'MASTER') {
        throw new Error('Apenas MASTER pode promover para MASTER');
      }

      // 5. MASTER não pode ser rebaixado (apenas por outro MASTER)
      if (targetRole === 'MASTER' && adminRole !== 'MASTER') {
        throw new Error('Apenas MASTER pode alterar outro MASTER');
      }

      // CRITICAL: Rebaixamento de MASTER exige aprovação dupla (Maker-Checker)
      // A operação é enfileirada; nenhuma alteração ocorre até um segundo MASTER aprovar.
      if (targetRole === 'MASTER' && data.role !== 'MASTER') {
        const approval = await PendingApprovalService.create({
          initiatorId:      adminId,
          operationType:    'DEMOTE_MASTER',
          operationPayload: {
            targetUserId:    userId,
            targetUserEmail: targetUser.email,
            targetUserName:  targetUser.name ?? targetUser.email,
            newRole:         data.role,
            newRoleSlug:     data.role.toLowerCase(),
            reason:          (data as any).reason ?? 'Sem motivo informado',
          },
        });
        return { _pending: true, approval } as any;
      }

      // CRITICAL: Promoção para MASTER exige aprovação dupla (Maker-Checker)
      // Mesma simetria de segurança do rebaixamento — evita promoção indevida por MASTER comprometido.
      if (data.role === 'MASTER' && targetRole !== 'MASTER') {
        const approval = await PendingApprovalService.create({
          initiatorId:      adminId,
          operationType:    'PROMOTE_MASTER',
          operationPayload: {
            targetUserId:    userId,
            targetUserEmail: targetUser.email,
            targetUserName:  targetUser.name ?? targetUser.email,
            newRole:         'MASTER',
            newRoleSlug:     'master',
            previousRole:    targetRole,
            reason:          (data as any).reason ?? 'Sem motivo informado',
          },
        });
        return { _pending: true, approval } as any;
      }

      // RBAC: Buscar role ID pelo slug
      const newRoleSlug = data.role.toLowerCase();
      const newRoleRecord = await prisma.role.findUnique({
        where: { slug: newRoleSlug },
      });

      if (!newRoleRecord) {
        throw new Error(`Role ${data.role} não encontrado no sistema RBAC`);
      }

      // Atualizar com roleId (RBAC) e legacyRole (backward compatibility)
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          roleId: newRoleRecord.id,
          legacyRole: data.role,
        },
      });

      // Invalidar cache de permissões imediatamente para que o novo role seja aplicado
      clearUserPermissionCache(userId);

      // Registrar ação admin com detalhes da hierarquia (legacy system - manter para backward compatibility)
      await this.logAdminAction({
        adminId,
        action: 'UPDATE_USER_ROLE',
        resource: 'USER',
        resourceId: userId,
        metadata: JSON.stringify({
          previousRole: targetRole,
          newRole: data.role,
          adminRole: adminRole,
          adminLevel,
          targetLevel,
          newLevel,
        }),
      });

      // Log no sistema moderno de audit
      await auditLogService.log({
        userId: adminId,
        email: admin.email,
        role: adminRole,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
        resource: AUDIT_RESOURCES.USER,
        resourceId: userId,
        metadata: {
          previousRole: targetRole,
          newRole: data.role,
          adminRole: adminRole,
          adminLevel,
          targetLevel,
          newLevel,
          targetUserEmail: targetUser.email,
          targetUserName: targetUser.name,
        },
        // Note: IP e userAgent não disponíveis aqui (service layer)
        // Seria necessário passar do controller se precisar
      });

      return user;
    }

    // Se não está mudando role, apenas aplica outras mudanças
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    // Registrar ação admin
    await this.logAdminAction({
      adminId,
      action: 'UPDATE_USER',
      resource: 'USER',
      resourceId: userId,
      metadata: JSON.stringify({
        ...data,
        adminRole: adminRole,
      }),
    });

    return user;
  }

  /**
   * Define limite diario personalizado para um usuario
   * Se customDailyLimit === null, reseta para formula automatica
   */
  async setCustomDailyLimit(
    userId: string,
    data: {
      customDailyLimit: number | null;
      note: string;
      adminId: string;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { customDailyLimit: true, reputationScore: true },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const effectivePrevious = user.customDailyLimit != null
      ? user.customDailyLimit.toNumber()
      : null;
    const previousLimit = effectivePrevious !== null
      ? effectivePrevious
      : 1000 + (user.reputationScore * 100);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        customDailyLimit: data.customDailyLimit,
        customLimitSetBy: data.customDailyLimit !== null ? data.adminId : null,
        customLimitSetAt: data.customDailyLimit !== null ? new Date() : null,
        customLimitNote: data.customDailyLimit !== null ? data.note : null,
      },
    });

    // Registrar acao admin
    await this.logAdminAction({
      adminId: data.adminId,
      action: 'SET_CUSTOM_LIMIT',
      resource: 'USER',
      resourceId: userId,
      metadata: JSON.stringify({
        previousLimit,
        newLimit: data.customDailyLimit,
        isCustom: data.customDailyLimit !== null,
        note: data.note,
      }),
    });

    return updatedUser;
  }

  /**
   * ============================================
   * GESTÃO DE PEDIDOS
   * ============================================
   */

  async getAllOrders(filters?: {
    status?: string;
    type?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 50));
    const skip = (page - 1) * limit;

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: {
          status: filters?.status,
          type: filters?.type,
          userId: filters?.userId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          wallet: {
            select: { id: true, address: true, cryptoType: true, network: true },
          },
          transactions: {
            include: {
              payer: {
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      }),
      prisma.order.count({
        where: {
          status: filters?.status,
          type: filters?.type,
          userId: filters?.userId,
        },
      }),
    ]);

    // Resolve providerId (string sem relation) para providerUser em BUY orders
    const providerIds = [...new Set(
      orders.filter(o => o.providerId).map(o => o.providerId!)
    )];

    let providerMap: Record<string, { id: string; email: string; name: string | null }> = {};
    if (providerIds.length > 0) {
      const providers = await prisma.user.findMany({
        where: { id: { in: providerIds } },
        select: { id: true, email: true, name: true },
      });
      providerMap = Object.fromEntries(providers.map(p => [p.id, p]));
    }

    // Resolve providerWalletId para endereço (BUY orders)
    const providerWalletIds = [...new Set(
      orders.filter(o => o.providerWalletId).map(o => o.providerWalletId!)
    )];
    let providerWalletMap: Record<string, { id: string; address: string }> = {};
    if (providerWalletIds.length > 0) {
      const wallets = await prisma.userWallet.findMany({
        where: { id: { in: providerWalletIds } },
        select: { id: true, address: true },
      });
      providerWalletMap = Object.fromEntries(wallets.map(w => [w.id, w]));
    }

    // Resolve receiver wallets (carteira do comprador por cryptoType+network)
    // SELL: buyerId = tx[0].payerId | BUY: buyerId = order.userId
    const receiverKeys = orders
      .filter(o => o.status !== 'PENDING')
      .map(o => {
        const buyerId = o.orderType === 'SELL'
          ? o.transactions[0]?.payerId
          : o.userId;
        return buyerId ? { userId: buyerId, cryptoType: o.cryptoType, network: o.cryptoNetwork } : null;
      })
      .filter((k): k is { userId: string; cryptoType: string; network: string } => k !== null);

    let receiverWalletMap: Record<string, { address: string }> = {};
    if (receiverKeys.length > 0) {
      const receiverWallets = await prisma.userWallet.findMany({
        where: { OR: receiverKeys.map(k => ({ userId: k.userId, cryptoType: k.cryptoType, network: k.network })) },
        select: { userId: true, cryptoType: true, network: true, address: true },
      });
      receiverWalletMap = Object.fromEntries(
        receiverWallets.map(w => [`${w.userId}-${w.cryptoType}-${w.network}`, { address: w.address }])
      );
    }

    const enrichedOrders = orders.map(order => {
      const buyerId = order.orderType === 'SELL'
        ? order.transactions[0]?.payerId
        : order.userId;
      const receiverKey = buyerId ? `${buyerId}-${order.cryptoType}-${order.cryptoNetwork}` : null;

      return {
        ...order,
        providerUser: order.providerId ? providerMap[order.providerId] ?? null : null,
        providerWallet: order.providerWalletId ? providerWalletMap[order.providerWalletId] ?? null : null,
        receiverWallet: receiverKey ? receiverWalletMap[receiverKey] ?? null : null,
      };
    });

    return { orders: enrichedOrders, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async cancelOrder(orderId: string, adminId: string, reason: string) {
    // 1. Buscar pedido com todas as relações necessárias
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        transactions: {
          include: {
            payer: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        wallet: true, // HD Wallet para desbloqueio de colateral
        disputes: {
          where: {
            status: { in: ['OPEN', 'UNDER_REVIEW'] },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // 2. Verificar se há disputa ativa
    if (order.disputes && order.disputes.length > 0) {
      throw new Error(
        'Não é possível cancelar pedido com disputa ativa. Resolva a disputa primeiro.'
      );
    }

    // 3. Verificar se status permite cancelamento
    const cancelableStatuses = [
      'PENDING',
      'IN_NEGOTIATION',
      'MATCHED',
      'PAYMENT_SENT',
      'PAYMENT_RECEIVED',
    ];

    if (!cancelableStatuses.includes(order.status)) {
      throw new Error(
        `Pedido com status ${order.status} não pode ser cancelado. ` +
        `Apenas pedidos ${cancelableStatuses.join(', ')} podem ser cancelados.`
      );
    }

    // 4. Desbloquear colateral se existir
    // BUY orders: colateral em providerWalletId; SELL orders: colateral em walletId
    const collateralWalletId = order.providerWalletId || order.walletId;
    if (collateralWalletId && order.collateralLocked && order.collateralLockedAmount) {
      try {
        await WalletService.unlockBalance(
          collateralWalletId,
          order.collateralLockedAmount.toString(),
          orderId,
          `Colateral desbloqueado - pedido cancelado pelo admin`
        );
        console.log(`[ADMIN CANCEL] Colateral desbloqueado para order ${orderId}`);
      } catch (error) {
        console.error('[ADMIN CANCEL] Erro ao desbloquear colateral:', error);
        // Não falhar o cancelamento por erro de desbloqueio
      }
    }

    // 5. Atualizar status do pedido
    const cancelledOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledBy: adminId,
        cancellationReason: `[ADMIN] ${reason}`,
        cancelledAt: new Date(),
        collateralLocked: false,
        collateralUnlockedAt: new Date(),
      },
    });

    // 6. Criar histórico de cancelamento para o vendedor
    await prisma.cancellationHistory.create({
      data: {
        orderId,
        userId: order.user.id,
        role: 'SELLER',
        reason: `ADMIN_CANCELLED`,
        note: reason,
        orderStatus: order.status,
        orderValue: order.brlAmount,
        penaltyApplied: false, // Admin cancel não aplica penalidade
      },
    });

    // 6b. Criar histórico para o comprador se existir transação
    const buyer = order.transactions[0]?.payer;
    if (buyer) {
      await prisma.cancellationHistory.create({
        data: {
          orderId,
          userId: buyer.id,
          role: 'BUYER',
          reason: `ADMIN_CANCELLED`,
          note: reason,
          orderStatus: order.status,
          orderValue: order.brlAmount,
          penaltyApplied: false,
        },
      });
    }

    // 7. Notificar ambas as partes
    // Notificar comprador (payer) se existir transação
    if (buyer) {
      await notificationService.createNotification({
        userId: buyer.id,
        type: 'ORDER_CANCELLED_BY_ADMIN',
        category: 'ORDER',
        title: 'Pedido cancelado pela administração',
        message: `Seu pedido #${order.id.slice(0, 8)} foi cancelado por um administrador. Motivo: ${reason}`,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'Ver Detalhes',
        relatedId: order.id,
        relatedType: 'ORDER',
        priority: 'HIGH',
      });
    }

    // Notificar vendedor (user)
    if (order.user) {
      await notificationService.createNotification({
        userId: order.user.id,
        type: 'ORDER_CANCELLED_BY_ADMIN',
        category: 'ORDER',
        title: 'Pedido cancelado pela administração',
        message: `O pedido #${order.id.slice(0, 8)} foi cancelado por um administrador. Motivo: ${reason}`,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'Ver Detalhes',
        relatedId: order.id,
        relatedType: 'ORDER',
        priority: 'HIGH',
      });
    }

    // 8. Log de auditoria DETALHADO
    await this.logAdminAction({
      adminId,
      action: 'CANCEL_ORDER',
      resource: 'ORDER',
      resourceId: orderId,
      metadata: JSON.stringify({
        reason,
        previousStatus: order.status,
        buyerId: buyer?.id,
        sellerId: order.user?.id,
        brlAmount: order.brlAmount,
        cryptoType: order.cryptoType,
        collateralUnlocked: order.collateralLocked,
        timestamp: new Date().toISOString(),
      }),
    });

    return cancelledOrder;
  }

  async editOrder(
    orderId: string,
    adminId: string,
    updates: {
      brlAmount?: string;
      cryptoAmount?: string;
      status?: string;
      notes?: string;
    }
  ) {
    // 1. Buscar pedido atual com relações
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        transactions: {
          include: {
            payer: { select: { id: true, email: true, name: true } },
          },
        },
        wallet: true,
      },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // 2. Validar mudanças perigosas
    if (updates.status) {
      // Não permitir mudança direta para COMPLETED se colateral ainda está locked
      if (updates.status === 'COMPLETED' && order.collateralLocked) {
        throw new Error(
          'Não é possível marcar como COMPLETED com colateral locked. ' +
          'Desbloqueie o colateral primeiro ou cancele o pedido.'
        );
      }

      // Não permitir mudança de status se há disputa ativa
      const activeDispute = await prisma.dispute.findFirst({
        where: {
          orderId,
          status: { in: ['OPEN', 'UNDER_REVIEW'] },
        },
      });

      if (activeDispute) {
        throw new Error('Não é possível editar pedido com disputa ativa');
      }
    }

    // 3. Validar mudanças de valor
    if (updates.brlAmount && !gtBN(updates.brlAmount, '0')) {
      throw new Error('Valor do pedido deve ser positivo');
    }

    if (updates.cryptoAmount && !gtBN(updates.cryptoAmount, '0')) {
      throw new Error('Quantidade de crypto deve ser positiva');
    }

    // 4. Registrar estado anterior para auditoria
    const previousState = {
      brlAmount: order.brlAmount,
      cryptoAmount: order.cryptoAmount,
      status: order.status,
      platformFee: order.platformFee,
      totalFee: order.totalFee,
    };

    // 5. Aplicar mudanças
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    // 6. Notificar partes envolvidas
    const changesSummary = Object.entries(updates)
      .map(([key, value]) => {
        const oldValue = previousState[key as keyof typeof previousState];
        return `${key}: ${oldValue} → ${value}`;
      })
      .join(', ');

    // Notificar comprador (payer) se existir transação
    const buyer = order.transactions[0]?.payer;
    if (buyer) {
      await notificationService.createNotification({
        userId: buyer.id,
        type: 'ORDER_EDITED_BY_ADMIN',
        category: 'ORDER',
        title: 'Pedido modificado pela administração',
        message: `Seu pedido #${order.id.slice(0, 8)} foi editado por um administrador. Alterações: ${changesSummary}`,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'Ver Alterações',
        relatedId: order.id,
        relatedType: 'ORDER',
        priority: 'NORMAL',
      });
    }

    // Notificar vendedor (user)
    if (order.user) {
      await notificationService.createNotification({
        userId: order.user.id,
        type: 'ORDER_EDITED_BY_ADMIN',
        category: 'ORDER',
        title: 'Pedido modificado pela administração',
        message: `O pedido #${order.id.slice(0, 8)} foi editado por um administrador. Alterações: ${changesSummary}`,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'Ver Alterações',
        relatedId: order.id,
        relatedType: 'ORDER',
        priority: 'NORMAL',
      });
    }

    // 8. Log de auditoria
    await this.logAdminAction({
      adminId,
      action: 'EDIT_ORDER',
      resource: 'ORDER',
      resourceId: orderId,
      metadata: JSON.stringify({
        previousState,
        newState: updates,
        changesSummary,
        timestamp: new Date().toISOString(),
      }),
    });

    return updatedOrder;
  }

  /**
   * ============================================
   * DETALHES COMPLETOS DO USUÁRIO (GOD MODE)
   * ============================================
   */

  /**
   * Buscar detalhes completos de um usuário para o painel admin
   * Inclui: informações gerais, saldos, transações, audit log
   */
  async getUserDetails(userId: string) {
    // 1. Buscar informações gerais do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        // RBAC: Incluir role relation
        role: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // 2. Buscar carteiras do usuário para calcular saldos
    const wallets = await prisma.userWallet.findMany({
      where: { userId },
      select: {
        id: true,
        cryptoType: true,
        network: true,
        address: true,
        balance: true,
        lockedBalance: true,
        availableBalance: true,
      },
    });

    // 3. Agrupar saldos por criptomoeda
    const balancesByCrypto: Record<string, {
      total: string;
      available: string;
      locked: string;
      wallets: number;
      walletList: Array<{
        id: string;
        address: string;
        network: string;
        balance: string;
        availableBalance: string;
        lockedBalance: string;
      }>;
    }> = {};

    wallets.forEach(wallet => {
      if (!balancesByCrypto[wallet.cryptoType]) {
        balancesByCrypto[wallet.cryptoType] = {
          total: '0',
          available: '0',
          locked: '0',
          wallets: 0,
          walletList: [],
        };
      }

      balancesByCrypto[wallet.cryptoType].total = sumBN([
        balancesByCrypto[wallet.cryptoType].total,
        wallet.balance || '0',
      ]);

      balancesByCrypto[wallet.cryptoType].available = sumBN([
        balancesByCrypto[wallet.cryptoType].available,
        wallet.availableBalance || '0',
      ]);

      balancesByCrypto[wallet.cryptoType].locked = sumBN([
        balancesByCrypto[wallet.cryptoType].locked,
        wallet.lockedBalance || '0',
      ]);

      balancesByCrypto[wallet.cryptoType].wallets++;

      // Adicionar carteira individual à lista
      balancesByCrypto[wallet.cryptoType].walletList.push({
        id: wallet.id,
        address: wallet.address,
        network: wallet.network,
        balance: wallet.balance?.toString() || '0',
        availableBalance: wallet.availableBalance?.toString() || '0',
        lockedBalance: wallet.lockedBalance?.toString() || '0',
      });
    });

    // 4. Buscar estatísticas de transações
    const transactions = await prisma.transaction.findMany({
      where: {
        payerId: userId,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        order: {
          select: {
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
          },
        },
      },
    });

    const successfulTransactions = transactions.filter(t => t.status === 'APPROVED');
    const failedTransactions = transactions.filter(t => t.status === 'REJECTED' || t.status === 'DISPUTED');

    const totalVolumeBRL = toBN(sumBN(successfulTransactions.map(t => t.order?.brlAmount || '0'))).toNumber();

    const totalVolumeBTC = toBN(sumBN(successfulTransactions.map(t => t.order?.cryptoAmount || '0'))).toNumber();

    // 5. Buscar últimas transações (10 mais recentes)
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        payerId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
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

    // 6. Buscar audit log relacionado ao usuário
    const auditLog = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId },
          { resourceId: userId },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      select: {
        id: true,
        userId: true,
        email: true,
        action: true,
        resource: true,
        resourceId: true,
        description: true,
        metadata: true,
        success: true,
        createdAt: true,
      },
    });

    // 7. Buscar pedidos do usuário (FASE 2) - Como CRIADOR e como PAGADOR
    // Pedidos onde o usuário é o CRIADOR
    const ordersAsCreator = await prisma.order.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Aumentado para incluir mais histórico
      select: {
        id: true,
        type: true,
        status: true,
        cryptoType: true,
        cryptoNetwork: true,
        cryptoAmount: true,
        brlAmount: true,
        platformFee: true,
        totalFee: true,
        collateralConfirmed: true,
        collateralLocked: true,
        paidByPlatform: true,
        timeoutAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Pedidos onde o usuário é o PAGADOR (aceitou pedido de outro usuário)
    const ordersAsPayer = await prisma.order.findMany({
      where: {
        transactions: {
          some: { payerId: userId },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      select: {
        id: true,
        type: true,
        status: true,
        cryptoType: true,
        cryptoNetwork: true,
        cryptoAmount: true,
        brlAmount: true,
        platformFee: true,
        totalFee: true,
        collateralConfirmed: true,
        collateralLocked: true,
        paidByPlatform: true,
        timeoutAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Combinar pedidos, remover duplicados e ordenar por data
    const orderIds = new Set<string>();
    const allOrdersCombined: Array<typeof ordersAsCreator[0] & { userRole: 'CREATOR' | 'PAYER' }> = [];

    // Adicionar pedidos como criador
    for (const order of ordersAsCreator) {
      if (!orderIds.has(order.id)) {
        orderIds.add(order.id);
        allOrdersCombined.push({ ...order, userRole: 'CREATOR' });
      }
    }

    // Adicionar pedidos como pagador (se não já adicionado)
    for (const order of ordersAsPayer) {
      if (!orderIds.has(order.id)) {
        orderIds.add(order.id);
        allOrdersCombined.push({ ...order, userRole: 'PAYER' });
      }
    }

    // Ordenar por data de criação (mais recentes primeiro)
    const orders = allOrdersCombined.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 8. Buscar disputas envolvendo o usuário (FASE 2)
    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { createdBy: userId },
          {
            order: {
              userId: userId,
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        orderId: true,
        category: true,
        title: true,
        description: true,
        status: true,
        resolution: true,
        resolutionType: true,
        resolvedBy: true,
        resolvedAt: true,
        createdAt: true,
        createdBy: true,
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
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
            status: true,
            userId: true,
          },
        },
      },
    });

    // 9. Retornar dados consolidados
    // RBAC: Extrair role como string
    const userRole = user.role?.slug?.toUpperCase() || user.legacyRole;

    return {
      // Informações gerais
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: userRole, // RBAC: Role como string (MASTER, ADMIN, etc)
        reputationScore: user.reputationScore,
        totalTransactions: user.totalTransactions,
        successfulTransactions: user.successfulTransactions,
        dailyLimit: (() => {
          const effectiveNum = user.customDailyLimit != null
            ? user.customDailyLimit.toNumber()
            : null;
          return effectiveNum != null ? effectiveNum : 1000 + (user.reputationScore * 100);
        })(),
        formulaLimit: 1000 + (user.reputationScore * 100),
        customDailyLimit: user.customDailyLimit != null
          ? user.customDailyLimit.toNumber()
          : undefined,
        customLimitNote: user.customLimitNote ?? undefined,
        customLimitSetAt: user.customLimitSetAt ?? undefined,
        twoFactorEnabled: user.twoFactorEnabled,
        accountFrozen: user.accountFrozen,
        frozenReason: user.frozenReason,
        frozenAt: user.frozenAt,
        frozenUntil: user.frozenUntil,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        cpf: user.cpf || null,
        phone: user.phone || null,
      },

      // Saldos por criptomoeda
      balances: Object.entries(balancesByCrypto).map(([crypto, data]) => ({
        cryptocurrency: crypto,
        totalBalance: data.total,
        availableBalance: data.available,
        lockedBalance: data.locked,
        walletCount: data.wallets,
        wallets: data.walletList, // Lista de carteiras individuais com endereços
      })),

      // Estatísticas de transações
      stats: {
        totalTransactions: transactions.length,
        successfulTransactions: successfulTransactions.length,
        failedTransactions: failedTransactions.length,
        successRate: transactions.length > 0
          ? ((successfulTransactions.length / transactions.length) * 100).toFixed(1) + '%'
          : '0.0%',
        totalVolumeBRL: totalVolumeBRL.toFixed(2),
        totalVolumeBTC: totalVolumeBTC.toFixed(8),
      },

      // Transações recentes
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        type: t.order?.type || 'N/A',
        amount: t.order?.brlAmount || '0',
        cryptocurrency: t.order?.cryptoType || 'BTC',
        status: t.status,
        createdAt: t.createdAt,
      })),

      // Audit log
      auditLog: auditLog.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        timestamp: log.createdAt,
        adminUser: log.email ? {
          email: log.email,
          name: log.email.split('@')[0],
        } : null,
        metadata: log.metadata,
      })),

      // FASE 2: Pedidos do usuário (inclui pedidos como CRIADOR e PAGADOR)
      orders: orders.map(order => ({
        id: order.id,
        type: order.type,
        status: order.status,
        cryptoType: order.cryptoType,
        cryptoNetwork: order.cryptoNetwork,
        cryptoAmount: order.cryptoAmount,
        brlAmount: order.brlAmount,
        platformFee: order.platformFee,
        totalFee: order.totalFee,
        collateralConfirmed: order.collateralConfirmed,
        collateralLocked: order.collateralLocked,
        paidByPlatform: order.paidByPlatform,
        timeoutAt: order.timeoutAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        userRole: order.userRole, // NOVO: Indica se é CREATOR ou PAYER
      })),

      // FASE 2: Disputas envolvendo o usuário
      disputes: disputes.map(dispute => ({
        id: dispute.id,
        orderId: dispute.orderId,
        category: dispute.category,
        title: dispute.title,
        description: dispute.description,
        status: dispute.status,
        resolution: dispute.resolution,
        resolutionType: dispute.resolutionType,
        resolvedBy: dispute.resolvedBy,
        resolvedAt: dispute.resolvedAt,
        createdAt: dispute.createdAt,
        creator: dispute.creator,
        order: dispute.order,
        // Indicar se o usuário atual foi o criador da disputa ou se é o dono do pedido
        userRole: dispute.createdBy === userId ? 'CREATOR' : 'ORDER_OWNER',
      })),
    };
  }

  /**
   * ============================================
   * RELATÓRIO PARA AUTORIDADES (FASE 2)
   * ============================================
   * Gera relatório completo do usuário para envio a autoridades governamentais
   */
  async generateAuthorityReport(userId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    includeAllData?: boolean;
  }) {
    // Buscar dados completos do usuário
    const userDetails = await this.getUserDetails(userId);

    // Buscar informações adicionais para o relatório
    const allWallets = await prisma.userWallet.findMany({
      where: { userId },
      select: {
        id: true,
        cryptoType: true,
        network: true,
        address: true,
        balance: true,
        lockedBalance: true,
        availableBalance: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Buscar TODAS as transações (não apenas as recentes)
    const allTransactions = await prisma.transaction.findMany({
      where: {
        payerId: userId,
        ...(filters?.startDate || filters?.endDate ? {
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            type: true,
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    // Buscar TODOS os pedidos (incluindo filtros de data)
    const allOrders = await prisma.order.findMany({
      where: {
        userId,
        ...(filters?.startDate || filters?.endDate ? {
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Flags de atividade suspeita
    const suspiciousActivityFlags = [];

    // Flag 1: Muitas disputas
    if (userDetails.disputes.length > 5) {
      suspiciousActivityFlags.push({
        type: 'HIGH_DISPUTE_COUNT',
        severity: 'MEDIUM',
        description: `Usuário possui ${userDetails.disputes.length} disputas registradas`,
      });
    }

    // Flag 2: Conta bloqueada
    if (userDetails.user.accountFrozen) {
      suspiciousActivityFlags.push({
        type: 'ACCOUNT_FROZEN',
        severity: 'HIGH',
        description: `Conta bloqueada. Motivo: ${userDetails.user.frozenReason || 'N/A'}`,
        frozenAt: userDetails.user.frozenAt,
      });
    }

    // Flag 3: Reputação baixa
    if (userDetails.user.reputationScore < 50) {
      suspiciousActivityFlags.push({
        type: 'LOW_REPUTATION',
        severity: 'LOW',
        description: `Reputação baixa: ${userDetails.user.reputationScore}`,
      });
    }

    // Calcular totais
    const approvedTxs = allTransactions.filter(t => t.status === 'APPROVED');
    const totalVolumeAllTime = toBN(sumBN(approvedTxs.map(t => t.order?.brlAmount || '0'))).toNumber();
    const totalCryptoAllTime = toBN(sumBN(approvedTxs.map(t => t.order?.cryptoAmount || '0'))).toNumber();

    // Montar relatório completo
    return {
      // Metadata do relatório
      reportMetadata: {
        generatedAt: new Date(),
        generatedBy: 'SYSTEM',
        reportType: 'AUTHORITY_COMPLIANCE',
        userId: userId,
        period: filters?.startDate && filters?.endDate ? {
          start: filters.startDate,
          end: filters.endDate,
        } : 'ALL_TIME',
      },

      // Dados do usuário
      userData: {
        id: userDetails.user.id,
        email: userDetails.user.email,
        name: userDetails.user.name,
        cpf: userDetails.user.cpf,
        phone: userDetails.user.phone,
        role: userDetails.user.role,
        reputationScore: userDetails.user.reputationScore,
        dailyLimit: userDetails.user.dailyLimit,
        accountStatus: userDetails.user.accountFrozen ? 'FROZEN' : 'ACTIVE',
        frozenReason: userDetails.user.frozenReason,
        frozenAt: userDetails.user.frozenAt,
        frozenUntil: userDetails.user.frozenUntil,
        createdAt: userDetails.user.createdAt,
      },

      // Carteiras e saldos
      wallets: allWallets,
      balancesSummary: userDetails.balances,

      // Transações completas
      transactions: {
        total: allTransactions.length,
        approved: allTransactions.filter(t => t.status === 'APPROVED').length,
        rejected: allTransactions.filter(t => t.status === 'REJECTED').length,
        disputed: allTransactions.filter(t => t.status === 'DISPUTED').length,
        totalVolumeBRL: totalVolumeAllTime.toFixed(2),
        totalVolumeCrypto: totalCryptoAllTime.toFixed(8),
        list: allTransactions,
      },

      // Pedidos completos
      orders: {
        total: allOrders.length,
        completed: allOrders.filter(o => o.status === 'COMPLETED').length,
        cancelled: allOrders.filter(o => o.status === 'CANCELLED').length,
        disputed: allOrders.filter(o => o.status === 'DISPUTED').length,
        list: allOrders,
      },

      // Disputas
      disputes: {
        total: userDetails.disputes.length,
        asInitiator: userDetails.disputes.filter(d => d.userRole === 'INITIATOR').length,
        asRespondent: userDetails.disputes.filter(d => d.userRole === 'RESPONDENT').length,
        list: userDetails.disputes,
      },

      // Flags de atividade suspeita
      suspiciousActivity: {
        hasFlags: suspiciousActivityFlags.length > 0,
        flagCount: suspiciousActivityFlags.length,
        flags: suspiciousActivityFlags,
      },

      // Audit log completo
      auditLog: userDetails.auditLog,
    };
  }

  /**
   * ============================================
   * ADMIN: RESETAR SENHA DE USUARIO
   * ============================================
   */

  async adminResetUserPassword(
    adminId: string,
    targetUserId: string,
    options?: { disable2FA?: boolean }
  ): Promise<{ resetLink: string }> {
    // 1. Verificar que admin tem nivel ADMIN ou MASTER
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      include: {
        role: { select: { slug: true, level: true } },
      },
    });

    if (!admin) {
      throw new Error('Admin nao encontrado');
    }

    const adminRole = admin.role?.slug?.toUpperCase() || admin.legacyRole;
    const adminLevel = admin.role?.level || 0;

    if (adminLevel < 80) {
      throw new Error('Apenas ADMIN ou MASTER podem resetar senhas');
    }

    // 2. Buscar usuario alvo
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        role: { select: { slug: true, level: true } },
      },
    });

    if (!targetUser) {
      throw new Error('Usuario nao encontrado');
    }

    const targetRole = targetUser.role?.slug?.toUpperCase() || targetUser.legacyRole;
    const targetLevel = targetUser.role?.level || 0;

    // Nao pode resetar senha de alguem de nivel superior ou igual
    if (targetLevel >= adminLevel) {
      throw new Error('Voce nao tem permissao para resetar a senha deste usuario');
    }

    // 3. Gerar token de reset (mesma logica do requestPasswordReset)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    const updateData: any = {
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
    };

    // 4. Se disable2FA === true: desabilitar 2FA do usuario
    if (options?.disable2FA) {
      updateData.twoFactorEnabled = false;
      updateData.twoFactorSecret = null;
      updateData.twoFactorBackupCodes = null;
    }

    updateData.forcePasswordReset = true; // SER-15: força o usuário a trocar a senha no próximo login

    await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
    });

    // 5. Enviar email de reset ao usuario
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(targetUser.email)}`;

    try {
      await emailService.sendPasswordResetEmail(targetUser.email, rawToken);
    } catch (emailError) {
      console.error('[ADMIN] Error sending reset email:', emailError);
    }

    // 6. Registrar no audit log
    await this.logAdminAction({
      adminId,
      action: 'ADMIN_RESET_USER_PASSWORD',
      resource: 'USER',
      resourceId: targetUserId,
      metadata: JSON.stringify({
        targetEmail: targetUser.email,
        targetRole,
        adminRole,
        disable2FA: options?.disable2FA || false,
        timestamp: new Date().toISOString(),
      }),
    });

    // Audit log moderno
    await auditLogService.log({
      userId: adminId,
      email: admin.email,
      role: adminRole,
      action: 'ADMIN_RESET_PASSWORD',
      resource: AUDIT_RESOURCES.USER,
      resourceId: targetUserId,
      metadata: {
        targetEmail: targetUser.email,
        targetRole,
        disable2FA: options?.disable2FA || false,
      },
    });

    // Notificar usuario
    await notificationService.createNotification({
      userId: targetUserId,
      type: 'PASSWORD_RESET_BY_ADMIN',
      category: 'SECURITY',
      title: 'Senha resetada por administrador',
      message: `Um administrador solicitou a redefinicao da sua senha.${options?.disable2FA ? ' O 2FA da sua conta foi desativado.' : ''} Verifique seu email para o link de redefinicao.`,
      priority: 'HIGH',
    });

    return { resetLink };
  }

  /**
   * ============================================
   * AUDIT LOG
   * ============================================
   */

  async logAdminAction(data: {
    adminId: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: string;
    ip?: string;
  }) {
    const log = await prisma.adminAction.create({
      data,
    });

    return log;
  }

  async getAdminActions(filters?: {
    adminId?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const actions = await prisma.adminAction.findMany({
      where: {
        adminId: filters?.adminId,
        resource: filters?.resource,
        createdAt: {
          gte: filters?.startDate,
          lte: filters?.endDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      take: 100, // Limitar a 100 registros
    });

    return actions;
  }
}

export const adminService = new AdminService();
