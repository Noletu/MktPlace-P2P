'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';

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
  metadata?: string;
}

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  USDC: 'USD Coin',
  USDT: 'Tether',
};

export default function CollateralBalancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<HDWallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [testBalanceModal, setTestBalanceModal] = useState<{
    show: boolean;
    walletId: string | null;
    cryptoType: string;
    network: string;
  }>({ show: false, walletId: null, cryptoType: '', network: '' });
  const [testAmount, setTestAmount] = useState('');
  const [addingBalance, setAddingBalance] = useState(false);
  const isDevelopment = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    fetchWallets();
    fetchTransactions();
  }, []);

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

      const data = await response.json();

      if (data.success) {
        setWallets(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar carteiras:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      // Buscar transações de todas as carteiras
      const allTransactions: WalletTransaction[] = [];

      for (const wallet of wallets) {
        try {
          const response = await fetch(
            `http://localhost:3001/api/v1/wallets/${wallet.id}/transactions?limit=50`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            }
          );

          const data = await response.json();
          if (data.success && data.data) {
            allTransactions.push(...data.data);
          }
        } catch (err) {
          console.error(`Erro ao buscar transações da carteira ${wallet.id}:`, err);
        }
      }

      // Ordenar por data (mais recente primeiro)
      allTransactions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTransactions(allTransactions.slice(0, 20));
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
    }
  };

  const handleAddTestBalance = async () => {
    if (!testBalanceModal.walletId || !testAmount) return;

    setAddingBalance(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(
        `http://localhost:3001/api/v1/wallets/${testBalanceModal.walletId}/test-balance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ amount: testAmount }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao adicionar saldo de teste');
      }

      setTestBalanceModal({ show: false, walletId: null, cryptoType: '', network: '' });
      setTestAmount('');
      await fetchWallets();
      await fetchTransactions();

      alert(`✅ Saldo de teste adicionado: ${data.data.amountAdded} ${data.data.cryptoType}`);
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
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
        return 'text-green-600 dark:text-green-400';
      case 'WITHDRAWAL':
      case 'DEDUCT':
      case 'LOCK':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Endereço copiado!');
  };

  // Calcular totais
  const totals = {
    totalBalance: wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0).toFixed(8),
    totalAvailable: wallets.reduce((sum, w) => sum + parseFloat(w.availableBalance), 0).toFixed(8),
    totalLocked: wallets.reduce((sum, w) => sum + parseFloat(w.lockedBalance), 0).toFixed(8),
  };

  // Agrupar wallets por crypto
  const walletsByCrypto: Record<string, HDWallet[]> = {};
  wallets.forEach(wallet => {
    if (!walletsByCrypto[wallet.cryptoType]) {
      walletsByCrypto[wallet.cryptoType] = [];
    }
    walletsByCrypto[wallet.cryptoType].push(wallet);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando carteiras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ← Voltar
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  💰 Saldo de Colateral (Carteiras HD)
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Estas são suas carteiras permanentes (BIP32/BIP44). O saldo disponível é usado automaticamente como colateral em pedidos.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resumo de Totais */}
        {wallets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Disponível</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {totals.totalAvailable}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Pode ser usado em pedidos</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Bloqueado</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {totals.totalLocked}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Em uso em pedidos ativos</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Saldo Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totals.totalBalance}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Disponível + Bloqueado</p>
            </div>
          </div>
        )}

        {/* Carteiras por Crypto */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Minhas Carteiras HD
            </h2>
            <button
              onClick={() => router.push('/wallets')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              📋 Ver Detalhes Completos →
            </button>
          </div>

          {wallets.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Você ainda não tem carteiras criadas.
              </p>
              <button
                onClick={() => router.push('/wallets')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                Criar Primeira Carteira
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(CRYPTO_NAMES).map(([cryptoKey, cryptoName]) => {
                const cryptoWallets = walletsByCrypto[cryptoKey] || [];

                if (cryptoWallets.length === 0) return null;

                return (
                  <div key={cryptoKey} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <CryptoIcon crypto={cryptoKey as CryptoType} size={32} />
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{cryptoKey}</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{cryptoName}</p>
                        </div>
                      </div>
                    </div>

                    {/* Carteiras */}
                    <div className="p-4 space-y-3">
                      {cryptoWallets.map(wallet => (
                        <div key={wallet.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                          {/* Badge da rede */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold px-2 py-1 bg-blue-600 text-white rounded">
                              {wallet.network}
                            </span>
                            {isDevelopment && (
                              <button
                                onClick={() => setTestBalanceModal({
                                  show: true,
                                  walletId: wallet.id,
                                  cryptoType: wallet.cryptoType,
                                  network: wallet.network
                                })}
                                className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                                title="Adicionar saldo de teste"
                              >
                                🧪 Add $
                              </button>
                            )}
                          </div>

                          {/* Saldos */}
                          <div className="space-y-1 text-xs mb-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Disponível:</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {parseFloat(wallet.availableBalance).toFixed(8)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Bloqueado:</span>
                              <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                                {parseFloat(wallet.lockedBalance).toFixed(8)}
                              </span>
                            </div>
                            <div className="flex justify-between border-t pt-1 dark:border-gray-700">
                              <span className="text-gray-700 dark:text-gray-300 font-medium">Total:</span>
                              <span className="font-bold text-gray-900 dark:text-white">
                                {parseFloat(wallet.balance).toFixed(8)}
                              </span>
                            </div>
                          </div>

                          {/* Endereço */}
                          <div className="pt-2 border-t dark:border-gray-700">
                            <div className="flex items-center gap-1">
                              <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded flex-1 overflow-x-auto border border-gray-300 dark:border-gray-600 font-mono">
                                {wallet.address.slice(0, 12)}...{wallet.address.slice(-12)}
                              </code>
                              <button
                                onClick={() => copyToClipboard(wallet.address)}
                                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                                title="Copiar endereço completo"
                              >
                                📋
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Histórico de Transações */}
        {transactions.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📊 Histórico Recente
            </h2>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getTransactionColor(tx.type)}`}>
                            {getTransactionIcon(tx.type)} {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm text-gray-900 dark:text-white">
                            {parseFloat(tx.amount).toFixed(8)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900 dark:text-white truncate max-w-xs">
                            {tx.description}
                          </p>
                          {tx.txHash && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                              TX: {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-10)}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(tx.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Aviso sobre criação de carteiras */}
        {wallets.length < 3 && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Dica:</strong> Você pode criar carteiras para BTC, USDC e USDT na aba{' '}
              <button
                onClick={() => router.push('/wallets')}
                className="underline font-semibold hover:text-blue-600"
              >
                "Carteiras"
              </button>
              . O saldo disponível será usado automaticamente como colateral em seus pedidos.
            </p>
          </div>
        )}
      </main>

      {/* Modal de Adicionar Saldo de Teste */}
      {testBalanceModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                🧪 Adicionar Saldo de Teste
              </h2>
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
                {addingBalance ? '⏳ Adicionando...' : '✅ Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
