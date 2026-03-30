'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import {
  SupportTicket,
  TicketStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '../../types/support';
import { fetchWithAuth } from '@/utils/api';

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [selectedStatus, tickets]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/support/my-tickets');

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

  const filterTickets = () => {
    if (selectedStatus === 'ALL') {
      setFilteredTickets(tickets);
    } else {
      setFilteredTickets(tickets.filter((t) => t.status === selectedStatus));
    }
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <AppHeader />
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Meus Tickets de Suporte</h1>
          <button
            onClick={() => router.push('/support/ticket/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Novo Ticket
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedStatus('ALL')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedStatus === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {STATUS_LABELS[status]} ({count})
              </button>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Tickets List */}
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-lg mb-4">
              {selectedStatus === 'ALL'
                ? 'Você ainda não criou nenhum ticket de suporte'
                : `Nenhum ticket com status "${STATUS_LABELS[selectedStatus]}"`}
            </div>
            {selectedStatus === 'ALL' && (
              <button
                onClick={() => router.push('/support/ticket/new')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Criar Primeiro Ticket
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => router.push(`/support/ticket/${ticket.id}`)}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Header com badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                    {PRIORITY_LABELS[ticket.priority]}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    {CATEGORY_LABELS[ticket.category]}
                  </span>
                </div>

                {/* Assunto */}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{ticket.subject}</h3>

                {/* Descrição (preview) */}
                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{ticket.description}</p>

                {/* Footer */}
                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-4">
                    <span>📅 {formatDate(ticket.createdAt)}</span>
                    <span>💬 {ticket._count?.messages || 0} mensagens</span>
                  </div>
                  {ticket.resolvedAt && <span>✅ Resolvido em {formatDate(ticket.resolvedAt)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
