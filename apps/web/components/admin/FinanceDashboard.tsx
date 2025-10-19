'use client';

import { useEffect, useState } from 'react';
import { formatBRL } from '@/utils/formatters';

interface FinanceStats {
  platformFees: {
    totalBRL: string;
    byMonth: Array<{ month: string; amount: string }>;
    byCrypto: Array<{ crypto: string; amount: string }>;
  };
  revenue: {
    totalBRL: string;
    avgPerTransaction: string;
    completedOrders: number;
  };
}

export default function FinanceDashboard() {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/admin/finance/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas financeiras:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-300">Carregando...</div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Taxa da Plataforma</p>
              <p className="text-3xl font-bold text-white mt-2">
                {formatBRL(stats.platformFees.totalBRL)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 border border-green-500/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Receita Total</p>
              <p className="text-3xl font-bold text-white mt-2">
                {formatBRL(stats.revenue.totalBRL)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">💵</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Média por Transação</p>
              <p className="text-3xl font-bold text-white mt-2">
                {formatBRL(stats.revenue.avgPerTransaction)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.revenue.completedOrders} ordens</p>
            </div>
            <div className="w-12 h-12 bg-purple-600/20 border border-purple-500/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown por Crypto */}
      {stats.platformFees.byCrypto.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Taxas por Criptomoeda</h3>
          <div className="space-y-3">
            {stats.platformFees.byCrypto.map((item) => (
              <div key={item.crypto} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">{item.crypto}</span>
                <span className="text-sm font-bold text-white">{formatBRL(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
