'use client';

import { useEffect, useState } from 'react';

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Carregando estatísticas...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Erro ao carregar estatísticas</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Administrativo</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Usuários</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.users.total}</p>
              <p className="text-xs text-green-600 mt-1">+{stats.users.recent} últimos 7 dias</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Pedidos</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.orders.total}</p>
              <p className="text-xs text-green-600 mt-1">+{stats.orders.recent} últimos 7 dias</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📦</span>
            </div>
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Ativos</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.orders.active}</p>
              <p className="text-xs text-gray-500 mt-1">Em andamento</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
        </div>

        {/* Volume BRL */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Volume Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">R$ {stats.volume.totalBRL}</p>
              <p className="text-xs text-gray-500 mt-1">Completados</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Completed Orders */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Completados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.orders.completed}</p>
            </div>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xl">💸</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Transações</p>
              <p className="text-2xl font-bold text-gray-900">{stats.transactions.total}</p>
            </div>
          </div>
        </div>

        {/* Pending KYC */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-xl">🔍</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">KYC Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.kyc.pending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/admin/platform-wallets"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <span className="text-3xl block mb-2">🏦</span>
            <span className="text-sm font-medium text-gray-700">Endereços da Plataforma</span>
          </a>
          <a
            href="/admin/users"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <span className="text-3xl block mb-2">👥</span>
            <span className="text-sm font-medium text-gray-700">Gerenciar Usuários</span>
          </a>
          <a
            href="/admin/orders"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <span className="text-3xl block mb-2">📦</span>
            <span className="text-sm font-medium text-gray-700">Gerenciar Pedidos</span>
          </a>
          <a
            href="/admin/audit"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <span className="text-3xl block mb-2">📋</span>
            <span className="text-sm font-medium text-gray-700">Ver Audit Log</span>
          </a>
        </div>
      </div>
    </div>
  );
}
