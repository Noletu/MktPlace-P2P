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


export default function AdminDisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [stats, setStats] = useState<DisputeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

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

      const res = await fetch('http://localhost:3002/api/v1/disputes', {
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

      const res = await fetch('http://localhost:3002/api/v1/disputes/stats', {
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          🛡️ Painel de Disputas - Admin
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gerencie e resolva disputas entre compradores e vendedores
        </p>
      </div>

      {/* Stats Cards - Analytics Aprimorado */}
      {stats && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📊 Estatísticas de Disputas</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
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
            <div className="bg-white dark:bg-gray-900 border border-gray-600 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {stats.cancelled}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-600 dark:text-gray-400">❌ Canceladas</div>
            </div>
          </div>

          {/* Taxa de Resolução */}
          {(stats.resolvedBuyer + stats.resolvedSeller) > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-300 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Taxa de Resolução:</span>
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
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow p-4 mb-6">
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
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Nenhuma disputa encontrada
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Titulo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Criado por</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {disputes
                  .filter(d => filterStatus === 'ALL' || d.status === filterStatus)
                  .map((dispute) => (
                  <tr key={dispute.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(dispute.status)}`}>
                        {STATUS_LABELS[dispute.status as keyof typeof STATUS_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                        {dispute.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {CATEGORY_LABELS[dispute.category as keyof typeof CATEGORY_LABELS]}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {dispute.creator.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      R$ {parseFloat(dispute.order.brlAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {new Date(dispute.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/disputes/${dispute.id}`)}
                        className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
