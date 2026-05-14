'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dispute, STATUS_LABELS, CATEGORY_LABELS } from '@/types/dispute';
import AppHeader from '@/components/AppHeader';
import { fetchWithAuth } from '@/utils/api';

type FilterType = 'ALL' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CANCELLED';

function getParties(dispute: Dispute) {
  const order = dispute.order;
  const creatorId = dispute.createdBy;
  const creatorName = dispute.creator.name || 'Usuário';
  const isBuy = order.orderType === 'BUY';

  const orderOwnerName = order.user?.name || 'Usuário';
  const payerName = order.transactions?.[0]?.payer?.name || 'Usuário';
  const providerName = order.providerName || 'Provedor';

  let creatorRole: string;
  let counterpartyName: string;
  let counterpartyRole: string;

  if (creatorId === order.userId) {
    creatorRole = isBuy ? 'Comprador' : 'Vendedor';
    if (isBuy) {
      counterpartyName = providerName;
      counterpartyRole = 'Provedor';
    } else {
      counterpartyName = payerName;
      counterpartyRole = 'Comprador';
    }
  } else if (creatorId === order.providerId) {
    creatorRole = 'Provedor';
    counterpartyName = orderOwnerName;
    counterpartyRole = 'Comprador';
  } else {
    creatorRole = 'Comprador';
    counterpartyName = orderOwnerName;
    counterpartyRole = isBuy ? 'Comprador' : 'Vendedor';
  }

  return { creatorName, creatorRole, counterpartyName, counterpartyRole };
}

function getStatusBorderColor(status: string) {
  switch (status) {
    case 'OPEN': return 'border-l-yellow-500';
    case 'UNDER_REVIEW': return 'border-l-blue-500';
    case 'RESOLVED_BUYER':
    case 'RESOLVED_SELLER': return 'border-l-green-500';
    case 'CANCELLED': return 'border-l-gray-500';
    default: return 'border-l-gray-500';
  }
}

function getStatusTextColor(status: string) {
  switch (status) {
    case 'OPEN': return 'text-yellow-500';
    case 'UNDER_REVIEW': return 'text-blue-500';
    case 'RESOLVED_BUYER':
    case 'RESOLVED_SELLER': return 'text-green-500';
    case 'CANCELLED': return 'text-gray-500';
    default: return 'text-gray-500';
  }
}

export default function DisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      const res = await fetchWithAuth('/disputes/my-disputes');
      const data = await res.json();
      if (data.success) {
        setDisputes(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar disputas:', error);
    } finally {
      setLoading(false);
    }
  };

  const matchesFilter = (status: string, filter: FilterType): boolean => {
    switch (filter) {
      case 'ALL': return true;
      case 'OPEN': return status === 'OPEN';
      case 'UNDER_REVIEW': return status === 'UNDER_REVIEW';
      case 'RESOLVED': return status === 'RESOLVED_BUYER' || status === 'RESOLVED_SELLER';
      case 'CANCELLED': return status === 'CANCELLED';
    }
  };

  const getFilteredDisputes = () => disputes.filter(d => matchesFilter(d.status, activeFilter));

  const countByFilter = (filter: FilterType) => disputes.filter(d => matchesFilter(d.status, filter)).length;

  const filters: { key: FilterType; label: string; activeColor: string }[] = [
    { key: 'ALL', label: 'Todas', activeColor: 'bg-gray-600' },
    { key: 'OPEN', label: 'Abertas', activeColor: 'bg-yellow-600' },
    { key: 'UNDER_REVIEW', label: 'Em Analise', activeColor: 'bg-blue-600' },
    { key: 'RESOLVED', label: 'Resolvidas', activeColor: 'bg-green-600' },
    { key: 'CANCELLED', label: 'Canceladas', activeColor: 'bg-gray-500' },
  ];

  const filteredDisputes = getFilteredDisputes();

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando disputas...</div>
        </div>
      </>
    );
  }

  return (
    <>
    <AppHeader />
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/dashboard')}
        className="text-blue-600 dark:text-blue-400 hover:underline mb-4 flex items-center gap-1"
      >
        ← Voltar para o Dashboard
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Minhas Disputas ({disputes.length})
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Acompanhe o status das suas disputas abertas
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeFilter === f.key
                  ? `${f.activeColor} text-white`
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.label} ({countByFilter(f.key)})
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de disputas */}
      {filteredDisputes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Nenhuma disputa encontrada
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow overflow-hidden">
          {/* Header da tabela - hidden no mobile */}
          <div className="hidden md:grid md:grid-cols-[180px_1fr_120px_120px_100px_120px] gap-4 px-5 py-3 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <span>Status</span>
            <span>Título</span>
            <span>Criado por</span>
            <span>Valor</span>
            <span>Data</span>
            <span>Acao</span>
          </div>

          {/* Rows */}
          {filteredDisputes.map((dispute) => {
            const parties = getParties(dispute);

            return (
              <div
                key={dispute.id}
                className={`border-l-4 ${getStatusBorderColor(dispute.status)} border-b border-gray-200 dark:border-gray-700 last:border-b-0`}
              >
                {/* Desktop: row em 1 linha */}
                <div className="hidden md:grid md:grid-cols-[180px_1fr_120px_120px_100px_120px] gap-4 items-center px-5 py-4">
                  {/* Status */}
                  <span className={`text-sm font-semibold ${getStatusTextColor(dispute.status)}`}>
                    {STATUS_LABELS[dispute.status as keyof typeof STATUS_LABELS]}
                  </span>

                  {/* Titulo + categoria */}
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">
                      {dispute.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {CATEGORY_LABELS[dispute.category as keyof typeof CATEGORY_LABELS]}
                    </p>
                  </div>

                  {/* Criado por */}
                  <span className="text-sm text-gray-900 dark:text-white truncate">
                    {parties.creatorName}
                  </span>

                  {/* Valor */}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    R$ {parseFloat(dispute.order.brlAmount).toFixed(2)}
                  </span>

                  {/* Data */}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(dispute.createdAt).toLocaleDateString('pt-BR')}
                  </span>

                  {/* Acao */}
                  <button
                    onClick={() => router.push(`/disputes/${dispute.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Ver Detalhes
                  </button>
                </div>

                {/* Mobile: layout empilhado */}
                <div className="md:hidden px-4 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${getStatusTextColor(dispute.status)}`}>
                      {STATUS_LABELS[dispute.status as keyof typeof STATUS_LABELS]}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(dispute.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white">{dispute.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {CATEGORY_LABELS[dispute.category as keyof typeof CATEGORY_LABELS]}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      <span>{parties.creatorName}</span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span className="font-semibold">R$ {parseFloat(dispute.order.brlAmount).toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => router.push(`/disputes/${dispute.id}`)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
