'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Activity {
  type: string;
  date: string;
  status: string;
  amount: string;
  crypto: string;
  orderId: string;
  transactionId?: string;
  description: string;
}

export default function RecentActivityCard() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentActivity();
  }, []);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/v1/transactions/timeline?limit=10', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar atividades');
      }

      const data = await response.json();
      setActivities(data.data || []);
    } catch (err) {
      console.error('Erro ao buscar atividades:', err);
      setError('Erro ao carregar atividades');
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      ORDER_CREATED: '📝',
      ORDER_MATCHED: '🤝',
      PAYMENT_SENT: '💸',
      PAYMENT_VALIDATED: '✅',
      ORDER_COMPLETED: '🎉',
      ORDER_CANCELLED: '❌',
      DEPOSIT: '⬇️',
      WITHDRAWAL: '⬆️',
      REVIEW_RECEIVED: '⭐',
      DISPUTE_OPENED: '⚠️',
    };
    return icons[type] || '📌';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'text-green-600 dark:text-green-400',
      PENDING: 'text-yellow-600 dark:text-yellow-400',
      APPROVED: 'text-green-600 dark:text-green-400',
      CANCELLED: 'text-red-600 dark:text-red-400',
      REJECTED: 'text-red-600 dark:text-red-400',
    };
    return colors[status] || 'text-gray-600 dark:text-gray-400';
  };

  const handleViewOrder = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Atividades Recentes</h3>
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Atividades Recentes</h3>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">📊 Atividades Recentes</h3>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhuma atividade recente
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activities.map((activity, index) => (
            <div
              key={`${activity.orderId}-${index}`}
              onClick={() => activity.orderId && handleViewOrder(activity.orderId)}
              className={`p-3 bg-gray-50 dark:bg-gray-700 rounded-lg ${
                activity.orderId ? 'hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer' : ''
              } transition-colors`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {activity.description}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
                      {formatDate(activity.date)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className={`text-xs font-semibold ${getStatusColor(activity.status)}`}>
                      {activity.status}
                    </p>
                    {activity.amount && (
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatBRL(activity.amount)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => router.push('/transactions')}
        className="w-full mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
      >
        Ver Histórico Completo →
      </button>
    </div>
  );
}
