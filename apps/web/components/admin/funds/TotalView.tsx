'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface TotalCrypto {
  cryptoType: string;
  partnersBalance: string;
  usersBalance: string;
  totalBalance: string;
}

interface TotalData {
  total: TotalCrypto[];
  breakdown: {
    partners: any[];
    users: any[];
  };
  summary: {
    totalPlatformWallets: number;
    totalUserWallets: number;
    totalUsers: number;
    cryptosSupported: number;
  };
}

export default function TotalView() {
  const [data, setData] = useState<TotalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await fetchWithAuth('/admin/funds/total');

      if (!response.ok) {
        throw new Error('Erro ao carregar dados totais');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados totais');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Carregando dados totais...</p>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-300">Platform Wallets</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.totalPlatformWallets}</p>
            </div>
            <div className="text-4xl">💼</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-300">User Wallets</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.totalUserWallets}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-300">Total de Usuários</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.totalUsers}</p>
            </div>
            <div className="text-4xl">🙋</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-300">Cryptos Suportadas</p>
              <p className="text-3xl font-bold text-white mt-2">{data.summary.cryptosSupported}</p>
            </div>
            <div className="text-4xl">🪙</div>
          </div>
        </div>
      </div>

      {/* Total by Crypto */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-6">🌍 Total Consolidado por Crypto</h3>
        <div className="space-y-4">
          {data.total.map((crypto) => (
            <div key={crypto.cryptoType} className="bg-gray-900/50 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold text-white">{crypto.cryptoType}</h4>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Total Plataforma</p>
                  <p className="text-2xl font-bold text-green-400">{crypto.totalBalance || '0'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Partners */}
                <div className="bg-purple-600/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">💼</span>
                    <span className="text-sm font-semibold text-purple-300 uppercase">Sócios</span>
                  </div>
                  <p className="text-sm text-gray-400">Balance</p>
                  <p className="text-xl font-bold text-purple-300">{crypto.partnersBalance || '0'}</p>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      {crypto.totalBalance !== '0'
                        ? `${((parseFloat(crypto.partnersBalance) / parseFloat(crypto.totalBalance)) * 100).toFixed(2)}% do total`
                        : '0% do total'}
                    </p>
                  </div>
                </div>

                {/* Users */}
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">👥</span>
                    <span className="text-sm font-semibold text-blue-300 uppercase">Usuários</span>
                  </div>
                  <p className="text-sm text-gray-400">Balance</p>
                  <p className="text-xl font-bold text-blue-300">{crypto.usersBalance || '0'}</p>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      {crypto.totalBalance !== '0'
                        ? `${((parseFloat(crypto.usersBalance) / parseFloat(crypto.totalBalance)) * 100).toFixed(2)}% do total`
                        : '0% do total'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Bar */}
              <div className="mt-4">
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
                  {crypto.totalBalance !== '0' && (
                    <>
                      <div
                        className="bg-purple-500"
                        style={{
                          width: `${(parseFloat(crypto.partnersBalance) / parseFloat(crypto.totalBalance)) * 100}%`,
                        }}
                        title={`Sócios: ${crypto.partnersBalance}`}
                      />
                      <div
                        className="bg-blue-500"
                        style={{
                          width: `${(parseFloat(crypto.usersBalance) / parseFloat(crypto.totalBalance)) * 100}%`,
                        }}
                        title={`Usuários: ${crypto.usersBalance}`}
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>💼 Sócios</span>
                  <span>👥 Usuários</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Partners Breakdown */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">💼 Detalhes dos Sócios</h3>
          <div className="space-y-3">
            {data.breakdown.partners.map((crypto: any) => (
              <div key={crypto.cryptoType} className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-purple-300">{crypto.cryptoType}</span>
                  <span className="text-sm text-white font-mono">{crypto.totalBalance || '0'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Fees</p>
                    <p className="text-purple-400">{crypto.totalFees || '0'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Depositado</p>
                    <p className="text-purple-400">{crypto.totalDeposits || '0'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Users Breakdown */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">👥 Detalhes dos Usuários</h3>
          <div className="space-y-3">
            {data.breakdown.users.map((crypto: any) => (
              <div key={crypto.cryptoType} className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-blue-300">{crypto.cryptoType}</span>
                  <span className="text-sm text-white font-mono">{crypto.totalBalance || '0'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Wallets</p>
                    <p className="text-blue-400">{crypto.totalWallets}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Média/Wallet</p>
                    <p className="text-blue-400">
                      {crypto.totalWallets > 0
                        ? (parseFloat(crypto.totalBalance) / crypto.totalWallets).toFixed(4)
                        : '0'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.total.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
          <p className="text-gray-400">Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
}
