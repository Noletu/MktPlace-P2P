'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Dispute, DisputeMessage, STATUS_LABELS, CATEGORY_LABELS, DisputeStatus } from '@/types/dispute';
import DisputeMessageThread from '@/components/DisputeMessageThread';
import EvidenceGallery from '@/components/admin/EvidenceGallery';

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const disputeId = params.disputeId as string;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userLevel, setUserLevel] = useState<number>(0);
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');

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
        setUserLevel(data.data.level || 0);
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
    }
  };

  const handleSendMessage = async (message: string, _attachments?: File[], visibleTo?: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('Você precisa estar logado');
        router.push('/login');
        return;
      }

      const body: any = { message };
      if (visibleTo) {
        body.visibleTo = visibleTo;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/disputes/${disputeId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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

  const handleResolve = async () => {
    if (!resolutionType || resolutionText.length < 20) {
      alert('Por favor, selecione um tipo de resolução e forneça uma justificativa (mínimo 20 caracteres)');
      return;
    }

    if (!confirm('Confirma a resolução desta disputa? Esta ação é irreversível.')) {
      return;
    }

    setResolving(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolution: resolutionText,
          resolutionType: resolutionType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ Disputa resolvida com sucesso!');
        setResolutionText('');
        setResolutionType('');
        await fetchDispute();
      } else {
        alert(`❌ Erro: ${data.error || 'Erro ao resolver disputa'}`);
      }
    } catch (err) {
      console.error('Erro ao resolver disputa:', err);
      alert('❌ Erro ao resolver disputa. Tente novamente.');
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

  const isOtherParty = () => {
    if (!dispute || !currentUserId) return false;
    // If current user is not the creator, they are the other party
    return dispute.createdBy !== currentUserId;
  };

  const isStaff = () => {
    return userLevel >= 40; // SUPPORT, GERENTE, ADMIN, MASTER
  };

  const canResolve = () => {
    // GERENTE+ pode resolver disputas
    return dispute?.status !== DisputeStatus.RESOLVED &&
           dispute?.status !== DisputeStatus.CANCELLED &&
           userLevel >= 60;
  };

  const canSendMessages = () => {
    return dispute?.status === DisputeStatus.OPEN || dispute?.status === DisputeStatus.UNDER_REVIEW;
  };

  // Identificar vendedor e comprador com base no tipo da ordem
  const { seller, buyer } = useMemo(() => {
    if (!dispute) return { seller: null, buyer: null };

    const orderType = (dispute.order as any).orderType;
    const provider = (dispute.order as any).provider;

    if (orderType === 'BUY') {
      // BUY: order.user = comprador, provider = vendedor
      return {
        seller: provider || null,
        buyer: dispute.order.user || null,
      };
    } else {
      // SELL: order.user = vendedor, transaction.payer = comprador
      const payer = dispute.order.transactions?.[0]?.payer;
      return {
        seller: dispute.order.user || null,
        buyer: payer || null,
      };
    }
  }, [dispute]);

  // Identificar as duas partes da disputa
  const disputeParties = useMemo(() => {
    const parties: { id: string; name: string; role: string }[] = [];

    if (seller) {
      parties.push({
        id: seller.id,
        name: seller.name || 'Vendedor',
        role: 'Vendedor de Cripto',
      });
    }

    if (buyer && buyer.id !== seller?.id) {
      parties.push({
        id: buyer.id,
        name: buyer.name || 'Comprador',
        role: 'Pagador do PIX',
      });
    }

    return parties;
  }, [seller, buyer]);

  // Setar aba ativa quando dispute carrega (apenas para staff)
  useEffect(() => {
    if (isStaff() && disputeParties.length > 0 && !activeTab) {
      setActiveTab(disputeParties[0].id);
    }
  }, [disputeParties, userLevel]);

  // Filtrar mensagens para a aba ativa (staff)
  const filteredMessages = useMemo((): DisputeMessage[] => {
    if (!dispute?.messages) return [];
    if (!isStaff() || !activeTab) return dispute.messages;

    return dispute.messages.filter((msg) => {
      // Mensagens do usuário da aba ativa
      if (msg.authorId === activeTab) return true;
      // Mensagens de admin destinadas ao usuário da aba ativa
      if (msg.isAdminMessage && msg.visibleTo === activeTab) return true;
      return false;
    });
  }, [dispute?.messages, activeTab, userLevel]);

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
        onClick={() => router.push(isStaff() ? '/admin/disputes' : '/disputes')}
        className="text-blue-600 dark:text-blue-400 hover:underline mb-4"
      >
        {isStaff() ? '← Voltar para painel de disputas' : '← Voltar para minhas disputas'}
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
            Informacoes do Pedido
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">ID:</span>
              <span className="ml-2 font-mono text-gray-900 dark:text-white">
                #{dispute.order.id.substring(0, 8)}
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
                {parseFloat(dispute.order.cryptoAmount).toFixed(8)} {dispute.order.cryptoType}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
              <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                (dispute.order as any).orderType === 'BUY'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {(dispute.order as any).orderType === 'BUY' ? 'COMPRA (BUY)' : 'VENDA (SELL)'}
              </span>
            </div>
          </div>
        </div>

        {/* Partes Envolvidas - Visao Admin */}
        {isStaff() && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Partes Envolvidas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vendedor de Cripto */}
              {seller && (
                <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-3">
                  <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2">
                    VENDEDOR DE CRIPTO
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Nome:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{seller.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Email:</span>
                      <span className="font-mono text-xs text-gray-900 dark:text-white">{seller.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">ID:</span>
                      <span className="font-mono text-xs text-gray-900 dark:text-white">{seller.id.slice(0, 12)}...</span>
                    </div>
                  </div>
                  {dispute.createdBy === seller.id && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold">
                      Abriu a disputa
                    </div>
                  )}
                </div>
              )}

              {/* Pagador do PIX (Comprador) */}
              {buyer && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
                  <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                    PAGADOR DO PIX (Comprador)
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Nome:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{buyer.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Email:</span>
                      <span className="font-mono text-xs text-gray-900 dark:text-white">{buyer.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">ID:</span>
                      <span className="font-mono text-xs text-gray-900 dark:text-white">{buyer.id.slice(0, 12)}...</span>
                    </div>
                  </div>
                  {dispute.createdBy === buyer.id && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold">
                      Abriu a disputa
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

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

      {/* Botão Resolver para GERENTE+ */}
      {canResolve() && (
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            👨‍⚖️ Resolver Disputa (Gerente/Admin)
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
            Como gerente, você pode resolver esta disputa tomando uma decisão final.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Resolucao
              </label>
              <select
                value={resolutionType}
                onChange={(e) => setResolutionType(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Selecione a decisao...</option>
                <option value="RELEASE_TO_BUYER">Liberar Cripto para Pagador do PIX (comprovante valido)</option>
                <option value="RETURN_TO_SELLER">Devolver Cripto ao Vendedor (comprovante invalido)</option>
                <option value="CANCEL_NO_PENALTY">Cancelar Negociacao (sem penalidade)</option>
                <option value="PENALTY_BUYER">Penalizar Pagador do PIX (fraude)</option>
                <option value="PENALTY_SELLER">Penalizar Vendedor (ma-fe)</option>
              </select>
              {resolutionType && (
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900 p-2 rounded">
                  {resolutionType === 'RELEASE_TO_BUYER' && 'A cripto sera transferida para a carteira do pagador do PIX.'}
                  {resolutionType === 'RETURN_TO_SELLER' && 'A cripto sera desbloqueada e devolvida ao vendedor.'}
                  {resolutionType === 'CANCEL_NO_PENALTY' && 'A cripto sera desbloqueada para o vendedor. Nenhuma penalidade.'}
                  {resolutionType === 'PENALTY_BUYER' && 'Cripto devolvida ao vendedor + penalidade ao comprador.'}
                  {resolutionType === 'PENALTY_SELLER' && 'Cripto liberada ao comprador + penalidade ao vendedor.'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Resolução (mínimo 20 caracteres)
              </label>
              <textarea
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Descreva a decisão e justificativa..."
                rows={6}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {resolutionText.length} caracteres
              </p>
            </div>

            <button
              onClick={handleResolve}
              disabled={resolving || !resolutionType || resolutionText.length < 20}
              className={`w-full py-3 px-4 rounded-lg font-medium transition ${
                resolving || !resolutionType || resolutionText.length < 20
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {resolving ? 'Resolvendo...' : 'Resolver Disputa'}
            </button>
          </div>
        </div>
      )}

      {/* Messages Thread */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow" style={{ minHeight: '500px', maxHeight: '700px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="bg-gray-100 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600">
          {/* Staff: abas para cada parte */}
          {isStaff() && disputeParties.length >= 2 ? (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Chat Privado com cada parte
              </h2>
              <div className="flex gap-1">
                {disputeParties.map((party) => (
                  <button
                    key={party.id}
                    onClick={() => setActiveTab(party.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                      activeTab === party.id
                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {party.name}
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                      ({party.role})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Histórico de Mensagens
            </h2>
          )}
        </div>
        <DisputeMessageThread
          messages={isStaff() ? filteredMessages : (dispute.messages || [])}
          currentUserId={currentUserId}
          onSendMessage={canSendMessages() ? handleSendMessage : undefined}
          canSendMessages={canSendMessages()}
          visibleTo={isStaff() && activeTab ? activeTab : undefined}
        />
      </div>

      {/* Info Footer */}
      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 text-center">
        Disputa criada em {new Date(dispute.createdAt).toLocaleString('pt-BR')} por {dispute.creator.name}
      </div>
    </div>
  );
}
