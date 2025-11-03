import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CryptoVolume {
  type: string;
  amount: string;
}

interface ActivityStats {
  period: string;
  stats: {
    totalBuys: number;
    totalSells: number;
    totalBrlVolume: string;
    cryptoVolumes: CryptoVolume[];
    trend: number[]; // Pedidos por dia
  };
  comparison: {
    buysChange: number; // Variação % vs período anterior
    sellsChange: number;
    brlVolumeChange: number;
  };
}

export class StatsService {
  /**
   * Obter estatísticas de atividade do usuário
   */
  async getActivityStats(userId: string, period: '7d' | '15d' | '30d' | '90d'): Promise<ActivityStats> {
    // Calcular datas baseado no período
    const days = parseInt(period.replace('d', ''));
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    // Período anterior para comparação
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);
    const previousEndDate = new Date(startDate);
    previousEndDate.setHours(23, 59, 59, 999);

    // Buscar pedidos COMPLETED do período atual
    const currentOrders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        userId: true,
        brlAmount: true,
        cryptoAmount: true,
        cryptoType: true,
        completedAt: true,
      },
      orderBy: {
        completedAt: 'asc',
      },
    });

    // Buscar pedidos do período anterior para comparação
    const previousOrders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
      select: {
        id: true,
        userId: true,
        brlAmount: true,
      },
    });

    // Separar vendas (usuário criou o pedido) vs compras (usuário aceitou o pedido)
    const sells = currentOrders.filter((order) => order.userId === userId);
    const buys = currentOrders.filter((order) => order.userId !== userId);

    const previousSells = previousOrders.filter((order) => order.userId === userId);
    const previousBuys = previousOrders.filter((order) => order.userId !== userId);

    // Calcular volume BRL total
    const totalBrlVolume = currentOrders.reduce((sum, order) => {
      return sum + parseFloat(order.brlAmount);
    }, 0);

    const previousBrlVolume = previousOrders.reduce((sum, order) => {
      return sum + parseFloat(order.brlAmount);
    }, 0);

    // Agregar volumes de crypto por tipo
    const cryptoVolumeMap = new Map<string, number>();
    currentOrders.forEach((order) => {
      const current = cryptoVolumeMap.get(order.cryptoType) || 0;
      cryptoVolumeMap.set(order.cryptoType, current + parseFloat(order.cryptoAmount));
    });

    const cryptoVolumes: CryptoVolume[] = Array.from(cryptoVolumeMap.entries()).map(
      ([type, amount]) => ({
        type,
        amount: amount.toFixed(8),
      })
    );

    // Gerar tendência diária (número de pedidos por dia)
    const trend: number[] = [];
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const ordersInDay = currentOrders.filter((order) => {
        if (!order.completedAt) return false;
        const completedDate = new Date(order.completedAt);
        return completedDate >= dayStart && completedDate <= dayEnd;
      }).length;

      trend.push(ordersInDay);
    }

    // Calcular variações percentuais
    const buysChange = this.calculatePercentageChange(previousBuys.length, buys.length);
    const sellsChange = this.calculatePercentageChange(previousSells.length, sells.length);
    const brlVolumeChange = this.calculatePercentageChange(previousBrlVolume, totalBrlVolume);

    return {
      period,
      stats: {
        totalBuys: buys.length,
        totalSells: sells.length,
        totalBrlVolume: totalBrlVolume.toFixed(2),
        cryptoVolumes,
        trend,
      },
      comparison: {
        buysChange,
        sellsChange,
        brlVolumeChange,
      },
    };
  }

  /**
   * Calcular variação percentual
   */
  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0;
    }
    return ((newValue - oldValue) / oldValue) * 100;
  }
}

export const statsService = new StatsService();
