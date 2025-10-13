'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PlatformWallet {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  label?: string;
  isActive: boolean;
  createdAt: string;
}

const CRYPTO_OPTIONS = ['BTC', 'USDC', 'USDT'];
const NETWORK_OPTIONS: Record<string, string[]> = {
  BTC: ['BITCOIN'],
  USDC: ['ETHEREUM', 'TRC20', 'BASE', 'ARBITRUM', 'SOLANA'],
  USDT: ['ETHEREUM', 'TRC20', 'BASE', 'ARBITRUM', 'SOLANA'],
};

export default function PlatformWalletsPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<PlatformWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [cryptoType, setCryptoType] = useState('BTC');
  const [network, setNetwork] = useState('BITCOIN');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/admin/platform-wallets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar endereços');
      }

      setWallets(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/admin/platform-wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cryptoType,
          network,
          address,
          label: label || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar endereço');
      }

      alert('✅ Endereço da plataforma criado com sucesso!');
      setShowForm(false);
      setCryptoType('BTC');
      setNetwork('BITCOIN');
      setAddress('');
      setLabel('');
      fetchWallets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v1/admin/platform-wallets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar endereço');
      }

      fetchWallets();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const deleteWallet = async (id: string) => {
    if (!confirm('⚠️ Tem certeza que deseja remover este endereço?\n\nISTO PODE QUEBRAR DEPÓSITOS EM ANDAMENTO!')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v1/admin/platform-wallets/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao remover endereço');
      }

      alert('🗑️ Endereço removido com sucesso');
      fetchWallets();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xl">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">🏦 Endereços da Plataforma</h1>
            <p className="text-gray-600 mt-2">Gerencie os endereços onde os colaterais serão depositados</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg"
            >
              ← Voltar
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              {showForm ? '❌ Cancelar' : '➕ Adicionar Endereço'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Formulário de criação */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-xl font-bold mb-6">Adicionar Novo Endereço</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Criptomoeda *
                  </label>
                  <select
                    value={cryptoType}
                    onChange={(e) => {
                      setCryptoType(e.target.value);
                      setNetwork(NETWORK_OPTIONS[e.target.value][0]);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {CRYPTO_OPTIONS.map((crypto) => (
                      <option key={crypto} value={crypto}>
                        {crypto}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rede *
                  </label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {NETWORK_OPTIONS[cryptoType].map((net) => (
                      <option key={net} value={net}>
                        {net}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço da Carteira *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Digite o endereço completo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  required
                  minLength={26}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Label (opcional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Carteira Principal BTC"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>IMPORTANTE:</strong> Certifique-se que este endereço pertence à plataforma
                  e que você tem acesso às chaves privadas. Todos os colaterais serão depositados neste endereço.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Criando...' : '✅ Criar Endereço'}
              </button>
            </form>
          </div>
        )}

        {/* Lista de endereços */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">Endereços Cadastrados ({wallets.length})</h2>
          </div>

          {wallets.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg mb-2">Nenhum endereço cadastrado</p>
              <p className="text-sm">Clique em "Adicionar Endereço" para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cripto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rede</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endereço</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {wallets.map((wallet) => (
                    <tr key={wallet.id} className={!wallet.isActive ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold">{wallet.cryptoType}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{wallet.network}</span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {wallet.address.slice(0, 20)}...{wallet.address.slice(-10)}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{wallet.label || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {wallet.isActive ? (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            ✅ Ativo
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                            ❌ Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleActive(wallet.id, wallet.isActive)}
                            className={`px-3 py-1 text-xs font-semibold rounded ${
                              wallet.isActive
                                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
                                : 'bg-green-100 hover:bg-green-200 text-green-800'
                            }`}
                          >
                            {wallet.isActive ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => deleteWallet(wallet.id)}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold rounded"
                          >
                            🗑️ Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Informações importantes */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">ℹ️ Como funciona:</h3>
          <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
            <li>Quando um usuário cria um pedido, o sistema gera um endereço de depósito usando o endereço ATIVO da plataforma</li>
            <li>Apenas UM endereço pode estar ativo por combinação de cripto + rede</li>
            <li>Se você desativar um endereço, pedidos novos não poderão ser criados para aquela cripto/rede</li>
            <li>NUNCA remova um endereço que ainda tem depósitos pendentes!</li>
            <li>Você pode ter múltiplos endereços para a mesma cripto/rede, mas apenas um pode estar ativo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
