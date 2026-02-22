'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dispute, STATUS_LABELS, CATEGORY_LABELS } from '@/types/dispute';
import AppHeader from '@/components/AppHeader';

function getParties(dispute: Dispute) {
  const order = dispute.order;
  const creatorId = dispute.createdBy;
  const creatorName = dispute.creator.name || 'Usuario';
  const isBuy = order.orderType === 'BUY';

  const orderOwnerName = order.user?.name || 'Usuario';
  const payerName = order.transactions?.[0]?.payer?.name || 'Usuario';
  const providerName = order.providerName || 'Provedor';

  let creatorRole: string;
  let counterpartyName: string;
  let counterpartyRole: string;

  if (creatorId === order.userId) {
    // Creator da disputa = dono da ordem
    creatorRole = isBuy ? 'Comprador' : 'Vendedor';
    if (isBuy) {
      counterpartyName = providerName;
      counterpartyRole = 'Provedor';
    } else {
      counterpartyName = payerName;
      counterpartyRole = 'Comprador';
    }
  } else if (creatorId === order.providerId) {
    // Creator da disputa = provider (BUY orders)
    creatorRole = 'Provedor';
    counterpartyName = orderOwnerName;
    counterpartyRole = 'Comprador';
  } else {
    // Creator da disputa = payer/comprador
    creatorRole = 'Comprador';
    counterpartyName = orderOwnerName;
    counterpartyRole = isBuy ? 'Comprador' : 'Vendedor';
  }

  return { creatorName, creatorRole, counterpartyName, counterpartyRole };
}

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

      const res = await fetch('http://localhost:3002/api/v1/disputes/my-disputes', {
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
      <>
        <AppHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando disputas...</div>
        </div>
      </>
    );
  }

  return (
    <>
    <AppHeader />
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
            Voce nao tem nenhuma disputa aberta
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const parties = getParties(dispute);
            const messageCount = (dispute as any)._count?.messages ?? dispute.messages?.length ?? 0;

            return (
              <div
                key={dispute.id}
                onClick={() => router.push(`/disputes/${dispute.id}`)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6"
              >
                {/* Cabecalho */}
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
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ml-3 ${getStatusColor(
                      dispute.status
                    )}`}
                  >
                    {STATUS_LABELS[dispute.status as keyof typeof STATUS_LABELS]}
                  </span>
                </div>

                {/* Info do pedido + partes */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 mb-4 space-y-2">
                  {/* Partes envolvidas */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Aberta por: </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {parties.creatorName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                        ({parties.creatorRole})
                      </span>
                    </div>
                    <span className="hidden sm:inline text-gray-400">→</span>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Contra: </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {parties.counterpartyName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                        ({parties.counterpartyRole})
                      </span>
                    </div>
                  </div>

                  {/* Pedido e valor */}
                  <div className="flex items-center gap-4 text-sm border-t border-gray-200 dark:border-gray-700 pt-2">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Pedido: </span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        #{dispute.order.id.substring(0, 8)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Valor: </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        R$ {parseFloat(dispute.order.brlAmount).toFixed(2)}
                      </span>
                    </div>
                    {dispute.order.orderType && (
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          dispute.order.orderType === 'BUY'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                        }`}>
                          {dispute.order.orderType === 'BUY' ? 'Compra' : 'Venda'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {messageCount} mensagens
                  </span>
                  <span className="text-gray-500 dark:text-gray-500">
                    {new Date(dispute.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
