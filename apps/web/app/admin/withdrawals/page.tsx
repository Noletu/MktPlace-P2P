'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getExplorerUrl, getExplorerName, truncateHash, NetworkType } from '@/utils/blockchainExplorer';

interface WithdrawalUser {
  id: string;
  email: string;
  name: string;
  accountFrozen?: boolean;
  frozenReason?: string;
}

interface WithdrawalWallet {
  id: string;
  userId: string;
  cryptoType: string;
  network: string;
  address: string;
  user: WithdrawalUser;
}

interface Withdrawal {
  id: string;
  walletId: string;
  toAddress: string;
  amount: string;
  txHash: string | null;
  status: string;
  networkFee: string | null;
  platformFee: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  wallet: WithdrawalWallet;
}

interface WithdrawalCounts {
  requiresApproval: number;
  pending: number;
  processing: number;
}

type TabFilter = 'ACTION_NEEDED' | 'ALL' | 'COMPLETED' | 'REJECTED' | 'FAILED';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  REQUIRES_APPROVAL: {
    label: 'Aguardando Aprovacao',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    icon: '⚠️',
  },
  PENDING: {
    label: 'Pendente',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    icon: '⏳',
  },
  APPROVED: {
    label: 'Aprovado',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    icon: '✅',
  },
  PROCESSING: {
    label: 'Processando',
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    icon: '🔄',
  },
  COMPLETED: {
    label: 'Concluido',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    icon: '✅',
  },
  FAILED: {
    label: 'Falhou',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    icon: '❌',
  },
  REJECTED: {
    label: 'Rejeitado',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    icon: '🚫',
  },
};

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [historyWithdrawals, setHistoryWithdrawals] = useState<Withdrawal[]>([]);
  const [counts, setCounts] = useState<WithdrawalCounts>({ requiresApproval: 0, pending: 0, processing: 0 });
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('ACTION_NEEDED');

  // Modal states
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // History filter
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('');
  const [historyOffset, setHistoryOffset] = useState(0);
  const historyLimit = 20;

  const getToken = () => localStorage.getItem('accessToken');

  const fetchPending = async () => {
    try {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      const res = await fetch('http://localhost:3002/api/v1/admin/withdrawals/pending', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawals(data.data || []);
        setCounts(data.counts || { requiresApproval: 0, pending: 0, processing: 0 });
      }
    } catch (error) {
      console.error('Erro ao carregar saques pendentes:', error);
    }
  };

  const fetchHistory = async (status?: string, offset = 0) => {
    try {
      const token = getToken();
      if (!token) return;

      const params = new URLSearchParams();
      params.set('limit', String(historyLimit));
      params.set('offset', String(offset));
      if (status) params.set('status', status);

      const res = await fetch(`http://localhost:3002/api/v1/admin/withdrawals/history?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setHistoryWithdrawals(data.data || []);
        setHistoryTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar historico:', error);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchPending(), fetchHistory()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // Auto-refresh a cada 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPending();
      if (activeTab !== 'ACTION_NEEDED') {
        fetchHistory(historyStatusFilter, historyOffset);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, historyStatusFilter, historyOffset]);

  // Reload history quando mudar filtro ou tab
  useEffect(() => {
    if (activeTab === 'COMPLETED') {
      fetchHistory('COMPLETED', 0);
      setHistoryOffset(0);
    } else if (activeTab === 'REJECTED') {
      fetchHistory('REJECTED', 0);
      setHistoryOffset(0);
    } else if (activeTab === 'FAILED') {
      fetchHistory('FAILED', 0);
      setHistoryOffset(0);
    } else if (activeTab === 'ALL') {
      fetchHistory(historyStatusFilter, 0);
      setHistoryOffset(0);
    }
  }, [activeTab]);

  const handleAction = async () => {
    if (!actionId || !actionType) return;
    if (actionType === 'reject' && !actionNote.trim()) {
      alert('Nota obrigatoria ao rejeitar um saque');
      return;
    }

    setActionLoading(true);
    try {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      const res = await fetch(
        `http://localhost:3002/api/v1/admin/withdrawals/${actionId}/${actionType}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ note: actionNote.trim() || undefined }),
        }
      );
      const data = await res.json();

      if (data.success) {
        closeModal();
        await fetchPending();
      } else {
        alert(data.error || `Erro ao ${actionType === 'approve' ? 'aprovar' : 'rejeitar'} saque`);
      }
    } catch (error) {
      console.error('Erro na acao:', error);
      alert('Erro ao processar acao');
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setActionId(null);
    setActionType(null);
    setActionNote('');
  };

  const openApprove = (id: string) => {
    setActionId(id);
    setActionType('approve');
    setActionNote('');
  };

  const openReject = (id: string) => {
    setActionId(id);
    setActionType('reject');
    setActionNote('');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getDisplayWithdrawals = (): Withdrawal[] => {
    switch (activeTab) {
      case 'ACTION_NEEDED':
        return withdrawals;
      case 'COMPLETED':
      case 'REJECTED':
      case 'FAILED':
      case 'ALL':
        return historyWithdrawals;
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando saques...</p>
        </div>
      </div>
    );
  }

  const totalActionNeeded = counts.requiresApproval + counts.pending + counts.processing;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          💸 Gerenciamento de Saques
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Acompanhe, aprove e gerencie saques dos usuarios
        </p>
      </div>

      {/* Stats Cards */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📊 Resumo</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-orange-800 dark:text-orange-200">
              {counts.requiresApproval}
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-300">⚠️ Aguardando Aprovacao</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
              {counts.pending}
            </div>
            <div className="text-sm text-yellow-700 dark:text-yellow-300">⏳ Pendentes (auto)</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">
              {counts.processing}
            </div>
            <div className="text-sm text-indigo-700 dark:text-indigo-300">🔄 Processando</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('ACTION_NEEDED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'ACTION_NEEDED'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Acao Necessaria {totalActionNeeded > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {totalActionNeeded}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'COMPLETED'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Concluidos
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'REJECTED'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Rejeitados
          </button>
          <button
            onClick={() => setActiveTab('FAILED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'FAILED'
                ? 'bg-red-800 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Falhas
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'ALL'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {/* Withdrawals List */}
      {getDisplayWithdrawals().length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {activeTab === 'ACTION_NEEDED'
              ? 'Nenhum saque pendente de acao'
              : 'Nenhum saque encontrado'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {getDisplayWithdrawals().map((w) => {
            const statusCfg = STATUS_CONFIG[w.status] || STATUS_CONFIG.PENDING;
            const isRequiresApproval = w.status === 'REQUIRES_APPROVAL';
            const isFrozen = w.wallet?.user?.accountFrozen;

            return (
              <div
                key={w.id}
                className={`bg-white dark:bg-gray-800 border rounded-lg shadow p-5 ${
                  isRequiresApproval
                    ? 'border-orange-400 dark:border-orange-600'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                {/* Top row: user + status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {parseFloat(w.amount).toFixed(8)} {w.wallet?.cryptoType}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {w.wallet?.network}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{w.wallet?.user?.name || w.wallet?.user?.email || 'Usuario'}</span>
                      <span className="mx-1">-</span>
                      <span className="text-gray-500">{w.wallet?.user?.email}</span>
                      {isFrozen && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold">
                          🧊 Conta Congelada
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusCfg.color}`}>
                    {statusCfg.icon} {statusCfg.label}
                  </span>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Destino:</span>
                    <span className="ml-1 font-mono text-gray-900 dark:text-white" title={w.toAddress}>
                      {truncateHash(w.toAddress, 10, 6)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Criado:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">
                      {formatDate(w.createdAt)}
                    </span>
                  </div>
                  {w.networkFee && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Taxa de Rede:</span>
                      <span className="ml-1 text-gray-900 dark:text-white">{w.networkFee}</span>
                    </div>
                  )}
                  {w.txHash && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">TxHash:</span>
                      <a
                        href={getExplorerUrl(w.wallet?.network as NetworkType, w.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 font-mono text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {truncateHash(w.txHash, 8, 6)} ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Retry / Error info */}
                {w.retryCount > 0 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mb-2">
                    Tentativas: {w.retryCount}/3
                    {w.lastError && (
                      <span className="ml-2 text-red-600 dark:text-red-400">
                        Ultimo erro: {w.lastError.substring(0, 100)}
                      </span>
                    )}
                  </div>
                )}

                {/* Review info */}
                {w.reviewNote && (
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-3 mb-3 text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Nota de revisao:</span>
                    <span className="ml-1 text-gray-800 dark:text-gray-200">{w.reviewNote}</span>
                    {w.reviewedAt && (
                      <span className="ml-2 text-xs text-gray-500">({formatDate(w.reviewedAt)})</span>
                    )}
                  </div>
                )}

                {/* Frozen reason */}
                {isFrozen && w.wallet?.user?.frozenReason && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-3 text-sm">
                    <span className="font-medium text-red-700 dark:text-red-300">Motivo do congelamento:</span>
                    <span className="ml-1 text-red-800 dark:text-red-200">{w.wallet.user.frozenReason}</span>
                  </div>
                )}

                {/* Actions */}
                {isRequiresApproval && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => openApprove(w.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition"
                    >
                      ✅ Aprovar Saque
                    </button>
                    <button
                      onClick={() => openReject(w.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition"
                    >
                      🚫 Rejeitar Saque
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination for history tabs */}
      {activeTab !== 'ACTION_NEEDED' && historyTotal > historyLimit && (
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => {
              const newOffset = Math.max(0, historyOffset - historyLimit);
              setHistoryOffset(newOffset);
              fetchHistory(
                activeTab === 'ALL' ? historyStatusFilter : activeTab,
                newOffset
              );
            }}
            disabled={historyOffset === 0}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Anterior
          </button>
          <span className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            {historyOffset + 1} - {Math.min(historyOffset + historyLimit, historyTotal)} de {historyTotal}
          </span>
          <button
            onClick={() => {
              const newOffset = historyOffset + historyLimit;
              if (newOffset < historyTotal) {
                setHistoryOffset(newOffset);
                fetchHistory(
                  activeTab === 'ALL' ? historyStatusFilter : activeTab,
                  newOffset
                );
              }
            }}
            disabled={historyOffset + historyLimit >= historyTotal}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Proximo
          </button>
        </div>
      )}

      {/* Modal de Aprovar/Rejeitar */}
      {actionId && actionType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {actionType === 'approve' ? '✅ Aprovar Saque' : '🚫 Rejeitar Saque'}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {actionType === 'approve'
                ? 'O saque sera movido para a fila de processamento automatico do worker.'
                : 'O saque sera cancelado e o saldo bloqueado sera devolvido ao usuario.'}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {actionType === 'approve' ? 'Nota (opcional)' : 'Motivo da rejeicao (obrigatorio)'}
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={
                  actionType === 'approve'
                    ? 'Opcional: adicione uma nota...'
                    : 'Explique o motivo da rejeicao...'
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading || (actionType === 'reject' && !actionNote.trim())}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading
                  ? 'Processando...'
                  : actionType === 'approve'
                  ? 'Confirmar Aprovacao'
                  : 'Confirmar Rejeicao'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
