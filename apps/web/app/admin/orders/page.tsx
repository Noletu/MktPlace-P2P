'use client';

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import { formatBRL } from '@/utils/formatters';
import CancelOrderModal from '@/components/admin/modals/CancelOrderModal';
import EditOrderModal from '@/components/admin/modals/EditOrderModal';

interface Order {
  id: string;
  orderType: string; // 'SELL' or 'BUY'
  type: string; // Payment method: 'PIX' or 'BOLETO'
  cryptoType: string;
  cryptoAmount: string;
  brlAmount: string;
  status: string;
  userId: string;
  user?: { email: string; name?: string };
  createdAt: string;
  updatedAt?: string;
  platformFee?: string;
  payerReward?: string;
  totalFee?: string;
  appliedCouponCode?: string;
  appliedCouponDiscount?: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3002/api/v1/admin/orders', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchStatus = filterStatus === 'ALL' || order.status === filterStatus;
    const matchType = filterType === 'ALL' || order.type === filterType;
    return matchStatus && matchType;
  });

  const getStatusVariant = (status: string) => {
    if (status === 'COMPLETED') return 'success';
    if (status === 'CANCELLED' || status === 'EXPIRED') return 'danger';
    if (status === 'PENDING_PAYMENT') return 'warning';
    return 'info';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-700 dark:text-gray-300">Carregando pedidos...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Gerenciar Pedidos</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{orders.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Ativos</p>
          <p className="text-3xl font-bold text-blue-400 mt-2">
            {orders.filter(o => o.status === 'ACTIVE' || o.status === 'PENDING_PAYMENT').length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Completados</p>
          <p className="text-3xl font-bold text-green-400 mt-2">
            {orders.filter(o => o.status === 'COMPLETED').length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Cancelados</p>
          <p className="text-3xl font-bold text-red-400 mt-2">
            {orders.filter(o => o.status === 'CANCELLED').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-600 text-gray-900 dark:text-white rounded-lg"
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PENDING_PAYMENT">Aguardando Pagamento</option>
              <option value="COMPLETED">Completado</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="EXPIRED">Expirado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-600 text-gray-900 dark:text-white rounded-lg"
            >
              <option value="ALL">Todos</option>
              <option value="BUY">Compra</option>
              <option value="SELL">Venda</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Usuário</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Crypto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-700/50 transition">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{order.id.substring(0, 8)}...</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {order.user?.name || 'Sem nome'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {order.user?.email || 'N/A'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={order.orderType === 'BUY' ? 'COMPRA' : 'VENDA'}
                      variant={order.orderType === 'BUY' ? 'success' : 'warning'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{order.cryptoType}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{order.cryptoAmount}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-green-400">
                      {formatBRL(order.brlAmount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} variant={getStatusVariant(order.status)} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowViewModal(true);
                        }}
                        className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition"
                        title="Ver detalhes"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowEditModal(true);
                        }}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                        title="Editar pedido"
                      >
                        ✏️
                      </button>
                      {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowCancelModal(true);
                          }}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
                          title="Cancelar pedido"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Nenhum pedido encontrado</p>
          </div>
        )}
      </div>

      {/* Modais */}
      {showCancelModal && selectedOrder && (
        <CancelOrderModal
          order={selectedOrder}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            fetchOrders(); // Recarregar lista de pedidos
          }}
        />
      )}

      {showEditModal && selectedOrder && (
        <EditOrderModal
          order={selectedOrder}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            fetchOrders(); // Recarregar lista de pedidos
          }}
        />
      )}

      {/* Modal de Visualização */}
      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Detalhes do Pedido
              </h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedOrder(null);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* ID e Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ID do Pedido</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">{selectedOrder.id}</p>
                </div>
                <StatusBadge status={selectedOrder.status} variant={getStatusVariant(selectedOrder.status)} />
              </div>

              {/* Usuário */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Usuário</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedOrder.user?.name || 'Sem nome'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {selectedOrder.user?.email || 'N/A'}
                </p>
              </div>

              {/* Tipo e Crypto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tipo</p>
                  <StatusBadge
                    status={selectedOrder.orderType === 'BUY' ? 'COMPRA' : 'VENDA'}
                    variant={selectedOrder.orderType === 'BUY' ? 'success' : 'warning'}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Criptomoeda</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedOrder.cryptoType}</p>
                </div>
              </div>

              {/* Valores */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Valores</p>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Quantidade Crypto</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedOrder.cryptoAmount} {selectedOrder.cryptoType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Valor em BRL</span>
                  <span className="text-sm font-bold text-green-500">{formatBRL(selectedOrder.brlAmount)}</span>
                </div>
                {selectedOrder.platformFee && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Taxa da Plataforma</span>
                    <span className="text-sm text-gray-900 dark:text-white">{selectedOrder.platformFee} {selectedOrder.cryptoType}</span>
                  </div>
                )}
                {selectedOrder.payerReward && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Recompensa do Pagador</span>
                    <span className="text-sm text-gray-900 dark:text-white">{selectedOrder.payerReward} {selectedOrder.cryptoType}</span>
                  </div>
                )}
              </div>

              {/* Cupom (se aplicado) */}
              {selectedOrder.appliedCouponCode && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400">Cupom Aplicado</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-sm font-mono text-green-700 dark:text-green-300">{selectedOrder.appliedCouponCode}</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      -{selectedOrder.appliedCouponDiscount}%
                    </span>
                  </div>
                </div>
              )}

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Criado em</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedOrder.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                {selectedOrder.updatedAt && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Atualizado em</p>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(selectedOrder.updatedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Fechar
              </button>
              {selectedOrder.status !== 'CANCELLED' && selectedOrder.status !== 'COMPLETED' && (
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setShowCancelModal(true);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  ❌ Cancelar
                </button>
              )}
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setShowEditModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                ✏️ Editar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
