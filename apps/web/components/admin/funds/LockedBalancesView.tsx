'use client';

import React, { useEffect, useState } from 'react';
import ManageLockModal from '../modals/ManageLockModal';
import { fetchWithAuth } from '@/utils/api';

// Enum de categorias (deve espelhar o backend)
export enum LockCategory {
  ORPHAN_COLLATERAL = 'ORPHAN_COLLATERAL',
  DISPUTE = 'DISPUTE',
  SECURITY = 'SECURITY',
  FRAUD_INVESTIGATION = 'FRAUD_INVESTIGATION',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  LEGAL_HOLD = 'LEGAL_HOLD',
}

export const LockCategoryLabels: Record<LockCategory, string> = {
  [LockCategory.ORPHAN_COLLATERAL]: 'Colateral Órfão',
  [LockCategory.DISPUTE]: 'Disputa',
  [LockCategory.SECURITY]: 'Segurança',
  [LockCategory.FRAUD_INVESTIGATION]: 'Investigação de Fraude',
  [LockCategory.ADMINISTRATIVE]: 'Administrativo',
  [LockCategory.LEGAL_HOLD]: 'Bloqueio Legal',
};

interface LockHistoryEntry {
  id: string;
  type: string;
  amount: string;
  category: LockCategory | null;
  reason: string | null;
  adminUserId: string | null;
  orderId: string | null;
  createdAt: string;
}

interface LockedWallet {
  walletId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  lockedBalance: string;
  availableBalance: string;
  lastLockDate: string | null;
  hasActiveOrder: boolean;
  lockHistory: LockHistoryEntry[];
}

interface LockedBalancesData {
  wallets: LockedWallet[];
  summary: {
    totalWallets: number;
    totalLockedAmount: Record<string, string>;
  };
}

export default function LockedBalancesView() {
  const [data, setData] = useState<LockedBalancesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    cryptoType: '',
    network: '',
    userId: '',
  });
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'lock' | 'unlock'>('unlock');
  const [selectedWallet, setSelectedWallet] = useState<LockedWallet | null>(null);

  // Novo Bloqueio
  const [newLockEmail, setNewLockEmail] = useState('');
  const [newLockUserData, setNewLockUserData] = useState<{
    user: { id: string; email: string; name: string | null };
    wallets: Array<{ id: string; cryptoType: string; network: string; address: string; balance: string; availableBalance: string; lockedBalance: string }>;
  } | null>(null);
  const [newLockSearchLoading, setNewLockSearchLoading] = useState(false);
  const [newLockSelectedWalletId, setNewLockSelectedWalletId] = useState('');
  const [newLockError, setNewLockError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (filterOverrides?: { cryptoType: string; network: string; userId: string }) => {
    setLoading(true);
    try {
      const active = filterOverrides ?? filters;
      const params = new URLSearchParams();
      if (active.cryptoType) params.append('cryptoType', active.cryptoType);
      if (active.network) params.append('network', active.network);
      if (active.userId) params.append('userId', active.userId);

      const response = await fetchWithAuth(`/admin/funds/locked-balances?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Erro ao carregar saldos bloqueados');
      }

      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar saldos bloqueados');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadData();
  };

  const handleClearFilters = () => {
    const empty = { cryptoType: '', network: '', userId: '' };
    setFilters(empty);
    loadData(empty);
  };

  const openUnlockModal = (wallet: LockedWallet) => {
    setSelectedWallet(wallet);
    setModalMode('unlock');
    setModalOpen(true);
  };

  const openLockModal = (wallet: LockedWallet) => {
    setSelectedWallet(wallet);
    setModalMode('lock');
    setModalOpen(true);
  };

  const handleModalSuccess = () => {
    setModalOpen(false);
    setSelectedWallet(null);
    loadData();
  };

  const searchUserForNewLock = async () => {
    if (!newLockEmail.trim()) return;
    setNewLockSearchLoading(true);
    setNewLockUserData(null);
    setNewLockSelectedWalletId('');
    setNewLockError('');
    try {
      const response = await fetchWithAuth(
        `/admin/funds/users/search?query=${encodeURIComponent(newLockEmail)}`
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Usuário não encontrado');
      }
      const result = await response.json();
      setNewLockUserData(result.data);
      if (result.data.wallets.length === 1) {
        setNewLockSelectedWalletId(result.data.wallets[0].id);
      }
    } catch (error) {
      setNewLockError((error as Error).message);
    } finally {
      setNewLockSearchLoading(false);
    }
  };

  const openNewLockModal = () => {
    const wallet = newLockUserData?.wallets.find(w => w.id === newLockSelectedWalletId);
    if (!wallet || !newLockUserData) return;
    const lockedWallet: LockedWallet = {
      walletId: wallet.id,
      userId: newLockUserData.user.id,
      userEmail: newLockUserData.user.email,
      userName: newLockUserData.user.name,
      cryptoType: wallet.cryptoType,
      network: wallet.network,
      address: wallet.address,
      balance: wallet.balance,
      lockedBalance: wallet.lockedBalance,
      availableBalance: wallet.availableBalance,
      lastLockDate: null,
      hasActiveOrder: false,
      lockHistory: [],
    };
    openLockModal(lockedWallet);
    setNewLockEmail('');
    setNewLockUserData(null);
    setNewLockSelectedWalletId('');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatAmount = (amount: string, crypto: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return `${num.toFixed(8)} ${crypto}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Carregando saldos bloqueados...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400">Erro ao carregar dados</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-orange-900/20 border border-orange-600/50 rounded-lg p-4">
        <p className="text-orange-300 text-sm">
          <strong>Saldos Bloqueados:</strong> Esta página mostra todas as carteiras com saldo bloqueado (lockedBalance {'>'} 0).
          Use para identificar colaterais órfãos e gerenciar bloqueios manuais.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-300">Carteiras com Saldo Bloqueado</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.totalWallets}</p>
            </div>
            <div className="text-4xl">🔒</div>
          </div>
        </div>

        {Object.entries(data.summary.totalLockedAmount).map(([crypto, amount]) => (
          <div key={crypto} className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-300">Total Bloqueado ({crypto})</p>
                <p className="text-2xl font-bold text-white mt-2">{parseFloat(amount).toFixed(8)}</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>
        ))}
      </div>

      {/* Novo Bloqueio */}
      <div className="bg-gray-800 border border-orange-600/40 rounded-lg p-4 space-y-4">
        <h3 className="text-orange-400 font-semibold">🔒 Novo Bloqueio de Saldo</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLockEmail}
            onChange={(e) => setNewLockEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUserForNewLock()}
            placeholder="ID, email ou ID da carteira"
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={searchUserForNewLock}
            disabled={newLockSearchLoading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
          >
            {newLockSearchLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {newLockError && (
          <p className="text-red-400 text-sm">{newLockError}</p>
        )}

        {newLockUserData && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Usuário: <span className="text-white font-medium">{newLockUserData.user.email}</span>
              {newLockUserData.user.name && <span className="text-gray-500 ml-2">({newLockUserData.user.name})</span>}
            </p>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Selecionar Carteira</label>
              <select
                value={newLockSelectedWalletId}
                onChange={(e) => setNewLockSelectedWalletId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">Selecione uma carteira...</option>
                {newLockUserData.wallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.cryptoType}/{w.network} — Disponível: {parseFloat(w.availableBalance).toFixed(8)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={openNewLockModal}
              disabled={!newLockSelectedWalletId}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
            >
              🔒 Prosseguir para Bloqueio
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Crypto</label>
            <select
              value={filters.cryptoType}
              onChange={(e) => setFilters({ ...filters, cryptoType: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">Todas</option>
              <option value="BTC">BTC</option>
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Rede</label>
            <select
              value={filters.network}
              onChange={(e) => setFilters({ ...filters, network: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">Todas</option>
              <option value="BITCOIN">Bitcoin</option>
              <option value="BASE">Base</option>
              <option value="SOLANA">Solana</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Buscar Usuário</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
              placeholder="ID, email ou ID da carteira"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleFilter}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition"
            >
              Filtrar
            </button>
            <button
              onClick={handleClearFilters}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Wallets Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">Carteiras com Saldo Bloqueado</h3>
        </div>

        {data.wallets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400">Nenhuma carteira com saldo bloqueado encontrada.</p>
            <p className="text-gray-500 text-sm mt-2">Isso é bom! Significa que não há colaterais órfãos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-900">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Usuário</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Crypto</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Rede</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Bloqueado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Disponível</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.wallets.map((wallet) => (
                  <React.Fragment key={wallet.walletId}>
                    <tr className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-white">{wallet.userEmail}</p>
                          <p className="text-xs text-gray-500">{wallet.userId.slice(0, 12)}...</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-medium">{wallet.cryptoType}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{wallet.network}</td>
                      <td className="px-4 py-3 text-sm text-white font-mono">
                        {formatAmount(wallet.balance, wallet.cryptoType)}
                      </td>
                      <td className="px-4 py-3 text-sm text-yellow-400 font-mono font-bold">
                        {formatAmount(wallet.lockedBalance, wallet.cryptoType)}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-400 font-mono">
                        {formatAmount(wallet.availableBalance, wallet.cryptoType)}
                      </td>
                      <td className="px-4 py-3">
                        {wallet.hasActiveOrder ? (
                          <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs font-medium">
                            Pedido Ativo
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-900/50 text-red-300 rounded text-xs font-medium">
                            Órfão
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setExpandedWallet(expandedWallet === wallet.walletId ? null : wallet.walletId)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
                          >
                            {expandedWallet === wallet.walletId ? 'Ocultar' : 'Histórico'}
                          </button>
                          <button
                            onClick={() => openUnlockModal(wallet)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition"
                          >
                            Desbloquear
                          </button>
                          {parseFloat(wallet.availableBalance) > 0 && (
                            <button
                              onClick={() => openLockModal(wallet)}
                              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm transition"
                            >
                              Bloquear Mais
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded History Row */}
                    {expandedWallet === wallet.walletId && (
                      <tr className="bg-gray-900/50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3">
                              Histórico de Bloqueios/Desbloqueios (últimos 10)
                            </h4>
                            {wallet.lockHistory.length === 0 ? (
                              <p className="text-gray-500 text-sm">Nenhum histórico encontrado.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="text-gray-400">
                                      <th className="px-3 py-2 text-left">Data</th>
                                      <th className="px-3 py-2 text-left">Tipo</th>
                                      <th className="px-3 py-2 text-left">Valor</th>
                                      <th className="px-3 py-2 text-left">Categoria</th>
                                      <th className="px-3 py-2 text-left">Motivo/Order</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {wallet.lockHistory.map((entry) => (
                                      <tr key={entry.id} className="border-t border-gray-700/50">
                                        <td className="px-3 py-2 text-gray-300">
                                          {formatDate(entry.createdAt)}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            entry.type.includes('LOCK') && !entry.type.includes('UNLOCK')
                                              ? 'bg-orange-900/50 text-orange-300'
                                              : 'bg-green-900/50 text-green-300'
                                          }`}>
                                            {entry.type}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-white font-mono">
                                          {entry.amount} {wallet.cryptoType}
                                        </td>
                                        <td className="px-3 py-2 text-gray-300">
                                          {entry.category ? LockCategoryLabels[entry.category] : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-gray-400">
                                          {entry.orderId ? `Order: ${entry.orderId.slice(0, 8)}...` : entry.reason || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedWallet && (
        <ManageLockModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          wallet={selectedWallet}
          mode={modalMode}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
