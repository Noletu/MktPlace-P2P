'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  ETH: 'Ethereum',
  XMR: 'Monero',
  ZEC: 'Zcash',
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

  const NETWORK_OPTIONS: Record<string, string[]> = {
    BTC: ['BITCOIN'],
    ETH: ['ETHEREUM'],
    XMR: ['MONERO'],
    ZEC: ['ZCASH'],
    USDC: ['ETHEREUM', 'POLYGON', 'BSC', 'SOLANA'],
    USDT: ['ETHEREUM', 'POLYGON', 'BSC', 'TRC20'],
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
      const response = await fetch('http://localhost:3001/api/v1/wallets', {
        credentials: 'include', // SECURITY: Envia cookies HttpOnly
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
      const response = await fetch('http://localhost:3001/api/v1/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // SECURITY: Envia cookies HttpOnly
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

  const handleDeleteWallet = async (walletId: string) => {
    if (!confirm('Tem certeza que deseja desativar esta carteira?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/v1/wallets/${walletId}`, {
        method: 'DELETE',
        credentials: 'include', // SECURITY: Envia cookies HttpOnly
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao desativar carteira');
      }

      await fetchWallets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Minhas Carteiras</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              {showAddForm ? 'Cancelar' : '+ Nova Carteira'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Formulário Adicionar Carteira */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-2xl font-bold mb-6">Adicionar Nova Carteira</h2>
            <form onSubmit={handleAddWallet} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Criptomoeda
                  </label>
                  <select
                    value={crypto}
                    onChange={(e) => setCrypto(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(CRYPTO_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name} ({key})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rede</label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {NETWORK_OPTIONS[crypto].map((net) => (
                      <option key={net} value={net}>
                        {net}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço da Carteira
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Digite o endereço da sua carteira"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Adicionando...' : 'Adicionar Carteira'}
              </button>
            </form>
          </div>
        )}

        {/* Lista de Carteiras */}
        {wallets.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">Você ainda não adicionou nenhuma carteira.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Adicionar Primeira Carteira
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {wallets.map((wallet) => (
              <div key={wallet.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold">
                      {CRYPTO_NAMES[wallet.crypto]} ({wallet.crypto})
                    </h3>
                    <p className="text-sm text-gray-600">{wallet.network}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteWallet(wallet.id)}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >
                    Desativar
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Endereço</p>
                  <p className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
                    {wallet.address}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">Saldo</p>
                  <p className="text-2xl font-bold">
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
