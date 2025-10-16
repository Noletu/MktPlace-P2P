'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType, NetworkType, CRYPTO_SUPPORTED_NETWORKS } from '@mktplace/shared';
import ThemeToggle from '@/components/ThemeToggle';

interface Wallet {
  id: string;
  crypto: string;
  network: string;
  address: string;
  balance: string;
  isActive: boolean;
  createdAt: string;
}

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  USDC: 'USD Coin',
  USDT: 'Tether',
};

export default function WalletsPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [crypto, setCrypto] = useState('BTC');
  const [network, setNetwork] = useState('BITCOIN');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Use CRYPTO_SUPPORTED_NETWORKS do shared
  const NETWORK_OPTIONS: Record<string, NetworkType[]> = {
    BTC: CRYPTO_SUPPORTED_NETWORKS[CryptoType.BTC],
    USDC: CRYPTO_SUPPORTED_NETWORKS[CryptoType.USDC],
    USDT: CRYPTO_SUPPORTED_NETWORKS[CryptoType.USDT],
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  useEffect(() => {
    // Atualizar rede quando crypto mudar
    setNetwork(NETWORK_OPTIONS[crypto][0]);
  }, [crypto]);

  const fetchWallets = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/v1/wallets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar carteiras');
      }

      const data = await response.json();
      setWallets(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/v1/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          crypto,
          network,
          address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao adicionar carteira');
      }

      setShowAddForm(false);
      setAddress('');
      await fetchWallets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWallet = async (walletId: string, permanent: boolean = false) => {
    const message = permanent
      ? 'Tem certeza que deseja DELETAR PERMANENTEMENTE esta carteira? Esta ação não pode ser desfeita!'
      : 'Tem certeza que deseja desativar esta carteira?';

    if (!confirm(message)) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const url = permanent
        ? `http://localhost:3001/api/v1/wallets/${walletId}/permanent`
        : `http://localhost:3001/api/v1/wallets/${walletId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao deletar carteira');
      }

      await fetchWallets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">💳 Meus Endereços</h1>
          <div className="flex gap-4">
            <ThemeToggle />
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg transition-colors"
            >
              {showAddForm ? 'Cancelar' : '+ Novo Endereço'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Formulário Adicionar Carteira */}
        {showAddForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Adicionar Novo Endereço</h2>
            <form onSubmit={handleAddWallet} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Selecione a Criptomoeda
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(CRYPTO_NAMES).map(([key, name]) => (
                    <div
                      key={key}
                      onClick={() => setCrypto(key)}
                      className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                        crypto === key
                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <CryptoIcon crypto={key as CryptoType} size={28} />
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{key}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rede</label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {NETWORK_OPTIONS[crypto].map((net) => (
                    <option key={net} value={net}>
                      {net}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Endereço da Carteira
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Digite o endereço da sua carteira"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Adicionando...' : 'Adicionar Carteira'}
              </button>
            </form>
          </div>
        )}

        {/* Lista de Carteiras */}
        {wallets.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">Você ainda não adicionou nenhuma carteira.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors"
            >
              Adicionar Primeira Carteira
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {wallets.map((wallet) => (
              <div key={wallet.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <CryptoIcon crypto={wallet.crypto as CryptoType} size={32} />
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {CRYPTO_NAMES[wallet.crypto]} ({wallet.crypto})
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{wallet.network}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteWallet(wallet.id, false)}
                      className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-500 font-semibold text-sm"
                    >
                      Desativar
                    </button>
                    <button
                      onClick={() => handleDeleteWallet(wallet.id, true)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-500 font-semibold text-sm"
                    >
                      Deletar
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Endereço</p>
                  <p className="font-mono text-sm break-all bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded">
                    {wallet.address}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Saldo</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {parseFloat(wallet.balance).toFixed(8)} {wallet.crypto}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
