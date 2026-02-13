'use client';

import { useState, useEffect } from 'react';

interface UserDetailsModalProps {
  userId: string;
  onClose: () => void;
}

interface UserDetails {
  user: {
    id: string;
    email: string;
    name?: string;
    cpf?: string;
    phone?: string;
    role: string;
    reputationScore: number;
    totalTransactions: number;
    successfulTransactions: number;
    accountFrozen: boolean;
    frozenReason?: string;
    frozenAt?: string;
    frozenUntil?: string;
    createdAt: string;
    lastLoginAt?: string;
  };
  balances: Array<{
    cryptocurrency: string;
    totalBalance: string;
    availableBalance: string;
    lockedBalance: string;
    walletCount: number;
    wallets: Array<{
      id: string;
      address: string;
      network: string;
      balance: string;
      availableBalance: string;
      lockedBalance: string;
    }>;
  }>;
  stats: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    successRate: string;
    totalVolumeBRL: string;
    totalVolumeBTC: string;
  };
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: string;
    cryptocurrency: string;
    status: string;
    createdAt: string;
    fromAddress?: string;
    toAddress?: string;
  }>;
  auditLog: Array<{
    id: string;
    action: string;
    resource: string;
    timestamp: string;
    adminUser?: {
      email: string;
      name?: string;
    };
    metadata?: string;
  }>;
  orders: Array<{
    id: string;
    type: string;
    status: string;
    cryptoType: string;
    cryptoAmount: string;
    brlAmount: string;
    platformFee: string;
    createdAt: string;
    userRole: 'CREATOR' | 'PAYER';
  }>;
  disputes: Array<{
    id: string;
    orderId: string;
    category: string;
    title: string;
    description: string;
    status: string;
    resolution?: string;
    resolutionType?: string;
    createdAt: string;
    userRole: string;
    creator: {
      id: string;
      name?: string;
      email: string;
    };
  }>;
}

type TabType = 'general' | 'transactions' | 'orders' | 'disputes' | 'report' | 'audit';

export default function UserDetailsModal({ userId, onClose }: UserDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v1/admin/users/${userId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao carregar detalhes do usuário');
      }

      setDetails(data.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar detalhes do usuário');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-green-600',
      PENDING: 'bg-yellow-600',
      FAILED: 'bg-red-600',
      CANCELLED: 'bg-gray-600',
      MATCHED: 'bg-blue-600',
      DISPUTED: 'bg-red-600',
      PAYMENT_SENT: 'bg-purple-600',
      VALIDATING: 'bg-orange-600',
      APPROVED: 'bg-green-600',
      REJECTED: 'bg-red-600',
      OPEN: 'bg-yellow-600',
      UNDER_REVIEW: 'bg-orange-600',
      RESOLVED: 'bg-green-600',
    };
    return colors[status] || 'bg-gray-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            👤 Detalhes do Usuário
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="ml-4 text-gray-600 dark:text-gray-400">Carregando detalhes...</p>
          </div>
        ) : error ? (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-400">{error}</p>
          </div>
        ) : details ? (
          <>
            {/* User Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 mb-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-2xl font-bold mb-2">{details.user.name || 'Sem nome'}</h4>
                  <p className="text-blue-100 mb-1">📧 {details.user.email}</p>
                  {details.user.cpf && (
                    <p className="text-blue-100 mb-1">🆔 CPF: {details.user.cpf}</p>
                  )}
                  {details.user.phone && (
                    <p className="text-blue-100">📱 {details.user.phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold block mb-2">
                    {details.user.role}
                  </span>
                  <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold block">
                    Rep: {details.user.reputationScore}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-300 dark:border-gray-700 mb-6">
              <div className="flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`px-6 py-3 font-medium transition whitespace-nowrap ${
                    activeTab === 'general'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  📋 Info Gerais
                </button>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`px-6 py-3 font-medium transition whitespace-nowrap ${
                    activeTab === 'transactions'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  💰 Transações
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-6 py-3 font-medium transition whitespace-nowrap ${
                    activeTab === 'orders'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  📦 Pedidos
                </button>
                <button
                  onClick={() => setActiveTab('disputes')}
                  className={`px-6 py-3 font-medium transition whitespace-nowrap ${
                    activeTab === 'disputes'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  ⚖️ Disputas
                </button>
                <button
                  onClick={() => setActiveTab('report')}
                  className={`px-6 py-3 font-medium transition whitespace-nowrap ${
                    activeTab === 'report'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  🏛️ Relatório
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-6 py-3 font-medium transition whitespace-nowrap ${
                    activeTab === 'audit'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  📝 Audit Log
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              {/* TAB 1: Informações Gerais */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  {/* Dados Pessoais */}
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                    <h5 className="font-bold text-gray-900 dark:text-white mb-4">👤 Dados Pessoais</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Nome Completo</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{details.user.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{details.user.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">CPF</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{details.user.cpf || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Telefone</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{details.user.phone || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Status da Conta */}
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                    <h5 className="font-bold text-gray-900 dark:text-white mb-4">🔒 Status da Conta</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Reputação</p>
                        <p className="text-2xl font-bold text-green-400">{details.user.reputationScore}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Status do Bloqueio</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">
                          {details.user.accountFrozen ? (
                            <span className="text-red-400 font-bold">🔒 BLOQUEADA</span>
                          ) : (
                            <span className="text-green-400 font-bold">✅ ATIVA</span>
                          )}
                        </p>
                      </div>
                      {details.user.accountFrozen && (
                        <>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Motivo do Bloqueio</p>
                            <p className="text-sm text-red-400">{details.user.frozenReason || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Bloqueado em</p>
                            <p className="text-sm text-gray-900 dark:text-white">{formatDate(details.user.frozenAt)}</p>
                          </div>
                          {details.user.frozenUntil && (
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Desbloqueio Automático</p>
                              <p className="text-sm text-yellow-400">{formatDate(details.user.frozenUntil)}</p>
                            </div>
                          )}
                        </>
                      )}
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Membro desde</p>
                        <p className="text-sm text-gray-900 dark:text-white">{formatDate(details.user.createdAt)}</p>
                      </div>
                      {details.user.lastLoginAt && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Último Login</p>
                          <p className="text-sm text-gray-900 dark:text-white">{formatDate(details.user.lastLoginAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Histórico de Transações */}
              {activeTab === 'transactions' && (
                <div className="space-y-6">
                  {/* Saldos por Criptomoeda */}
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                    <h5 className="font-bold text-gray-900 dark:text-white mb-4">💰 Saldos por Criptomoeda</h5>
                    <div className="space-y-3">
                      {details.balances.length > 0 ? (
                        details.balances.map((balance) => (
                          <div key={balance.cryptocurrency} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h6 className="text-lg font-bold text-gray-900 dark:text-white">
                                {balance.cryptocurrency}
                              </h6>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {balance.walletCount} carteira(s)
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mb-3">
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Saldo Total</p>
                                <p className="text-lg font-bold text-blue-400">{balance.totalBalance}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Disponivel</p>
                                <p className="text-lg font-bold text-green-400">{balance.availableBalance}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Bloqueado</p>
                                <p className="text-lg font-bold text-yellow-400">{balance.lockedBalance}</p>
                              </div>
                            </div>

                            {/* Lista de carteiras individuais com enderecos */}
                            {balance.wallets && balance.wallets.length > 0 && (
                              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">Carteiras:</p>
                                <div className="space-y-2">
                                  {balance.wallets.map((wallet) => (
                                    <div key={wallet.id} className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs px-2 py-1 bg-purple-600 text-white rounded font-bold">
                                            {wallet.network}
                                          </span>
                                          <code className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-gray-100 break-all max-w-[300px]">
                                            {wallet.address}
                                          </code>
                                          <button
                                            onClick={() => copyToClipboard(wallet.address)}
                                            className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                                            title="Copiar endereco"
                                          >
                                            {copiedAddress === wallet.address ? 'Copiado!' : 'Copiar'}
                                          </button>
                                        </div>
                                        <div className="text-right text-sm">
                                          <span className="text-green-500 font-bold">{wallet.availableBalance}</span>
                                          {parseFloat(wallet.lockedBalance) > 0 && (
                                            <span className="text-yellow-500 ml-2 font-bold">
                                              Bloq: {wallet.lockedBalance}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                          Nenhum saldo encontrado
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Estatísticas */}
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                    <h5 className="font-bold text-gray-900 dark:text-white mb-4">📊 Estatísticas de Transações</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total de Transações</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{details.stats.totalTransactions}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Taxa de Sucesso</p>
                        <p className="text-2xl font-bold text-green-400">{details.stats.successRate}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Volume Total (BRL)</p>
                        <p className="text-2xl font-bold text-blue-400">R$ {details.stats.totalVolumeBRL}</p>
                      </div>
                    </div>
                  </div>

                  {/* Transações Recentes */}
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                    <h5 className="font-bold text-gray-900 dark:text-white mb-4">📜 Últimas 10 Transações</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Data</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Tipo</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Valor</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Cripto</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.recentTransactions.length > 0 ? (
                            details.recentTransactions.map((tx) => (
                              <tr key={tx.id} className="border-b border-gray-200 dark:border-gray-800">
                                <td className="py-2 px-3 text-gray-900 dark:text-white">
                                  {formatDate(tx.createdAt)}
                                </td>
                                <td className="py-2 px-3 text-gray-900 dark:text-white">{tx.type}</td>
                                <td className="py-2 px-3 text-gray-900 dark:text-white font-mono">{tx.amount}</td>
                                <td className="py-2 px-3 text-gray-900 dark:text-white">{tx.cryptocurrency}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-1 ${getStatusColor(tx.status)} text-white rounded-full text-xs font-bold`}>
                                    {tx.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center py-4 text-gray-600 dark:text-gray-400">
                                Nenhuma transação encontrada
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Pedidos (FASE 2) */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                      <h5 className="font-bold text-gray-900 dark:text-white">
                        📦 Pedidos do Usuario ({details.orders?.length || 0})
                      </h5>
                    </div>

                    {/* Filtro de Status */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {['ALL', 'PENDING', 'MATCHED', 'COMPLETED', 'CANCELLED', 'DISPUTED'].map((status) => (
                        <button
                          key={status}
                          onClick={() => setOrderStatusFilter(status)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                            orderStatusFilter === status
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {status === 'ALL' ? 'Todos' : status}
                        </button>
                      ))}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Data</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Papel</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Tipo</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Cripto</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Valor BRL</th>
                            <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.orders && details.orders.length > 0 ? (
                            details.orders
                              .filter((order) => orderStatusFilter === 'ALL' || order.status === orderStatusFilter)
                              .map((order) => (
                                <tr key={order.id} className="border-b border-gray-200 dark:border-gray-800">
                                  <td className="py-2 px-3 text-gray-900 dark:text-white">{formatDate(order.createdAt)}</td>
                                  <td className="py-2 px-3">
                                    <span className={`text-xs font-bold ${
                                      order.userRole === 'CREATOR' ? 'text-blue-500' : 'text-green-500'
                                    }`}>
                                      {order.userRole === 'CREATOR' ? 'Criador' : 'Pagador'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-gray-900 dark:text-white">{order.type}</td>
                                  <td className="py-2 px-3 text-gray-900 dark:text-white font-mono">
                                    {order.cryptoAmount} {order.cryptoType}
                                  </td>
                                  <td className="py-2 px-3 text-gray-900 dark:text-white">R$ {order.brlAmount}</td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-1 ${getStatusColor(order.status)} text-white rounded-full text-xs font-bold`}>
                                      {order.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="text-center py-4 text-gray-600 dark:text-gray-400">
                                Nenhum pedido encontrado
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Contador de pedidos filtrados */}
                    {details.orders && details.orders.length > 0 && orderStatusFilter !== 'ALL' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Mostrando {details.orders.filter((o) => o.status === orderStatusFilter).length} de {details.orders.length} pedidos
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Disputas (FASE 2) */}
              {activeTab === 'disputes' && (
                <div className="space-y-4">
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-bold text-gray-900 dark:text-white">⚖️ Disputas ({details.disputes?.length || 0})</h5>
                    </div>
                    <div className="space-y-3">
                      {details.disputes && details.disputes.length > 0 ? (
                        details.disputes.map((dispute) => (
                          <div key={dispute.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-yellow-500">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white">{dispute.title}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Categoria: {dispute.category} | Pedido: {dispute.orderId}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className={`px-2 py-1 ${getStatusColor(dispute.status)} text-white rounded-full text-xs font-bold`}>
                                  {dispute.status}
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(dispute.createdAt)}</p>
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{dispute.description}</p>
                            <div className="flex justify-between items-center">
                              <div className="flex gap-2 items-center">
                                <span className={`text-xs font-bold ${
                                  dispute.userRole === 'CREATOR' ? 'text-red-500' : 'text-blue-500'
                                }`}>
                                  {dispute.userRole === 'CREATOR' ? '🔴 CRIADOR DA DISPUTA' : '🔵 DONO DO PEDIDO'}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  • Criada por: {dispute.creator.name || dispute.creator.email}
                                </span>
                              </div>
                              {dispute.resolutionType && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  Resolução: {dispute.resolutionType}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                          Nenhuma disputa encontrada
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Relatório para Autoridades (FASE 2) */}
              {activeTab === 'report' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-6 text-white">
                    <h5 className="font-bold text-xl mb-2">🏛️ Relatório para Autoridades Governamentais</h5>
                    <p className="text-yellow-100 text-sm">
                      Gere um relatório completo com todos os dados do usuário para envio a autoridades competentes
                    </p>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-6">
                    <h6 className="font-bold text-gray-900 dark:text-white mb-4">📋 O que será incluído no relatório:</h6>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">Dados Pessoais</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Nome, CPF, telefone, endereço</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">Reputacao e Limites</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Baseado em transacoes</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">Carteiras</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Endereços, saldos, transações</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">Histórico Completo</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Todas as transações e pedidos</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">Disputas</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Histórico de reclamações</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">Flags Suspeitas</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Alertas de atividade irregular</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-300 dark:border-gray-700">
                    <h6 className="font-bold text-gray-900 dark:text-white mb-4">⚙️ Opções de Exportação:</h6>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('accessToken');
                            const response = await fetch(`http://localhost:3001/api/v1/admin/users/${userId}/authority-report`, {
                              headers: { 'Authorization': `Bearer ${token}` },
                            });
                            const data = await response.json();

                            // Download como JSON
                            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `relatorio-autoridades-${details.user.email}-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                          } catch (error) {
                            console.error('Erro ao gerar relatório:', error);
                          }
                        }}
                        className="flex flex-col items-center gap-2 p-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                      >
                        <span className="text-3xl">📄</span>
                        <p className="font-bold">Gerar JSON</p>
                        <p className="text-xs text-blue-100">Formato estruturado</p>
                      </button>

                      <button
                        onClick={() => alert('Funcionalidade PDF em desenvolvimento. Por enquanto, use JSON.')}
                        className="flex flex-col items-center gap-2 p-6 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                      >
                        <span className="text-3xl">📑</span>
                        <p className="font-bold">Gerar PDF</p>
                        <p className="text-xs text-red-100">Em desenvolvimento</p>
                      </button>
                    </div>

                    <div className="mt-6 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
                      <p className="text-yellow-800 dark:text-yellow-400 text-sm">
                        <span className="font-bold">⚠️ Atenção:</span> Este relatório contém dados sensíveis e deve ser usado exclusivamente para fins legais e de compliance com requisições de autoridades governamentais.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: Audit Log */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                    <h5 className="font-bold text-gray-900 dark:text-white mb-4">📝 Últimas 20 Ações Administrativas</h5>
                    <div className="space-y-3">
                      {details.auditLog.length > 0 ? (
                        details.auditLog.map((log) => (
                          <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white">{log.action}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Recurso: {log.resource}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(log.timestamp)}</p>
                            </div>
                            {log.adminUser && (
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                👤 Executado por: {log.adminUser.name || log.adminUser.email}
                              </p>
                            )}
                            {log.metadata && (
                              <details className="mt-2">
                                <summary className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer">
                                  Ver detalhes
                                </summary>
                                <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded mt-2 overflow-x-auto">
                                  {log.metadata}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                          Nenhuma ação administrativa registrada
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
