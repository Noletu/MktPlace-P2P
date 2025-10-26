'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dispute, STATUS_LABELS, CATEGORY_LABELS } from '@/types/dispute';

export default function DisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('http://localhost:3001/api/v1/disputes/my-disputes', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setDisputes(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar disputas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'UNDER_REVIEW':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'RESOLVED_BUYER':
      case 'RESOLVED_SELLER':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Carregando disputas...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/dashboard')}
        className="text-blue-600 dark:text-blue-400 hover:underline mb-4 flex items-center gap-1"
      >
        ← Voltar para o Dashboard
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Minhas Disputas
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Acompanhe o status das suas disputas abertas
        </p>
      </div>

      {/* Lista de disputas */}
      {disputes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Você não tem nenhuma disputa aberta
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <div
              key={dispute.id}
              onClick={() => router.push(`/disputes/${dispute.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6"
            >
              {/* Cabeçalho */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {dispute.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {CATEGORY_LABELS[dispute.category as keyof typeof CATEGORY_LABELS]}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                    dispute.status
                  )}`}
                >
                  {STATUS_LABELS[dispute.status as keyof typeof STATUS_LABELS]}
                </span>
              </div>

              {/* Info do pedido */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 mb-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Pedido:</span>
                    <span className="ml-2 font-mono text-gray-900 dark:text-white">
                      #{dispute.order.id.substring(0, 8)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Valor:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                      R$ {parseFloat(dispute.order.brlAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {dispute.messages?.length || 0} mensagens
                </span>
                <span className="text-gray-500 dark:text-gray-500">
                  {new Date(dispute.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
