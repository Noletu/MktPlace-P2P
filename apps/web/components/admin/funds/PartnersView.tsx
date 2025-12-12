'use client';

import { useEffect, useState } from 'react';

interface PartnerCrypto {
  cryptoType: string;
  networks: Array<{
    network: string;
    address: string;
    balance: string;
    availableBalance: string;
    feesCollected: string;
    deposited: string;
    withdrawn: string;
    lastSyncedAt: string | null;
  }>;
  totalBalance: string;
  totalFees: string;
  totalDeposits: string;
  totalWithdrawals: string;
}

interface PartnersData {
  partners: PartnerCrypto[];
  summary: {
    totalPlatformWallets: number;
    cryptosSupported: number;
  };
}

export default function PartnersView() {
  const [data, setData] = useState<PartnersData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch('http://localhost:3001/api/v1/admin/funds/partners', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar dados dos sócios');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados dos sócios');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Carregando fundos dos sócios...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400">Erro ao carregar dados</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-300">Platform Wallets</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.totalPlatformWallets}</p>
            </div>
            <div className="text-4xl">💼</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-300">Cryptos Suportadas</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.cryptosSupported}</p>
            </div>
            <div className="text-4xl">🪙</div>
          </div>
        </div>
      </div>

      {/* Funds by Crypto */}
      {data.partners.map((crypto) => (
        <div key={crypto.cryptoType} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-white">{crypto.cryptoType}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-400">Saldo Total</p>
                <p className="text-lg font-bold text-green-400">{crypto.totalBalance || '0'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Fees Coletadas</p>
                <p className="text-lg font-bold text-blue-400">{crypto.totalFees || '0'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Depositado</p>
                <p className="text-lg font-bold text-purple-400">{crypto.totalDeposits || '0'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Sacado</p>
                <p className="text-lg font-bold text-yellow-400">{crypto.totalWithdrawals || '0'}</p>
              </div>
            </div>
          </div>

          {/* Networks */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-300 uppercase">Redes</h4>
            {crypto.networks.map((network) => (
              <div key={network.network} className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm font-medium">
                    {network.network}
                  </span>
                  {network.lastSyncedAt && (
                    <span className="text-xs text-gray-500">
                      Sync: {new Date(network.lastSyncedAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">Endereço</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-gray-300 bg-gray-800 px-2 py-1 rounded flex-1 overflow-x-auto">
                      {network.address}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(network.address)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition"
                      title="Copiar endereço"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Saldo</p>
                    <p className="text-white font-mono">{network.balance || '0'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Disponível</p>
                    <p className="text-green-400 font-mono">{network.availableBalance || '0'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Fees</p>
                    <p className="text-blue-400 font-mono">{network.feesCollected || '0'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Depositado</p>
                    <p className="text-purple-400 font-mono">{network.deposited || '0'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {data.partners.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
          <p className="text-gray-400">Nenhuma platform wallet encontrada</p>
          <p className="text-sm text-gray-500 mt-2">Configure a master seed para gerar as carteiras dos sócios</p>
        </div>
      )}
    </div>
  );
}
