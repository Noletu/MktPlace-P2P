'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface InternalBalance {
  id: string;
  cryptoType: string;
  network: string;
  balance: string;
  lockedAmount: string;
  availableAmount: string;
}

export default function CollateralWidget() {
  const router = useRouter();
  const [balances, setBalances] = useState<InternalBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/v1/collateral-balance', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar saldos');
      }

      const data = await response.json();
      setBalances(data.data || []);
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
    router.push('/collateral-balance');
  };

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

  const totalBalances = balances.length;
  const totalAvailable = balances.reduce(
    (sum, b) => sum + parseFloat(b.availableAmount || '0'),
    0
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">💰 Saldo de Colateral</h3>
        <button
          onClick={handleAddCollateral}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          ➕ Adicionar
        </button>
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
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Adicionar Primeiro Colateral
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

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {balances.map((balance) => (
              <div
                key={balance.id}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">
                      {balance.cryptoType} <span className="text-xs text-gray-500">({balance.network})</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Disponível: {formatBalance(balance.availableAmount)}
                    </p>
                    {parseFloat(balance.lockedAmount) > 0 && (
                      <p className="text-xs text-orange-500 dark:text-orange-400">
                        🔒 Bloqueado: {formatBalance(balance.lockedAmount)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatBalance(balance.balance)}
                    </p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddCollateral}
            className="w-full mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            Ver Detalhes →
          </button>
        </>
      )}
    </div>
  );
}
