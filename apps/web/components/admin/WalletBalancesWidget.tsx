'use client';

import { useEffect, useState } from 'react';

interface WalletBalance {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  valueUSD: string;
}

export default function WalletBalancesWidget() {
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/admin/finance/wallet-balances', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setWallets(data.data);
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-4 text-gray-600 dark:text-gray-300">Carregando...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">🏦 Carteiras da Plataforma</h3>
        <a href="/admin/funds" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
          Ver detalhes →
        </a>
      </div>

      {wallets.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Nenhuma carteira configurada</p>
      ) : (
        <div className="space-y-3">
          {wallets.map((wallet) => (
            <div key={wallet.id} className="flex items-center justify-between border-b border-gray-300 dark:border-gray-700 pb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{wallet.cryptoType}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{wallet.network}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate max-w-[200px]">{wallet.address}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{wallet.balance || '0.00'}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">$ {wallet.valueUSD || '0.00'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
