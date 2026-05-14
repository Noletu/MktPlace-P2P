import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';

export class CouponService {
  /**
   * ADMIN: Criar cupom
   */
  async createCoupon(data: {
    code: string;
    discountPercentage: number;
    maxUsesPerUser: number;
    expiresAt?: string | null;
    isPublic?: boolean;
    isActive?: boolean;
    description?: string | null;
    createdBy: string;
  }) {
    // Verificar se código já existe
    const existing = await prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (existing) {
      throw new Error('Código de cupom já existe');
    }

    // Criar cupom
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        discountPercentage: data.discountPercentage,
        maxUsesPerUser: data.maxUsesPerUser,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        isPublic: data.isPublic ?? false,
        isActive: data.isActive ?? true,
        description: data.description,
        createdBy: data.createdBy,
      },
    });

    return coupon;
  }

  /**
   * ADMIN: Listar todos os cupons (com filtros)
   */
  async listCoupons(filters?: {
    isActive?: boolean;
    isPublic?: boolean;
    search?: string;
  }) {
    const where: Prisma.CouponWhereInput = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters?.search) {
      where.code = {
        contains: filters.search.toUpperCase(),
        mode: 'insensitive',
      };
    }

    const coupons = await prisma.coupon.findMany({
      where,
      include: {
        _count: {
          select: { userCoupons: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return coupons;
  }

  /**
   * ADMIN: Obter cupom por ID
   */
  async getCouponById(couponId: string) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        userCoupons: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!coupon) {
      throw new Error('Cupom não encontrado');
    }

    return coupon;
  }

  /**
   * ADMIN: Atualizar cupom
   */
  async updateCoupon(couponId: string, data: {
    discountPercentage?: number;
    maxUsesPerUser?: number;
    expiresAt?: string | null;
    isPublic?: boolean;
    isActive?: boolean;
    description?: string | null;
  }) {
    const updateData: any = {};

    if (data.discountPercentage !== undefined) {
      updateData.discountPercentage = data.discountPercentage;
    }
    if (data.maxUsesPerUser !== undefined) {
      updateData.maxUsesPerUser = data.maxUsesPerUser;
    }
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }
    if (data.isPublic !== undefined) {
      updateData.isPublic = data.isPublic;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    const coupon = await prisma.coupon.update({
      where: { id: couponId },
      data: updateData,
    });

    return coupon;
  }

  /**
   * ADMIN: Deletar cupom
   */
  async deleteCoupon(couponId: string) {
    await prisma.coupon.delete({
      where: { id: couponId },
    });
  }

  /**
   * ADMIN: Estatísticas de cupons
   */
  async getCouponStats() {
    const [totalCoupons, activeCoupons, totalUsesResult] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.count({ where: { isActive: true } }),
      prisma.coupon.aggregate({ _sum: { totalUses: true } }),
    ]);

    return {
      totalCoupons,
      activeCoupons,
      totalUses: totalUsesResult._sum.totalUses || 0,
      totalDiscountGiven: 0, // TODO: Calcular do histórico de pedidos se necessário
    };
  }

  /**
   * USER: Listar cupons públicos disponíveis
   */
  async getPublicCoupons(userId: string) {
    const now = new Date();

    const coupons = await prisma.coupon.findMany({
      where: {
        isPublic: true,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        code: true,
        discountPercentage: true,
        maxUsesPerUser: true,
        expiresAt: true,
        description: true,
        totalUses: true,
      },
      orderBy: { discountPercentage: 'desc' },
    });

    // Para cada cupom, verificar se usuário já usou
    const couponsWithUserData = await Promise.all(
      coupons.map(async (coupon) => {
        const userCoupon = await prisma.userCoupon.findUnique({
          where: {
            userId_couponId: {
              userId,
              couponId: coupon.id,
            },
          },
        });

        return {
          ...coupon,
          userTimesUsed: userCoupon?.timesUsed || 0,
          userIsActive: userCoupon?.isActive || false,
          // 0 = ilimitado, sempre pode ativar (se não tiver outro ativo)
          canActivate: !userCoupon?.isActive && (coupon.maxUsesPerUser === 0 || (userCoupon?.timesUsed || 0) < coupon.maxUsesPerUser),
        };
      })
    );

    return couponsWithUserData;
  }

  /**
   * USER: Ativar cupom
   */
  async activateCoupon(userId: string, code: string) {
    const now = new Date();

    // Verificar se usuário já tem um cupom ativo
    const activeCoupon = await prisma.userCoupon.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: { coupon: true },
    });

    if (activeCoupon) {
      throw new Error(`Você já tem um cupom ativo: ${activeCoupon.coupon.code}. Desative-o primeiro.`);
    }

    // Buscar cupom
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      throw new Error('Cupom não encontrado');
    }

    if (!coupon.isActive) {
      throw new Error('Este cupom não está mais ativo');
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new Error('Este cupom expirou');
    }

    // Verificar se usuário já usou o máximo de vezes
    const userCoupon = await prisma.userCoupon.findUnique({
      where: {
        userId_couponId: {
          userId,
          couponId: coupon.id,
        },
      },
    });

    // 0 = ilimitado, não verificar limite
    if (coupon.maxUsesPerUser > 0 && userCoupon && userCoupon.timesUsed >= coupon.maxUsesPerUser) {
      throw new Error(`Você já atingiu o limite de uso deste cupom (${coupon.maxUsesPerUser}x)`);
    }

    // Criar ou atualizar UserCoupon
    const activated = await prisma.userCoupon.upsert({
      where: {
        userId_couponId: {
          userId,
          couponId: coupon.id,
        },
      },
      create: {
        userId,
        couponId: coupon.id,
        isActive: true,
        activatedAt: now,
      },
      update: {
        isActive: true,
        activatedAt: now,
        deactivatedAt: null,
      },
      include: { coupon: true },
    });

    return activated;
  }

  /**
   * USER: Desativar cupom ativo
   */
  async deactivateCoupon(userId: string) {
    const activeCoupon = await prisma.userCoupon.findFirst({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!activeCoupon) {
      throw new Error('Você não tem nenhum cupom ativo');
    }

    await prisma.userCoupon.update({
      where: { id: activeCoupon.id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * USER: Obter cupom ativo do usuário
   */
  async getActiveCoupon(userId: string) {
    const userCoupon = await prisma.userCoupon.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        coupon: true,
      },
    });

    if (!userCoupon) {
      return null;
    }

    const now = new Date();

    // Verificar se cupom ainda é válido
    if (!userCoupon.coupon.isActive || (userCoupon.coupon.expiresAt && userCoupon.coupon.expiresAt < now)) {
      // Desativar automaticamente
      await prisma.userCoupon.update({
        where: { id: userCoupon.id },
        data: { isActive: false, deactivatedAt: now },
      });
      return null;
    }

    // Verificar se ainda tem usos disponíveis (0 = ilimitado)
    const usesRemaining = userCoupon.coupon.maxUsesPerUser === 0
      ? Infinity
      : userCoupon.coupon.maxUsesPerUser - userCoupon.timesUsed;

    if (usesRemaining <= 0) {
      // Desativar automaticamente se não tem mais usos
      await prisma.userCoupon.update({
        where: { id: userCoupon.id },
        data: { isActive: false, deactivatedAt: now },
      });
      return null;
    }

    return {
      ...userCoupon,
      usesRemaining,
    };
  }

  /**
   * INTERNAL: Aplicar cupom ao criar pedido (chamado por OrderService)
   */
  async applyCouponToOrder(userId: string, orderId: string) {
    const activeCoupon = await this.getActiveCoupon(userId);

    if (!activeCoupon) {
      return null;
    }

    // Incrementar contador de uso
    await prisma.userCoupon.update({
      where: { id: activeCoupon.id },
      data: {
        timesUsed: { increment: 1 },
        firstUsedAt: activeCoupon.firstUsedAt || new Date(),
        lastUsedAt: new Date(),
      },
    });

    // Incrementar contador global do cupom
    await prisma.coupon.update({
      where: { id: activeCoupon.couponId },
      data: {
        totalUses: { increment: 1 },
      },
    });

    return {
      couponId: activeCoupon.coupon.id,
      code: activeCoupon.coupon.code,
      discountPercentage: activeCoupon.coupon.discountPercentage,
    };
  }
}

export const couponService = new CouponService();
