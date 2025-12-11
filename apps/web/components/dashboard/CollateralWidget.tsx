'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DepositModal from '@/components/modals/DepositModal';
import DepositWizardModal from '@/components/modals/DepositWizardModal';
import AggregatedCryptoCard from './AggregatedCryptoCard';

interface InternalBalance {
  id: string;
  cryptoType: string;
  network: string;
  balance: string;
  lockedAmount: string;
  availableAmount: string;
  address: string;
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

type FilterMode = 'all' | 'with_balance' | 'empty';

export default function CollateralWidget() {
  const router = useRouter();
  const [balances, setBalances] = useState<InternalBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtro de carteiras
  const [filterMode, setFilterMode] = useState<FilterMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('walletFilter') as FilterMode) || 'all';
    }
    return 'all';
  });
  const [filterOpen, setFilterOpen] = useState(false);

  // Modal de depósito
  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    wallet: {
      id: string;
      cryptoType: string;
      network: string;
      address: string;
    } | null;
  }>({ isOpen: false, wallet: null });

  // Wizard de depósito
  const [wizardOpen, setWizardOpen] = useState(false);

  // Estado de expandido para agregação
  const [expandedCrypto, setExpandedCrypto] = useState<string | null>(null);

  useEffect(() => {
    fetchBalances();
  }, []);

  // Salvar filtro no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('walletFilter', filterMode);
    }
  }, [filterMode]);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/collateral-balance');
      const balancesArray = data.data?.balances || data.data || [];
      setBalances(Array.isArray(balancesArray) ? balancesArray : []);
    } catch (err) {
      console.error('Erro ao buscar saldos:', err);
      setError('Erro ao carregar saldos');
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return num.toFixed(8);
  };

  const handleAddCollateral = () => {
    setWizardOpen(true);
  };

  const handleOpenDeposit = (balance: InternalBalance) => {
    setDepositModal({
      isOpen: true,
      wallet: {
        id: balance.id,
        cryptoType: balance.cryptoType,
        network: balance.network,
        address: balance.address,
      }
    });
  };

  // Função para agregar balances por moeda
  const aggregateBalancesByCrypto = (balances: InternalBalance[]): AggregatedBalance[] => {
    const grouped: Record<string, InternalBalance[]> = {};

    balances.forEach(balance => {
      if (!grouped[balance.cryptoType]) {
        grouped[balance.cryptoType] = [];
      }
      grouped[balance.cryptoType].push(balance);
    });

    return Object.entries(grouped).map(([cryptoType, networks]) => ({
      cryptoType,
      totalBalance: networks
        .reduce((sum, b) => sum + parseFloat(b.balance || '0'), 0)
        .toFixed(8),
      totalAvailable: networks
        .reduce((sum, b) => sum + parseFloat(b.availableAmount || '0'), 0)
        .toFixed(8),
      totalLocked: networks
        .reduce((sum, b) => sum + parseFloat(b.lockedAmount || '0'), 0)
        .toFixed(8),
      networks: networks.map(b => ({
        network: b.network,
        id: b.id,
        balance: b.balance,
        availableAmount: b.availableAmount,
        lockedAmount: b.lockedAmount,
        address: b.address,
      })),
    }));
  };

  // Filtrar carteiras
  const filteredBalances = balances.filter((balance) => {
    const hasBalance = parseFloat(balance.balance) > 0;

    if (filterMode === 'with_balance') {
      return hasBalance;
    } else if (filterMode === 'empty') {
      return !hasBalance;
    }
    return true; // 'all'
  });

  // Agregar balances por moeda
  const aggregatedBalances = aggregateBalancesByCrypto(filteredBalances);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">💰 Saldo de Colateral</h3>
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">💰 Saldo de Colateral</h3>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const totalBalances = aggregatedBalances.length;
  const totalAvailable = aggregatedBalances.reduce(
    (sum, b) => sum + parseFloat(b.totalAvailable || '0'),
    0
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">💰 Saldo de Colateral</h3>

        <div className="flex items-center gap-3">
          {/* Filter Dropdown */}
          {balances.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>
                  {filterMode === 'all' && 'Todas'}
                  {filterMode === 'with_balance' && 'Com Saldo'}
                  {filterMode === 'empty' && 'Vazias'}
                </span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {filterOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setFilterOpen(false)}
                  />

                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                    <button
                      onClick={() => {
                        setFilterMode('all');
                        setFilterOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        filterMode === 'all' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>👁️</span>
                        <span>Mostrar Todas</span>
                        {filterMode === 'all' && <span className="ml-auto">✓</span>}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setFilterMode('with_balance');
                        setFilterOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        filterMode === 'with_balance' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>💰</span>
                        <span>Apenas com Saldo</span>
                        {filterMode === 'with_balance' && <span className="ml-auto">✓</span>}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setFilterMode('empty');
                        setFilterOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        filterMode === 'empty' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>📭</span>
                        <span>Apenas Vazias</span>
                        {filterMode === 'empty' && <span className="ml-auto">✓</span>}
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Add Button - Melhorado */}
          <button
            onClick={handleAddCollateral}
            className="group px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 dark:from-green-700 dark:to-green-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
          >
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Depositar Colateral</span>
            <span className="sm:hidden">Depositar</span>
            <span className="text-xs opacity-80">→</span>
          </button>
        </div>
      </div>

      {totalBalances === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Você ainda não tem saldo de colateral
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
            Deposite cripto para criar pedidos instantaneamente e economizar em taxas de rede
          </p>
          <button
            onClick={handleAddCollateral}
            className="group px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2 justify-center"
          >
            <svg className="w-6 h-6 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Adicionar Primeiro Colateral</span>
            <span className="text-xs opacity-80">→</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total de Moedas</p>
              <p className="text-2xl font-bold">{totalBalances}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Disponível</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {totalAvailable > 0 ? '✅' : '⚠️'}
              </p>
            </div>
          </div>

          {/* Contador de filtro */}
          {filterMode !== 'all' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Mostrando {filteredBalances.length} de {balances.length} carteiras
            </p>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {aggregatedBalances.map((balance) => (
              <AggregatedCryptoCard
                key={balance.cryptoType}
                balance={balance}
                isExpanded={expandedCrypto === balance.cryptoType}
                onToggleExpand={() => setExpandedCrypto(
                  expandedCrypto === balance.cryptoType ? null : balance.cryptoType
                )}
                onOpenDeposit={(id, cryptoType, network, address) =>
                  setDepositModal({
                    isOpen: true,
                    wallet: { id, cryptoType, network, address }
                  })
                }
              />
            ))}
          </div>

          <button
            onClick={() => router.push('/collateral-balance')}
            className="w-full mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            Ver Detalhes →
          </button>
        </>
      )}

      {/* Modal de Depósito */}
      <DepositModal
        isOpen={depositModal.isOpen}
        onClose={() => setDepositModal({ isOpen: false, wallet: null })}
        wallet={depositModal.wallet}
      />

      {/* Wizard de Depósito */}
      <DepositWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </div>
  );
}
