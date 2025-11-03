'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';

interface CollateralBalance {
  id: string;
  cryptoType: string;
  network: string;
  balance: string;
  lockedAmount: string;
  availableBalance: string;
}

export default function CollateralWidget() {
  const router = useRouter();
  const [balances, setBalances] = useState<CollateralBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/collateral-balance', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        // Agrupar por crypto (somar todas as redes)
        const grouped = data.data.balances.reduce((acc: any, bal: CollateralBalance) => {
          if (!acc[bal.cryptoType]) {
            acc[bal.cryptoType] = {
              cryptoType: bal.cryptoType,
              balance: 0,
              lockedAmount: 0,
              availableBalance: 0,
            };
          }
          acc[bal.cryptoType].balance += parseFloat(bal.balance);
          acc[bal.cryptoType].lockedAmount += parseFloat(bal.lockedAmount);
          acc[bal.cryptoType].availableBalance += parseFloat(bal.availableBalance);
          return acc;
        }, {});

        setBalances(Object.values(grouped));
      }
    } catch (error) {
      console.error('Erro ao buscar saldos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatAmount = (amount: number, crypto: string) => {
    const decimals = crypto === 'BTC' ? 8 : 2;
    return amount.toFixed(decimals);
  };

  const hasAnyBalance = balances.some((b) => parseFloat(b.availableBalance) > 0);

  const handleDepositSuccess = () => {
    fetchBalances();
  };

  const handleWithdrawSuccess = () => {
    fetchBalances();
  };

  return (
    <>
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={handleDepositSuccess}
      />
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={handleWithdrawSuccess}
        balances={balances}
      />

      <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Saldo de Colateral
            </h2>
          </div>
          <button
            onClick={() => router.push('/collateral-balance')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-sm flex items-center gap-1 transition-colors"
          >
            Ver Tudo
            <span>→</span>
          </button>
        </div>

        {balances.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💳</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Você ainda não tem saldo de colateral
            </p>
            <button
              onClick={() => setShowDepositModal(true)}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              💰 Depositar Agora
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {['BTC', 'USDT', 'USDC'].map((crypto) => {
                const balance = balances.find((b) => b.cryptoType === crypto);
                const available = balance ? balance.availableBalance : 0;
                const locked = balance ? balance.lockedAmount : 0;
                const total = balance ? balance.balance : 0;

                return (
                  <div
                    key={crypto}
                    className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <CryptoIcon crypto={crypto as CryptoType} size={24} />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {crypto}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Disponível</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          {formatAmount(Number(available), crypto)}
                        </p>
                      </div>
                      {Number(locked) > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Bloqueado</p>
                          <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                            {formatAmount(Number(locked), crypto)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setShowDepositModal(true)}
                className="py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-md flex items-center justify-center gap-2"
              >
                <span className="text-xl">💰</span>
                <span>Depositar</span>
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={!hasAnyBalance}
                className="py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <span className="text-xl">💸</span>
                <span>Sacar</span>
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-center">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                ✨ Use seu saldo interno e economize até 99% em taxas de rede!
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
