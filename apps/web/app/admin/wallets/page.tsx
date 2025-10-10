'use client';

import { useEffect, useState } from 'react';

interface PlatformWallet {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  label?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminWallets() {
  const [wallets, setWallets] = useState<PlatformWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<PlatformWallet | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    cryptoType: '',
    network: '',
    address: '',
    label: '',
  });

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/admin/platform-wallets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setWallets(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar endereços:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/admin/platform-wallets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert('Endereço criado com sucesso!');
        setShowCreateModal(false);
        setFormData({ cryptoType: '', network: '', address: '', label: '' });
        fetchWallets();
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao criar endereço:', error);
      alert('Erro ao criar endereço');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v1/admin/platform-wallets/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      const data = await response.json();

      if (data.success) {
        fetchWallets();
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar endereço:', error);
      alert('Erro ao atualizar endereço');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este endereço?')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v1/admin/platform-wallets/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        alert('Endereço removido com sucesso!');
        fetchWallets();
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao remover endereço:', error);
      alert('Erro ao remover endereço');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Carregando endereços...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Endereços da Plataforma</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
        >
          + Adicionar Endereço
        </button>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 gap-6">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`bg-white rounded-lg shadow-md p-6 ${
              !wallet.isActive ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl">
                    {wallet.cryptoType === 'BTC' && '₿'}
                    {wallet.cryptoType === 'USDT' && '💵'}
                    {wallet.cryptoType === 'USDC' && '💲'}
                    {wallet.cryptoType === 'ETH' && 'Ξ'}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {wallet.cryptoType} - {wallet.network}
                    </h3>
                    {wallet.label && (
                      <p className="text-sm text-gray-500">{wallet.label}</p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      wallet.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {wallet.isActive ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <p className="text-xs text-gray-500 mb-1">Endereço:</p>
                  <p className="font-mono text-sm text-gray-900 break-all">
                    {wallet.address}
                  </p>
                </div>

                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Criado: {new Date(wallet.createdAt).toLocaleDateString('pt-BR')}</span>
                  <span>Atualizado: {new Date(wallet.updatedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <div className="flex flex-col space-y-2 ml-4">
                <button
                  onClick={() => handleToggleActive(wallet.id, wallet.isActive)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                    wallet.isActive
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {wallet.isActive ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => handleDelete(wallet.id)}
                  className="px-4 py-2 bg-red-100 text-red-800 hover:bg-red-200 rounded-lg font-medium text-sm transition"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        ))}

        {wallets.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">Nenhum endereço cadastrado</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Adicionar Primeiro Endereço
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Adicionar Endereço da Plataforma</h2>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Criptomoeda *
                  </label>
                  <select
                    value={formData.cryptoType}
                    onChange={(e) => setFormData({ ...formData, cryptoType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="BTC">BTC - Bitcoin</option>
                    <option value="USDT">USDT - Tether</option>
                    <option value="USDC">USDC - USD Coin</option>
                    <option value="ETH">ETH - Ethereum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rede *
                  </label>
                  <select
                    value={formData.network}
                    onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="BITCOIN">BITCOIN</option>
                    <option value="ETHEREUM">ETHEREUM</option>
                    <option value="BASE">BASE</option>
                    <option value="ARBITRUM">ARBITRUM</option>
                    <option value="TRC20">TRC20 (Tron)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço *
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="0x... ou bc1... ou T..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Label (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Carteira Principal USDT TRC20"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    Adicionar Endereço
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({ cryptoType: '', network: '', address: '', label: '' });
                    }}
                    className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
