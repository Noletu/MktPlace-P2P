'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PresenceBadge from '@/components/PresenceBadge';
import { formatBRL } from '@/utils/formatters';
import ThemeToggle from '@/components/ThemeToggle';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';
import { Star, ExternalLink, AlertTriangle } from 'lucide-react';
import CancellationBadge from '@/components/CancellationBadge';

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
  user: {
    id: string;
    name: string;
    email: string;
    reputationScore: number;
    totalTransactions: number;
    successfulTransactions: number;
    totalCancellations: number;
    recentCancellations: number;
  };
}

export default function OrderPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, [orderId]);

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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/orders/${orderId}`, {
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/orders/${orderId}/match`, {
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
                  <h3 className="font-bold mb-4 text-gray-900 dark:text-white">Informações do Vendedor</h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-lg text-gray-900 dark:text-white">{order.user.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="fill-yellow-400 text-yellow-400" size={16} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {order.user.reputationScore}/100
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/user/${order.user.id}`)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        Ver Perfil
                        <ExternalLink size={16} />
                      </button>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600 dark:text-gray-400">
                        <strong>Transações:</strong> {order.user.totalTransactions}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        <strong>Bem-sucedidas:</strong> {order.user.successfulTransactions}
                      </p>
                      {order.user.totalTransactions > 0 && (
                        <p className="text-gray-600 dark:text-gray-400">
                          <strong>Taxa de sucesso:</strong>{' '}
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {Math.round((order.user.successfulTransactions / order.user.totalTransactions) * 100)}%
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Badge de Cancelamentos (se houver) */}
                    {order.user.recentCancellations > 0 && (
                      <div className="mt-3">
                        <CancellationBadge
                          recentCancellations={order.user.recentCancellations}
                          totalCancellations={order.user.totalCancellations}
                          className="w-full justify-center"
                        />
                      </div>
                    )}

                    {/* Warning adicional para muitos cancelamentos */}
                    {order.user.recentCancellations >= 3 && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={18} />
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Atenção:</strong> Este vendedor tem histórico de cancelamentos recentes. Recomendamos verificar o perfil completo antes de aceitar.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        💡 Clique em "Ver Perfil" para visualizar avaliações e histórico completo
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
      </div>
    </div>
  );
}
