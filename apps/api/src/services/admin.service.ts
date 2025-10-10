import { PrismaClient } from '@prisma/client';

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
    // Verificar se endereço já existe
    const existing = await prisma.platformWallet.findUnique({
      where: { address: data.address },
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
      pendingKYC,
      activeOrders,
      completedOrders,
      totalVolumeBRL,
      recentUsers,
      recentOrders,
    ] = await Promise.all([
      // Total de usuários
      prisma.user.count(),

      // Total de pedidos
      prisma.order.count(),

      // Total de transações
      prisma.transaction.count(),

      // KYC pendentes
      prisma.user.count({
        where: {
          kycLevel: 'NONE',
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

      // Volume total em BRL
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _sum: {
          brlAmount: true,
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

    const totalVolume = orders.reduce((sum, order) => {
      return sum + parseFloat(order.brlAmount);
    }, 0);

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
      kyc: {
        pending: pendingKYC,
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
    kycLevel?: string;
    role?: string;
    search?: string;
  }) {
    const users = await prisma.user.findMany({
      where: {
        kycLevel: filters?.kycLevel,
        role: filters?.role,
        OR: filters?.search
          ? [
              { email: { contains: filters.search } },
              { name: { contains: filters.search } },
              { cpf: { contains: filters.search } },
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
        cpf: true,
        kycLevel: true,
        role: true,
        reputationScore: true,
        totalTransactions: true,
        successfulTransactions: true,
        createdAt: true,
      },
    });

    return users;
  }

  async updateUser(
    userId: string,
    data: {
      kycLevel?: string;
      role?: string;
    },
    adminId: string
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    // Registrar ação admin
    await this.logAdminAction({
      adminId,
      action: 'UPDATE',
      resource: 'USER',
      resourceId: userId,
      metadata: JSON.stringify(data),
    });

    return user;
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
  }) {
    const orders = await prisma.order.findMany({
      where: {
        status: filters?.status,
        type: filters?.type,
        userId: filters?.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        transactions: true,
      },
    });

    return orders;
  }

  async cancelOrder(orderId: string, adminId: string, reason: string) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
      },
    });

    // Registrar ação admin
    await this.logAdminAction({
      adminId,
      action: 'CANCEL',
      resource: 'ORDER',
      resourceId: orderId,
      metadata: JSON.stringify({ reason }),
    });

    return order;
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
