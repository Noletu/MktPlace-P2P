'use client';

import { useEffect, useState } from 'react';

interface Statistics {
  summary: {
    totalBuys: number;
    totalSells: number;
    totalOrders: number;
    totalVolumeBRL: string;
    totalVolumeCrypto: { [key: string]: number };
  };
  chartData: Array<{
    date: string;
    volumeBRL: number;
    count: number;
  }>;
  period: {
    days: number;
    from: string;
    to: string;
  };
}

export default function StatisticsCard() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 15 | 30 | 90>(30);

  useEffect(() => {
    fetchStatistics();
  }, [selectedPeriod]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet(`/orders/statistics?days=${selectedPeriod}`);
      setStats(data.data);
    } catch (err: any) {
      console.error('Erro ao buscar estatísticas:', err);
      // Não mostrar erro, apenas definir stats como vazio
      // A mensagem amigável será exibida
      setStats({
        summary: {
          totalBuys: 0,
          totalSells: 0,
          totalOrders: 0,
          totalVolumeBRL: '0',
          totalVolumeCrypto: {},
        },
        chartData: [],
        period: {
          days: selectedPeriod,
          from: new Date().toISOString(),
          to: new Date().toISOString(),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const formatBRL = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatCrypto = (amount: number, crypto: string) => {
    const decimals = crypto === 'BTC' ? 8 : 2;
    return `${amount.toFixed(decimals)} ${crypto}`;
  };

  // Renderizar gráfico SVG simples
  const renderChart = () => {
    if (!stats || stats.chartData.length === 0) return null;

    const width = 100;
    const height = 60;
    const padding = 5;

    const maxValue = Math.max(...stats.chartData.map(d => d.volumeBRL), 100);
    const points = stats.chartData.map((d, i) => {
      const x = padding + (i / (stats.chartData.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((d.volumeBRL / maxValue) * (height - 2 * padding));
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-24"
        preserveAspectRatio="none"
      >
        {/* Grade de fundo */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeWidth="0.5" opacity="0.2" />

        {/* Linha do gráfico */}
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-blue-600 dark:text-blue-400"
        />

        {/* Pontos */}
        {stats.chartData.map((d, i) => {
          const x = padding + (i / (stats.chartData.length - 1 || 1)) * (width - 2 * padding);
          const y = height - padding - ((d.volumeBRL / maxValue) * (height - 2 * padding));
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="1"
              className="fill-blue-600 dark:fill-blue-400"
            />
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Minhas Estatísticas</h3>
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">📊 Minhas Estatísticas</h3>
      </div>

      {/* Filtro de período */}
      <div className="flex gap-2 mb-4">
        {[7, 15, 30, 90].map((days) => (
          <button
            key={days}
            onClick={() => setSelectedPeriod(days as 7 | 15 | 30 | 90)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              selectedPeriod === days
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {days}d
          </button>
        ))}
      </div>

      {!stats || stats.summary.totalOrders === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Nenhuma transação concluída nos últimos {selectedPeriod} dias
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Complete seu primeiro pedido para ver suas estatísticas aqui
          </p>
        </div>
      ) : (
        <>
          {/* Gráfico */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Volume Transacionado (BRL)
            </p>
            {renderChart()}
          </div>

          {/* Cards de estatísticas */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <p className="text-xs text-green-700 dark:text-green-300 mb-1">Compras</p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                {stats.summary.totalBuys}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Vendas</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {stats.summary.totalSells}
              </p>
            </div>
          </div>

          {/* Volumes */}
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Volume em BRL:</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatBRL(stats.summary.totalVolumeBRL)}
              </span>
            </div>

            {Object.entries(stats.summary.totalVolumeCrypto).map(([crypto, amount]) => (
              <div key={crypto} className="flex justify-between items-center py-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Volume em {crypto}:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCrypto(amount, crypto)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
