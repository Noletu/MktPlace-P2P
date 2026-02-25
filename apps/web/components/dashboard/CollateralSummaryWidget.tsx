'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DepositWizardModal from '@/components/modals/DepositWizardModal';
import WithdrawWizardModal from '@/components/modals/WithdrawWizardModal';

interface Balance {
  cryptoType: string;
  balance: string;
  availableBalance: string;
  lockedBalance: string;
}

interface Price {
  crypto: string;
  brlPrice: string;
  usdPrice?: string;
}

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

export default function CollateralSummaryWidget() {
  const router = useRouter();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [wallets, setWallets] = useState<HDWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAvailable, setExpandedAvailable] = useState(false);
  const [expandedLocked, setExpandedLocked] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [withdrawWizardOpen, setWithdrawWizardOpen] = useState(false);

  useEffect(() => {
    Promise.all([fetchBalances(), fetchPrices(), fetchWallets()]);
  }, []);

  const fetchBalances = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3002/api/v1/collateral-balance', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erro ao buscar saldos');

      const data = await response.json();
      setBalances(data.data || []);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const fetchWallets = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3002/api/v1/wallets', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
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
      const response = await fetch('http://localhost:3002/api/v1/prices');
      if (!response.ok) throw new Error('Erro ao buscar cotações');

      const data = await response.json();
      const priceMap: Record<string, number> = {};

      data.data.forEach((p: Price) => {
        priceMap[p.crypto] = parseFloat(p.brlPrice) || 0;
      });

      setPrices(priceMap);
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalUSD = (type: 'available' | 'locked') => {
    let total = 0;

    balances.forEach(balance => {
      const amount = type === 'available'
        ? parseFloat(balance.availableBalance)
        : parseFloat(balance.lockedBalance);

      const priceInBRL = prices[balance.cryptoType] || 0;
      total += amount * priceInBRL;
    });

    return total;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCrypto = (value: string) => {
    return parseFloat(value).toFixed(8);
  };

  const totalAvailable = calculateTotalUSD('available');
  const totalLocked = calculateTotalUSD('locked');

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Título */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        💰 Saldo de Colateral
      </h3>

      {/* Card: Saldo Disponível */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Saldo Disponível</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(totalAvailable)}
            </p>
          </div>

          <button
            onClick={() => setExpandedAvailable(!expandedAvailable)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-green-200 dark:hover:bg-green-700/30 rounded-lg transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expandedAvailable ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {expandedAvailable ? 'Recolher' : 'Ver Composição'}
          </button>
        </div>

        {/* Breakdown expandido */}
        {expandedAvailable && (
          <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700 space-y-2">
            {balances
              .filter(b => parseFloat(b.availableBalance) > 0)
              .map((balance, idx) => {
                const amount = parseFloat(balance.availableBalance);
                const valueInBRL = amount * (prices[balance.cryptoType] || 0);

                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-gray-900/50 rounded-lg p-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {balance.cryptoType}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCrypto(balance.availableBalance)} {balance.cryptoType}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(valueInBRL)}
                    </p>
                  </div>
                );
              })}

            {balances.filter(b => parseFloat(b.availableBalance) > 0).length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                Nenhum saldo disponível
              </p>
            )}
          </div>
        )}
      </div>

      {/* Card: Saldo Bloqueado */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Saldo Bloqueado</p>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">
              {formatCurrency(totalLocked)}
            </p>
          </div>

          {totalLocked > 0 && (
            <button
              onClick={() => setExpandedLocked(!expandedLocked)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-200 dark:hover:bg-orange-700/30 rounded-lg transition-colors flex items-center gap-1"
            >
              <svg
                className={`w-4 h-4 transition-transform ${expandedLocked ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {expandedLocked ? 'Recolher' : 'Ver Detalhes'}
            </button>
          )}
        </div>

        {/* Breakdown expandido */}
        {expandedLocked && (
          <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-700 space-y-2">
            {balances
              .filter(b => parseFloat(b.lockedBalance) > 0)
              .map((balance, idx) => {
                const amount = parseFloat(balance.lockedBalance);
                const valueInBRL = amount * (prices[balance.cryptoType] || 0);

                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-gray-900/50 rounded-lg p-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {balance.cryptoType}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        🔒 {formatCrypto(balance.lockedBalance)} {balance.cryptoType}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(valueInBRL)}
                    </p>
                  </div>
                );
              })}
          </div>
        )}

        {totalLocked === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhum valor bloqueado
          </p>
        )}
      </div>

      {/* Botões Depositar / Sacar */}
      <div className="flex justify-center gap-4">
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
      </div>

      {/* Botão Ver Detalhes */}
      <button
        onClick={() => router.push('/wallet')}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <span>Ver Detalhes Completos</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Deposit Wizard Modal */}
      <DepositWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* Withdraw Wizard Modal */}
      <WithdrawWizardModal
        isOpen={withdrawWizardOpen}
        onClose={() => setWithdrawWizardOpen(false)}
        wallets={wallets}
        prices={prices}
        onSuccess={() => {
          Promise.all([fetchBalances(), fetchWallets()]);
        }}
      />

    </div>
  );
}
