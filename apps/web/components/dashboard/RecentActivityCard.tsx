'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
    trend: number[];
  };
  comparison: {
    buysChange: number;
    sellsChange: number;
    brlVolumeChange: number;
  };
}

type Period = '7d' | '15d' | '30d' | '90d';

export default function RecentActivityCard() {
  const router = useRouter();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('7d');

  useEffect(() => {
    fetchActivityStats(selectedPeriod);
  }, [selectedPeriod]);

  const fetchActivityStats = async (period: Period) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(
        `http://localhost:3001/api/v1/stats/activity?period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas de atividade:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string): string => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatChange = (change: number): { text: string; color: string; icon: string } => {
    if (change > 0) {
      return {
        text: `+${change.toFixed(1)}%`,
        color: 'text-green-600 dark:text-green-400',
        icon: '↑',
      };
    } else if (change < 0) {
      return {
        text: `${change.toFixed(1)}%`,
        color: 'text-red-600 dark:text-red-400',
        icon: '↓',
      };
    } else {
      return {
        text: '0%',
        color: 'text-gray-600 dark:text-gray-400',
        icon: '→',
      };
    }
  };

  const getPeriodLabel = (period: Period): string => {
    const labels = {
      '7d': '7 dias',
      '15d': '15 dias',
      '30d': '30 dias',
      '90d': '90 dias',
    };
    return labels[period];
  };

  // Preparar dados do gráfico
  const chartData =
    stats?.stats.trend.map((value, index) => ({
      day: index + 1,
      orders: value,
    })) || [];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
      {/* Header with Period Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xl">📊</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Estatísticas de Atividade
          </h3>
        </div>
      </div>

      {/* Period Filter Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['7d', '15d', '30d', '90d'] as Period[]).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
              selectedPeriod === period
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {getPeriodLabel(period)}
          </button>
        ))}
      </div>

      {stats && stats.stats.totalBuys + stats.stats.totalSells > 0 ? (
        <>
          {/* Grid 2x2 - Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Compras */}
            <div
              onClick={() => router.push('/orders/my-orders')}
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                    🛒 Compras
                  </p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {stats.stats.totalBuys}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    pedidos concluídos
                  </p>
                </div>
                {stats.comparison.buysChange !== 0 && (
                  <div
                    className={`text-sm font-semibold ${
                      formatChange(stats.comparison.buysChange).color
                    }`}
                  >
                    {formatChange(stats.comparison.buysChange).icon}{' '}
                    {formatChange(stats.comparison.buysChange).text}
                  </div>
                )}
              </div>
            </div>

            {/* Vendas */}
            <div
              onClick={() => router.push('/orders/my-orders')}
              className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">
                    💰 Vendas
                  </p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                    {stats.stats.totalSells}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    pedidos concluídos
                  </p>
                </div>
                {stats.comparison.sellsChange !== 0 && (
                  <div
                    className={`text-sm font-semibold ${
                      formatChange(stats.comparison.sellsChange).color
                    }`}
                  >
                    {formatChange(stats.comparison.sellsChange).icon}{' '}
                    {formatChange(stats.comparison.sellsChange).text}
                  </div>
                )}
              </div>
            </div>

            {/* Volume BRL */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">
                    💵 Volume em BRL
                  </p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {formatCurrency(stats.stats.totalBrlVolume)}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    volume negociado
                  </p>
                </div>
                {stats.comparison.brlVolumeChange !== 0 && (
                  <div
                    className={`text-sm font-semibold ${
                      formatChange(stats.comparison.brlVolumeChange).color
                    }`}
                  >
                    {formatChange(stats.comparison.brlVolumeChange).icon}{' '}
                    {formatChange(stats.comparison.brlVolumeChange).text}
                  </div>
                )}
              </div>
            </div>

            {/* Volume Crypto */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-2">
                ₿ Volume em Cripto
              </p>
              {stats.stats.cryptoVolumes.length > 0 ? (
                <div className="space-y-1">
                  {stats.stats.cryptoVolumes.map((crypto) => (
                    <div key={crypto.type} className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-orange-900 dark:text-orange-100">
                        {parseFloat(crypto.amount).toFixed(crypto.type === 'BTC' ? 8 : 2)}
                      </span>
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-semibold">
                        {crypto.type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Sem movimentação
                </p>
              )}
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                criptomoedas movimentadas
              </p>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              📈 Tendência de Pedidos
            </h4>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="day"
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={{ fill: '#6366F1', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              Pedidos concluídos por dia
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">📭</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
            Nenhuma atividade no período
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Tente selecionar um período maior ou crie seu primeiro pedido!
          </p>
        </div>
      )}
    </div>
  );
}
