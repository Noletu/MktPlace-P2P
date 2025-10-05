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
  platformFee: string;
  payerReward: string;
  totalFee: string;
  createdAt: string;
  timeoutAt: string;
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
  const [filter, setFilter] = useState<'ALL' | 'PIX' | 'BOLETO'>('ALL');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Atualizar a cada 10s
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/orders/marketplace', {
        credentials: 'include', // SECURITY: Envia cookies HttpOnly
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

  const handleMatch = async (orderId: string) => {
    if (!confirm('Você confirma que deseja aceitar este pedido e realizar o pagamento?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/v1/orders/${orderId}/match`, {
        method: 'POST',
        credentials: 'include', // SECURITY: Envia cookies HttpOnly
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer match');
      }

      alert('Match realizado! Você pode agora efetuar o pagamento.');
      router.push(`/orders/${orderId}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'ALL') return true;
    return order.type === filter;
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
            <p className="text-gray-600">Aceite pedidos e ganhe cripto pagando contas!</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/orders/create')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
            >
              + Criar Pedido
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg"
            >
              Voltar
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
              onClick={() => setFilter('PIX')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'PIX' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              PIX ({orders.filter((o) => o.type === 'PIX').length})
            </button>
            <button
              onClick={() => setFilter('BOLETO')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                filter === 'BOLETO' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Boleto ({orders.filter((o) => o.type === 'BOLETO').length})
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
            <p className="text-gray-600 mb-4">Nenhum pedido disponível no momento.</p>
            <button
              onClick={() => router.push('/orders/create')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              Criar Primeiro Pedido
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        order.type === 'PIX'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {order.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Expira em</p>
                    <p className="text-sm font-semibold">{getTimeRemaining(order.timeoutAt)}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600">Valor do Pagamento</p>
                  <p className="text-3xl font-bold text-gray-900">R$ {parseFloat(order.brlAmount).toFixed(2)}</p>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600">Você receberá</p>
                  <p className="text-xl font-bold text-green-600">
                    {parseFloat(order.payerReward).toFixed(8)} {order.cryptoType}
                  </p>
                  <p className="text-xs text-gray-500">
                    Recompensa de 1% em {order.cryptoType} ({order.cryptoNetwork})
                  </p>
                </div>

                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-gray-600 mb-2">Vendedor</p>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{order.user.name || 'Anônimo'}</p>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Score: {order.user.reputationScore}
                      </p>
                      <p className="text-xs text-gray-500">
                        {order.user.successfulTransactions}/{order.user.totalTransactions} sucesso
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleMatch(order.id)}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Aceitar e Pagar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
