'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    fetchOrders();
  }, []);

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
      PENDING: 'bg-yellow-100 text-yellow-800',
      MATCHED: 'bg-blue-100 text-blue-800',
      PAYMENT_SENT: 'bg-purple-100 text-purple-800',
      VALIDATING: 'bg-orange-100 text-orange-800',
      COMPLETED: 'bg-green-100 text-green-800',
      DISPUTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
      TIMEOUT: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Meus Pedidos</h1>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/orders/create')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
            >
              + Novo Pedido
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg"
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Todos ({orders.length})
            </button>
            <button
              onClick={() => setFilter('ACTIVE')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'ACTIVE' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Ativos (
              {orders.filter((o) => !['COMPLETED', 'CANCELLED', 'TIMEOUT'].includes(o.status)).length}
              )
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'COMPLETED' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Concluídos ({orders.filter((o) => o.status === 'COMPLETED').length})
            </button>
            <button
              onClick={() => setFilter('CANCELLED')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'CANCELLED' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Cancelados ({orders.filter((o) => o.status === 'CANCELLED').length})
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Lista de Pedidos */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">Você ainda não criou nenhum pedido.</p>
            <button
              onClick={() => router.push('/orders/create')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              Criar Primeiro Pedido
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                          getPaymentMethod(order) === 'PIX'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
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
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-600">Valor em BRL</p>
                        <p className="text-lg font-bold">R$ {parseFloat(order.brlAmount).toFixed(2)}</p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">Crypto</p>
                        <p className="text-lg font-semibold">
                          {parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">Rede</p>
                        <p className="text-sm font-semibold">{order.cryptoNetwork}</p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">Criado em</p>
                        <p className="text-sm">
                          {new Date(order.createdAt).toLocaleDateString()} às{' '}
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {order.transactions.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-600">
                          {order.transactions.length} transação(ões) associada(s)
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <svg
                      className="w-6 h-6 text-gray-400"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
