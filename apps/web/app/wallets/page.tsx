'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType, NetworkType, CRYPTO_SUPPORTED_NETWORKS } from '@mktplace/shared';
import AppHeader from '@/components/AppHeader';
import { fetchWithAuth } from '@/utils/api';

interface HDWallet {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  availableBalance: string;
  lockedBalance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string;
  txHash: string | null;
  createdAt: string;
}

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  USDC: 'USD Coin',
  USDT: 'Tether',
};

export default function WalletsPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<HDWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [showTransactions, setShowTransactions] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [testBalanceModal, setTestBalanceModal] = useState<{ show: boolean; walletId: string | null; cryptoType: string; network: string }>({ show: false, walletId: null, cryptoType: '', network: '' });
  const [testAmount, setTestAmount] = useState('');
  const [addingBalance, setAddingBalance] = useState(false);
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Opções de redes disponíveis
  const NETWORK_OPTIONS: Record<string, NetworkType[]> = {
    BTC: CRYPTO_SUPPORTED_NETWORKS[CryptoType.BTC],
    USDC: CRYPTO_SUPPORTED_NETWORKS[CryptoType.USDC],
    USDT: CRYPTO_SUPPORTED_NETWORKS[CryptoType.USDT],
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  // Função para toggle do dropdown
  const toggleDropdown = (cryptoKey: string) => {
    setOpenDropdown(openDropdown === cryptoKey ? null : cryptoKey);
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchWallets = async () => {
    try {
      const response = await fetchWithAuth('/wallets');

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

  const handleCreateWallet = async (cryptoType: string, network: string) => {
    setOpenDropdown(null); // Fechar dropdown ao criar
    setError('');
    try {
      const response = await fetchWithAuth('/wallets', {
        method: 'POST',
        body: JSON.stringify({
          cryptoType,
          network,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar carteira');
      }

      await fetchWallets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSyncBalance = async (walletId: string) => {
    setSyncing({ ...syncing, [walletId]: true });
    try {
      const response = await fetchWithAuth(`/wallets/${walletId}/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Erro ao sincronizar saldo');
      }

      await fetchWallets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing({ ...syncing, [walletId]: false });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Endereço copiado!');
    } catch (err) {
      alert('Erro ao copiar endereço');
    }
  };

  const fetchTransactions = async (walletId: string) => {
    setLoadingTx(true);
    try {
      const response = await fetchWithAuth(`/wallets/${walletId}/transactions`);

      if (!response.ok) {
        throw new Error('Erro ao buscar transações');
      }

      const data = await response.json();
      setTransactions(data.data);
      setShowTransactions(walletId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingTx(false);
    }
  };

  const handleAddTestBalance = async () => {
    if (!testBalanceModal.walletId || !testAmount) return;

    setAddingBalance(true);
    try {
      const response = await fetchWithAuth(`/wallets/${testBalanceModal.walletId}/test-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount: testAmount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao adicionar saldo de teste');
      }

      setTestBalanceModal({ show: false, walletId: null, cryptoType: '', network: '' });
      setTestAmount('');
      await fetchWallets();

      alert(`✅ Saldo de teste adicionado: ${data.data.amountAdded} ${data.data.cryptoType}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingBalance(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return '📥';
      case 'WITHDRAWAL':
        return '📤';
      case 'LOCK':
        return '🔒';
      case 'UNLOCK':
        return '🔓';
      case 'DEDUCT':
        return '💸';
      default:
        return '💰';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'UNLOCK':
      case 'CREDIT':
        return 'text-green-600 dark:text-green-400';
      case 'WITHDRAWAL':
      case 'DEDUCT':
      case 'LOCK':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Carregando...</div>
      </div>
    );
  }

  // Agrupar wallets por crypto
  const walletsByCrypto: Record<string, HDWallet[]> = {};
  wallets.forEach(wallet => {
    if (!walletsByCrypto[wallet.cryptoType]) {
      walletsByCrypto[wallet.cryptoType] = [];
    }
    walletsByCrypto[wallet.cryptoType].push(wallet);
  });

  // Calcular redes faltantes por crypto
  const missingNetworksByCrypto: Record<string, NetworkType[]> = {};
  Object.entries(NETWORK_OPTIONS).forEach(([cryptoKey, supportedNetworks]) => {
    const existingWallets = walletsByCrypto[cryptoKey] || [];
    const existingNetworks = existingWallets.map(w => w.network);
    const missingNetworks = supportedNetworks.filter(
      network => !existingNetworks.includes(network)
    );
    missingNetworksByCrypto[cryptoKey] = missingNetworks;
  });

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">💳 Minhas Carteiras HD</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Carteiras derivadas automaticamente (BIP32/BIP44). Deposite crypto para usar como colateral.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
              {error}
              <button onClick={() => setError('')} className="float-right font-bold">×</button>
            </div>
          )}

          {/* Grid de Cryptos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {Object.entries(CRYPTO_NAMES).map(([cryptoKey, cryptoName]) => {
              const cryptoWallets = walletsByCrypto[cryptoKey] || [];
              const missingNetworks = missingNetworksByCrypto[cryptoKey] || [];
              const hasWallets = cryptoWallets.length > 0;
              const hasNetworksToCreate = missingNetworks.length > 0;
              const isDropdownOpen = openDropdown === cryptoKey;

              return (
                <div key={cryptoKey} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  {/* Header com ícone, nome e botão flutuante */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <CryptoIcon crypto={cryptoKey as CryptoType} size={40} />
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{cryptoKey}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{cryptoName}</p>
                      </div>
                    </div>

                    {/* Botão Flutuante "+" com Dropdown */}
                    {hasNetworksToCreate && (
                      <div className="relative dropdown-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(cryptoKey);
                          }}
                          className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg transition-colors shadow-md"
                          title="Criar nova carteira"
                        >
                          <span className="text-lg">+</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-10">
                            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                Criar Carteira:
                              </p>
                            </div>
                            <div className="py-1">
                              {missingNetworks.map(network => (
                                <button
                                  key={network}
                                  onClick={() => handleCreateWallet(cryptoKey, network)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                  <span className="font-medium">{network}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mensagem se todas redes criadas */}
                    {hasWallets && !hasNetworksToCreate && (
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        ✅ Completo
                      </span>
                    )}
                  </div>

                  {/* Cards das Carteiras Existentes (separados) */}
                  {hasWallets ? (
                    <div className="space-y-4">
                      {cryptoWallets.map(wallet => (
                        <div key={wallet.id} className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                          {/* Badge da rede */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold px-3 py-1 bg-blue-600 text-white rounded-full">
                              {wallet.network}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSyncBalance(wallet.id)}
                                disabled={syncing[wallet.id]}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                                title="Sincronizar saldo"
                              >
                                {syncing[wallet.id] ? '🔄 Sincronizando...' : '🔄 Sync'}
                              </button>
                              {isDevelopment && (
                                <button
                                  onClick={() => setTestBalanceModal({ show: true, walletId: wallet.id, cryptoType: wallet.cryptoType, network: wallet.network })}
                                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                                  title="Adicionar saldo de teste (DEV ONLY)"
                                >
                                  🧪 Test $
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Saldos */}
                          <div className="space-y-2 text-sm mb-3">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Disponível:</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {parseFloat(wallet.availableBalance).toFixed(8)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Bloqueado:</span>
                              <span className="font-semibold text-orange-600 dark:text-orange-400">
                                {parseFloat(wallet.lockedBalance).toFixed(8)}
                              </span>
                            </div>
                            <div className="flex justify-between border-t pt-2 dark:border-gray-700">
                              <span className="text-gray-700 dark:text-gray-300 font-medium">Total:</span>
                              <span className="font-bold text-gray-900 dark:text-white">
                                {parseFloat(wallet.balance).toFixed(8)}
                              </span>
                            </div>
                          </div>

                          {/* Endereço e ações */}
                          <div className="pt-3 border-t dark:border-gray-700">
                            <div className="flex items-center gap-2 mb-2">
                              <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded flex-1 overflow-x-auto border border-gray-300 dark:border-gray-600">
                                {wallet.address}
                              </code>
                              <button
                                onClick={() => copyToClipboard(wallet.address)}
                                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded transition-colors whitespace-nowrap"
                                title="Copiar endereço"
                              >
                                📋 Copiar
                              </button>
                            </div>
                            <button
                              onClick={() => fetchTransactions(wallet.id)}
                              className="w-full py-2 px-3 text-xs bg-gray-600 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded transition-colors"
                            >
                              📜 Ver Histórico
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Mensagem quando não há carteiras
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400 mb-2">
                        Nenhuma carteira criada ainda
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        Clique no botão <span className="text-green-600 font-semibold">+</span> acima para criar
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Modal de Transações */}
          {showTransactions && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">📜 Histórico de Transações</h2>
                  <button
                    onClick={() => {
                      setShowTransactions(null);
                      setTransactions([]);
                    }}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                  {loadingTx ? (
                    <p className="text-center text-gray-600 dark:text-gray-400">Carregando...</p>
                  ) : transactions.length === 0 ? (
                    <p className="text-center text-gray-600 dark:text-gray-400">Nenhuma transação encontrada</p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map(tx => (
                        <div key={tx.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getTransactionIcon(tx.type)}</span>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{tx.type}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {new Date(tx.createdAt).toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            <span className={`font-bold text-lg ${getTransactionColor(tx.type)}`}>
                              {tx.type === 'DEPOSIT' || tx.type === 'UNLOCK' || tx.type === 'CREDIT' ? '+' : '-'}
                              {parseFloat(tx.amount).toFixed(8)}
                            </span>
                          </div>

                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{tx.description}</p>

                          {tx.txHash && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                              TX: {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-10)}
                            </p>
                          )}

                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>Antes: {parseFloat(tx.balanceBefore).toFixed(8)}</span>
                            <span>→</span>
                            <span>Depois: {parseFloat(tx.balanceAfter).toFixed(8)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal de Adicionar Saldo de Teste */}
          {testBalanceModal.show && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🧪 Adicionar Saldo de Teste</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {testBalanceModal.cryptoType} - {testBalanceModal.network}
                  </p>
                  <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                      ⚠️ Recurso apenas para desenvolvimento. Simula depósito sem transação real.
                    </p>
                  </div>
                </div>

                <div className="p-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor a adicionar:
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    min="0"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0.00000000"
                    autoFocus
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <p className="w-full text-xs text-gray-600 dark:text-gray-400 mb-1">Valores rápidos:</p>
                    {['0.001', '0.01', '0.1', '1'].map(value => (
                      <button
                        key={value}
                        onClick={() => setTestAmount(value)}
                        className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded transition-colors"
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                  <button
                    onClick={() => {
                      setTestBalanceModal({ show: false, walletId: null, cryptoType: '', network: '' });
                      setTestAmount('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                    disabled={addingBalance}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddTestBalance}
                    disabled={addingBalance || !testAmount || parseFloat(testAmount) <= 0}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingBalance ? '⏳ Adicionando...' : '✅ Add Balance'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
