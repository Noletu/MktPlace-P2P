'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import {
  SupportTicket,
  TicketMessage,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  TicketStatus,
} from '../../../../types/support';
import { fetchWithAuth } from '@/utils/api';

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams() ?? {};
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`/support/${ticketId}`);

      const data = await response.json();

      if (data.success) {
        setTicket(data.data);
      } else {
        setError(data.error || 'Erro ao carregar ticket');
      }
    } catch (err: any) {
      setError('Erro ao conectar com servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) {
      return;
    }

    try {
      setSending(true);
      const response = await fetchWithAuth(`/support/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          message: newMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNewMessage('');
        // Recarregar ticket para ver nova mensagem
        await fetchTicket();
      } else {
        setError(data.error || 'Erro ao enviar mensagem');
      }
    } catch (err: any) {
      setError('Erro ao conectar com servidor');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
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
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Ticket não encontrado'}</p>
            <button onClick={() => router.push('/support')} className="text-blue-600 hover:text-blue-700">
              ← Voltar para lista de tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <AppHeader />
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push('/support')} className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2">
            ← Voltar para meus tickets
          </button>
        </div>

        {/* Ticket Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{ticket.subject}</h1>

          {/* Meta info */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Criado em {formatDate(ticket.createdAt)} por {ticket.creator?.name || ticket.creator?.email}
          </p>

          {/* Resolution Box */}
          {ticket.status === TicketStatus.RESOLVED && ticket.resolution && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">✅ Ticket Resolvido</p>
              <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">{ticket.resolution}</p>
              {ticket.resolvedAt && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">Resolvido em {formatDate(ticket.resolvedAt)}</p>
              )}
            </div>
          )}
        </div>

        {/* Messages Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Histórico de Mensagens</h2>

          <div className="space-y-4">
            {ticket.messages && ticket.messages.length > 0 ? (
              ticket.messages.map((message: TicketMessage) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.isSupportMessage
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {/* Message Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {message.isSupportMessage && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">
                          {message.author.role?.name || 'Suporte'}
                        </span>
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {message.author.name || message.author.email}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(message.createdAt)}</span>
                  </div>

                  {/* Message Content */}
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{message.message}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhuma mensagem ainda</p>
            )}
          </div>
        </div>

        {/* New Message Form */}
        {ticket.status !== TicketStatus.CLOSED && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Adicionar Mensagem</h2>

            {error && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg text-sm">{error}</div>}

            <form onSubmit={handleSendMessage}>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={4}
                placeholder="Digite sua mensagem..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-4"
                disabled={sending}
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={sending || !newMessage.trim()}
                >
                  {sending ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </div>
            </form>
          </div>
        )}

        {ticket.status === TicketStatus.CLOSED && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">Este ticket está fechado e não aceita mais mensagens.</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
