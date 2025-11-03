'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface OrderStats {
  inProgress: number;
  awaitingPayment: number;
  disputed: number;
  total: number;
}

interface DisputeStats {
  inProgress: number;
  concluded: number;
  total: number;
}

export default function ActiveOrdersCard() {
  const router = useRouter();
  const [stats, setStats] = useState<OrderStats>({
    inProgress: 0,
    awaitingPayment: 0,
    disputed: 0,
    total: 0,
  });
  const [disputeStats, setDisputeStats] = useState<DisputeStats>({
    inProgress: 0,
    concluded: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      // Fetch orders
      const ordersResponse = await fetch('http://localhost:3001/api/v1/orders/my-orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const ordersData = await ordersResponse.json();

      if (ordersData.success && ordersData.data) {
        const orders = ordersData.data;

        const inProgress = orders.filter((o: any) =>
          ['MATCHED', 'PAYMENT_SENT', 'VALIDATING', 'IN_NEGOTIATION'].includes(o.status)
        ).length;

        const awaitingPayment = orders.filter((o: any) =>
          o.status === 'PENDING'
        ).length;

        const disputed = orders.filter((o: any) =>
          o.status === 'DISPUTED'
        ).length;

        setStats({
          inProgress,
          awaitingPayment,
          disputed,
          total: orders.length,
        });
      }

      // Fetch disputes
      const disputesResponse = await fetch('http://localhost:3001/api/v1/disputes/my-disputes', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const disputesData = await disputesResponse.json();

      if (disputesData.success && disputesData.data) {
        const disputes = disputesData.data;

        const inProgressDisputes = disputes.filter((d: any) =>
          ['OPEN', 'UNDER_REVIEW'].includes(d.status)
        ).length;

        const concludedDisputes = disputes.filter((d: any) =>
          ['RESOLVED_BUYER', 'RESOLVED_SELLER', 'CANCELLED'].includes(d.status)
        ).length;

        setDisputeStats({
          inProgress: inProgressDisputes,
          concluded: concludedDisputes,
          total: disputes.length,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
          <div className="space-y-3 mb-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
          <div className="space-y-3 mb-6">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xl">📊</span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Pedidos & Disputas
        </h3>
      </div>

      {stats.total === 0 && disputeStats.total === 0 ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📦</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Você ainda não tem pedidos
          </p>
          <button
            onClick={() => router.push('/orders/create')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            Criar Primeiro Pedido
          </button>
        </div>
      ) : (
        <>
          {/* SEÇÃO: PEDIDOS */}
          <div className="mb-4">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Pedidos
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 dark:text-blue-400">⏳</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Em andamento
                  </span>
                </div>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {stats.inProgress}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400">⏱️</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Aguardando match
                  </span>
                </div>
                <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.awaitingPayment}
                </span>
              </div>

              {stats.disputed > 0 && (
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 dark:text-red-400 animate-pulse">⚠️</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Em disputa
                    </span>
                  </div>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                    {stats.disputed}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* DIVIDER */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

          {/* SEÇÃO: DISPUTAS */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Disputas
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-orange-600 dark:text-orange-400">🔍</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Em análise
                  </span>
                </div>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {disputeStats.inProgress}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✅</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Concluídas
                  </span>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {disputeStats.concluded}
                </span>
              </div>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/orders/my-orders')}
              className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Ver Pedidos ({stats.total})
            </button>
            <button
              onClick={() => router.push('/disputes')}
              className="py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
            >
              Disputas ({disputeStats.total})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
