'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Order {
  id: string;
  status: string;
  createdAt: string;
}

interface Dispute {
  id: string;
  status: string;
  createdAt: string;
}

interface OrderMetrics {
  open: number;
  completed: number;
  cancelled: number;
  total: number;
}

interface DisputeMetrics {
  open: number;
  underReview: number;
  resolved: number;
  total: number;
}

export default function ActiveOrdersCard() {
  const router = useRouter();
  const [orderMetrics, setOrderMetrics] = useState<OrderMetrics>({
    open: 0,
    completed: 0,
    cancelled: 0,
    total: 0,
  });
  const [disputeMetrics, setDisputeMetrics] = useState<DisputeMetrics>({
    open: 0,
    underReview: 0,
    resolved: 0,
    total: 0,
  });
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 15 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, [selectedPeriod]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const { apiGet } = await import('@/utils/api');

      // Filtro de data
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - selectedPeriod);

      // Buscar pedidos
      const ordersData = await apiGet('/orders/my-orders');
      const allOrders: Order[] = Array.isArray(ordersData.data) ? ordersData.data : [];

      const filteredOrders = allOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= dateFrom;
      });

      // Calcular métricas de pedidos
      const openCount = filteredOrders.filter((order) =>
        ['PENDING', 'MATCHED', 'IN_NEGOTIATION', 'PAYMENT_SENT', 'VALIDATING'].includes(order.status)
      ).length;

      const completedCount = filteredOrders.filter((order) =>
        order.status === 'COMPLETED'
      ).length;

      const cancelledCount = filteredOrders.filter((order) =>
        order.status === 'CANCELLED'
      ).length;

      setOrderMetrics({
        open: openCount,
        completed: completedCount,
        cancelled: cancelledCount,
        total: filteredOrders.length,
      });

      // Buscar disputas
      try {
        const disputesData = await apiGet('/disputes/my-disputes');
        const allDisputes: Dispute[] = Array.isArray(disputesData.data) ? disputesData.data : [];

        const filteredDisputes = allDisputes.filter((dispute) => {
          const disputeDate = new Date(dispute.createdAt);
          return disputeDate >= dateFrom;
        });

        // Calcular métricas de disputas
        const openDisputesCount = filteredDisputes.filter((d) => d.status === 'OPEN').length;
        const underReviewCount = filteredDisputes.filter((d) => d.status === 'UNDER_REVIEW').length;
        const resolvedCount = filteredDisputes.filter((d) =>
          ['RESOLVED_BUYER', 'RESOLVED_SELLER', 'CANCELLED'].includes(d.status)
        ).length;

        setDisputeMetrics({
          open: openDisputesCount,
          underReview: underReviewCount,
          resolved: resolvedCount,
          total: filteredDisputes.length,
        });
      } catch (disputeErr) {
        // Se não houver disputas ou erro, manter zeros
        console.log('Sem disputas ou erro ao buscar:', disputeErr);
        setDisputeMetrics({ open: 0, underReview: 0, resolved: 0, total: 0 });
      }

    } catch (err) {
      console.error('Erro ao buscar métricas:', err);
      setError('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAllOrders = () => {
    router.push('/orders/my-orders');
  };

  const handleViewAllDisputes = () => {
    router.push('/disputes');
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Resumo de Atividades</h3>
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Resumo de Atividades</h3>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const totalActivities = orderMetrics.total + disputeMetrics.total;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">📊 Resumo de Atividades</h3>
        {totalActivities > 0 && (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-semibold">
            {totalActivities} total
          </span>
        )}
      </div>

      {/* Filtro de período */}
      <div className="flex gap-2 mb-6">
        {[7, 15, 30, 90].map((days) => (
          <button
            key={days}
            onClick={() => setSelectedPeriod(days as 7 | 15 | 30 | 90)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              selectedPeriod === days
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {days}d
          </button>
        ))}
      </div>

      {totalActivities === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Nenhuma atividade nos últimos {selectedPeriod} dias
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            Crie seu primeiro pedido para começar a negociar
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
          {/* Seção PEDIDOS */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              📦 Pedidos
            </h4>
            <div className="grid grid-cols-3 gap-4 mb-3">
              {/* Pedidos em Aberto */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {orderMetrics.open}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  Em Aberto
                </div>
              </div>

              {/* Pedidos Concluídos */}
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {orderMetrics.completed}
                </div>
                <div className="text-xs text-green-700 dark:text-green-300 font-medium">
                  Concluídos
                </div>
              </div>

              {/* Pedidos Cancelados */}
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
                  {orderMetrics.cancelled}
                </div>
                <div className="text-xs text-red-700 dark:text-red-300 font-medium">
                  Cancelados
                </div>
              </div>
            </div>
            <button
              onClick={handleViewAllOrders}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Ver Todos os Pedidos →
            </button>
          </div>

          {/* Divisor */}
          <div className="border-t border-gray-200 dark:border-gray-700 mb-6"></div>

          {/* Seção DISPUTAS */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              ⚖️ Disputas
            </h4>
            <div className="grid grid-cols-3 gap-4 mb-3">
              {/* Disputas Abertas */}
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  {disputeMetrics.open}
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                  Abertas
                </div>
              </div>

              {/* Disputas Em Análise */}
              <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                  {disputeMetrics.underReview}
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                  Em Análise
                </div>
              </div>

              {/* Disputas Resolvidas */}
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {disputeMetrics.resolved}
                </div>
                <div className="text-xs text-green-700 dark:text-green-300 font-medium">
                  Resolvidas
                </div>
              </div>
            </div>
            <button
              onClick={handleViewAllDisputes}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Ver Todas as Disputas →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
