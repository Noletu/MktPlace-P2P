'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getApiUrl } from '@/config/api';
import { getExplorerUrl, getExplorerName, truncateHash } from '@/utils/blockchainExplorer';
import type { NetworkType } from '@/utils/blockchainExplorer';

interface PlatformWallet {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  derivationPath: string;
  balance: string;
  availableBalance: string;
  totalFeesCollected: string;
  isActive: boolean;
  createdAt: string;
}

interface PlatformTransfer {
  id: string;
  platformWalletId: string;
  toAddress: string;
  amount: string;
  networkFee: string | null;
  txHash: string | null;
  status: string;
  requestedBy: string;
  note: string | null;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface PlatformWalletMovement {
  id: string;
  platformWalletId: string;
  type: string;
  direction: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  orderId: string | null;
  txHash: string | null;
  toAddress: string | null;
  fromAddress: string | null;
  userId: string | null;
  description: string;
  metadata: string | null;
  createdAt: string;
}

interface TransferEstimate {
  amount: string;
  networkFee: string;
  amountToReceive: string;
  isToken: boolean;
  feeNote: string;
  isValid: boolean;
  isValidAddress: boolean;
  isAboveMinimum: boolean;
  minimumAmount: string;
  estimatedTime: string;
}

type ModalStep = 'form' | 'preview' | 'confirm' | 'result';

export default function PlatformWalletsPage() {
  const [wallets, setWallets] = useState<PlatformWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transfer modal state
  const [transferWallet, setTransferWallet] = useState<PlatformWallet | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>('form');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [estimate, setEstimate] = useState<TransferEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<PlatformTransfer | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Deposit modal state
  const [depositWallet, setDepositWallet] = useState<PlatformWallet | null>(null);
  const [copied, setCopied] = useState(false);

  // Movement history state
  const [historyWallet, setHistoryWallet] = useState<PlatformWallet | null>(null);
  const [movements, setMovements] = useState<PlatformWalletMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json',
  });

  const fetchWallets = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(getApiUrl('admin/platform-wallets'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erro ao buscar carteiras');

      const data = await response.json();
      setWallets(data.data || []);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar carteiras:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAll = async () => {
    if (!confirm('Deseja criar todas as 5 carteiras da plataforma?\n(BTC, USDT/BASE, USDT/SOL, USDC/BASE, USDC/SOL)\n\nIsso irá derivar endereços usando o master seed.')) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('admin/platform-wallets/create-all'), {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar carteiras');

      alert(data.message);
      await fetchWallets();
    } catch (err: any) {
      console.error('Erro ao criar carteiras:', err);
      alert(`Erro: ${err.message}`);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  // ============================================
  // TRANSFER MODAL LOGIC
  // ============================================

  const openTransferModal = (wallet: PlatformWallet) => {
    setTransferWallet(wallet);
    setModalStep('form');
    setToAddress('');
    setAmount('');
    setNote('');
    setTwoFactorCode('');
    setEstimate(null);
    setTransferResult(null);
    setTransferError(null);
  };

  const closeTransferModal = () => {
    setTransferWallet(null);
    if (transferResult) {
      fetchWallets(); // Refresh balances after successful transfer
    }
  };

  const handleGetEstimate = async () => {
    if (!transferWallet || !toAddress || !amount) return;

    setEstimateLoading(true);
    setTransferError(null);

    try {
      const params = new URLSearchParams({ amount, toAddress });
      const response = await fetch(
        getApiUrl(`admin/platform-wallets/${transferWallet.id}/transfer-estimate?${params}`),
        { headers: getAuthHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao estimar');

      setEstimate(data.data);

      if (!data.data.isValidAddress) {
        setTransferError(`Endereco invalido para a rede ${transferWallet.network}`);
      } else if (!data.data.isAboveMinimum) {
        setTransferError(`Valor minimo: ${data.data.minimumAmount} ${transferWallet.cryptoType}`);
      } else if (!data.data.isValid) {
        setTransferError('Saldo insuficiente');
      } else {
        setModalStep('preview');
      }
    } catch (err: any) {
      setTransferError(err.message);
    } finally {
      setEstimateLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferWallet || !twoFactorCode) return;

    setTransferring(true);
    setTransferError(null);

    try {
      const response = await fetch(
        getApiUrl(`admin/platform-wallets/${transferWallet.id}/transfer`),
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ toAddress, amount, twoFactorCode, note: note || undefined }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao transferir');

      setTransferResult(data.data);
      setModalStep('result');
    } catch (err: any) {
      setTransferError(err.message);
    } finally {
      setTransferring(false);
    }
  };

  // ============================================
  // MOVEMENT HISTORY
  // ============================================

  const openMovementHistory = async (wallet: PlatformWallet) => {
    setHistoryWallet(wallet);
    setMovementsLoading(true);

    try {
      const response = await fetch(
        getApiUrl(`admin/platform-wallets/${wallet.id}/movements`),
        { headers: getAuthHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMovements(data.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar movimentacoes:', err);
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

  const closeMovementHistory = () => {
    setHistoryWallet(null);
    setMovements([]);
  };

  const getMovementTypeBadge = (type: string, direction: string) => {
    const isIn = direction === 'IN';
    const colorClass = isIn
      ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
      : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';

    const labels: Record<string, string> = {
      'FEE_RECEIVED': 'Fee Recebida',
      'SWEEP_IN': 'Sweep Recebido',
      'WITHDRAWAL_OUT': 'Saque',
      'TRANSFER_OUT': 'Transferencia',
      'DEPOSIT_IN': 'Deposito',
      'BALANCE_SYNC': 'Sync',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${colorClass}`}>
        {labels[type] || type}
      </span>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Carteiras da Plataforma</h1>
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Carteiras da Plataforma</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie os enderecos da plataforma usados para receber fees e depositos dos socios
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              <strong>Erro:</strong> {error}
            </p>
          </div>
        )}

        {/* Info Alert — wallets faltando */}
        {wallets.length === 0 && (
          <div className="mb-6 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Nenhuma carteira encontrada.</strong> Clique no botão abaixo para criar todas as carteiras da plataforma automaticamente.
            </p>
          </div>
        )}

        {wallets.length > 0 && wallets.length < 5 && (
          <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>Carteiras incompletas ({wallets.length}/5).</strong> Clique no botão abaixo para criar as carteiras que faltam.
            </p>
          </div>
        )}

        {/* Create All Button */}
        {wallets.length < 5 && (
          <div className="mb-8">
            <button
              onClick={handleCreateAll}
              disabled={creating}
              className={`px-6 py-3 rounded-lg font-medium text-white transition ${
                creating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {creating ? 'Criando carteiras...' : wallets.length === 0 ? 'Criar Todas as Carteiras (5)' : `Criar Carteiras Faltantes (${5 - wallets.length})`}
            </button>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Redes suportadas: BTC/BITCOIN, USDT e USDC em Base e Solana
            </p>
          </div>
        )}

        {/* Wallets Table */}
        {wallets.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Crypto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Network</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fees Coletadas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acoes</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-300 dark:divide-gray-700">
                  {wallets.map((wallet) => (
                    <tr key={wallet.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                          {wallet.cryptoType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-gray-100">{wallet.network}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-600 dark:text-gray-400">
                            {wallet.address.substring(0, 12)}...{wallet.address.substring(wallet.address.length - 8)}
                          </code>
                          <button
                            onClick={() => copyAddress(wallet.address)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition text-xs"
                            title="Copiar endereco completo"
                          >
                            Copiar
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {parseFloat(wallet.balance).toFixed(8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {parseFloat(wallet.totalFeesCollected).toFixed(8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {wallet.isActive ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                            Ativa
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-400">
                            Inativa
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDepositWallet(wallet)}
                            className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 hover:bg-green-700 text-white transition"
                          >
                            Depositar
                          </button>
                          <button
                            onClick={() => openTransferModal(wallet)}
                            disabled={!wallet.isActive || parseFloat(wallet.balance) <= 0}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                              !wallet.isActive || parseFloat(wallet.balance) <= 0
                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-orange-600 hover:bg-orange-700 text-white'
                            }`}
                          >
                            Transferir
                          </button>
                          <button
                            onClick={() => openMovementHistory(wallet)}
                            className="px-3 py-1.5 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                          >
                            Historico
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Box */}
        {wallets.length > 0 && (
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900/50 rounded border border-gray-300 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              Informacoes sobre Carteiras da Plataforma
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>- Todas as carteiras usam Account 0 (reservado para plataforma)</li>
              <li>- Derivadas do master seed usando BIP44</li>
              <li>- Private keys criptografadas com AES-256-GCM</li>
              <li>- Usadas para receber fees de transacoes e depositos dos socios</li>
            </ul>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* DEPOSIT MODAL */}
      {/* ============================================ */}
      {depositWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Depositar {depositWallet.cryptoType}
              </h2>
              <button
                onClick={() => { setDepositWallet(null); setCopied(false); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="text-center mb-6">
              <span className="inline-block px-3 py-1 text-sm font-medium rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 mb-1">
                {depositWallet.cryptoType}
              </span>
              <span className="inline-block px-3 py-1 text-sm font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ml-2">
                {depositWallet.network}
              </span>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={depositWallet.address}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Address */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 text-center">
                Endereço da Carteira
              </label>
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 border border-gray-300 dark:border-gray-700">
                <code className="text-sm text-gray-800 dark:text-gray-200 break-all block text-center font-mono">
                  {depositWallet.address}
                </code>
              </div>
            </div>

            {/* Copy Button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(depositWallet.address);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              }}
              className={`w-full py-3 rounded-lg font-medium transition text-sm ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? 'Endereço Copiado!' : 'Copiar Endereço'}
            </button>

            {/* Warning */}
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                Envie apenas <strong>{depositWallet.cryptoType}</strong> na rede <strong>{depositWallet.network}</strong> para este endereço. Enviar ativos em rede incorreta pode resultar em perda de fundos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TRANSFER MODAL */}
      {/* ============================================ */}
      {transferWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Transferir {transferWallet.cryptoType}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {transferWallet.network} | Saldo: {parseFloat(transferWallet.balance).toFixed(8)} {transferWallet.cryptoType}
                </p>
              </div>
              <button
                onClick={closeTransferModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                X
              </button>
            </div>

            <div className="p-6">
              {/* Step 1: Form */}
              {modalStep === 'form' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Endereco destino
                    </label>
                    <input
                      type="text"
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      placeholder={
                        transferWallet.network === 'BITCOIN' ? 'bc1...' :
                        transferWallet.network === 'SOLANA' ? 'Base58 address...' :
                        '0x...'
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valor ({transferWallet.cryptoType})
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => setAmount(transferWallet.balance)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      >
                        MAX
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Disponivel: {parseFloat(transferWallet.availableBalance).toFixed(8)} {transferWallet.cryptoType}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nota (opcional)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex: Saque para cold wallet"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {transferError && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                      <p className="text-sm text-red-800 dark:text-red-300">{transferError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleGetEstimate}
                    disabled={!toAddress || !amount || estimateLoading}
                    className={`w-full py-2.5 rounded-lg font-medium text-white transition ${
                      !toAddress || !amount || estimateLoading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {estimateLoading ? 'Estimando fee...' : 'Continuar'}
                  </button>
                </div>
              )}

              {/* Step 2: Preview */}
              {modalStep === 'preview' && estimate && (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Valor:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{estimate.amount} {transferWallet.cryptoType}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Taxa de rede:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {parseFloat(estimate.networkFee).toFixed(8)} {estimate.isToken ? (transferWallet.network === 'SOLANA' ? 'SOL' : 'ETH') : transferWallet.cryptoType}
                      </span>
                    </div>
                    <hr className="border-gray-300 dark:border-gray-700" />
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Destinatario recebe:</span>
                      <span className="font-bold text-green-700 dark:text-green-400">{estimate.amountToReceive} {transferWallet.cryptoType}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tempo estimado:</span>
                      <span className="text-gray-900 dark:text-white">{estimate.estimatedTime}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                      <strong>Para:</strong> {toAddress}
                    </p>
                    {note && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        <strong>Nota:</strong> {note}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    {estimate.feeNote}
                  </p>

                  {transferError && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                      <p className="text-sm text-red-800 dark:text-red-300">{transferError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setModalStep('form'); setTransferError(null); }}
                      className="flex-1 py-2.5 rounded-lg font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={() => { setModalStep('confirm'); setTransferError(null); }}
                      className="flex-1 py-2.5 rounded-lg font-medium bg-orange-600 hover:bg-orange-700 text-white transition"
                    >
                      Confirmar com 2FA
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: 2FA Confirmation */}
              {modalStep === 'confirm' && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-3">
                      <span className="text-2xl">🔐</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Insira o codigo 2FA do seu aplicativo autenticador para confirmar a transferencia
                    </p>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium">
                      Atencao: Esta operacao e irreversivel. Verifique o endereco de destino antes de confirmar.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Codigo 2FA
                    </label>
                    <input
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>

                  {transferError && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                      <p className="text-sm text-red-800 dark:text-red-300">{transferError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setModalStep('preview'); setTransferError(null); setTwoFactorCode(''); }}
                      className="flex-1 py-2.5 rounded-lg font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleConfirmTransfer}
                      disabled={twoFactorCode.length !== 6 || transferring}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-white transition ${
                        twoFactorCode.length !== 6 || transferring
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {transferring ? 'Enviando...' : 'Confirmar Transferencia'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Result */}
              {modalStep === 'result' && transferResult && (
                <div className="space-y-4 text-center">
                  {transferResult.status === 'COMPLETED' ? (
                    <>
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
                        <span className="text-3xl">&#10003;</span>
                      </div>
                      <h3 className="text-lg font-bold text-green-700 dark:text-green-400">
                        Transferencia Concluida
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2 text-left">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Valor:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{transferResult.amount} {transferWallet.cryptoType}</span>
                        </div>
                        {transferResult.networkFee && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Taxa de rede:</span>
                            <span className="text-gray-900 dark:text-white">{transferResult.networkFee}</span>
                          </div>
                        )}
                        {transferResult.txHash && (
                          <div className="flex justify-between text-sm items-center">
                            <span className="text-gray-600 dark:text-gray-400">TxHash:</span>
                            <a
                              href={getExplorerUrl(transferWallet.network as NetworkType, transferResult.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs"
                            >
                              {truncateHash(transferResult.txHash)} ({getExplorerName(transferWallet.network as NetworkType)})
                            </a>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-2">
                        <span className="text-3xl">!</span>
                      </div>
                      <h3 className="text-lg font-bold text-red-700 dark:text-red-400">
                        Transferencia Falhou
                      </h3>
                      {transferResult.lastError && (
                        <p className="text-sm text-red-600 dark:text-red-400">{transferResult.lastError}</p>
                      )}
                    </>
                  )}

                  <button
                    onClick={closeTransferModal}
                    className="w-full py-2.5 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MOVEMENT HISTORY MODAL */}
      {/* ============================================ */}
      {historyWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Historico de Movimentacoes
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {historyWallet.cryptoType} / {historyWallet.network} — Entradas, saidas e fees
                </p>
              </div>
              <button
                onClick={closeMovementHistory}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                X
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {movementsLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  ))}
                </div>
              ) : movements.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">Nenhuma movimentacao registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {movements.map((mov) => (
                    <div
                      key={mov.id}
                      className={`border rounded-lg p-4 ${
                        mov.direction === 'IN'
                          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                          : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getMovementTypeBadge(mov.type, mov.direction)}
                          <span className={`text-sm font-medium ${
                            mov.direction === 'IN'
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}>
                            {mov.direction === 'IN' ? '+' : '-'}{parseFloat(mov.amount).toFixed(8)} {historyWallet.cryptoType}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(mov.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {mov.description}
                      </p>

                      <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Antes: {parseFloat(mov.balanceBefore).toFixed(8)}</span>
                        <span>Depois: {parseFloat(mov.balanceAfter).toFixed(8)}</span>
                      </div>

                      {mov.txHash && (
                        <p className="text-xs mt-1">
                          <span className="text-gray-500 dark:text-gray-400">TxHash: </span>
                          <a
                            href={getExplorerUrl(historyWallet.network as NetworkType, mov.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                          >
                            {truncateHash(mov.txHash)} ({getExplorerName(historyWallet.network as NetworkType)})
                          </a>
                        </p>
                      )}

                      {mov.toAddress && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                          Para: {mov.toAddress}
                        </p>
                      )}

                      {mov.orderId && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Order: {mov.orderId}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
