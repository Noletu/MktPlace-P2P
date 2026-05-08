'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

type DisplayCurrency = 'BRL' | 'BTC';

export default function StatisticsCard() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 15 | 30 | 90>(30);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('BRL');
  const [btcPrice, setBtcPrice] = useState<number>(0);

  useEffect(() => {
    fetchStatistics();
    fetchBtcPrice();
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

  const fetchBtcPrice = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/prices`);
      if (!response.ok) return;
      const data = await response.json();
      const btc = data.data?.find((p: { crypto: string; brlPrice: string }) => p.crypto === 'BTC');
      if (btc) setBtcPrice(parseFloat(btc.brlPrice) || 0);
    } catch {
      // silently fail — BRL mode still works
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

  const chartData = stats?.chartData.map(d => {
    const brlValue = d.volumeBRL;
    return {
      date: format(new Date(d.date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
      fullDate: format(new Date(d.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
      value: displayCurrency === 'BRL' ? brlValue : (btcPrice > 0 ? brlValue / btcPrice : 0),
    };
  }) || [];

  const formatYAxis = (value: number) => {
    if (displayCurrency === 'BTC') {
      if (value === 0) return '0 ₿';
      return `${value.toFixed(value < 0.001 ? 6 : 4)} ₿`;
    }
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  const formatTooltipValue = (value: number) => {
    if (displayCurrency === 'BTC') {
      return `${value.toFixed(8)} BTC`;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Volume Transacionado ({displayCurrency === 'BRL' ? 'BRL' : 'BTC'})
              </p>
              <div className="flex bg-gray-200 dark:bg-gray-600 rounded-lg p-0.5">
                {(['BRL', 'BTC'] as DisplayCurrency[]).map((cur) => (
                  <button
                    key={cur}
                    onClick={() => setDisplayCurrency(cur)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      displayCurrency === cur
                        ? 'bg-white dark:bg-gray-500 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {cur === 'BRL' ? 'R$' : 'BTC'}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorStats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--axis-stroke)"
                    style={{ fontSize: '11px' }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--axis-stroke)"
                    style={{ fontSize: '11px' }}
                    tickFormatter={formatYAxis}
                    tickLine={false}
                    width={displayCurrency === 'BTC' ? 80 : 65}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg)',
                      border: '1px solid var(--tooltip-border)',
                      borderRadius: '8px',
                      color: 'var(--tooltip-text)',
                      fontSize: '12px',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                    formatter={(value: number) => [formatTooltipValue(value), 'Volume']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorStats)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                Sem dados no período
              </div>
            )}
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
