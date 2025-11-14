'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBRL } from '@/utils/formatters';
import { useChats } from '@/hooks/useChats';
import AppHeader from '@/components/AppHeader';

interface Order {
  id: string;
  type: string;
  status: string;
  cryptoType: string;
  cryptoNetwork: string;
  cryptoAmount: string;
  brlAmount: string;
  createdAt: string;
  timeoutAt: string;
  ownerOnline: boolean;
  ownerLastSeenAt: string;
  transactions: any[];
  orderData?: string | {
    barcode?: string;
    pixKey?: string;
    [key: string]: any;
  };
}

export default function MyOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ACTIVE');
  const { getUnreadCountByOrderId } = useChats();

  useEffect(() => {
    fetchOrders();
  }, []);

  // Heartbeat automático para pedidos online
  useEffect(() => {
    const onlineOrders = orders.filter(
      o => o.ownerOnline && ['PENDING', 'IN_NEGOTIATION'].includes(o.status)
    );

    if (onlineOrders.length === 0) return;

    const interval = setInterval(async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      // Enviar heartbeat para cada pedido online
      for (const order of onlineOrders) {
        try {
          await fetch(`http://localhost:3001/api/v1/presence/orders/${order.id}/heartbeat`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        } catch (err) {
          console.error('Heartbeat failed for order:', order.id);
        }
      }
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [orders]);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/v1/orders/my-orders', {
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

  const handleTogglePresence = async (orderId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('Você precisa estar logado');
        return;
      }

      const response = await fetch(`http://localhost:3001/api/v1/presence/orders/${orderId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ online: !currentStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao alterar status');
      }

      // Atualizar lista de pedidos
      await fetchOrders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getTimeRemaining = (timeoutAt: string) => {
    const now = new Date().getTime();
    const timeout = new Date(timeoutAt).getTime();
    const diff = timeout - now;

    if (diff <= 0) return 'Expirado';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    return `${minutes}min`;
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE')
      return !['COMPLETED', 'CANCELLED', 'TIMEOUT'].includes(order.status);
    if (filter === 'COMPLETED') return order.status === 'COMPLETED';
    if (filter === 'CANCELLED') return order.status === 'CANCELLED';
    return true;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
      MATCHED: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
      PAYMENT_SENT: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
      VALIDATING: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
      COMPLETED: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
      DISPUTED: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
      CANCELLED: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      TIMEOUT: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    };
    return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      PENDING: 'Aguardando Match',
      MATCHED: 'Match Realizado',
      PAYMENT_SENT: 'Pagamento Enviado',
      VALIDATING: 'Validando',
      COMPLETED: 'Concluído',
      DISPUTED: 'Em Disputa',
      CANCELLED: 'Cancelado',
      TIMEOUT: 'Timeout',
    };
    return texts[status] || status;
  };

  const getPaymentMethod = (order: Order): 'PIX' | 'BOLETO' => {
    try {
      // Se orderData for string, fazer parse
      const data = typeof order.orderData === 'string'
        ? JSON.parse(order.orderData)
        : order.orderData;

      if (data?.pixKey) return 'PIX';
      if (data?.barcode) return 'BOLETO';
    } catch (e) {
      console.error('Error parsing orderData:', e);
    }

    // Fallback para tipo de pedido antigo
    return order.type === 'PIX' ? 'PIX' : 'BOLETO';
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
          <h1 className="text-3xl font-bold dark:text-white">Meus Pedidos</h1>
          <button
            onClick={() => router.push('/orders/create')}
            className="px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg"
          >
            + Novo Pedido
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Todos ({orders.length})
            </button>
            <button
              onClick={() => setFilter('ACTIVE')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'ACTIVE' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Ativos (
              {orders.filter((o) => !['COMPLETED', 'CANCELLED', 'TIMEOUT'].includes(o.status)).length}
              )
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'COMPLETED' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Concluídos ({orders.filter((o) => o.status === 'COMPLETED').length})
            </button>
            <button
              onClick={() => setFilter('CANCELLED')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'CANCELLED' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Cancelados ({orders.filter((o) => o.status === 'CANCELLED').length})
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Lista de Pedidos */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">Você ainda não criou nenhum pedido.</p>
            <button
              onClick={() => router.push('/orders/create')}
              className="px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg"
            >
              Criar Primeiro Pedido
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const unreadCount = getUnreadCountByOrderId(order.id);

              return (
                <div
                  key={order.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                            getPaymentMethod(order) === 'PIX'
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                          }`}
                        >
                          {getPaymentMethod(order)}
                        </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {getStatusText(order.status)}
                        </span>
                        {unreadCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300">
                            💬 {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Valor em BRL</p>
                        <p className="text-lg font-bold dark:text-gray-200">{formatBRL(order.brlAmount)}</p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Crypto</p>
                        <p className="text-lg font-semibold dark:text-gray-200">
                          {parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Rede</p>
                        <p className="text-sm font-semibold dark:text-gray-200">{order.cryptoNetwork}</p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Criado em</p>
                        <p className="text-sm dark:text-gray-300">
                          {new Date(order.createdAt).toLocaleDateString()} às{' '}
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </p>
                      </div>

                      {/* Mostrar tempo de expiração para pedidos ativos */}
                      {['PENDING', 'MATCHED'].includes(order.status) && order.timeoutAt && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Expira em</p>
                          <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            ⏱️ {getTimeRemaining(order.timeoutAt)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Toggle de Presença - Apenas para pedidos PENDING ou IN_NEGOTIATION */}
                    {['PENDING', 'IN_NEGOTIATION'].includes(order.status) && (
                      <div
                        className="mt-4 pt-4 border-t dark:border-gray-700"
                        onClick={(e) => e.stopPropagation()} // Prevenir navegação ao clicar no toggle
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                              Disponível para negociar:
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {order.ownerOnline ? (
                                <span className="text-green-600 dark:text-green-400">🟢 ONLINE - Ativo agora</span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">⚫ OFFLINE - há {getTimeAgo(order.ownerLastSeenAt)}</span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => handleTogglePresence(order.id, order.ownerOnline)}
                            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
                              order.ownerOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                order.ownerOnline ? 'translate-x-9' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}

                    {order.transactions.length > 0 && (
                      <div className="mt-4 pt-4 border-t dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {order.transactions.length} transação(ões) associada(s)
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <svg
                      className="w-6 h-6 text-gray-400 dark:text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
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
