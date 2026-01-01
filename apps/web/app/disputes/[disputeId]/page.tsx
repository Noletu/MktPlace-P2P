'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Dispute, STATUS_LABELS, CATEGORY_LABELS, DisputeStatus } from '@/types/dispute';
import DisputeMessageThread from '@/components/DisputeMessageThread';
import EvidenceGallery from '@/components/admin/EvidenceGallery';

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const disputeId = params.disputeId as string;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [responding, setResponding] = useState(false);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    fetchDispute();
    fetchCurrentUser();
  }, [disputeId]);

  const fetchDispute = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/disputes/${disputeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setDispute(data.data);
      } else {
        alert(data.message || 'Erro ao carregar disputa');
      }
    } catch (error) {
      console.error('Erro ao carregar disputa:', error);
      alert('Erro ao carregar disputa');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const res = await fetch('http://localhost:3001/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUserId(data.data.id);
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('Você precisa estar logado');
        router.push('/login');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/disputes/${disputeId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchDispute(); // Reload to show new message
      } else {
        alert(data.message || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) {
      alert('Por favor, escreva sua contestação');
      return;
    }

    if (responseText.trim().length < 50) {
      alert('A contestação deve ter pelo menos 50 caracteres');
      return;
    }

    setResponding(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('Você precisa estar logado');
        router.push('/login');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/disputes/${disputeId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          contestation: responseText,
          counterEvidences: [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Resposta enviada com sucesso!');
        setResponseText('');
        await fetchDispute();
      } else {
        alert(data.message || 'Erro ao responder disputa');
      }
    } catch (error) {
      console.error('Erro ao responder:', error);
      alert('Erro ao responder disputa');
    } finally {
      setResponding(false);
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

  const isOtherParty = () => {
    if (!dispute || !currentUserId) return false;
    // If current user is not the creator, they are the other party
    return dispute.createdBy !== currentUserId;
  };

  const canRespond = () => {
    return dispute?.status === DisputeStatus.OPEN && isOtherParty();
  };

  const canSendMessages = () => {
    return dispute?.status === DisputeStatus.OPEN || dispute?.status === DisputeStatus.UNDER_REVIEW;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Carregando disputa...</div>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Disputa não encontrada</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/disputes')}
        className="text-blue-600 dark:text-blue-400 hover:underline mb-4"
      >
        ← Voltar para minhas disputas
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {dispute.title}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {CATEGORY_LABELS[dispute.category as keyof typeof CATEGORY_LABELS]}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
              dispute.status
            )}`}
          >
            {STATUS_LABELS[dispute.status as keyof typeof STATUS_LABELS]}
          </span>
        </div>

        {/* Order Info */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Informações do Pedido
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">ID do Pedido:</span>
              <span className="ml-2 font-mono text-gray-900 dark:text-white">
                #{dispute.order.id.substring(0, 8)}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                {dispute.order.type === 'BUY' ? 'Compra' : 'Venda'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Valor BRL:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                R$ {parseFloat(dispute.order.brlAmount).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Cripto:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                {dispute.order.cryptoAmount} {dispute.order.cryptoType}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Descrição da Disputa
          </h3>
          <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {dispute.description}
          </p>
        </div>

        {/* Evidências/Anexos */}
        {dispute.attachments && dispute.attachments.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              📎 Evidências Anexadas ({dispute.attachments.length})
            </h3>
            <EvidenceGallery attachments={dispute.attachments} />
          </div>
        )}

        {/* Resolution (if resolved) */}
        {(dispute.status === DisputeStatus.RESOLVED_BUYER || dispute.status === DisputeStatus.RESOLVED_SELLER) && dispute.resolution && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded">
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
              ✅ Resolução
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">
              {dispute.resolution}
            </p>
            {dispute.resolvedAt && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Resolvida em: {new Date(dispute.resolvedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Response Form (if OPEN and user is other party) */}
      {canRespond() && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
            ⚠️ Você precisa responder a esta disputa (mínimo 50 caracteres)
          </h2>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
            A outra parte abriu uma disputa. Você tem 24 horas para apresentar sua contestação.
            Caso não responda, a decisão poderá ser favorável à outra parte.
          </p>
          <textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Escreva sua contestação detalhada..."
            className="w-full px-4 py-3 border border-yellow-300 dark:border-yellow-600 rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-gray-800 dark:text-white resize-none mb-1"
            rows={6}
            disabled={responding}
          />
          <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
            {responseText.length} / 50 caracteres mínimos
          </div>
          <button
            onClick={handleRespond}
            disabled={responding || !responseText.trim() || responseText.trim().length < 50}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {responding ? 'Enviando...' : 'Enviar Resposta'}
          </button>
        </div>
      )}

      {/* Messages Thread */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" style={{ height: '500px' }}>
        <div className="bg-gray-100 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Histórico de Mensagens
          </h2>
        </div>
        <DisputeMessageThread
          messages={dispute.messages || []}
          currentUserId={currentUserId}
          onSendMessage={canSendMessages() ? handleSendMessage : undefined}
          canSendMessages={canSendMessages()}
        />
      </div>

      {/* Info Footer */}
      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 text-center">
        Disputa criada em {new Date(dispute.createdAt).toLocaleString('pt-BR')} por {dispute.creator.name}
      </div>
    </div>
  );
}
