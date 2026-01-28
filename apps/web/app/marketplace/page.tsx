'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';
import { formatBRL } from '@/utils/formatters';
import PresenceBadge from '@/components/PresenceBadge';
import AppHeader from '@/components/AppHeader';

interface Order {
  id: string;
  orderType: string; // 'SELL' or 'BUY'
  type: string; // Payment method: 'PIX' or 'BOLETO'
  status: string;
  cryptoType: string;
  cryptoNetwork: string;
  cryptoAmount: string;
  brlAmount: string;
  platformFee: string;
  payerReward: string;
  totalFee: string;
  createdAt: string;
  timeoutAt: string;
  ownerOnline: boolean;
  ownerLastSeenAt: string;
  negotiatingUserId?: string;
  user: {
    id: string;
    name: string;
    reputationScore: number;
    totalTransactions: number;
    successfulTransactions: number;
  };
}

export default function MarketplacePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PIX' | 'BOLETO'>('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'ALL' | 'SELL' | 'BUY'>('ALL');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Buscar ordens quando o filtro de tipo mudar
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Atualizar a cada 10s
    return () => clearInterval(interval);
  }, [orderTypeFilter]);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.data.id);
      }
    } catch (err) {
      console.error('Erro ao buscar usuário atual:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Voce precisa fazer login para ver o marketplace');
        setLoading(false);
        return;
      }

      // Passar filtro de tipo de ordem para a API
      const typeParam = orderTypeFilter !== 'ALL' ? `?type=${orderTypeFilter}` : '';
      const response = await fetch(`http://localhost:3001/api/v1/orders/marketplace${typeParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar pedidos');
      }

      const data = await response.json();
      setOrders(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMore = (orderId: string) => {
    router.push(`/orders/${orderId}/preview`);
  };

  // Filtrar por metodo de pagamento (PIX/BOLETO) - so se aplica a SELL orders
  const filteredOrders = orders.filter((order) => {
    // BUY orders nao tem metodo de pagamento definido ate serem aceitas
    if (order.orderType === 'BUY') {
      return paymentFilter === 'ALL'; // BUY orders so aparecem no "Todos"
    }
    if (paymentFilter === 'ALL') return true;
    // Para SELL orders, o type e PIX ou BOLETO
    return order.type === paymentFilter;
  });

  const getTimeRemaining = (timeoutAt: string) => {
    const now = new Date().getTime();
    const timeout = new Date(timeoutAt).getTime();
    const diff = timeout - now;

    if (diff <= 0) return 'Expirado';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl dark:text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 dark:text-white">Marketplace</h1>
            <p className="text-gray-600 dark:text-gray-300">Aceite pedidos e ganhe cripto pagando contas!</p>
          </div>
          <button
            onClick={() => router.push('/orders/create')}
            className="px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg"
          >
            + Criar Pedido
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          {/* Filtro por Tipo de Ordem: SELL/BUY */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Ordem:</p>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderTypeFilter('ALL')}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  orderTypeFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setOrderTypeFilter('SELL')}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  orderTypeFilter === 'SELL' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Vendendo Cripto
              </button>
              <button
                onClick={() => setOrderTypeFilter('BUY')}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  orderTypeFilter === 'BUY' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Comprando Cripto
              </button>
            </div>
          </div>

          {/* Filtro por Metodo de Pagamento (so para SELL orders) */}
          {orderTypeFilter !== 'BUY' && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metodo de Pagamento:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentFilter('ALL')}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    paymentFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Todos ({orders.length})
                </button>
                <button
                  onClick={() => setPaymentFilter('PIX')}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    paymentFilter === 'PIX' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  PIX ({orders.filter((o) => o.type === 'PIX').length})
                </button>
                <button
                  onClick={() => setPaymentFilter('BOLETO')}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    paymentFilter === 'BOLETO' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Boleto ({orders.filter((o) => o.type === 'BOLETO').length})
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Lista de Pedidos */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">Nenhum pedido disponível no momento.</p>
            <button
              onClick={() => router.push('/orders/create')}
              className="px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg"
            >
              Criar Primeiro Pedido
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => {
              const isOwnOrder = currentUserId && order.user.id === currentUserId;
              const isInNegotiationWithOther = order.status === 'IN_NEGOTIATION' && order.negotiatingUserId !== currentUserId;
              const isBuyOrder = order.orderType === 'BUY';

              return (
                <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${isOwnOrder ? 'border-2 border-red-200 dark:border-red-800' : ''} ${isBuyOrder ? 'border-l-4 border-l-blue-500' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-2">
                      {isBuyOrder ? (
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                          QUER COMPRAR
                        </span>
                      ) : (
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                            order.type === 'PIX'
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                              : 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300'
                          }`}
                        >
                          {order.type}
                        </span>
                      )}
                      {isOwnOrder && (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300">
                          SEU PEDIDO
                        </span>
                      )}
                      {isInNegotiationWithOther && (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300">
                          EM NEGOCIACAO
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Expira em</p>
                      <p className="text-sm font-semibold dark:text-gray-200">{getTimeRemaining(order.timeoutAt)}</p>
                    </div>
                  </div>

                  {/* Presence Badge */}
                  <div className="mb-4">
                    <PresenceBadge
                      online={order.ownerOnline}
                      lastSeenAt={order.ownerLastSeenAt}
                      size="small"
                    />
                  </div>

                {/* Conteudo diferente para BUY vs SELL orders */}
                {isBuyOrder ? (
                  <>
                    {/* BUY ORDER: Usuario quer comprar cripto */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Quer comprar</p>
                      <div className="flex items-center gap-2">
                        <CryptoIcon crypto={order.cryptoType as CryptoType} size={28} />
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Rede: {order.cryptoNetwork}
                      </p>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Voce recebera</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatBRL(order.brlAmount)}</p>
                      <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
                        Via PIX (inclui ~1% lucro para voce)
                      </p>
                    </div>

                    <div className="mb-4 pb-4 border-b dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Comprador</p>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold dark:text-gray-200">{order.user.name || 'Anonimo'}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/user/${order.user.id}`);
                          }}
                          className="text-right hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg p-2 -m-2 transition-colors group"
                        >
                          <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            Score: {order.user.reputationScore}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {order.user.successfulTransactions}/{order.user.totalTransactions} sucesso
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver perfil
                          </p>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* SELL ORDER: Usuario vende cripto (fluxo original) */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Valor do Pagamento</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatBRL(order.brlAmount)}</p>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Voce recebera</p>
                      <div className="flex items-center gap-2">
                        <CryptoIcon crypto={order.cryptoType as CryptoType} size={28} />
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                          {(parseFloat(order.cryptoAmount) + parseFloat(order.payerReward || '0')).toFixed(8)} {order.cryptoType}
                        </p>
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
                        Inclui +{parseFloat(order.payerReward || '0').toFixed(8)} de cashback (1%)
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Rede: {order.cryptoNetwork}
                      </p>
                    </div>

                    <div className="mb-4 pb-4 border-b dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Vendedor</p>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold dark:text-gray-200">{order.user.name || 'Anonimo'}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/user/${order.user.id}`);
                          }}
                          className="text-right hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg p-2 -m-2 transition-colors group"
                        >
                          <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            Score: {order.user.reputationScore}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {order.user.successfulTransactions}/{order.user.totalTransactions} sucesso
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver perfil
                          </p>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {isOwnOrder ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-400 dark:bg-gray-600 text-white font-semibold rounded-lg cursor-not-allowed"
                  >
                    Seu Pedido - Nao pode aceitar
                  </button>
                ) : isInNegotiationWithOther ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-400 dark:bg-gray-600 text-white font-semibold rounded-lg cursor-not-allowed"
                  >
                    Em Negociacao
                  </button>
                ) : (
                  <button
                    onClick={() => handleViewMore(order.id)}
                    className={`w-full py-3 px-4 font-semibold rounded-lg transition-colors ${
                      isBuyOrder
                        ? 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white'
                        : 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white'
                    }`}
                  >
                    {isBuyOrder ? 'Fornecer Liquidez' : 'Ver Mais'}
                  </button>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
