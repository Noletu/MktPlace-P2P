'use client';

import { useState } from 'react';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import CryptoPriceCard from './CryptoPriceCard';

export default function CryptoPriceCards() {
  const { data, loading, error } = useCryptoPrices();
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-xs text-gray-600 dark:text-gray-400">Carregando preços...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-3 py-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
        <span className="text-xs text-red-600 dark:text-red-400">Erro ao carregar preços</span>
      </div>
    );
  }

  // Format fee for compact display
  const formatFee = (amount: number): string => {
    if (amount === 0) return '$0';
    if (amount < 0.01) return `$${amount.toFixed(4)}`;
    if (amount < 1) return `$${amount.toFixed(3)}`;
    return `$${amount.toFixed(2)}`;
  };

  // Desktop: Show all 3 cards side by side
  const DesktopView = () => (
    <div className="hidden lg:flex items-center gap-2">
      <CryptoPriceCard
        symbol="BTC"
        icon="₿"
        name="Bitcoin"
        price={data.prices.btc}
        fees={data.fees.btc}
        lastUpdated={data.lastUpdated.prices}
      />
      <CryptoPriceCard
        symbol="SOL"
        icon="◎"
        name="Solana"
        price={data.prices.sol}
        fees={data.fees.sol}
        lastUpdated={data.lastUpdated.prices}
      />
      <CryptoPriceCard
        symbol="ETH"
        icon="Ξ"
        name="Ethereum"
        price={data.prices.eth}
        fees={data.fees.eth}
        lastUpdated={data.lastUpdated.prices}
      />
    </div>
  );

  // Mobile/Tablet: Show dropdown button
  const MobileView = () => (
    <div className="lg:hidden relative">
      <button
        onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-lg">💰</span>
        <span className="text-xs font-medium text-gray-900 dark:text-white">Preços</span>
        <svg
          className={`w-4 h-4 text-gray-600 dark:text-gray-300 transition-transform ${
            mobileDropdownOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {mobileDropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMobileDropdownOpen(false)}
          ></div>

          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Preços & Taxas de Rede</h3>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Bitcoin */}
              <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">₿</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Bitcoin (BTC)</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        ${data.prices.btc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="ml-8 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>🐢 Lenta:</span>
                    <span className="font-medium">{formatFee(data.fees.btc.estimatedUSD.slow)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>⚡ Média:</span>
                    <span className="font-medium">{formatFee(data.fees.btc.estimatedUSD.medium)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>🚀 Rápida:</span>
                    <span className="font-medium">{formatFee(data.fees.btc.estimatedUSD.fastest)}</span>
                  </div>
                </div>
              </div>

              {/* Solana */}
              <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">◎</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Solana (SOL)</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        ${data.prices.sol.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="ml-8 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Taxa padrão:</span>
                    <span className="font-medium">{formatFee(data.fees.sol.estimatedUSD)}</span>
                  </div>
                </div>
              </div>

              {/* Ethereum */}
              <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">Ξ</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Ethereum (ETH)</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        ${data.prices.eth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="ml-8 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>L1 Ethereum:</span>
                    <span className="font-medium">{formatFee(data.fees.eth.l1.estimatedUSD)}</span>
                  </div>
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>L2 Base:</span>
                    <span className="font-medium">{formatFee(data.fees.eth.l2.estimatedUSD)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Atualizado: {data.lastUpdated.prices.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <DesktopView />
      <MobileView />
    </>
  );
}
