'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/config/api';

interface PlatformWallet {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  derivationPath: string;
  balance: string;
  availableBalance: string;
  totalFeesCollected: string;
  isActive: boolean;
  createdAt: string;
}

export default function PlatformWalletsPage() {
  const [wallets, setWallets] = useState<PlatformWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(getApiUrl('admin/platform-wallets'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar carteiras');
      }

      const data = await response.json();
      setWallets(data.data || []);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar carteiras:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAll = async () => {
    if (!confirm('Deseja criar todas as 9 carteiras da plataforma?\n\nIsso irá derivar endereços usando o master seed.')) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(getApiUrl('admin/platform-wallets/create-all'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar carteiras');
      }

      alert(`✅ ${data.message}`);
      await fetchWallets();
    } catch (err: any) {
      console.error('Erro ao criar carteiras:', err);
      alert(`❌ Erro: ${err.message}`);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      alert('✅ Endereço copiado para a área de transferência!');
    } catch (err) {
      console.error('Erro ao copiar:', err);
      alert('❌ Erro ao copiar endereço');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">🏦 Carteiras da Plataforma</h1>
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">🏦 Carteiras da Plataforma</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie os endereços da plataforma usados para receber fees e depósitos dos sócios
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              ❌ <strong>Erro:</strong> {error}
            </p>
          </div>
        )}

        {/* Info Alert */}
        {wallets.length === 0 && (
          <div className="mb-6 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Nenhuma carteira encontrada.</strong> Clique no botão abaixo para criar todas as carteiras da plataforma automaticamente.
            </p>
          </div>
        )}

        {/* Botão Criar Todas */}
        {wallets.length === 0 && (
          <div className="mb-8">
            <button
              onClick={handleCreateAll}
              disabled={creating}
              className={`px-6 py-3 rounded-lg font-medium text-white transition ${
                creating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {creating ? '⏳ Criando carteiras...' : '✨ Criar Todas as Carteiras (9)'}
            </button>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Serão criadas: BTC/BITCOIN + USDT e USDC em 4 redes (Ethereum, Base, Arbitrum, Solana)
            </p>
          </div>
        )}

        {/* Tabela de Carteiras */}
        {wallets.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Crypto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Network
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Fees Coletadas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-300 dark:divide-gray-700">
                  {wallets.map((wallet) => (
                    <tr key={wallet.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                          {wallet.cryptoType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-gray-100">{wallet.network}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-600 dark:text-gray-400">
                            {wallet.address.substring(0, 12)}...{wallet.address.substring(wallet.address.length - 8)}
                          </code>
                          <button
                            onClick={() => copyAddress(wallet.address)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                            title="Copiar endereço completo"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {parseFloat(wallet.balance).toFixed(8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {parseFloat(wallet.totalFeesCollected).toFixed(8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {wallet.isActive ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                            ✅ Ativa
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-400">
                            ⚪ Inativa
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Box */}
        {wallets.length > 0 && (
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900/50 rounded border border-gray-300 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              ℹ️ Informações sobre Carteiras da Plataforma
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Todas as carteiras usam Account 0 (reservado para plataforma)</li>
              <li>• Derivadas do master seed usando BIP44</li>
              <li>• Private keys criptografadas com AES-256-GCM</li>
              <li>• Usadas para receber fees de transações e depósitos dos sócios</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
