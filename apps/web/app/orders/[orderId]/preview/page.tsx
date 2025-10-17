'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ChatWindow from '@/components/chat/ChatWindow';
import PresenceBadge from '@/components/PresenceBadge';
import { formatBRL } from '@/utils/formatters';
import ThemeToggle from '@/components/ThemeToggle';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';

interface Order {
  id: string;
  type: string;
  status: string;
  cryptoType: string;
  cryptoNetwork: string;
  cryptoAmount: string;
  brlAmount: string;
  platformFee: string;
  payerReward: string;
  totalFee: string;
  orderData: string;
  createdAt: string;
  timeoutAt: string;
  ownerOnline: boolean;
  ownerLastSeenAt: string;
  negotiatingUserId?: string;
  negotiationStartedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    reputationScore: number;
    totalTransactions: number;
    successfulTransactions: number;
  };
}

export default function OrderPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    fetchCurrentUser();
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, [orderId]);

  // Timer de negociação (10 minutos)
  useEffect(() => {
    console.log('Timer effect - order:', order);
    console.log('Timer effect - status:', order?.status);
    console.log('Timer effect - negotiationStartedAt:', order?.negotiationStartedAt);

    if (!order || order.status !== 'IN_NEGOTIATION' || !order.negotiationStartedAt) {
      console.log('Timer: conditions not met, setting to 0');
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const startTime = new Date(order.negotiationStartedAt!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000); // segundos
      const total = 10 * 60; // 10 minutos em segundos
      const remaining = Math.max(0, total - elapsed);
      console.log('Timer update:', { startTime, now, elapsed, remaining });
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [order]);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.data.id);
      }
    } catch (err) {
      console.error('Erro ao buscar usuário atual:', err);
    }
  };

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:3001/api/v1/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar pedido');
      }

      const data = await response.json();
      setOrder(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async () => {
    if (!confirm('Você confirma que deseja aceitar este pedido? O timer de 30 minutos iniciará agora.')) {
      return;
    }

    setAccepting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Você precisa estar logado');
      }

      const response = await fetch(`http://localhost:3001/api/v1/orders/${orderId}/match`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao aceitar pedido');
      }

      alert('✅ Pedido aceito! Timer de 30 minutos iniciado. Faça o pagamento agora.');
      router.push(`/orders/${orderId}`);
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Carregando...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Pedido não encontrado</div>
      </div>
    );
  }

  const orderData = JSON.parse(order.orderData);
  const paymentMethod = orderData.pixKey ? 'PIX' : 'BOLETO';
  const isOwnOrder = order.user.id === currentUserId;
  const isInNegotiationWithOther = order.status === 'IN_NEGOTIATION' && order.negotiatingUserId !== currentUserId;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Preview do Pedido</h1>
          <div className="flex gap-4">
            <ThemeToggle />
            <button
              onClick={() => router.push('/marketplace')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg"
            >
              ← Voltar ao Marketplace
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Warning: Own Order */}
        {isOwnOrder && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200 font-semibold">
              ⚠️ Este é seu próprio pedido. Você não pode aceitar.
            </p>
          </div>
        )}

        {/* Warning: In Negotiation */}
        {isInNegotiationWithOther && (
          <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-lg">
            <p className="text-orange-800 dark:text-orange-200 font-semibold">
              🔒 Este pedido está em negociação com outro usuário. Aguarde até ficar disponível novamente.
            </p>
          </div>
        )}

        {/* Timer de Negociação */}
        {order.status === 'IN_NEGOTIATION' && timeRemaining > 0 && (
          <div className="mb-6 p-6 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-800 dark:text-blue-200 font-semibold text-lg mb-1">
                  ⏱️ Negociação em Andamento
                </p>
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  Você tem tempo limitado para negociar e aceitar este pedido
                </p>
              </div>
              <div className="text-center ml-6">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">minutos restantes</p>
              </div>
            </div>
            {timeRemaining < 120 && (
              <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded text-center">
                <p className="text-red-700 dark:text-red-300 text-sm font-semibold">
                  ⚠️ Atenção! Menos de 2 minutos restantes
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                    {paymentMethod === 'PIX' ? 'Pagamento PIX' : 'Pagamento de Boleto'}
                  </h2>
                  <PresenceBadge
                    online={order.ownerOnline}
                    lastSeenAt={order.ownerLastSeenAt}
                    size="medium"
                  />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatBRL(order.brlAmount)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-bold mb-2 text-gray-900 dark:text-white">Dados do Pagamento</h3>
                  {paymentMethod === 'PIX' ? (
                    <>
                      <p className="text-gray-800 dark:text-gray-300"><strong>Tipo de Chave:</strong> {orderData.pixKeyType}</p>
                      <p className="text-gray-800 dark:text-gray-300"><strong>Chave PIX:</strong> {orderData.pixKey}</p>
                      <p className="text-gray-800 dark:text-gray-300"><strong>Beneficiário:</strong> {orderData.recipientName}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-800 dark:text-gray-300"><strong>Código de Barras:</strong></p>
                      <p className="font-mono text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded break-all">
                        {orderData.barcode}
                      </p>
                      <p className="text-gray-800 dark:text-gray-300"><strong>Vencimento:</strong> {new Date(orderData.dueDate).toLocaleDateString()}</p>
                      <p className="text-gray-800 dark:text-gray-300"><strong>Beneficiário:</strong> {orderData.recipientName}</p>
                    </>
                  )}
                </div>

                <div>
                  <h3 className="font-bold mb-2 text-gray-900 dark:text-white">Vendedor</h3>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-800 dark:text-gray-300"><strong>Nome:</strong> {order.user.name}</p>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Reputação: {order.user.reputationScore}/100
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {order.user.successfulTransactions}/{order.user.totalTransactions} transações bem-sucedidas
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Section */}
            {!isOwnOrder && !isInNegotiationWithOther && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">💬 Conversar com o Vendedor</h3>
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg"
                  >
                    {showChat ? 'Fechar Chat' : 'Abrir Chat'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Negocie e confirme que ambos estão online antes de aceitar o pedido.
                  <strong className="text-orange-600 dark:text-orange-400"> Ao enviar a primeira mensagem, o pedido ficará reservado por 10 minutos.</strong>
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="font-bold mb-4 text-gray-900 dark:text-white">Resumo</h3>
              <div className="space-y-3">
                <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
                  <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold mb-1">💸 VOCÊ PAGARÁ:</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {formatBRL(order.brlAmount)}
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Via {paymentMethod}
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
                  <p className="text-xs text-green-700 dark:text-green-300 font-semibold mb-1">💰 VOCÊ RECEBERÁ:</p>
                  <div className="flex items-center gap-2">
                    <CryptoIcon crypto={order.cryptoType as CryptoType} size={24} />
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {(parseFloat(order.cryptoAmount) + parseFloat(order.payerReward)).toFixed(8)}
                    </p>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {order.cryptoType} ({order.cryptoNetwork})
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 font-semibold mt-2">
                    ✨ Inclui +{parseFloat(order.payerReward).toFixed(8)} de cashback (1%)
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="font-bold mb-4 text-gray-900 dark:text-white">Ação</h3>
              {isOwnOrder ? (
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-400 dark:bg-gray-600 text-white font-semibold rounded-lg cursor-not-allowed"
                >
                  Seu Pedido - Não pode aceitar
                </button>
              ) : isInNegotiationWithOther ? (
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-400 dark:bg-gray-600 text-white font-semibold rounded-lg cursor-not-allowed"
                >
                  🔒 Em Negociação com Outro Usuário
                </button>
              ) : (
                <>
                  <button
                    onClick={handleAcceptOrder}
                    disabled={accepting}
                    className="w-full py-3 px-4 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg disabled:opacity-50 mb-3"
                  >
                    {accepting ? 'Aceitando...' : '✅ Aceitar Pedido'}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Timer de 30 minutos iniciará após aceitar
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat Modal */}
        {showChat && !isChatMinimized && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl h-[600px]">
              <ChatWindow
                orderId={orderId}
                onClose={() => setShowChat(false)}
                onMinimize={() => setIsChatMinimized(true)}
              />
            </div>
          </div>
        )}

        {/* Chat Minimized */}
        {showChat && isChatMinimized && (
          <div className="fixed bottom-4 right-4 z-50">
            <button
              onClick={() => setIsChatMinimized(false)}
              className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 transition-all hover:scale-105"
            >
              <span className="text-2xl">💬</span>
              <div className="text-left">
                <p className="font-bold text-sm">Chat</p>
                <p className="text-xs">Clique para expandir</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
