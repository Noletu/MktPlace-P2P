'use client';

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import { formatBRL, formatCrypto } from '@/utils/formatters';
import { fetchWithAuth } from '@/utils/api';
import CancelOrderModal from '@/components/admin/modals/CancelOrderModal';
import EditOrderModal from '@/components/admin/modals/EditOrderModal';

interface UserInfo {
  id: string;
  email: string;
  name?: string | null;
}

interface TransactionInfo {
  id: string;
  status: string;
  payerId: string;
  payer?: UserInfo;
  comprovanteUrl?: string | null;
  comprovanteData?: string | null;
  validationScore?: number | null;
  validatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WalletInfo {
  id?: string;
  address: string;
  cryptoType?: string;
  network?: string;
}

interface Order {
  id: string;
  orderType: string; // 'SELL' or 'BUY'
  type: string; // Payment method: 'PIX' or 'BOLETO'
  cryptoType: string;
  cryptoNetwork?: string;
  cryptoAmount: string;
  brlAmount: string;
  fiatAmount: string; // alias for brlAmount used by modals
  status: string;
  userId: string;
  user?: UserInfo;
  providerId?: string | null;
  providerUser?: UserInfo | null;
  transactions?: TransactionInfo[];
  createdAt: string;
  updatedAt?: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  platformFee?: string;
  payerReward?: string;
  totalFee?: string;
  appliedCouponCode?: string;
  appliedCouponDiscount?: number;
  orderData?: string;
  wallet?: WalletInfo | null;
  providerWallet?: { address: string } | null;
  receiverWallet?: { address: string } | null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetchWithAuth('/admin/orders');
      const data = await res.json();
      if (data.success) setOrders(data.data.map((o: Order) => ({ ...o, fiatAmount: o.fiatAmount ?? o.brlAmount })));
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchStatus = filterStatus === 'ALL' || order.status === filterStatus;
    const matchType = filterType === 'ALL' || order.orderType === filterType;
    const matchSearch = !searchQuery || (() => {
      const q = searchQuery.toLowerCase();
      return order.id.toLowerCase().includes(q) ||
        (order.user?.name?.toLowerCase().includes(q) ?? false) ||
        (order.user?.email?.toLowerCase().includes(q) ?? false);
    })();
    return matchStatus && matchType && matchSearch;
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Buscar</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, email ou ID..."
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-600 text-gray-900 dark:text-white rounded-lg"
            />
          </div>
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
                    <span
                      className="text-xs font-mono text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-400"
                      title="Clique para copiar ID completo"
                      onClick={() => copyToClipboard(order.id, `table-${order.id}`)}
                    >
                      {copiedField === `table-${order.id}` ? '✓ Copiado' : `${order.id.substring(0, 8)}...`}
                    </span>
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
                      <p className="text-xs text-gray-600 dark:text-gray-400">{formatCrypto(order.cryptoAmount, order.cryptoType)}</p>
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
      {showViewModal && selectedOrder && (() => {
        const tx = selectedOrder.transactions?.[0];
        const isSell = selectedOrder.orderType === 'SELL';
        const isPending = selectedOrder.status === 'PENDING';
        // SELL: criador = vendedor, contraparte = comprador (payer da transaction)
        // BUY: criador = comprador, contraparte = provedor (providerId)
        const counterparty: UserInfo | null | undefined = isSell
          ? tx?.payer ?? null
          : selectedOrder.providerUser ?? null;

        // Parse orderData JSON
        let parsedOrderData: Record<string, string | undefined> | null = null;
        try {
          if (selectedOrder.orderData) {
            parsedOrderData = JSON.parse(selectedOrder.orderData);
          }
        } catch { /* ignore */ }

        const hasWallets = selectedOrder.wallet || selectedOrder.receiverWallet || selectedOrder.providerWallet;

        const truncateAddr = (addr: string) => addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : addr;

        const getTransactionStatusLabel = (status: string) => {
          const map: Record<string, string> = {
            PENDING: 'Pendente',
            VALIDATING: 'Validando',
            APPROVED: 'Aprovada',
            REJECTED: 'Rejeitada',
            DISPUTED: 'Em Disputa',
          };
          return map[status] || status;
        };

        const getTransactionStatusVariant = (status: string) => {
          if (status === 'APPROVED') return 'success';
          if (status === 'REJECTED') return 'danger';
          if (status === 'DISPUTED') return 'danger';
          if (status === 'VALIDATING') return 'warning';
          return 'info';
        };

        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Detalhes do Pedido
                </h2>
                <StatusBadge status={selectedOrder.status} variant={getStatusVariant(selectedOrder.status)} />
              </div>
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
              {/* ID */}
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">ID do Pedido</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-gray-900 dark:text-white">{selectedOrder.id}</p>
                  <button
                    onClick={() => copyToClipboard(selectedOrder.id, 'modal-id')}
                    className="text-xs text-blue-500 hover:text-blue-400 transition"
                    title="Copiar ID"
                  >
                    {copiedField === 'modal-id' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              {/* ======== Seção 1: Partes ======== */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Partes</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Criador */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {isSell ? 'Vendedor (iniciou)' : 'Comprador (iniciou)'}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedOrder.user?.name || 'Sem nome'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {selectedOrder.user?.email || 'N/A'}
                    </p>
                  </div>
                  {/* Contraparte */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {isSell ? 'Comprador' : 'Provedor'}
                    </p>
                    {counterparty ? (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {counterparty.name || 'Sem nome'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {counterparty.email}
                        </p>
                      </>
                    ) : isPending ? (
                      <p className="text-sm text-yellow-500 italic">Aguardando match</p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Dados indisponiveis</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ======== Seção 2: Pedido ======== */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Pedido</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
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
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rede</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.cryptoNetwork || 'N/A'}</p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Quantidade Crypto</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCrypto(selectedOrder.cryptoAmount, selectedOrder.cryptoType)} {selectedOrder.cryptoType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Valor em BRL</span>
                    <span className="text-sm font-bold text-green-500">{formatBRL(selectedOrder.brlAmount)}</span>
                  </div>
                  {selectedOrder.platformFee && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Taxa da Plataforma</span>
                      <span className="text-sm text-gray-900 dark:text-white">{formatCrypto(selectedOrder.platformFee, selectedOrder.cryptoType)} {selectedOrder.cryptoType}</span>
                    </div>
                  )}
                  {selectedOrder.payerReward && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Recompensa do Pagador</span>
                      <span className="text-sm text-gray-900 dark:text-white">{formatCrypto(selectedOrder.payerReward, selectedOrder.cryptoType)} {selectedOrder.cryptoType}</span>
                    </div>
                  )}
                  {selectedOrder.totalFee && (
                    <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Taxa Total</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCrypto(selectedOrder.totalFee, selectedOrder.cryptoType)} {selectedOrder.cryptoType}</span>
                    </div>
                  )}
                </div>

                {/* Cupom (se aplicado) */}
                {selectedOrder.appliedCouponCode && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-3">
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">Cupom Aplicado</p>
                    <div className="flex justify-between mt-1">
                      <span className="text-sm font-mono text-green-700 dark:text-green-300">{selectedOrder.appliedCouponCode}</span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        -{selectedOrder.appliedCouponDiscount}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ======== Seção 3: Transação (merged) ======== */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Transacao</p>

                {/* Sub-seção: Dados do Pagamento */}
                {parsedOrderData && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2 mb-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Dados para Pagamento ({selectedOrder.type}) — {isSell ? selectedOrder.user?.name || 'Vendedor' : (selectedOrder.providerUser?.name || 'Provedor')}</p>
                    {selectedOrder.type === 'PIX' && (
                      <>
                        {parsedOrderData.pixKeyType && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Tipo da Chave</span>
                            <span className="text-sm text-gray-900 dark:text-white">{parsedOrderData.pixKeyType}</span>
                          </div>
                        )}
                        {parsedOrderData.pixKey && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Chave PIX</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white">{parsedOrderData.pixKey}</span>
                          </div>
                        )}
                        {parsedOrderData.beneficiaryName && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Beneficiario</span>
                            <span className="text-sm text-gray-900 dark:text-white">{parsedOrderData.beneficiaryName}</span>
                          </div>
                        )}
                      </>
                    )}
                    {selectedOrder.type === 'BOLETO' && (
                      <>
                        {parsedOrderData.barcode && (
                          <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 block">Codigo de Barras</span>
                            <span className="text-xs font-mono text-gray-900 dark:text-white break-all">{parsedOrderData.barcode}</span>
                          </div>
                        )}
                        {parsedOrderData.dueDate && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Vencimento</span>
                            <span className="text-sm text-gray-900 dark:text-white">{parsedOrderData.dueDate}</span>
                          </div>
                        )}
                        {parsedOrderData.beneficiaryName && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Beneficiario</span>
                            <span className="text-sm text-gray-900 dark:text-white">{parsedOrderData.beneficiaryName}</span>
                          </div>
                        )}
                        {parsedOrderData.document && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Documento</span>
                            <span className="text-sm text-gray-900 dark:text-white">{parsedOrderData.document}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Sub-seção: Carteiras Crypto */}
                {hasWallets && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2 mb-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Carteiras Crypto</p>
                    {selectedOrder.wallet?.address && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Colateral ({isSell ? (selectedOrder.user?.name || 'Vendedor') : (selectedOrder.providerUser?.name || 'Provedor')})</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="text-sm font-mono text-gray-900 dark:text-white cursor-pointer hover:text-blue-400"
                            title={selectedOrder.wallet.address}
                            onClick={() => copyToClipboard(selectedOrder.wallet!.address, 'wallet-collateral')}
                          >
                            {truncateAddr(selectedOrder.wallet.address)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedOrder.wallet!.address, 'wallet-collateral')}
                            className="text-xs text-blue-500 hover:text-blue-400 transition"
                            title="Copiar endereço"
                          >
                            {copiedField === 'wallet-collateral' ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedOrder.receiverWallet?.address && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Destino ({isSell ? (tx?.payer?.name || 'Comprador') : (selectedOrder.user?.name || 'Comprador')})</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="text-sm font-mono text-gray-900 dark:text-white cursor-pointer hover:text-blue-400"
                            title={selectedOrder.receiverWallet.address}
                            onClick={() => copyToClipboard(selectedOrder.receiverWallet!.address, 'wallet-receiver')}
                          >
                            {truncateAddr(selectedOrder.receiverWallet.address)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedOrder.receiverWallet!.address, 'wallet-receiver')}
                            className="text-xs text-blue-500 hover:text-blue-400 transition"
                            title="Copiar endereço"
                          >
                            {copiedField === 'wallet-receiver' ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedOrder.providerWallet?.address && selectedOrder.providerWallet.address !== selectedOrder.wallet?.address && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Provedor ({selectedOrder.providerUser?.name || 'Provedor'})</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="text-sm font-mono text-gray-900 dark:text-white cursor-pointer hover:text-blue-400"
                            title={selectedOrder.providerWallet.address}
                            onClick={() => copyToClipboard(selectedOrder.providerWallet!.address, 'wallet-provider')}
                          >
                            {truncateAddr(selectedOrder.providerWallet.address)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedOrder.providerWallet!.address, 'wallet-provider')}
                            className="text-xs text-blue-500 hover:text-blue-400 transition"
                            title="Copiar endereço"
                          >
                            {copiedField === 'wallet-provider' ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-seção: Comprovante & Validação */}
                {tx && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2 mb-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Comprovante e Validacao</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                      <StatusBadge
                        status={getTransactionStatusLabel(tx.status)}
                        variant={getTransactionStatusVariant(tx.status)}
                      />
                    </div>
                    {tx.comprovanteUrl && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Comprovante</span>
                        <a
                          href={tx.comprovanteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:text-blue-400 underline"
                        >
                          Ver comprovante
                        </a>
                      </div>
                    )}
                    {tx.validationScore != null && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Score de Validacao</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{tx.validationScore}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-seção: Timeline */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Timeline</p>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Criado em</span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedOrder.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {/* Atualizado em: só mostrar se não existe completedAt nem cancelledAt */}
                  {selectedOrder.updatedAt && selectedOrder.updatedAt !== selectedOrder.createdAt && !selectedOrder.completedAt && !selectedOrder.cancelledAt && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Atualizado em</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {new Date(selectedOrder.updatedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                  {selectedOrder.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Concluido em</span>
                      <span className="text-sm text-green-500">
                        {new Date(selectedOrder.completedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                  {selectedOrder.cancelledAt && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Cancelado em</span>
                      <span className="text-sm text-red-500">
                        {new Date(selectedOrder.cancelledAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                  {/* Validado em: só mostrar se diferente de completedAt */}
                  {tx?.validatedAt && (!selectedOrder.completedAt || new Date(tx.validatedAt).toLocaleString('pt-BR') !== new Date(selectedOrder.completedAt).toLocaleString('pt-BR')) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Validado em</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {new Date(tx.validatedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
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
                  Cancelar
                </button>
              )}
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setShowEditModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Editar
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
