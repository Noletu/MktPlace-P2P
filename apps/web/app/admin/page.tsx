'use client';

import { useEffect, useState } from 'react';
import { formatBRL, formatCrypto } from '@/utils/formatters';
import { fetchWithAuth } from '@/utils/api';
import FinanceDashboard from '@/components/admin/FinanceDashboard';
import StatCard from '@/components/admin/shared/StatCard';
import OrdersStatusChart from '@/components/admin/charts/OrdersStatusChart';
import VolumeChart from '@/components/admin/charts/VolumeChart';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

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
  disputes: {
    pending: number;
  };
  volume: {
    totalBRL: string;
  };
}

interface FundsData {
  totalCustody: string;
  networkSummary: Array<{
    network: string;
    balance: string;
    lockedBalance: string;
    availableBalance: string;
    walletsCount: number;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    name: string | null;
    accountFrozen: boolean;
    totalBalance: string;
    walletsCount: number;
  }>;
  totalUsers: number;
  totalWallets: number;
  solvency: Array<{
    cryptoType: string;
    network: string;
    hotWalletBalance: string;
    totalUserBalance: string;
    delta: string;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  }>;
}

interface Price {
  crypto: string;
  brlPrice: string;
  usdPrice?: string;
}

type DisplayCurrency = 'BRL' | 'USD' | 'BTC';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '0.5rem',
  color: '#fff',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [fundsData, setFundsData] = useState<FundsData | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('BRL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchFundsData(), fetchPrices()]).finally(() => setLoading(false));
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetchWithAuth('/admin/dashboard');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const fetchFundsData = async () => {
    try {
      const response = await fetchWithAuth('/admin/funds/dashboard');
      const data = await response.json();
      if (data.success) {
        setFundsData(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de custódia:', error);
    }
  };

  const fetchPrices = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/prices`);
      if (!response.ok) return;
      const data = await response.json();
      const brlMap: Record<string, number> = {};
      data.data.forEach((p: Price) => {
        brlMap[p.crypto] = parseFloat(p.brlPrice) || 0;
      });
      setPrices(brlMap);
    } catch (error) {
      console.error('Erro ao buscar cotações:', error);
    }
  };

  // --- Conversão de custódia ---
  const calculateTotalInBRL = () => {
    if (!fundsData) return 0;
    let total = 0;
    fundsData.networkSummary.forEach(n => {
      const crypto = n.network.split('/')[0]; // "BTC/BITCOIN" → "BTC"
      const balance = parseFloat(n.balance);
      total += balance * (prices[crypto] || 0);
    });
    return total;
  };

  const convertFromBRL = (brl: number) => {
    if (displayCurrency === 'BRL') return brl;
    if (displayCurrency === 'USD') {
      const rate = prices['USDT'] || prices['USDC'] || 0;
      return rate > 0 ? brl / rate : 0;
    }
    const btcPrice = prices['BTC'] || 0;
    return btcPrice > 0 ? brl / btcPrice : 0;
  };

  const formatDisplay = (value: number) => {
    if (displayCurrency === 'BRL') return formatBRL(value);
    if (displayCurrency === 'USD') return `$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${value.toFixed(8)} BTC`;
  };

  // --- Solvency ---
  const statusConfig = {
    HEALTHY: { label: 'Saudável', bg: 'bg-green-900/30', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' },
    WARNING: { label: 'Atenção', bg: 'bg-yellow-900/30', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
    CRITICAL: { label: 'Crítico', bg: 'bg-red-900/30', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' },
  };

  const overallStatus = fundsData
    ? fundsData.solvency.some(s => s.status === 'CRITICAL')
      ? 'CRITICAL'
      : fundsData.solvency.some(s => s.status === 'WARNING')
        ? 'WARNING'
        : 'HEALTHY'
    : 'HEALTHY';

  const sc = statusConfig[overallStatus];

  // --- Chart data ---
  const getCryptoFromNetwork = (network: string) => network.split('/')[0] || 'BTC';

  const topHoldersData = fundsData?.topUsers.map(u => ({
    email: u.email.length > 25 ? u.email.slice(0, 22) + '...' : u.email,
    fullEmail: u.email,
    saldo: parseFloat(u.totalBalance),
    frozen: u.accountFrozen,
    carteiras: u.walletsCount,
  })) || [];

  const networkBalancesData = fundsData?.networkSummary.map(n => ({
    network: n.network,
    disponivel: parseFloat(n.availableBalance),
    bloqueado: parseFloat(n.lockedBalance),
    carteiras: n.walletsCount,
  })) || [];

  const walletDistData = fundsData?.networkSummary.map(n => ({
    name: n.network,
    value: n.walletsCount,
  })) || [];

  const currencyButtons: { key: DisplayCurrency; label: string }[] = [
    { key: 'BRL', label: 'R$' },
    { key: 'USD', label: 'US$' },
    { key: 'BTC', label: 'BTC' },
  ];

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

  const totalCustodyBRL = calculateTotalInBRL();
  const totalCustodyDisplay = formatDisplay(convertFromBRL(totalCustodyBRL));

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

        {/* Pending Disputes */}
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600/20 border border-orange-500/30 rounded-full flex items-center justify-center">
              <span className="text-xl">⚖️</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Disputas Pendentes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.disputes?.pending || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <OrdersStatusChart />
        <VolumeChart />
      </div>

      {/* Custódia & Solvência */}
      {fundsData && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">🏦 Custódia & Solvência</h2>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total em Custódia + toggle */}
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-blue-300">Total em Custódia</p>
                <div className="flex bg-gray-800/50 rounded-md p-0.5">
                  {currencyButtons.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setDisplayCurrency(c.key)}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all ${
                        displayCurrency === c.key
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-2xl font-bold text-white mt-1">{totalCustodyDisplay}</p>
              <p className="text-xs text-blue-400 mt-1">Soma de todos os saldos de usuários</p>
            </div>

            {/* Usuários com Carteira */}
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-5">
              <p className="text-sm font-medium text-green-300">Usuários com Carteira</p>
              <p className="text-2xl font-bold text-white mt-1">{fundsData.totalUsers}</p>
              <p className="text-xs text-green-400 mt-1">Usuários com carteira ativa</p>
            </div>

            {/* Total Carteiras */}
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-5">
              <p className="text-sm font-medium text-purple-300">Total Carteiras</p>
              <p className="text-2xl font-bold text-white mt-1">{fundsData.totalWallets}</p>
              <p className="text-xs text-purple-400 mt-1">Carteiras ativas na plataforma</p>
            </div>

            {/* Status Solvência */}
            <div className={`${sc.bg} border ${sc.border} rounded-lg p-5`}>
              <p className={`text-sm font-medium ${sc.text}`}>Status Solvência</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-3 h-3 rounded-full ${sc.dot} animate-pulse`} />
                <p className="text-2xl font-bold text-white">{sc.label}</p>
              </div>
              <p className={`text-xs ${sc.text} mt-1`}>
                {fundsData.solvency.filter(s => s.status === 'HEALTHY').length}/{fundsData.solvency.length} redes saudáveis
              </p>
            </div>
          </div>

          {/* Solvência por Rede — Tabela */}
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Solvência por Rede</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Compara o saldo do hot wallet (fundos reais on-chain) com o total devido aos usuários.
              Se o hot wallet for menor, a plataforma não consegue cobrir todos os saques.
            </p>

            {fundsData.solvency.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Rede</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Hot Wallet</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Saldo Usuários</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Delta</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundsData.solvency.map(s => {
                      const cfg = statusConfig[s.status];
                      const crypto = getCryptoFromNetwork(`${s.cryptoType}/${s.network}`);
                      const delta = parseFloat(s.delta);
                      return (
                        <tr key={`${s.cryptoType}-${s.network}`} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{s.cryptoType}/{s.network}</td>
                          <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300 font-mono">{formatCrypto(s.hotWalletBalance, crypto)}</td>
                          <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300 font-mono">{formatCrypto(s.totalUserBalance, crypto)}</td>
                          <td className={`py-3 px-4 text-right font-mono font-semibold ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {delta >= 0 ? '+' : ''}{formatCrypto(s.delta, crypto)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} border ${cfg.border} ${cfg.text}`}>
                              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">Nenhum dado de solvência disponível</p>
            )}
          </div>

          {/* Top 10 Holders */}
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Top 10 Maiores Saldos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Usuários com maior saldo total (soma de todas as carteiras)</p>

            {topHoldersData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, topHoldersData.length * 40)}>
                <BarChart data={topHoldersData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="email"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    width={180}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: any, _name: any, props: any) => {
                      const lines = [`Saldo: ${Number(value).toFixed(8)}`];
                      if (props.payload.frozen) lines.push('CONTA CONGELADA');
                      lines.push(`Carteiras: ${props.payload.carteiras}`);
                      return [lines.join('\n'), props.payload.fullEmail];
                    }}
                  />
                  <Bar dataKey="saldo" name="Saldo Total">
                    {topHoldersData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.frozen ? '#ef4444' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-center py-8">Nenhum usuário encontrado</p>
            )}

            {topHoldersData.some(u => u.frozen) && (
              <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
                <span className="w-3 h-3 rounded bg-red-500" />
                <span>Vermelho = conta congelada</span>
              </div>
            )}
          </div>

          {/* Saldos por Rede + Distribuição Carteiras */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Saldos por Rede — Stacked Bar */}
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Saldos por Rede</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Disponível vs Bloqueado</p>

              {networkBalancesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={networkBalancesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="network" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: any, name: any, props: any) => {
                        const crypto = getCryptoFromNetwork(props.payload.network);
                        const label = name === 'disponivel' ? 'Disponível' : 'Bloqueado';
                        return [formatCrypto(Number(value), crypto), label];
                      }}
                      labelFormatter={(label: string) => {
                        const item = networkBalancesData.find(n => n.network === label);
                        return `${label} (${item?.carteiras || 0} carteiras)`;
                      }}
                    />
                    <Legend wrapperStyle={{ color: '#9ca3af' }} />
                    <Bar dataKey="disponivel" stackId="a" fill="#10b981" name="Disponível" />
                    <Bar dataKey="bloqueado" stackId="a" fill="#f59e0b" name="Bloqueado" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-8">Nenhum dado de rede disponível</p>
              )}
            </div>

            {/* Distribuição de Carteiras — Pie */}
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Distribuição de Carteiras</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Proporção por rede</p>

              {walletDistData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={walletDistData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {walletDistData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: any) => [`${value} carteiras`, 'Quantidade']}
                    />
                    <Legend wrapperStyle={{ color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-8">Nenhum dado disponível</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finance Dashboard */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">💰 Financeiro</h2>
        <FinanceDashboard />
      </div>

    </div>
  );
}
