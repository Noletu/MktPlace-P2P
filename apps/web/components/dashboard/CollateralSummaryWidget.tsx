'use client';

import { useEffect, useState } from 'react';
import DepositWizardModal from '@/components/modals/DepositWizardModal';
import WithdrawWizardModal from '@/components/modals/WithdrawWizardModal';
import { fetchWithAuth } from '@/utils/api';

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

type DisplayCurrency = 'BRL' | 'USD' | 'BTC';

export default function CollateralSummaryWidget() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricesUsd, setPricesUsd] = useState<Record<string, number>>({});
  const [wallets, setWallets] = useState<HDWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAvailable, setExpandedAvailable] = useState(false);
  const [expandedLocked, setExpandedLocked] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [withdrawWizardOpen, setWithdrawWizardOpen] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('BRL');

  useEffect(() => {
    Promise.all([fetchBalances(), fetchPrices(), fetchWallets()]);
  }, []);

  const fetchBalances = async () => {
    try {
      const response = await fetchWithAuth('/collateral-balance');

      if (!response.ok) throw new Error('Erro ao buscar saldos');

      const data = await response.json();
      setBalances(data.data || []);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
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
      if (!response.ok) throw new Error('Erro ao buscar cotações');

      const data = await response.json();
      const brlMap: Record<string, number> = {};
      const usdMap: Record<string, number> = {};

      data.data.forEach((p: Price) => {
        brlMap[p.crypto] = parseFloat(p.brlPrice) || 0;
        usdMap[p.crypto] = parseFloat(p.usdPrice || '0') || 0;
      });

      setPrices(brlMap);
      setPricesUsd(usdMap);
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcula total em BRL
  const calculateTotalBRL = (type: 'available' | 'locked') => {
    let total = 0;
    balances.forEach(balance => {
      const amount = type === 'available'
        ? parseFloat(balance.availableBalance)
        : parseFloat(balance.lockedBalance);
      total += amount * (prices[balance.cryptoType] || 0);
    });
    return total;
  };

  // Calcula total em USD
  const calculateTotalUSD = (type: 'available' | 'locked') => {
    let total = 0;
    balances.forEach(balance => {
      const amount = type === 'available'
        ? parseFloat(balance.availableBalance)
        : parseFloat(balance.lockedBalance);
      total += amount * (pricesUsd[balance.cryptoType] || 0);
    });
    return total;
  };

  // Calcula total em BTC
  const calculateTotalBTC = (type: 'available' | 'locked') => {
    const btcPriceBRL = prices['BTC'] || 0;
    if (btcPriceBRL === 0) return 0;
    const totalBRL = calculateTotalBRL(type);
    return totalBRL / btcPriceBRL;
  };

  // Converte valor individual de BRL para moeda selecionada
  const convertFromBRL = (valueBRL: number): number => {
    if (displayCurrency === 'BRL') return valueBRL;
    if (displayCurrency === 'USD') {
      // Usa cotação USD/BRL (pegar de stablecoin que é 1:1 USD)
      const usdBrlRate = prices['USDT'] || prices['USDC'] || 0;
      return usdBrlRate > 0 ? valueBRL / usdBrlRate : 0;
    }
    // BTC
    const btcPriceBRL = prices['BTC'] || 0;
    return btcPriceBRL > 0 ? valueBRL / btcPriceBRL : 0;
  };

  // Formata valor conforme moeda selecionada
  const formatDisplay = (valueBRL: number): string => {
    const converted = convertFromBRL(valueBRL);
    if (displayCurrency === 'BRL') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(converted);
    }
    if (displayCurrency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(converted);
    }
    // BTC — mostrar com 8 casas
    return `${converted.toFixed(8)} BTC`;
  };

  const formatCrypto = (value: string) => {
    return parseFloat(value).toFixed(8);
  };

  const totalAvailableBRL = calculateTotalBRL('available');
  const totalLockedBRL = calculateTotalBRL('locked');

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

  const currencyButtons: { key: DisplayCurrency; label: string }[] = [
    { key: 'BRL', label: 'R$' },
    { key: 'USD', label: 'US$' },
    { key: 'BTC', label: 'BTC' },
  ];

  return (
    <div className="space-y-4">
      {/* Título + Toggle de moeda */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Saldo de Colateral
        </h3>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {currencyButtons.map((c) => (
            <button
              key={c.key}
              onClick={() => setDisplayCurrency(c.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                displayCurrency === c.key
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card: Saldo Disponível */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Saldo Disponível</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {formatDisplay(totalAvailableBRL)}
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
                      {formatDisplay(valueInBRL)}
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
              {formatDisplay(totalLockedBRL)}
            </p>
          </div>

          {totalLockedBRL > 0 && (
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
                        {formatCrypto(balance.lockedBalance)} {balance.cryptoType}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {formatDisplay(valueInBRL)}
                    </p>
                  </div>
                );
              })}
          </div>
        )}

        {totalLockedBRL === 0 && (
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
