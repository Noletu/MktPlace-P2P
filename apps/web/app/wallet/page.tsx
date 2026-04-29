'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';
import DepositWizardModal from '@/components/modals/DepositWizardModal';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';
import WithdrawWizardModal from '@/components/modals/WithdrawWizardModal';
import GenerateWalletModal from '@/components/modals/GenerateWalletModal';
import { formatBRL } from '@/utils/formatters';
import { getTransactionLabel } from '@/utils/transactionLabels';
import { getExplorerUrl, getExplorerName, truncateHash } from '@/utils/blockchainExplorer';
import type { NetworkType } from '@/utils/blockchainExplorer';
import { fetchWithAuth } from '@/utils/api';

interface HDWallet {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  availableBalance: string;
  lockedBalance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  creationSource?: string;
  createdAt?: string;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string;
  txHash: string | null;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  walletId: string;
  toAddress: string;
  amount: string;
  txHash: string | null;
  status: string;
  networkFee: string | null;
  reviewNote: string | null;
  createdAt: string;
  processedAt: string | null;
  completedAt: string | null;
  wallet: {
    cryptoType: string;
    network: string;
    address: string;
  };
}

interface AggregatedWallet {
  cryptoType: string;
  totalBalance: number;
  totalAvailable: number;
  totalLocked: number;
  wallets: HDWallet[];
}

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  USDC: 'USD Coin',
  USDT: 'Tether',
};

const CRYPTO_ICONS: Record<string, string> = {
  BTC: '₿',
  USDC: '$',
  USDT: '₮',
};

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  MANUAL: { label: 'Manual', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  DEPOSIT_WIZARD: { label: 'Depósito', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  ORDER_SELL: { label: 'Venda', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  ORDER_BUY: { label: 'Compra', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  COLLATERAL_GENERATE: { label: 'Colateral', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  SYSTEM: { label: 'Sistema', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400' },
};

export default function WalletHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<HDWallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Modals
  const [wizardOpen, setWizardOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    wallet: { id: string; cryptoType: string; network: string; address: string } | null;
  }>({ isOpen: false, wallet: null });
  const [withdrawWizardOpen, setWithdrawWizardOpen] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState<{
    isOpen: boolean;
    wallet: HDWallet | null;
  }>({ isOpen: false, wallet: null });
  const [expandedCryptos, setExpandedCryptos] = useState<Set<string>>(new Set());
  const [networkPicker, setNetworkPicker] = useState<{
    isOpen: boolean;
    cryptoType: string;
    action: 'deposit' | 'withdraw';
    wallets: HDWallet[];
  }>({ isOpen: false, cryptoType: '', action: 'deposit', wallets: [] });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchWallets(), fetchPrices(), fetchHistory(), fetchWithdrawals()]);
    setLoading(false);
  };

  const fetchWallets = async () => {
    try {
      const response = await fetchWithAuth('/wallets');
      const data = await response.json();
      if (data.success) {
        setWallets(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar carteiras:', error);
    }
  };

  const fetchPrices = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/prices`);
      if (!response.ok) return;
      const data = await response.json();
      const priceMap: Record<string, number> = {};
      (data.data || []).forEach((p: { crypto: string; brlPrice: string }) => {
        priceMap[p.crypto] = parseFloat(p.brlPrice) || 0;
      });
      setPrices(priceMap);
    } catch (error) {
      console.error('Erro ao buscar cotações:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetchWithAuth('/collateral-balance/history?limit=10');
      const data = await response.json();
      if (data.success) {
        setTransactions(data.data?.transactions || []);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const response = await fetchWithAuth('/wallets/my-withdrawals?limit=20');
      const data = await response.json();
      if (data.success) {
        setWithdrawals(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar saques:', error);
    }
  };

  // Aggregate wallets by crypto type
  const aggregated = useMemo((): AggregatedWallet[] => {
    const grouped: Record<string, HDWallet[]> = {};
    wallets.forEach(w => {
      if (!grouped[w.cryptoType]) grouped[w.cryptoType] = [];
      grouped[w.cryptoType].push(w);
    });

    return Object.entries(grouped).map(([cryptoType, ws]) => ({
      cryptoType,
      totalBalance: ws.reduce((sum, w) => sum + parseFloat(w.balance || '0'), 0),
      totalAvailable: ws.reduce((sum, w) => sum + parseFloat(w.availableBalance || '0'), 0),
      totalLocked: ws.reduce((sum, w) => sum + parseFloat(w.lockedBalance || '0'), 0),
      wallets: ws,
    }));
  }, [wallets]);

  // Totals in BRL
  const totals = useMemo(() => {
    let totalBalance = 0;
    let totalAvailable = 0;
    let totalLocked = 0;

    aggregated.forEach(a => {
      const price = prices[a.cryptoType] || 0;
      totalBalance += a.totalBalance * price;
      totalAvailable += a.totalAvailable * price;
      totalLocked += a.totalLocked * price;
    });

    return { totalBalance, totalAvailable, totalLocked };
  }, [aggregated, prices]);

  const getWithdrawalStatusConfig = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'PENDING':
        return { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
      case 'PROCESSING':
        return { label: 'Processando', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
      case 'COMPLETED':
        return { label: 'Concluído', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
      case 'FAILED':
        return { label: 'Falhou', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
      case 'REQUIRES_APPROVAL':
        return { label: 'Aguardando Aprovação', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
      case 'APPROVED':
        return { label: 'Aprovado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
      case 'REJECTED':
        return { label: 'Rejeitado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' };
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT': return '📥';
      case 'WITHDRAWAL': return '📤';
      case 'LOCK': return '🔒';
      case 'UNLOCK': return '🔓';
      case 'DEDUCT': return '💸';
      case 'CREDIT': return '💳';
      case 'REFUND': return '↩️';
      case 'ADMIN_CREDIT': return '🏦';
      case 'ADMIN_DEBIT': return '🏦';
      case 'ADMIN_LOCK': return '🔐';
      case 'ADMIN_UNLOCK': return '🔑';
      case 'ADMIN_ADJUSTMENT': return '⚙️';
      case 'PLATFORM_FEE': return '🏷️';
      default: return '💰';
    }
  };

  const isPositiveTransaction = (type: string, amount?: string) => {
    if (['DEPOSIT', 'UNLOCK', 'CREDIT', 'REFUND', 'ADMIN_CREDIT', 'ADMIN_UNLOCK'].includes(type)) return true;
    if (['WITHDRAWAL', 'DEDUCT', 'LOCK', 'ADMIN_DEBIT', 'ADMIN_LOCK'].includes(type)) return false;
    if (type === 'ADMIN_ADJUSTMENT') return parseFloat(amount || '0') >= 0;
    return false;
  };

  const getTransactionColor = (type: string, amount?: string) => {
    if (isPositiveTransaction(type, amount)) return 'text-green-600 dark:text-green-400';
    if (['WITHDRAWAL', 'DEDUCT', 'LOCK', 'ADMIN_DEBIT', 'ADMIN_LOCK'].includes(type)) return 'text-red-600 dark:text-red-400';
    if (type === 'ADMIN_ADJUSTMENT') return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const toggleCryptoExpand = (cryptoType: string) => {
    setExpandedCryptos(prev => {
      const next = new Set(prev);
      if (next.has(cryptoType)) {
        next.delete(cryptoType);
      } else {
        next.add(cryptoType);
      }
      return next;
    });
  };

  // Open withdraw for a specific wallet (pick the first wallet of that crypto with available balance)
  const handleOpenWithdraw = (cryptoType: string) => {
    const matching = wallets.filter(w => w.cryptoType === cryptoType);
    if (matching.length === 0) return;

    if (matching.length === 1) {
      setWithdrawModal({ isOpen: true, wallet: matching[0] });
    } else {
      setNetworkPicker({ isOpen: true, cryptoType, action: 'withdraw', wallets: matching });
    }
  };

  // Open deposit for a specific crypto
  const handleOpenDeposit = (cryptoType: string) => {
    const matching = wallets.filter(w => w.cryptoType === cryptoType);
    if (matching.length === 0) return;

    if (matching.length === 1) {
      setDepositModal({
        isOpen: true,
        wallet: {
          id: matching[0].id,
          cryptoType: matching[0].cryptoType,
          network: matching[0].network,
          address: matching[0].address,
        },
      });
    } else {
      setNetworkPicker({ isOpen: true, cryptoType, action: 'deposit', wallets: matching });
    }
  };

  const handleNetworkSelected = (wallet: HDWallet) => {
    setNetworkPicker({ isOpen: false, cryptoType: '', action: 'deposit', wallets: [] });
    if (networkPicker.action === 'deposit') {
      setDepositModal({
        isOpen: true,
        wallet: {
          id: wallet.id,
          cryptoType: wallet.cryptoType,
          network: wallet.network,
          address: wallet.address,
        },
      });
    } else {
      setWithdrawModal({ isOpen: true, wallet });
    }
  };

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Carregando carteira...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Title */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Minha Carteira
          </h1>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Saldo Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBRL(totals.totalBalance)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Disponível</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatBRL(totals.totalAvailable)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Bloqueado</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {formatBRL(totals.totalLocked)}
              </p>
            </div>
          </div>

          {/* Global Action Buttons */}
          <div className="flex gap-4 mb-8 justify-center">
            <button
              onClick={() => setWizardOpen(true)}
              className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Depositar
            </button>
            <button
              onClick={() => setWithdrawWizardOpen(true)}
              disabled={wallets.length === 0}
              className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Sacar
            </button>
            <button
              onClick={() => setGenerateModalOpen(true)}
              className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Gerar Endereço
            </button>
          </div>

          {/* Crypto List */}
          {aggregated.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center border border-gray-200 dark:border-gray-700 mb-8">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Você ainda não tem carteiras. Faça seu primeiro depósito!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setWizardOpen(true)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Depositar Agora
                </button>
                <button
                  onClick={() => setGenerateModalOpen(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Gerar Endereço
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
              {aggregated.map((agg, idx) => {
                const price = prices[agg.cryptoType] || 0;
                const availBRL = agg.totalAvailable * price;
                const lockedBRL = agg.totalLocked * price;
                const isExpanded = expandedCryptos.has(agg.cryptoType);

                return (
                  <div
                    key={agg.cryptoType}
                    className={idx > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}
                  >
                    {/* Crypto Summary Row */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Crypto Info (clickable to expand) */}
                      <button
                        onClick={() => toggleCryptoExpand(agg.cryptoType)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className="flex-shrink-0">
                          <CryptoIcon crypto={agg.cryptoType as CryptoType} size={36} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {CRYPTO_NAMES[agg.cryptoType] || agg.cryptoType}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {agg.cryptoType} · {agg.wallets.length} rede{agg.wallets.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Balances */}
                      <div className="flex gap-6 flex-1 justify-start sm:justify-center">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Disponível</p>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {agg.totalAvailable.toFixed(8)} {agg.cryptoType}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            ≈ {formatBRL(availBRL)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Bloqueado</p>
                          <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                            {agg.totalLocked.toFixed(8)} {agg.cryptoType}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            ≈ {formatBRL(lockedBRL)}
                          </p>
                        </div>
                      </div>

                      {/* Per-crypto Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleOpenDeposit(agg.cryptoType)}
                          className="px-4 py-2 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                        >
                          Depositar
                        </button>
                        <button
                          onClick={() => handleOpenWithdraw(agg.cryptoType)}
                          className="px-4 py-2 text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                        >
                          Sacar
                        </button>
                      </div>
                    </div>

                    {/* Expanded: Per-network details */}
                    {isExpanded && (
                      <div className="px-5 pb-5 space-y-2">
                        {agg.wallets.map(w => {
                          const badge = SOURCE_BADGES[w.creationSource || 'SYSTEM'] || SOURCE_BADGES.SYSTEM;
                          return (
                            <div
                              key={w.id}
                              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {w.network}
                                  </span>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.color}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                {w.createdAt && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    Criada em {new Date(w.createdAt).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>

                              <div className="font-mono text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-3 py-2 break-all">
                                {w.address}
                              </div>

                              <div className="flex gap-6 text-xs">
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Saldo: </span>
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {parseFloat(w.balance).toFixed(8)} {w.cryptoType}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Disponível: </span>
                                  <span className="font-semibold text-green-600 dark:text-green-400">
                                    {parseFloat(w.availableBalance).toFixed(8)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Bloqueado: </span>
                                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                                    {parseFloat(w.lockedBalance).toFixed(8)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent History */}
          {transactions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Histórico Recente
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">{getTransactionIcon(tx.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {getTransactionLabel(tx.type)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {tx.description}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${getTransactionColor(tx.type, tx.amount)}`}>
                        {isPositiveTransaction(tx.type, tx.amount) ? '+' : '-'}
                        {Math.abs(parseFloat(tx.amount)).toFixed(8)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {tx.type === 'DEPOSIT' && !tx.txHash ? 'PENDING' : formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Withdrawals History */}
          {withdrawals.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Meus Saques
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {withdrawals.map(w => {
                  const statusConfig = getWithdrawalStatusConfig(w.status);
                  return (
                    <div key={w.id} className="px-5 py-4 space-y-2">
                      {/* Linha principal */}
                      <div className="flex items-center gap-3">
                        <span className="text-xl flex-shrink-0">📤</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {parseFloat(w.amount).toFixed(8)} {w.wallet.cryptoType}
                            </p>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {w.wallet.network} · {new Date(w.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {/* Endereço de destino */}
                      <div className="ml-9">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Destino: <span className="font-mono">{truncateHash(w.toAddress, 10, 8)}</span>
                        </p>

                        {/* Taxa de rede */}
                        {w.networkFee && parseFloat(w.networkFee) > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Taxa de rede: {w.networkFee}
                          </p>
                        )}

                        {/* txHash com link para explorer */}
                        {w.txHash && (
                          <div className="mt-1">
                            <a
                              href={getExplorerUrl(w.wallet.network as NetworkType, w.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            >
                              <span className="font-mono">{truncateHash(w.txHash, 10, 8)}</span>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              <span className="text-gray-400 dark:text-gray-500">
                                ({getExplorerName(w.wallet.network as NetworkType)})
                              </span>
                            </a>
                          </div>
                        )}

                        {/* Nota de rejeição */}
                        {w.status === 'REJECTED' && w.reviewNote && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Motivo: {w.reviewNote}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Generate Wallet Modal (manual address generation) */}
      <GenerateWalletModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        existingWallets={wallets.map(w => ({ cryptoType: w.cryptoType, network: w.network }))}
        onSuccess={fetchAll}
      />

      {/* Deposit Wizard Modal */}
      <DepositWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* Direct Deposit Modal (per-crypto) */}
      <DepositModal
        isOpen={depositModal.isOpen}
        onClose={() => setDepositModal({ isOpen: false, wallet: null })}
        wallet={depositModal.wallet}
      />

      {/* Withdraw Wizard Modal (global button) */}
      <WithdrawWizardModal
        isOpen={withdrawWizardOpen}
        onClose={() => setWithdrawWizardOpen(false)}
        wallets={wallets}
        prices={prices}
        onSuccess={fetchAll}
      />

      {/* Withdraw Modal (per-crypto button) */}
      {withdrawModal.wallet && (
        <WithdrawModal
          isOpen={withdrawModal.isOpen}
          onClose={() => setWithdrawModal({ isOpen: false, wallet: null })}
          wallet={{
            id: withdrawModal.wallet.id,
            cryptoType: withdrawModal.wallet.cryptoType,
            network: withdrawModal.wallet.network,
            availableBalance: withdrawModal.wallet.availableBalance,
            address: withdrawModal.wallet.address,
          }}
          cryptoPrice={prices[withdrawModal.wallet.cryptoType] || 0}
          onSuccess={() => {
            setWithdrawModal({ isOpen: false, wallet: null });
            fetchAll();
          }}
        />
      )}

      {/* Network Picker Modal (when crypto has multiple networks) */}
      {networkPicker.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Selecione a Rede
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {networkPicker.action === 'deposit' ? 'Para qual rede deseja depositar' : 'De qual rede deseja sacar'}{' '}
              {networkPicker.cryptoType}?
            </p>
            <div className="space-y-2">
              {networkPicker.wallets.map(w => (
                <button
                  key={w.id}
                  onClick={() => handleNetworkSelected(w)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{w.network}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                      {w.address.slice(0, 8)}...{w.address.slice(-6)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {parseFloat(w.availableBalance).toFixed(8)}
                    </p>
                    <p className="text-xs text-gray-400">disponível</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setNetworkPicker({ isOpen: false, cryptoType: '', action: 'deposit', wallets: [] })}
              className="w-full mt-4 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
