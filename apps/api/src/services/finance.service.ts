import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FinanceStats {
  platformFees: {
    totalBRL: string;
    byMonth: Array<{ month: string; amount: string }>;
    byCrypto: Array<{ crypto: string; amount: string }>;
  };
  walletBalances: {
    totalUSD: string;
    wallets: Array<{
      crypto: string;
      network: string;
      address: string;
      balance: string;
      valueUSD: string;
    }>;
  };
  revenue: {
    totalBRL: string;
    avgPerTransaction: string;
    completedOrders: number;
  };
}

export class FinanceService {
  /**
   * Obter estatísticas financeiras completas da plataforma
   */
  async getFinanceStats(): Promise<FinanceStats> {
    // Buscar pedidos completados
    const completedOrders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
      },
      select: {
        platformFee: true,
        brlAmount: true,
        cryptoType: true,
        createdAt: true,
      },
    });

    // Calcular total de taxas
    const totalFees = completedOrders.reduce(
      (sum, order) => sum + parseFloat(order.platformFee || '0'),
      0
    );

    // Calcular por mês (últimos 12 meses)
    const byMonth = this.calculateByMonth(completedOrders);

    // Calcular por crypto
    const byCrypto = this.calculateByCrypto(completedOrders);

    // Buscar saldos das carteiras da plataforma
    const platformWallets = await prisma.platformWallet.findMany({
      where: { isActive: true },
    });

    // TODO: Integrar com API de preços para conversão USD real
    const walletBalances = platformWallets.map((wallet) => ({
      crypto: wallet.cryptoType,
      network: wallet.network,
      address: wallet.address,
      balance: '0', // TODO: Consultar balance real via blockchain
      valueUSD: '0', // TODO: Converter para USD
    }));

    // Calcular receita total
    const totalRevenue = totalFees;
    const avgPerTransaction =
      completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    return {
      platformFees: {
        totalBRL: totalFees.toFixed(2),
        byMonth,
        byCrypto,
      },
      walletBalances: {
        totalUSD: '0', // TODO: Somar todos os wallets em USD
        wallets: walletBalances,
      },
      revenue: {
        totalBRL: totalRevenue.toFixed(2),
        avgPerTransaction: avgPerTransaction.toFixed(2),
        completedOrders: completedOrders.length,
      },
    };
  }

  /**
   * Calcular taxas por mês (últimos 12 meses)
   */
  private calculateByMonth(
    orders: Array<{ platformFee: string | null; createdAt: Date }>
  ): Array<{ month: string; amount: string }> {
    const monthlyData: Record<string, number> = {};
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    orders.forEach((order) => {
      if (order.createdAt >= twelveMonthsAgo) {
        const monthKey = `${order.createdAt.getFullYear()}-${String(
          order.createdAt.getMonth() + 1
        ).padStart(2, '0')}`;
        monthlyData[monthKey] =
          (monthlyData[monthKey] || 0) + parseFloat(order.platformFee || '0');
      }
    });

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({
        month,
        amount: amount.toFixed(2),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calcular taxas por tipo de crypto
   */
  private calculateByCrypto(
    orders: Array<{ platformFee: string | null; cryptoType: string }>
  ): Array<{ crypto: string; amount: string }> {
    const cryptoData: Record<string, number> = {};

    orders.forEach((order) => {
      cryptoData[order.cryptoType] =
        (cryptoData[order.cryptoType] || 0) +
        parseFloat(order.platformFee || '0');
    });

    return Object.entries(cryptoData).map(([crypto, amount]) => ({
      crypto,
      amount: amount.toFixed(2),
    }));
  }

  /**
   * Obter saldos das carteiras da plataforma
   */
  async getWalletBalances() {
    const platformWallets = await prisma.platformWallet.findMany({
      where: { isActive: true },
      select: {
        id: true,
        cryptoType: true,
        network: true,
        address: true,
        label: true,
      },
    });

    return {
      success: true,
      data: platformWallets.map((wallet) => ({
        ...wallet,
        balance: '0', // TODO: Consultar balance via blockchain
        valueUSD: '0', // TODO: Converter para USD
      })),
    };
  }
}

export const financeService = new FinanceService();
