'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Order {
  id: string;
  type: string;
  cryptoType: string;
  cryptoAmount: string;
  brlAmount: string;
  status: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  MATCHED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  IN_NEGOTIATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  PAYMENT_SENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  VALIDATING: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  DISPUTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const statusLabels: Record<string, string> = {
  PENDING: '⏳ Pendente',
  MATCHED: '🤝 Pareado',
  IN_NEGOTIATION: '💬 Negociando',
  PAYMENT_SENT: '💸 Pag. Enviado',
  VALIDATING: '🔍 Validando',
  COMPLETED: '✅ Concluído',
  CANCELLED: '❌ Cancelado',
  DISPUTED: '⚠️ Disputado',
};

export default function ActiveOrdersCard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveOrders();
  }, []);

  const fetchActiveOrders = async () => {
    try {
      setLoading(true);
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/orders/my-orders');
      const allOrders = Array.isArray(data.data) ? data.data : [];

      // Filtrar apenas pedidos ativos (não concluídos, cancelados ou disputados)
      const activeStatuses = ['PENDING', 'MATCHED', 'IN_NEGOTIATION', 'PAYMENT_SENT', 'VALIDATING'];
      const activeOrders = allOrders.filter((order: Order) => activeStatuses.includes(order.status));

      setOrders(activeOrders.slice(0, 5)); // Mostrar apenas 5 mais recentes
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
      setError('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const formatBRL = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewOrder = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  const handleViewAllOrders = () => {
    router.push('/orders/my-orders');
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📦 Pedidos Ativos</h3>
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📦 Pedidos Ativos</h3>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">📦 Pedidos Ativos</h3>
        {orders.length > 0 && (
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-full text-xs font-semibold">
            {orders.length}
          </span>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Você não tem pedidos ativos no momento
          </p>
          <button
            onClick={() => router.push('/orders/create')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Criar Primeiro Pedido
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleViewOrder(order.id)}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {order.cryptoAmount} {order.cryptoType}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatBRL(order.brlAmount)}
                  </p>
                  <button className="text-blue-600 dark:text-blue-400 text-sm hover:underline">
                    Ver Detalhes →
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleViewAllOrders}
            className="w-full mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            Ver Todos os Pedidos →
          </button>
        </>
      )}
    </div>
  );
}
