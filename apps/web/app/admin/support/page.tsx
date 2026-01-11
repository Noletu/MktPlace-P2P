'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SupportTicket,
  TicketStatus,
  TicketCategory,
  TicketPriority,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  TicketStats,
} from '../../../types/support';

export default function AdminSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [selectedStatus, selectedPriority, tickets]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://localhost:3001/api/v1/support', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setTickets(data.data);
        setFilteredTickets(data.data);
      } else {
        setError(data.error || 'Erro ao carregar tickets');
      }
    } catch (err: any) {
      setError('Erro ao conectar com servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://localhost:3001/api/v1/support/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar estatísticas:', err);
    }
  };

  const filterTickets = () => {
    let filtered = tickets;

    if (selectedStatus !== 'ALL') {
      filtered = filtered.filter((t) => t.status === selectedStatus);
    }

    if (selectedPriority !== 'ALL') {
      filtered = filtered.filter((t) => t.priority === selectedPriority);
    }

    setFilteredTickets(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tickets de Suporte</h1>
        <p className="text-gray-600 dark:text-gray-400">Gerencie todos os tickets de suporte da plataforma</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total de Tickets</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <div className="text-4xl">🎫</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Abertos</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.byStatus.open}</p>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Em Análise</p>
                <p className="text-3xl font-bold text-blue-600">{stats.byStatus.underReview}</p>
              </div>
              <div className="text-4xl">🔍</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Taxa de Resolução</p>
                <p className="text-3xl font-bold text-green-600">{stats.resolutionRate.toFixed(1)}%</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedStatus('ALL')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Todos ({tickets.length})
              </button>
              {Object.values(TicketStatus).map((status) => {
                const count = tickets.filter((t) => t.status === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedStatus === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {STATUS_LABELS[status]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prioridade</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedPriority('ALL')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedPriority === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Todas
              </button>
              {Object.values(TicketPriority).map((priority) => {
                const count = tickets.filter((t) => t.priority === priority).length;
                return (
                  <button
                    key={priority}
                    onClick={() => setSelectedPriority(priority)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedPriority === priority
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {PRIORITY_LABELS[priority]} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-gray-400 dark:text-gray-500 text-lg">
            Nenhum ticket encontrado com os filtros selecionados
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => router.push(`/admin/support/${ticket.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                    {PRIORITY_LABELS[ticket.priority]}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    {CATEGORY_LABELS[ticket.category as TicketCategory]}
                  </span>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  #{ticket.id.slice(0, 8)}
                </div>
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{ticket.subject}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{ticket.description}</p>

              {/* Footer */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <span>👤</span>
                  <span>{ticket.creator?.name || ticket.creator?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span>{formatDate(ticket.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💬</span>
                  <span>{ticket._count?.messages || 0} mensagens</span>
                </div>
                {ticket.resolvedAt && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <span>✅</span>
                    <span>Resolvido em {formatDate(ticket.resolvedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
