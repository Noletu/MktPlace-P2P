'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

interface CollateralBalance {
  id: string;
  cryptoType: string;
  network: string;
  balance: string;
  lockedAmount: string;
  availableAmount: string;
  totalDeposited: string;
  totalUsed: string;
  availableBalance?: string; // Calculado pelo backend
}

interface CollateralTransaction {
  id: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string;
  createdAt: string;
  order?: {
    id: string;
    type: string;
    status: string;
  };
}

export default function CollateralBalancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<CollateralBalance[]>([]);
  const [transactions, setTransactions] = useState<CollateralTransaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('');

  // Modal state
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositAddress, setDepositAddress] = useState<any>(null);
  const [simulatingDeposit, setSimulatingDeposit] = useState(false);

  useEffect(() => {
    fetchBalances();
    fetchTransactions();
  }, []);

  const fetchBalances = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/v1/collateral-balance', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setBalances(data.data.balances || []);
      }
    } catch (error) {
      console.error('Erro ao buscar saldos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/collateral-balance/history?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setTransactions(data.data.transactions || []);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const handleAddCollateral = async () => {
    if (!selectedCrypto || !selectedNetwork || !depositAmount) {
      alert('Preencha todos os campos');
      return;
    }

    setDepositLoading(true);

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://localhost:3001/api/v1/collateral-balance/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cryptoType: selectedCrypto,
          network: selectedNetwork,
          amount: depositAmount,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDepositAddress(data.data.collateralAddress);
        alert('Endereço de depósito gerado! Envie o pagamento para creditar em seu saldo.');
      } else {
        alert(data.message || 'Erro ao gerar endereço de depósito');
      }
    } catch (error) {
      console.error('Erro ao iniciar depósito:', error);
      alert('Erro ao iniciar depósito');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleSimulateDeposit = async () => {
    if (!depositAddress?.id) {
      alert('Nenhum endereço de depósito encontrado');
      return;
    }

    if (!confirm('🧪 Simular depósito?\n\nIsso vai creditar o saldo instantaneamente (APENAS TESTE)')) {
      return;
    }

    setSimulatingDeposit(true);

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `http://localhost:3001/api/v1/collateral-balance/simulate-deposit/${depositAddress.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        alert(`✅ Depósito simulado com sucesso!\n\n${data.data.amount} ${data.data.cryptoType} creditado no seu saldo interno.`);

        // Fechar modal e atualizar dados
        setShowAddModal(false);
        setDepositAddress(null);
        setDepositAmount('');
        setSelectedCrypto('');
        setSelectedNetwork('');

        // Recarregar saldos e transações
        await fetchBalances();
        await fetchTransactions();
      } else {
        alert(data.message || 'Erro ao simular depósito');
      }
    } catch (error) {
      console.error('Erro ao simular depósito:', error);
      alert('Erro ao simular depósito');
    } finally {
      setSimulatingDeposit(false);
    }
  };

  const getTransactionLabel = (tx: CollateralTransaction) => {
    // Se for LOCK e tiver pedido vinculado, mostrar baseado no status do pedido
    if (tx.type === 'LOCK' && tx.order) {
      switch (tx.order.status) {
        case 'COMPLETED':
          return 'GASTO'; // Colateral foi usado (cripto transferida)
        case 'CANCELLED':
          return 'DEVOLVIDO'; // Colateral foi desbloqueado após cancelamento
        default:
          return 'LOCK'; // Pedido ainda ativo
      }
    }

    return tx.type; // Outros tipos mantêm como estão
  };

  const getTransactionIcon = (tx: CollateralTransaction) => {
    const label = getTransactionLabel(tx);

    // Ícones baseados no label (após processar lógica de negócio)
    if (label === 'GASTO') {
      return '💸'; // Dinheiro gasto
    }
    if (label === 'DEVOLVIDO') {
      return '↩️'; // Devolução
    }

    const type = tx.type;
    switch (type) {
      case 'DEPOSIT': return '💰';
      case 'LOCK': return '🔒';
      case 'UNLOCK': return '🔓';
      case 'REFUND': return '💸';
      case 'WITHDRAWAL': return '🏦';
      default: return '📝';
    }
  };

  const getTransactionColor = (tx: CollateralTransaction) => {
    const label = getTransactionLabel(tx);

    // Cores baseadas no label (após processar lógica de negócio)
    if (label === 'GASTO') {
      return 'text-red-600 dark:text-red-400'; // Vermelho para gasto
    }
    if (label === 'DEVOLVIDO') {
      return 'text-blue-600 dark:text-blue-400'; // Azul para devolução
    }

    const type = tx.type;
    switch (type) {
      case 'DEPOSIT': return 'text-green-600 dark:text-green-400';
      case 'LOCK': return 'text-yellow-600 dark:text-yellow-400';
      case 'UNLOCK': return 'text-blue-600 dark:text-blue-400';
      case 'REFUND': return 'text-purple-600 dark:text-purple-400';
      case 'WITHDRAWAL': return 'text-red-600 dark:text-red-400';
      case 'DEDUCT': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando saldos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                💰 Meu Saldo de Colateral
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Saldos */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Saldos Disponíveis
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              ➕ Adicionar Colateral
            </button>
          </div>

          {balances.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Você ainda não tem saldo de colateral.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                Fazer Primeiro Depósito
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {balances.map((balance) => (
                <div
                  key={balance.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {balance.cryptoType}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {balance.network}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Disponível:</span>
                      <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                        {balance.availableBalance || balance.availableAmount} {balance.cryptoType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Bloqueado:</span>
                      <span className="font-mono text-yellow-600 dark:text-yellow-400">
                        {balance.lockedAmount} {balance.cryptoType}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Total:</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {balance.balance} {balance.cryptoType}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      <p>Total depositado: {balance.totalDeposited} {balance.cryptoType}</p>
                      <p>Total usado: {balance.totalUsed} {balance.cryptoType}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histórico */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📊 Histórico de Movimentações
          </h2>

          {transactions.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Nenhuma movimentação ainda.
              </p>
            </div>
          ) : (
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
                          <span className={`text-sm font-medium ${getTransactionColor(tx)}`}>
                            {getTransactionIcon(tx)} {getTransactionLabel(tx)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm text-gray-900 dark:text-white">
                            {tx.amount}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900 dark:text-white">
                            {tx.description}
                          </p>
                          {tx.order && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Pedido: {tx.order.id.substring(0, 8)}... ({tx.order.status})
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
          )}
        </div>
      </main>

      {/* Modal Adicionar Colateral */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Adicionar Colateral
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setDepositAddress(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            {!depositAddress ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Criptomoeda
                  </label>
                  <select
                    value={selectedCrypto}
                    onChange={(e) => {
                      setSelectedCrypto(e.target.value);
                      if (e.target.value === 'BTC') setSelectedNetwork('BITCOIN');
                      else setSelectedNetwork('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Selecione...</option>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="USDC">USD Coin (USDC)</option>
                  </select>
                </div>

                {selectedCrypto && selectedCrypto !== 'BTC' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Rede
                    </label>
                    <select
                      value={selectedNetwork}
                      onChange={(e) => setSelectedNetwork(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Selecione...</option>
                      <option value="ETHEREUM">Ethereum (ERC20)</option>
                      <option value="TRC20">Tron (TRC20)</option>
                      <option value="BASE">Base</option>
                      <option value="ARBITRUM">Arbitrum</option>
                      <option value="SOLANA">Solana (SPL)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor
                  </label>
                  <input
                    type="text"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.001"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  onClick={handleAddCollateral}
                  disabled={depositLoading || !selectedCrypto || !selectedNetwork || !depositAmount}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium"
                >
                  {depositLoading ? 'Gerando...' : 'Gerar Endereço de Depósito'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-300 text-sm">
                    ✅ Endereço gerado! Envie {depositAmount} {selectedCrypto} para:
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Endereço:</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                    {depositAddress.address}
                  </p>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                    ⚠️ Expira em 30 minutos. Após confirmação, o saldo será creditado automaticamente.
                  </p>
                </div>

                {/* Botão de Simulação (APENAS DESENVOLVIMENTO) */}
                {process.env.NODE_ENV !== 'production' && (
                  <button
                    onClick={handleSimulateDeposit}
                    disabled={simulatingDeposit}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    {simulatingDeposit ? (
                      <>⏳ Simulando...</>
                    ) : (
                      <>🧪 Simular Depósito (Teste)</>
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setDepositAddress(null);
                    fetchBalances();
                  }}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
