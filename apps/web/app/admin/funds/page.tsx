'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ToastContainer from '@/components/admin/ToastContainer';
import { Toast } from '@/components/admin/ToastNotification';

interface DashboardData {
  totalCustody: {
    [network: string]: {
      [crypto: string]: string;
    };
  };
  totalUsers: number;
  totalWallets: number;
  topUsers: Array<{
    userId: string;
    email: string;
    wallets: number;
    totalBalance: string;
  }>;
}

interface UserWallet {
  id: string;
  network: string;
  crypto: string;
  address: string;
  balance: string;
  lockedBalance: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  userId: string;
  details: any;
  createdAt: string;
}

export default function AdminFundsPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'freeze' | 'transfer' | 'adjust' | 'audit' | 'analytics'>('dashboard');

  // Freeze/Unfreeze states
  const [freezeUserId, setFreezeUserId] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeLoading, setFreezeLoading] = useState(false);

  // Transfer states
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Adjust states
  const [adjustWalletId, setAdjustWalletId] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Search states
  const [searchUserId, setSearchUserId] = useState('');
  const [searchedWallets, setSearchedWallets] = useState<UserWallet[]>([]);

  // Audit Log states
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    adminUserId: '',
    startDate: '',
    endDate: '',
    limit: '50',
  });

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: Toast['type'], message: string, duration?: number) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/v1/admin/funds/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar dashboard');
      }

      const result = await response.json();
      setDashboard(result.data);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      alert('Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  };

  const searchUserWallets = async () => {
    if (!searchUserId.trim()) {
      alert('Digite o ID do usuário');
      return;
    }

    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(`http://localhost:3001/api/v1/admin/funds/users/${searchUserId}/wallets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar carteiras');
      }

      const result = await response.json();
      setSearchedWallets(result.wallets);
    } catch (error) {
      console.error('Erro ao buscar carteiras:', error);
      alert('Erro ao buscar carteiras do usuário');
    }
  };

  const handleFreezeAccount = async () => {
    if (!freezeUserId.trim() || !freezeReason.trim()) {
      alert('Preencha todos os campos');
      return;
    }

    if (!confirm(`Tem certeza que deseja CONGELAR a conta do usuário ${freezeUserId}?\n\nMotivo: ${freezeReason}`)) {
      return;
    }

    setFreezeLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch('http://localhost:3001/api/v1/admin/funds/freeze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: freezeUserId,
          reason: freezeReason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao congelar conta');
      }

      addToast('success', 'Conta congelada com sucesso!');
      setFreezeUserId('');
      setFreezeReason('');
      loadDashboard();
    } catch (error) {
      console.error('Erro ao congelar conta:', error);
      addToast('error', `Erro ao congelar conta: ${(error as Error).message}`);
    } finally {
      setFreezeLoading(false);
    }
  };

  const handleUnfreezeAccount = async () => {
    if (!freezeUserId.trim()) {
      alert('Digite o ID do usuário');
      return;
    }

    if (!confirm(`Tem certeza que deseja DESCONGELAR a conta do usuário ${freezeUserId}?`)) {
      return;
    }

    setFreezeLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch('http://localhost:3001/api/v1/admin/funds/unfreeze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: freezeUserId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao descongelar conta');
      }

      addToast('success', 'Conta descongelada com sucesso!');
      setFreezeUserId('');
      loadDashboard();
    } catch (error) {
      console.error('Erro ao descongelar conta:', error);
      addToast('error', `Erro ao descongelar conta: ${(error as Error).message}`);
    } finally {
      setFreezeLoading(false);
    }
  };

  const handleInternalTransfer = async () => {
    if (!fromWalletId.trim() || !toWalletId.trim() || !transferAmount.trim() || !transferReason.trim()) {
      alert('Preencha todos os campos');
      return;
    }

    if (!confirm(`⚠️ OPERAÇÃO CRÍTICA\n\nTransferir ${transferAmount} da carteira ${fromWalletId} para ${toWalletId}?\n\nMotivo: ${transferReason}\n\nEsta ação é IRREVERSÍVEL!`)) {
      return;
    }

    setTransferLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch('http://localhost:3001/api/v1/admin/funds/internal-transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromWalletId,
          toWalletId,
          amount: transferAmount,
          reason: transferReason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao transferir fundos');
      }

      addToast('success', 'Transferência interna realizada com sucesso!');
      setFromWalletId('');
      setToWalletId('');
      setTransferAmount('');
      setTransferReason('');
      loadDashboard();
    } catch (error) {
      console.error('Erro ao transferir fundos:', error);
      addToast('error', `Erro na transferência: ${(error as Error).message}`);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustWalletId.trim() || !adjustment.trim() || !adjustReason.trim()) {
      alert('Preencha todos os campos');
      return;
    }

    const adjustValue = parseFloat(adjustment);
    if (isNaN(adjustValue)) {
      alert('Valor de ajuste inválido');
      return;
    }

    const action = adjustValue >= 0 ? 'ADICIONAR' : 'SUBTRAIR';
    const absValue = Math.abs(adjustValue);

    if (!confirm(`⚠️ OPERAÇÃO CRÍTICA\n\n${action} ${absValue} na carteira ${adjustWalletId}?\n\nMotivo: ${adjustReason}\n\nEsta ação é IRREVERSÍVEL!`)) {
      return;
    }

    setAdjustLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch('http://localhost:3001/api/v1/admin/funds/adjust-balance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletId: adjustWalletId,
          adjustment,
          reason: adjustReason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao ajustar saldo');
      }

      addToast('success', 'Saldo ajustado com sucesso!');
      setAdjustWalletId('');
      setAdjustment('');
      setAdjustReason('');
      loadDashboard();
    } catch (error) {
      console.error('Erro ao ajustar saldo:', error);
      addToast('error', `Erro ao ajustar saldo: ${(error as Error).message}`);
    } finally {
      setAdjustLoading(false);
    }
  };

  const loadAuditLog = async () => {
    setAuditLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const params = new URLSearchParams();
      if (auditFilters.action) params.append('action', auditFilters.action);
      if (auditFilters.adminUserId) params.append('adminUserId', auditFilters.adminUserId);
      if (auditFilters.startDate) params.append('startDate', auditFilters.startDate);
      if (auditFilters.endDate) params.append('endDate', auditFilters.endDate);
      if (auditFilters.limit) params.append('limit', auditFilters.limit);

      const response = await fetch(`http://localhost:3001/api/v1/admin/funds/audit-log?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao buscar audit log');
      }

      setAuditLogs(result.logs || []);
    } catch (error) {
      console.error('Erro ao buscar audit log:', error);
      alert(`Erro: ${(error as Error).message}`);
    } finally {
      setAuditLoading(false);
    }
  };

  const exportAuditLog = () => {
    if (auditLogs.length === 0) {
      alert('Nenhum registro para exportar');
      return;
    }

    const csvContent = [
      ['ID', 'Ação', 'User ID', 'Detalhes', 'Data'].join(','),
      ...auditLogs.map(log => [
        log.id,
        log.action,
        log.userId,
        JSON.stringify(log.details).replace(/,/g, ';'),
        new Date(log.createdAt).toLocaleString('pt-BR')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `audit-log-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">💰 Controle de Fundos</h1>
        <p className="text-gray-400">Gestão completa de fundos em custódia da plataforma</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('freeze')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'freeze'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            ❄️ Freeze/Unfreeze
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'transfer'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            💸 Transferência Interna
          </button>
          <button
            onClick={() => setActiveTab('adjust')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'adjust'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            🔧 Ajuste de Saldo
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            📝 Audit Log
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            📈 Analytics
          </button>
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-300">Total de Usuários</p>
                  <p className="text-3xl font-bold text-white mt-2">{dashboard.totalUsers}</p>
                </div>
                <div className="text-4xl">👥</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-300">Total de Carteiras</p>
                  <p className="text-3xl font-bold text-white mt-2">{dashboard.totalWallets}</p>
                </div>
                <div className="text-4xl">💼</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-300">Redes Suportadas</p>
                  <p className="text-3xl font-bold text-white mt-2">{Object.keys(dashboard.totalCustody).length}</p>
                </div>
                <div className="text-4xl">🌐</div>
              </div>
            </div>
          </div>

          {/* Custody by Network */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">💰 Fundos em Custódia por Rede</h3>
            <div className="space-y-4">
              {Object.entries(dashboard.totalCustody).map(([network, cryptos]) => (
                <div key={network} className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-blue-400 mb-3">{network}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(cryptos).map(([crypto, amount]) => (
                      <div key={crypto} className="bg-gray-800 rounded-lg p-3">
                        <p className="text-sm text-gray-400">{crypto}</p>
                        <p className="text-lg font-bold text-white">{amount}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">🏆 Top 10 Usuários por Saldo</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Carteiras</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Saldo Total (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.topUsers.map((user, index) => (
                    <tr key={user.userId} className="border-b border-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-white">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{user.wallets}</td>
                      <td className="px-4 py-3 text-sm font-mono text-green-400">${user.totalBalance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Freeze/Unfreeze Tab */}
      {activeTab === 'freeze' && (
        <div className="space-y-6">
          <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              ⚠️ <strong>Atenção:</strong> Congelar uma conta impede que o usuário faça qualquer operação (saques, transferências, etc.)
            </p>
          </div>

          {/* Search User Wallets */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">🔍 Buscar Carteiras do Usuário</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                placeholder="ID do usuário"
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={searchUserWallets}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Buscar
              </button>
            </div>

            {searchedWallets.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Rede</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Crypto</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Endereço</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Saldo</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Bloqueado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedWallets.map((wallet) => (
                      <tr key={wallet.id} className="border-b border-gray-700/50">
                        <td className="px-4 py-3 text-sm text-white">{wallet.network}</td>
                        <td className="px-4 py-3 text-sm text-white">{wallet.crypto}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-400">{wallet.address.slice(0, 20)}...</td>
                        <td className="px-4 py-3 text-sm text-green-400">{wallet.balance}</td>
                        <td className="px-4 py-3 text-sm text-yellow-400">{wallet.lockedBalance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Freeze/Unfreeze Form */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">❄️ Congelar/Descongelar Conta</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ID do Usuário
                </label>
                <input
                  type="text"
                  value={freezeUserId}
                  onChange={(e) => setFreezeUserId(e.target.value)}
                  placeholder="cmiwzdpca0000m61k925nh8ib"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Motivo (obrigatório para congelar)
                </label>
                <textarea
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="Ex: Atividade suspeita detectada, conta comprometida, etc."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleFreezeAccount}
                  disabled={freezeLoading}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
                >
                  {freezeLoading ? 'Processando...' : '❄️ Congelar Conta'}
                </button>
                <button
                  onClick={handleUnfreezeAccount}
                  disabled={freezeLoading}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
                >
                  {freezeLoading ? 'Processando...' : '✅ Descongelar Conta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Internal Transfer Tab */}
      {activeTab === 'transfer' && (
        <div className="space-y-6">
          <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4">
            <p className="text-red-300 text-sm">
              🚨 <strong>OPERAÇÃO CRÍTICA:</strong> Transferências internas movem fundos entre carteiras sem usar blockchain. Esta ação é IRREVERSÍVEL!
            </p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">💸 Transferência Interna</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Carteira de Origem (From Wallet ID)
                </label>
                <input
                  type="text"
                  value={fromWalletId}
                  onChange={(e) => setFromWalletId(e.target.value)}
                  placeholder="ID da carteira de origem"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Carteira de Destino (To Wallet ID)
                </label>
                <input
                  type="text"
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  placeholder="ID da carteira de destino"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Valor
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00000000"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Motivo (obrigatório)
                </label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Ex: Correção de saldo incorreto, reembolso aprovado, etc."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleInternalTransfer}
                disabled={transferLoading}
                className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                {transferLoading ? 'Processando...' : '🚨 Executar Transferência Interna'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Balance Tab */}
      {activeTab === 'adjust' && (
        <div className="space-y-6">
          <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4">
            <p className="text-red-300 text-sm">
              🚨 <strong>OPERAÇÃO CRÍTICA:</strong> Ajuste manual de saldo pode adicionar ou subtrair fundos de qualquer carteira. Esta ação é IRREVERSÍVEL!
            </p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">🔧 Ajuste Manual de Saldo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Wallet ID
                </label>
                <input
                  type="text"
                  value={adjustWalletId}
                  onChange={(e) => setAdjustWalletId(e.target.value)}
                  placeholder="ID da carteira"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ajuste (use valores negativos para subtrair)
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  placeholder="Ex: 100.50 para adicionar ou -50.25 para subtrair"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <p className="mt-2 text-sm text-gray-400">
                  💡 Dica: Use valor positivo para adicionar, negativo para subtrair
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Motivo (obrigatório)
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Correção de crédito duplicado, erro de sistema, etc."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleAdjustBalance}
                disabled={adjustLoading}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                {adjustLoading ? 'Processando...' : '🚨 Executar Ajuste de Saldo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              ℹ️ <strong>Audit Log:</strong> Registro completo de todas as operações administrativas realizadas no sistema.
            </p>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">🔍 Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Ação
                </label>
                <select
                  value={auditFilters.action}
                  onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Todas</option>
                  <option value="ACCOUNT_FROZEN">Congelar Conta</option>
                  <option value="ACCOUNT_UNFROZEN">Descongelar Conta</option>
                  <option value="INTERNAL_TRANSFER">Transferência Interna</option>
                  <option value="BALANCE_ADJUSTMENT">Ajuste de Saldo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Admin User ID
                </label>
                <input
                  type="text"
                  value={auditFilters.adminUserId}
                  onChange={(e) => setAuditFilters({ ...auditFilters, adminUserId: e.target.value })}
                  placeholder="ID do administrador"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Limite
                </label>
                <select
                  value={auditFilters.limit}
                  onChange={(e) => setAuditFilters({ ...auditFilters, limit: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="10">10 registros</option>
                  <option value="50">50 registros</option>
                  <option value="100">100 registros</option>
                  <option value="500">500 registros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data Início
                </label>
                <input
                  type="date"
                  value={auditFilters.startDate}
                  onChange={(e) => setAuditFilters({ ...auditFilters, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={auditFilters.endDate}
                  onChange={(e) => setAuditFilters({ ...auditFilters, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={loadAuditLog}
                disabled={auditLoading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                {auditLoading ? 'Carregando...' : '🔍 Buscar Logs'}
              </button>
              <button
                onClick={exportAuditLog}
                disabled={auditLogs.length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                📥 Exportar CSV
              </button>
            </div>
          </div>

          {/* Results */}
          {auditLogs.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
                  📋 Resultados ({auditLogs.length} registros)
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Data/Hora</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Ação</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Admin ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            log.action.includes('FROZEN') ? 'bg-blue-900/50 text-blue-300' :
                            log.action.includes('TRANSFER') ? 'bg-orange-900/50 text-orange-300' :
                            log.action.includes('ADJUSTMENT') ? 'bg-red-900/50 text-red-300' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-400">
                          {log.userId.slice(0, 12)}...
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          <details className="cursor-pointer">
                            <summary className="hover:text-white">Ver detalhes</summary>
                            <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!auditLoading && auditLogs.length === 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
              <p className="text-gray-400">
                Nenhum registro encontrado. Clique em "Buscar Logs" para carregar os dados.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && dashboard && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              📊 <strong>Analytics:</strong> Visualização gráfica dos fundos em custódia e atividades administrativas.
            </p>
          </div>

          {/* Network Distribution Pie Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6">💼 Distribuição de Carteiras por Rede</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={Object.entries(dashboard.totalCustody).map(([network, cryptos]) => ({
                    name: network,
                    value: Object.keys(cryptos).length,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.keys(dashboard.totalCustody).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }} />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Users Bar Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6">👥 Top 10 Usuários por Número de Carteiras</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dashboard.topUsers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="email"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#fff'
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Bar dataKey="wallets" fill="#3b82f6" name="Carteiras" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Custody by Network Bar Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6">💰 Tipos de Criptomoedas por Rede</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={Object.entries(dashboard.totalCustody).map(([network, cryptos]) => ({
                  network,
                  tipos: Object.keys(cryptos).length,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="network" tick={{ fill: '#9ca3af' }} />
                <YAxis tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#fff'
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Bar dataKey="tipos" fill="#10b981" name="Tipos de Crypto" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Audit Activity Mock Chart (since we don't have historical data) */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6">📊 Atividade Administrativa (Exemplo)</h3>
            <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4 mb-4">
              <p className="text-yellow-300 text-sm">
                ⚠️ <strong>Nota:</strong> Gráfico de exemplo. Para dados reais, implementar endpoint de histórico temporal no backend.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={[
                  { date: '01/12', freezes: 2, transfers: 1, adjustments: 0 },
                  { date: '02/12', freezes: 1, transfers: 3, adjustments: 1 },
                  { date: '03/12', freezes: 3, transfers: 2, adjustments: 0 },
                  { date: '04/12', freezes: 0, transfers: 4, adjustments: 2 },
                  { date: '05/12', freezes: 2, transfers: 1, adjustments: 1 },
                  { date: '06/12', freezes: 1, transfers: 5, adjustments: 0 },
                  { date: '07/12', freezes: 4, transfers: 2, adjustments: 1 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af' }} />
                <YAxis tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#fff'
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Line type="monotone" dataKey="freezes" stroke="#ef4444" name="Freezes" strokeWidth={2} />
                <Line type="monotone" dataKey="transfers" stroke="#3b82f6" name="Transferências" strokeWidth={2} />
                <Line type="monotone" dataKey="adjustments" stroke="#f59e0b" name="Ajustes" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
