'use client';

import { useState, useEffect, useMemo } from 'react';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  balances: any[];
}

interface NetworkInfo {
  name: string;
  minWithdraw: string;
  maxWithdraw: string;
  estimatedFee: string;
  estimatedTime: string;
  addressRegex: RegExp;
  addressExample: string;
}

export default function WithdrawModal({ isOpen, onClose, onSuccess, balances }: WithdrawModalProps) {
  const [crypto, setCrypto] = useState('BTC');
  const [network, setNetwork] = useState('BITCOIN');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError] = useState('');

  const NETWORK_OPTIONS: Record<string, string[]> = {
    BTC: ['BITCOIN'],
    USDC: ['ETHEREUM', 'TRC20', 'BASE', 'ARBITRUM', 'SOLANA'],
    USDT: ['ETHEREUM', 'TRC20', 'BASE', 'ARBITRUM', 'SOLANA'],
  };

  const NETWORK_INFO: Record<string, NetworkInfo> = {
    'BTC-BITCOIN': {
      name: 'Bitcoin Network',
      minWithdraw: '0.0001',
      maxWithdraw: '10',
      estimatedFee: '0.00005',
      estimatedTime: '~30 minutos',
      addressRegex: /^([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/,
      addressExample: 'bc1q... ou 1A1zP1...',
    },
    'USDT-ETHEREUM': {
      name: 'Ethereum (ERC20)',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '1',
      estimatedTime: '~5 minutos',
      addressRegex: /^0x[a-fA-F0-9]{40}$/,
      addressExample: '0x742d35Cc6634...',
    },
    'USDT-TRC20': {
      name: 'Tron (TRC20)',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '1',
      estimatedTime: '~3 minutos',
      addressRegex: /^T[a-zA-Z0-9]{33}$/,
      addressExample: 'TXyz123...',
    },
    'USDT-BASE': {
      name: 'Base Network',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '0.5',
      estimatedTime: '~2 minutos',
      addressRegex: /^0x[a-fA-F0-9]{40}$/,
      addressExample: '0x742d35Cc6634...',
    },
    'USDT-ARBITRUM': {
      name: 'Arbitrum One',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '0.5',
      estimatedTime: '~2 minutos',
      addressRegex: /^0x[a-fA-F0-9]{40}$/,
      addressExample: '0x742d35Cc6634...',
    },
    'USDT-SOLANA': {
      name: 'Solana Network',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '0.5',
      estimatedTime: '~1 minuto',
      addressRegex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      addressExample: '7Np...',
    },
    'USDC-ETHEREUM': {
      name: 'Ethereum (ERC20)',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '1',
      estimatedTime: '~5 minutos',
      addressRegex: /^0x[a-fA-F0-9]{40}$/,
      addressExample: '0x742d35Cc6634...',
    },
    'USDC-TRC20': {
      name: 'Tron (TRC20)',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '1',
      estimatedTime: '~3 minutos',
      addressRegex: /^T[a-zA-Z0-9]{33}$/,
      addressExample: 'TXyz123...',
    },
    'USDC-BASE': {
      name: 'Base Network',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '0.5',
      estimatedTime: '~2 minutos',
      addressRegex: /^0x[a-fA-F0-9]{40}$/,
      addressExample: '0x742d35Cc6634...',
    },
    'USDC-ARBITRUM': {
      name: 'Arbitrum One',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '0.5',
      estimatedTime: '~2 minutos',
      addressRegex: /^0x[a-fA-F0-9]{40}$/,
      addressExample: '0x742d35Cc6634...',
    },
    'USDC-SOLANA': {
      name: 'Solana Network',
      minWithdraw: '10',
      maxWithdraw: '100000',
      estimatedFee: '0.5',
      estimatedTime: '~1 minuto',
      addressRegex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      addressExample: '7Np...',
    },
  };

  useEffect(() => {
    if (isOpen) {
      setCrypto('BTC');
      setNetwork('BITCOIN');
      setAddress('');
      setAmount('');
      setError('');
      setAddressError('');
      setAmountError('');
    }
  }, [isOpen]);

  useEffect(() => {
    setNetwork(NETWORK_OPTIONS[crypto][0]);
  }, [crypto]);

  const currentBalance = useMemo(() => {
    const balance = balances.find((b) => b.cryptoType === crypto);
    return balance ? parseFloat(balance.availableBalance) : 0;
  }, [balances, crypto]);

  const networkInfo = useMemo(() => {
    return NETWORK_INFO[`${crypto}-${network}`] || NETWORK_INFO['BTC-BITCOIN'];
  }, [crypto, network]);

  const validateAddress = (addr: string) => {
    if (!addr) {
      setAddressError('');
      return false;
    }

    if (!networkInfo.addressRegex.test(addr)) {
      setAddressError(`Endereço inválido. Exemplo: ${networkInfo.addressExample}`);
      return false;
    }

    setAddressError('');
    return true;
  };

  const validateAmount = (amt: string) => {
    if (!amt) {
      setAmountError('');
      return false;
    }

    const numAmount = parseFloat(amt);

    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Quantidade inválida');
      return false;
    }

    if (numAmount < parseFloat(networkInfo.minWithdraw)) {
      setAmountError(`Mínimo: ${networkInfo.minWithdraw} ${crypto}`);
      return false;
    }

    if (numAmount > parseFloat(networkInfo.maxWithdraw)) {
      setAmountError(`Máximo: ${networkInfo.maxWithdraw} ${crypto}`);
      return false;
    }

    if (numAmount > currentBalance) {
      setAmountError(`Saldo insuficiente (disponível: ${currentBalance} ${crypto})`);
      return false;
    }

    setAmountError('');
    return true;
  };

  const netAmount = useMemo(() => {
    const amt = parseFloat(amount);
    const fee = parseFloat(networkInfo.estimatedFee);
    if (isNaN(amt) || isNaN(fee)) return '0';
    return Math.max(0, amt - fee).toFixed(crypto === 'BTC' ? 8 : 2);
  }, [amount, networkInfo, crypto]);

  const handleSubmit = async () => {
    setError('');

    // Validações
    if (!validateAddress(address)) {
      setError('Por favor, corrija o endereço de destino');
      return;
    }

    if (!validateAmount(amount)) {
      setError('Por favor, corrija a quantidade');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');

      // Simular delay de processamento
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await fetch('http://localhost:3001/api/v1/collateral/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cryptoType: crypto,
          cryptoNetwork: network,
          amount,
          destinationAddress: address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar saque');
      }

      // Simular conclusão do saque
      const completeResponse = await fetch(
        `http://localhost:3001/api/v1/collateral/withdraw/${data.data.id}/simulate-complete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (completeResponse.ok) {
        alert(`✅ Saque de ${amount} ${crypto} processado com sucesso!\n\nO valor será enviado para ${address.slice(0, 10)}...`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">💸</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Sacar Colateral
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Seleção de Cripto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Criptomoeda
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['BTC', 'USDT', 'USDC'].map((c) => {
                const balance = balances.find((b) => b.cryptoType === c);
                const available = balance ? parseFloat(balance.availableBalance) : 0;
                const isDisabled = available === 0;

                return (
                  <button
                    key={c}
                    onClick={() => !isDisabled && setCrypto(c)}
                    disabled={isDisabled}
                    className={`p-4 border-2 rounded-lg transition flex flex-col items-center gap-2 ${
                      crypto === c
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : isDisabled
                        ? 'border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                    }`}
                  >
                    <CryptoIcon crypto={c as CryptoType} size={32} />
                    <span className="font-semibold text-gray-900 dark:text-white">{c}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {available.toFixed(c === 'BTC' ? 8 : 2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seleção de Rede */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rede
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {NETWORK_OPTIONS[crypto].map((net) => (
                <option key={net} value={net}>
                  {NETWORK_INFO[`${crypto}-${net}`]?.name || net}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Taxa: ~{networkInfo.estimatedFee} {crypto} | Tempo: {networkInfo.estimatedTime}
            </p>
          </div>

          {/* Endereço de Destino */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Endereço de Destino
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                validateAddress(e.target.value);
              }}
              placeholder={networkInfo.addressExample}
              className={`w-full px-4 py-3 border-2 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 ${
                addressError
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
              } text-gray-900 dark:text-white`}
            />
            {addressError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{addressError}</p>
            )}
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantidade
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  validateAmount(e.target.value);
                }}
                placeholder="0.00"
                step={crypto === 'BTC' ? '0.00000001' : '0.01'}
                className={`w-full px-4 py-3 pr-24 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  amountError
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                } text-gray-900 dark:text-white`}
              />
              <button
                onClick={() => {
                  setAmount(currentBalance.toString());
                  validateAmount(currentBalance.toString());
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded"
              >
                MAX
              </button>
            </div>
            {amountError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{amountError}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Disponível: {currentBalance} {crypto} | Mínimo: {networkInfo.minWithdraw} {crypto}
            </p>
          </div>

          {/* Resumo */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Resumo do Saque</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Quantidade:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {amount} {crypto}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Taxa de rede:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  - {networkInfo.estimatedFee} {crypto}
                </span>
              </div>
              <hr className="border-gray-300 dark:border-gray-600" />
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Você receberá:</span>
                <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                  {netAmount} {crypto}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ⏱️ Tempo estimado: {networkInfo.estimatedTime}
              </p>
            </div>
          )}

          {/* Aviso de Segurança */}
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              ⚠️ Atenção
            </h4>
            <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1 list-disc list-inside">
              <li>Verifique cuidadosamente o endereço de destino</li>
              <li>Certifique-se de usar a rede correta ({networkInfo.name})</li>
              <li>Transações em blockchain são irreversíveis</li>
              <li>Endereços incorretos resultam em perda permanente dos fundos</li>
            </ul>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !address || !amount || !!addressError || !!amountError}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
            >
              {loading ? '🔄 Processando...' : '💸 Confirmar Saque'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
