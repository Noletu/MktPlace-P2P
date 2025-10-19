'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dispute, DisputeStatus, STATUS_LABELS, CATEGORY_LABELS } from '@/types/dispute';

interface DisputeStats {
  total: number;
  open: number;
  underReview: number;
  resolvedBuyer: number;
  resolvedSeller: number;
  cancelled: number;
}

enum ResolutionType {
  REFUND_BUYER_FULL = 'REFUND_BUYER_FULL',
  REFUND_BUYER_PARTIAL = 'REFUND_BUYER_PARTIAL',
  RELEASE_SELLER = 'RELEASE_SELLER',
  CANCEL_NO_PENALTY = 'CANCEL_NO_PENALTY',
  PENALTY_BUYER = 'PENALTY_BUYER',
  PENALTY_SELLER = 'PENALTY_SELLER',
}

const RESOLUTION_TYPE_LABELS: Record<ResolutionType, string> = {
  [ResolutionType.REFUND_BUYER_FULL]: 'Reembolso Total ao Comprador',
  [ResolutionType.REFUND_BUYER_PARTIAL]: 'Reembolso Parcial ao Comprador',
  [ResolutionType.RELEASE_SELLER]: 'Liberar Crypto para Vendedor',
  [ResolutionType.CANCEL_NO_PENALTY]: 'Cancelar sem Penalidade',
  [ResolutionType.PENALTY_BUYER]: 'Penalizar Comprador (Fraude)',
  [ResolutionType.PENALTY_SELLER]: 'Penalizar Vendedor (Má-fé)',
};

export default function AdminDisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [stats, setStats] = useState<DisputeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionType, setResolutionType] = useState<ResolutionType | ''>('');
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchDisputes();
    fetchStats();
  }, []);

  const fetchDisputes = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('http://localhost:3001/api/v1/disputes', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        // O backend retorna data: {disputes: [], total: number, limit: number, offset: number}
        const disputesData = data.data?.disputes || [];
        setDisputes(disputesData);
      } else {
        alert('Erro ao carregar disputas');
        setDisputes([]);
      }
    } catch (error) {
      console.error('Erro ao carregar disputas:', error);
      alert('Erro ao carregar disputas. Verifique se você é admin.');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const res = await fetch('http://localhost:3001/api/v1/disputes/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleResolve = async () => {
    if (!resolvingId || !resolutionType || !resolutionText.trim()) {
      alert('Preencha todos os campos');
      return;
    }

    setResolving(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('Você precisa estar logado');
        router.push('/login');
        return;
      }

      const res = await fetch(`http://localhost:3001/api/v1/disputes/${resolvingId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolutionType,
          resolution: resolutionText,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('Disputa resolvida com sucesso!');
        setResolvingId(null);
        setResolutionType('');
        setResolutionText('');
        await fetchDisputes();
        await fetchStats();
      } else {
        alert(data.message || 'Erro ao resolver disputa');
      }
    } catch (error) {
      console.error('Erro ao resolver disputa:', error);
      alert('Erro ao resolver disputa');
    } finally {
      setResolving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'UNDER_REVIEW':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'RESOLVED_BUYER':
      case 'RESOLVED_SELLER':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Carregando disputas...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          🛡️ Painel de Disputas - Admin
        </h1>
        <p className="text-gray-400">
          Gerencie e resolva disputas entre compradores e vendedores
        </p>
      </div>

      {/* Stats Cards - Analytics Aprimorado */}
      {stats && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">📊 Estatísticas de Disputas</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-white">
                {stats.total}
              </div>
              <div className="text-sm text-gray-400">Total</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                {stats.open}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">⚠️ Abertas</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {stats.underReview}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">🔍 Em Análise</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                {stats.resolvedBuyer}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">✅ Favor Comprador</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                {stats.resolvedSeller}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">✅ Favor Vendedor</div>
            </div>
            <div className="bg-gray-900 border border-gray-600 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {stats.cancelled}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-400">❌ Canceladas</div>
            </div>
          </div>

          {/* Taxa de Resolução */}
          {(stats.resolvedBuyer + stats.resolvedSeller) > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Taxa de Resolução:</span>
                <div className="flex gap-4">
                  <span className="text-sm font-semibold text-blue-600">
                    Comprador: {Math.round((stats.resolvedBuyer / (stats.resolvedBuyer + stats.resolvedSeller)) * 100)}%
                  </span>
                  <span className="text-sm font-semibold text-purple-600">
                    Vendedor: {Math.round((stats.resolvedSeller / (stats.resolvedBuyer + stats.resolvedSeller)) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-4 py-2 rounded-lg ${
              filterStatus === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterStatus(DisputeStatus.OPEN)}
            className={`px-4 py-2 rounded-lg ${
              filterStatus === DisputeStatus.OPEN
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Abertas
          </button>
          <button
            onClick={() => setFilterStatus(DisputeStatus.UNDER_REVIEW)}
            className={`px-4 py-2 rounded-lg ${
              filterStatus === DisputeStatus.UNDER_REVIEW
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Em Análise
          </button>
        </div>
      </div>

      {/* Disputes List */}
      {disputes.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-8 text-center">
          <p className="text-gray-400">
            Nenhuma disputa encontrada
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes
            .filter(d => filterStatus === 'ALL' || d.status === filterStatus)
            .map((dispute) => (
            <div
              key={dispute.id}
              className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {dispute.title}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {CATEGORY_LABELS[dispute.category as keyof typeof CATEGORY_LABELS]}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                    dispute.status
                  )}`}
                >
                  {STATUS_LABELS[dispute.status as keyof typeof STATUS_LABELS]}
                </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-400">Criado por:</span>
                  <span className="ml-2 font-semibold text-white">
                    {dispute.creator.name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Pedido:</span>
                  <span className="ml-2 font-mono text-white">
                    #{dispute.order.id.substring(0, 8)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Valor:</span>
                  <span className="ml-2 font-semibold text-white">
                    R$ {parseFloat(dispute.order.brlAmount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Description Preview */}
              <div className="bg-gray-900 border border-gray-600 rounded p-3 mb-4">
                <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                  {dispute.description}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/disputes/${dispute.id}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Ver Detalhes
                </button>
                {(dispute.status === DisputeStatus.OPEN || dispute.status === DisputeStatus.UNDER_REVIEW) && (
                  <button
                    onClick={() => setResolvingId(dispute.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Resolver Disputa
                  </button>
                )}
              </div>

              {/* Resolution Form */}
              {resolvingId === dispute.id && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    Resolver Disputa
                  </h4>

                  {/* Resolution Type */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Tipo de Resolução
                    </label>
                    <select
                      value={resolutionType}
                      onChange={(e) => setResolutionType(e.target.value as ResolutionType)}
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Selecione...</option>
                      {Object.entries(RESOLUTION_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Resolution Text */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Justificativa da Decisão
                    </label>
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Explique detalhadamente a decisão tomada..."
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg dark:bg-gray-800 dark:text-white resize-none"
                      rows={4}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setResolvingId(null);
                        setResolutionType('');
                        setResolutionText('');
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                      disabled={resolving}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleResolve}
                      disabled={resolving || !resolutionType || !resolutionText.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resolving ? 'Resolvendo...' : 'Confirmar Resolução'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
