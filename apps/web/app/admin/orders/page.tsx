'use client';

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import { formatBRL } from '@/utils/formatters';

interface Order {
  id: string;
  type: string;
  cryptoType: string;
  cryptoAmount: string;
  fiatAmount: string;
  status: string;
  userId: string;
  user?: { email: string; name?: string };
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/admin/orders', {
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
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Tipo</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Crypto</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Valor</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-700/50 transition">
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{order.id.substring(0, 8)}...</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={order.type}
                      variant={order.type === 'BUY' ? 'success' : 'warning'}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{order.cryptoType}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{order.cryptoAmount}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-green-400">
                      {formatBRL(order.fiatAmount)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={order.status} variant={getStatusVariant(order.status)} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </span>
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
    </div>
  );
}
