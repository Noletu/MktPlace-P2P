'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';
import DepositModal from '@/components/modals/DepositModal';
import DepositWizardModal from '@/components/modals/DepositWizardModal';
import TransactionTypeFilter, { TransactionType } from '@/components/TransactionTypeFilter';
import { getExplorerUrl, truncateHash } from '@/utils/blockchainExplorer';
import AggregatedCryptoCard from '@/components/dashboard/AggregatedCryptoCard';
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
  metadata?: string;
}

interface AggregatedBalance {
  cryptoType: string;
  totalBalance: string;
  totalAvailable: string;
  totalLocked: string;
  networks: Array<{
    network: string;
    id: string;
    balance: string;
    availableAmount: string;
    lockedAmount: string;
    address: string;
  }>;
}

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  USDC: 'USD Coin',
  USDT: 'Tether',
};

export default function CollateralBalancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<HDWallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [testBalanceModal, setTestBalanceModal] = useState<{
    show: boolean;
    walletId: string | null;
    cryptoType: string;
    network: string;
  }>({ show: false, walletId: null, cryptoType: '', network: '' });
  const [testAmount, setTestAmount] = useState('');
  const [addingBalance, setAddingBalance] = useState(false);

  // Filtros
  const [selectedCrypto, setSelectedCrypto] = useState<'ALL' | 'BTC' | 'USDT' | 'USDC'>('ALL');
  const [selectedTxType, setSelectedTxType] = useState<TransactionType>('ALL');
  const [filterBalance, setFilterBalance] = useState<'all' | 'with_balance' | 'empty'>('all');

  // Estado de expandido para cards agregados
  const [expandedCrypto, setExpandedCrypto] = useState<string | null>(null);

  // Preços para conversão BRL
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Wizard de depósito
  const [wizardOpen, setWizardOpen] = useState(false);

  // Modal de depósito com QR code
  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    wallet: {
      id: string;
      cryptoType: string;
      network: string;
      address: string;
    } | null;
  }>({ isOpen: false, wallet: null });

  useEffect(() => {
    fetchWallets();
    fetchTransactions();
    fetchPrices();
  }, []);

  const fetchWallets = async () => {
    try {
      const response = await fetchWithAuth('/wallets');

      const data = await response.json();

      if (data.success) {
        setWallets(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar carteiras:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      // Buscar transações de todas as carteiras
      const allTransactions: WalletTransaction[] = [];

      for (const wallet of wallets) {
        try {
          const response = await fetchWithAuth(`/wallets/${wallet.id}/transactions?limit=50`);

          const data = await response.json();
          if (data.success && data.data) {
            allTransactions.push(...data.data);
          }
        } catch (err) {
          console.error(`Erro ao buscar transações da carteira ${wallet.id}:`, err);
        }
      }

      // Ordenar por data (mais recente primeiro)
      allTransactions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTransactions(allTransactions.slice(0, 20));
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
    }
  };

  const fetchPrices = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/prices`);
      if (!response.ok) return;
      const data = await response.json();
      const priceMap: Record<string, number> = {};
      data.data.forEach((p: { crypto: string; brlPrice: string }) => {
        priceMap[p.crypto] = parseFloat(p.brlPrice) || 0;
      });
      setPrices(priceMap);
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };

  const handleAddTestBalance = async () => {
    if (!testBalanceModal.walletId || !testAmount) return;

    setAddingBalance(true);
    try {
      const response = await fetchWithAuth(`/wallets/${testBalanceModal.walletId}/test-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount: testAmount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao adicionar saldo de teste');
      }

      setTestBalanceModal({ show: false, walletId: null, cryptoType: '', network: '' });
      setTestAmount('');
      await fetchWallets();
      await fetchTransactions();

      alert(`✅ Saldo de teste adicionado: ${data.data.amountAdded} ${data.data.cryptoType}`);
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setAddingBalance(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return '📥';
      case 'WITHDRAWAL':
        return '📤';
      case 'LOCK':
        return '🔒';
      case 'UNLOCK':
        return '🔓';
      case 'DEDUCT':
        return '💸';
      default:
        return '💰';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'UNLOCK':
        return 'text-green-600 dark:text-green-400';
      case 'WITHDRAWAL':
      case 'DEDUCT':
      case 'LOCK':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Endereço copiado!');
  };

  // Formatar valor em BRL
  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Calcular totais convertidos para BRL
  const totals = {
    totalAvailable: wallets.reduce((sum, w) => sum + parseFloat(w.availableBalance) * (prices[w.cryptoType] || 0), 0),
    totalLocked: wallets.reduce((sum, w) => sum + parseFloat(w.lockedBalance) * (prices[w.cryptoType] || 0), 0),
    totalBalance: wallets.reduce((sum, w) => sum + parseFloat(w.balance) * (prices[w.cryptoType] || 0), 0),
  };

  // Agrupar wallets por crypto
  const walletsByCrypto: Record<string, HDWallet[]> = {};
  wallets.forEach(wallet => {
    if (!walletsByCrypto[wallet.cryptoType]) {
      walletsByCrypto[wallet.cryptoType] = [];
    }
    walletsByCrypto[wallet.cryptoType].push(wallet);
  });

  // Agregar balances por moeda (para visualização limpa)
  const aggregateBalancesByCrypto = (wallets: HDWallet[]): AggregatedBalance[] => {
    const grouped: Record<string, HDWallet[]> = {};

    wallets.forEach(wallet => {
      if (!grouped[wallet.cryptoType]) {
        grouped[wallet.cryptoType] = [];
      }
      grouped[wallet.cryptoType].push(wallet);
    });

    return Object.entries(grouped).map(([cryptoType, networks]) => ({
      cryptoType,
      totalBalance: networks
        .reduce((sum, w) => sum + parseFloat(w.balance || '0'), 0)
        .toFixed(8),
      totalAvailable: networks
        .reduce((sum, w) => sum + parseFloat(w.availableBalance || '0'), 0)
        .toFixed(8),
      totalLocked: networks
        .reduce((sum, w) => sum + parseFloat(w.lockedBalance || '0'), 0)
        .toFixed(8),
      networks: networks.map(w => ({
        network: w.network,
        id: w.id,
        balance: w.balance,
        availableAmount: w.availableBalance,
        lockedAmount: w.lockedBalance,
        address: w.address,
      })),
    }));
  };

  // Aplicar filtros aos agregados
  let filteredAggregated = aggregateBalancesByCrypto(wallets);

  // Filtro por crypto
  if (selectedCrypto !== 'ALL') {
    filteredAggregated = filteredAggregated.filter(b => b.cryptoType === selectedCrypto);
  }

  // Filtro por saldo
  if (filterBalance === 'with_balance') {
    filteredAggregated = filteredAggregated.filter(b => parseFloat(b.totalBalance) > 0);
  } else if (filterBalance === 'empty') {
    filteredAggregated = filteredAggregated.filter(b => parseFloat(b.totalBalance) === 0);
  }

  const aggregatedBalances = filteredAggregated;

  // Filtrar transações
  const filteredTransactions = transactions.filter((tx) => {
    // Filtro por crypto
    if (selectedCrypto !== 'ALL') {
      const wallet = wallets.find(w =>
        tx.description.includes(w.address) ||
        tx.description.includes(w.cryptoType)
      );
      if (!wallet || wallet.cryptoType !== selectedCrypto) {
        return false;
      }
    }

    // Filtro por tipo
    if (selectedTxType !== 'ALL' && tx.type !== selectedTxType) {
      return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando carteiras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ← Voltar
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  💰 Saldo de Colateral (Carteiras HD)
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Estas são suas carteiras permanentes (BIP32/BIP44). O saldo disponível é usado automaticamente como colateral em pedidos.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resumo de Totais */}
        {wallets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Disponível</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatBRL(totals.totalAvailable)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Pode ser usado em pedidos</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Bloqueado</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {formatBRL(totals.totalLocked)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Em uso em pedidos ativos</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Saldo Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBRL(totals.totalBalance)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Disponível + Bloqueado</p>
            </div>
          </div>
        )}

        {/* Carteiras por Crypto */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Minhas Carteiras HD
              </h2>
              <button
                onClick={() => setWizardOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Depositar Colateral
              </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Filtro por Moeda */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCrypto('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCrypto === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  💰 Todas
                </button>
                <button
                  onClick={() => setSelectedCrypto('BTC')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCrypto === 'BTC'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  ₿ BTC
                </button>
                <button
                  onClick={() => setSelectedCrypto('USDT')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCrypto === 'USDT'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  ₮ USDT
                </button>
                <button
                  onClick={() => setSelectedCrypto('USDC')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCrypto === 'USDC'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  $ USDC
                </button>
              </div>

              {/* Divisor */}
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

              {/* Filtro por Saldo */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterBalance('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterBalance === 'all'
                      ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterBalance('with_balance')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterBalance === 'with_balance'
                      ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Com Saldo
                </button>
                <button
                  onClick={() => setFilterBalance('empty')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterBalance === 'empty'
                      ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Vazias
                </button>
              </div>
            </div>
          </div>

          {wallets.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Você ainda não tem carteiras criadas.
              </p>
              <button
                onClick={() => router.push('/wallets')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                Criar Primeira Carteira
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {aggregatedBalances.map((balance) => (
                <AggregatedCryptoCard
                  key={balance.cryptoType}
                  balance={balance}
                  isExpanded={expandedCrypto === balance.cryptoType}
                  onToggleExpand={() => {
                    setExpandedCrypto(
                      expandedCrypto === balance.cryptoType ? null : balance.cryptoType
                    );
                  }}
                  onOpenDeposit={(walletId, cryptoType, network, address) => {
                    setDepositModal({
                      isOpen: true,
                      wallet: {
                        id: walletId,
                        cryptoType,
                        network,
                        address,
                      }
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Histórico de Transações */}
        {transactions.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold mb-4">📊 Histórico de Transações</h2>

              {/* Asset Selector Tabs */}
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCrypto('ALL')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    selectedCrypto === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  💰 Todos
                </button>
                <button
                  onClick={() => setSelectedCrypto('BTC')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    selectedCrypto === 'BTC'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  ₿ BTC
                </button>
                <button
                  onClick={() => setSelectedCrypto('USDT')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    selectedCrypto === 'USDT'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  ₮ USDT
                </button>
                <button
                  onClick={() => setSelectedCrypto('USDC')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    selectedCrypto === 'USDC'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  $ USDC
                </button>
              </div>

              {/* Transaction Type Filter */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tipo:</span>
                <TransactionTypeFilter
                  selectedType={selectedTxType}
                  onTypeChange={setSelectedTxType}
                />

                {/* Counter */}
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                  {filteredTransactions.length} transações
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Antes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Depois
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      TX Hash
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        Nenhuma transação encontrada
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const wallet = wallets.find(w =>
                        tx.description.includes(w.address) ||
                        tx.description.includes(w.cryptoType)
                      );

                      return (
                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{getTransactionIcon(tx.type)}</span>
                              <span className={`text-sm font-medium ${getTransactionColor(tx.type)}`}>
                                {tx.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold ${
                              tx.type === 'DEPOSIT' || tx.type === 'UNLOCK'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {tx.type === 'DEPOSIT' || tx.type === 'UNLOCK' ? '+' : '-'}
                              {parseFloat(tx.amount).toFixed(8)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {parseFloat(tx.balanceBefore).toFixed(8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                            {parseFloat(tx.balanceAfter).toFixed(8)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                            {tx.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {tx.txHash ? (
                              <a
                                href={getExplorerUrl(wallet?.network as any, tx.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                {truncateHash(tx.txHash)}
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(tx.createdAt).toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Aviso sobre criação de carteiras */}
        {wallets.length < 3 && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Dica:</strong> Você pode criar carteiras para BTC, USDC e USDT na aba{' '}
              <button
                onClick={() => router.push('/wallets')}
                className="underline font-semibold hover:text-blue-600"
              >
                "Carteiras"
              </button>
              . O saldo disponível será usado automaticamente como colateral em seus pedidos.
            </p>
          </div>
        )}
      </main>

      {/* Modal de Adicionar Saldo de Teste */}
      {testBalanceModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                🧪 Adicionar Saldo de Teste
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {testBalanceModal.cryptoType} - {testBalanceModal.network}
              </p>
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">⚠️</span>
                  <div>
                    <p className="font-bold text-yellow-800 dark:text-yellow-400 text-lg">
                      ATENÇÃO: SALDO DE TESTE
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
                      Este é um saldo simulado para testes. Não representa valor real e não pode ser sacado.
                      Use apenas para testar funcionalidades da plataforma.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Valor a adicionar:
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                placeholder="0.00000000"
                autoFocus
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <p className="w-full text-xs text-gray-600 dark:text-gray-400 mb-1">Valores rápidos:</p>
                {['0.001', '0.01', '0.1', '1'].map(value => (
                  <button
                    key={value}
                    onClick={() => setTestAmount(value)}
                    className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded transition-colors"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setTestBalanceModal({ show: false, walletId: null, cryptoType: '', network: '' });
                  setTestAmount('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                disabled={addingBalance}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddTestBalance}
                disabled={addingBalance || !testAmount || parseFloat(testAmount) <= 0}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingBalance ? '⏳ Adicionando...' : '✅ Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Depósito com QR Code */}
      <DepositModal
        isOpen={depositModal.isOpen}
        onClose={() => setDepositModal({ isOpen: false, wallet: null })}
        wallet={depositModal.wallet}
      />

      {/* Wizard de Depósito (3 etapas) */}
      <DepositWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSelectWallet={(walletId, cryptoType, network, address) => {
          setWizardOpen(false);
          setDepositModal({
            isOpen: true,
            wallet: { id: walletId, cryptoType, network, address }
          });
        }}
      />
    </div>
  );
}
