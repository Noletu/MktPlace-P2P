'use client';

import { useEffect, useState } from 'react';
import { formatBRL } from '@/utils/formatters';
import FinanceDashboard from '@/components/admin/FinanceDashboard';
import WalletBalancesWidget from '@/components/admin/WalletBalancesWidget';
import StatCard from '@/components/admin/shared/StatCard';
import OrdersStatusChart from '@/components/admin/charts/OrdersStatusChart';
import VolumeChart from '@/components/admin/charts/VolumeChart';

interface DashboardStats {
  users: {
    total: number;
    recent: number;
  };
  orders: {
    total: number;
    active: number;
    completed: number;
    recent: number;
  };
  transactions: {
    total: number;
  };
  kyc: {
    pending: number;
  };
  volume: {
    totalBRL: string;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando estatísticas...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">Erro ao carregar estatísticas</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Dashboard Administrativo</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total de Usuários"
          value={stats.users.total}
          icon="👥"
          change={{
            value: `+${stats.users.recent} últimos 7 dias`,
            isPositive: true,
          }}
          bgColor="bg-blue-600/10"
        />

        <StatCard
          title="Total de Pedidos"
          value={stats.orders.total}
          icon="📦"
          change={{
            value: `+${stats.orders.recent} últimos 7 dias`,
            isPositive: true,
          }}
          bgColor="bg-purple-600/10"
        />

        <StatCard
          title="Pedidos Ativos"
          value={stats.orders.active}
          icon="⏳"
          change={{
            value: 'Em andamento',
            isPositive: true,
          }}
          bgColor="bg-yellow-600/10"
        />

        <StatCard
          title="Volume Total"
          value={formatBRL(stats.volume.totalBRL)}
          icon="💰"
          change={{
            value: 'Completados',
            isPositive: true,
          }}
          bgColor="bg-green-600/10"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Completed Orders */}
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-600/20 border border-green-500/30 rounded-full flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pedidos Completados</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.orders.completed}</p>
            </div>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center">
              <span className="text-xl">💸</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Transações</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.transactions.total}</p>
            </div>
          </div>
        </div>

        {/* Pending KYC */}
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600/20 border border-orange-500/30 rounded-full flex items-center justify-center">
              <span className="text-xl">🔍</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">KYC Pendentes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.kyc.pending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <OrdersStatusChart />
        <VolumeChart />
      </div>

      {/* Finance Dashboard */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">💰 Financeiro</h2>
        <FinanceDashboard />
      </div>

      {/* Wallet Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <WalletBalancesWidget />

        {/* Disputes Summary */}
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">⚖️ Disputas</h3>
            <a href="/admin/disputes" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
              Ver todas →
            </a>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Acesse o painel de disputas para gerenciar casos pendentes</p>
        </div>
      </div>

    </div>
  );
}
