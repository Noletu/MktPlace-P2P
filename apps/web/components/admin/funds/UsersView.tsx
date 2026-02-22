'use client';

import { useEffect, useState } from 'react';

interface UserCrypto {
  cryptoType: string;
  totalBalance: string;
  totalWallets: number;
  networks: Array<{
    network: string;
    balance: string;
    walletCount: number;
  }>;
}

interface UserDetail {
  userId: string;
  userName: string;
  userEmail: string;
  wallets: Array<{
    cryptoType: string;
    network: string;
    address: string;
    balance: string;
  }>;
  totalBalance: { [crypto: string]: string };
}

interface UsersData {
  users: {
    byCrypto: UserCrypto[];
    byUser: UserDetail[];
  };
  summary: {
    totalUsers: number;
    totalUserWallets: number;
    cryptosSupported: number;
  };
}

export default function UsersView() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUserBreakdown, setShowUserBreakdown] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch('http://localhost:3002/api/v1/admin/funds/users-funds', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar dados dos usuários');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados dos usuários');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Carregando fundos dos usuários...</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-300">Total de Usuários</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.totalUsers}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-300">User Wallets</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.totalUserWallets}</p>
            </div>
            <div className="text-4xl">💼</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-300">Cryptos</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.cryptosSupported}</p>
            </div>
            <div className="text-4xl">🪙</div>
          </div>
        </div>
      </div>

      {/* Aggregated by Crypto */}
      {data.users.byCrypto.map((crypto) => (
        <div key={crypto.cryptoType} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-white">{crypto.cryptoType}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-400">Saldo Total</p>
                <p className="text-lg font-bold text-green-400">{crypto.totalBalance || '0'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Total de Carteiras</p>
                <p className="text-lg font-bold text-blue-400">{crypto.totalWallets}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Média por Carteira</p>
                <p className="text-lg font-bold text-purple-400">
                  {crypto.totalWallets > 0
                    ? (parseFloat(crypto.totalBalance) / crypto.totalWallets).toFixed(8)
                    : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Networks */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-300 uppercase">Por Rede</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {crypto.networks.map((network) => (
                <div key={network.network} className="bg-gray-900/50 rounded-lg p-3">
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs font-medium">
                    {network.network}
                  </span>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Saldo</p>
                    <p className="text-sm text-white font-mono">{network.balance || '0'}</p>
                  </div>
                  <div className="mt-1">
                    <p className="text-xs text-gray-500">Carteiras</p>
                    <p className="text-sm text-gray-300">{network.walletCount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* User Breakdown Toggle */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <button
          onClick={() => setShowUserBreakdown(!showUserBreakdown)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <h3 className="text-xl font-bold text-white">👤 Breakdown por Usuário</h3>
            <p className="text-sm text-gray-400 mt-1">
              Ver detalhes de cada usuário ({data.users.byUser.length} usuários)
            </p>
          </div>
          <span className="text-2xl text-gray-400">
            {showUserBreakdown ? '▼' : '▶'}
          </span>
        </button>

        {showUserBreakdown && (
          <div className="mt-6 space-y-4">
            {data.users.byUser.map((user) => (
              <div key={user.userId} className="bg-gray-900/50 rounded-lg p-4">
                <div className="mb-3">
                  <h4 className="text-lg font-semibold text-white">{user.userName}</h4>
                  <p className="text-sm text-gray-400">{user.userEmail}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">ID: {user.userId}</p>
                </div>

                {/* User's Total Balance by Crypto */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Saldo Total</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(user.totalBalance).map(([crypto, balance]) => (
                      <div key={crypto} className="bg-gray-800 px-3 py-2 rounded">
                        <span className="text-sm text-gray-400">{crypto}: </span>
                        <span className="text-sm text-green-400 font-mono">{balance}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User's Wallets */}
                <details className="cursor-pointer">
                  <summary className="text-sm text-blue-400 hover:text-blue-300">
                    Ver {user.wallets.length} carteiras
                  </summary>
                  <div className="mt-3 space-y-2">
                    {user.wallets.map((wallet, idx) => (
                      <div key={idx} className="bg-gray-800 p-3 rounded text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded">
                            {wallet.cryptoType}
                          </span>
                          <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded">
                            {wallet.network}
                          </span>
                        </div>
                        <p className="text-gray-400 font-mono">{wallet.address}</p>
                        <p className="text-green-400 font-mono mt-1">Balance: {wallet.balance}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.users.byCrypto.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
          <p className="text-gray-400">Nenhuma carteira de usuário encontrada</p>
        </div>
      )}
    </div>
  );
}
