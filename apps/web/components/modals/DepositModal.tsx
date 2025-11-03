'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DepositModal({ isOpen, onClose, onSuccess }: DepositModalProps) {
  const [step, setStep] = useState<'select' | 'generate' | 'display'>('select');
  const [crypto, setCrypto] = useState('BTC');
  const [network, setNetwork] = useState('BITCOIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [depositAddress, setDepositAddress] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutos
  const [simulating, setSimulating] = useState(false);

  const NETWORK_OPTIONS: Record<string, string[]> = {
    BTC: ['BITCOIN'],
    USDC: ['ETHEREUM', 'TRC20', 'BASE', 'ARBITRUM', 'SOLANA'],
    USDT: ['ETHEREUM', 'TRC20', 'BASE', 'ARBITRUM', 'SOLANA'],
  };

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setCrypto('BTC');
      setNetwork('BITCOIN');
      setError('');
      setDepositAddress(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setNetwork(NETWORK_OPTIONS[crypto][0]);
  }, [crypto]);

  // Timer countdown
  useEffect(() => {
    if (step !== 'display' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // Verificar pagamento periodicamente
  useEffect(() => {
    if (step !== 'display' || !depositAddress) return;

    const checkPayment = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(
          `http://localhost:3001/api/v1/collateral/${depositAddress.id}/status`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (data.success && data.data.status === 'CONFIRMED') {
          alert('✅ Depósito confirmado com sucesso!');
          onSuccess();
          onClose();
        }
      } catch (err) {
        console.error('Erro ao verificar pagamento:', err);
      }
    };

    const interval = setInterval(checkPayment, 10000);
    return () => clearInterval(interval);
  }, [step, depositAddress, onSuccess, onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGenerateAddress = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://localhost:3001/api/v1/collateral/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cryptoType: crypto,
          cryptoNetwork: network,
          expectedAmount: '0', // Depósito livre (usuário decide quanto depositar)
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar endereço');
      }

      setDepositAddress(data.data);
      setStep('display');
      setTimeLeft(1800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateDeposit = async () => {
    setSimulating(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `http://localhost:3001/api/v1/collateral/${depositAddress.id}/simulate-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        alert('✅ Depósito simulado com sucesso!');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSimulating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Depositar Colateral
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
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Step 1: Seleção */}
          {step === 'select' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Selecione a Criptomoeda
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['BTC', 'USDT', 'USDC'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCrypto(c)}
                      className={`p-4 border-2 rounded-lg transition flex flex-col items-center gap-2 ${
                        crypto === c
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                      }`}
                    >
                      <CryptoIcon crypto={c as CryptoType} size={32} />
                      <span className="font-semibold text-gray-900 dark:text-white">{c}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selecione a Rede
                </label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {NETWORK_OPTIONS[crypto].map((net) => (
                    <option key={net} value={net}>
                      {net}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">📌 Importante:</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>Certifique-se de usar a rede correta ({network})</li>
                  <li>O endereço expira em 30 minutos</li>
                  <li>Apenas depósitos em {crypto} serão creditados</li>
                  <li>Depósitos em outras moedas serão perdidos</li>
                </ul>
              </div>

              <button
                onClick={handleGenerateAddress}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
              >
                {loading ? '🔄 Gerando endereço...' : '✨ Gerar Endereço de Depósito'}
              </button>
            </div>
          )}

          {/* Step 2: Display */}
          {step === 'display' && depositAddress && (
            <div className="space-y-6">
              {/* Timer */}
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4 text-center">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  ⏰ Tempo restante para depósito:
                </p>
                <p className={`text-3xl font-bold ${timeLeft < 300 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {formatTime(timeLeft)}
                </p>
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Endereço de Depósito ({network}):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={depositAddress.address}
                    readOnly
                    className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(depositAddress.address);
                      alert('📋 Endereço copiado!');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    📋 Copiar
                  </button>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center">
                <div className="bg-white border-4 border-gray-300 dark:border-gray-600 p-6 rounded-lg shadow-lg">
                  <QRCodeSVG
                    value={depositAddress.address}
                    size={200}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 text-center">
                  Escaneie o QR Code com sua carteira de {crypto}
                </p>
              </div>

              {/* Instruções */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">📋 Instruções:</h3>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Envie qualquer quantidade de {crypto} para o endereço acima</li>
                  <li>Use obrigatoriamente a rede {network}</li>
                  <li>O saldo será creditado automaticamente após confirmação</li>
                  <li>Você tem {formatTime(timeLeft)} para completar o depósito</li>
                </ol>
              </div>

              {/* Botão Simular */}
              <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-4">
                <h4 className="font-bold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  MODO DE TESTE
                </h4>
                <p className="text-sm text-green-900 dark:text-green-300 mb-3">
                  Este botão simula que o depósito foi confirmado na blockchain.
                  Use para testar o fluxo sem fazer um depósito real.
                </p>
                <button
                  onClick={handleSimulateDeposit}
                  disabled={simulating}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {simulating ? '🔄 Simulando...' : '⚡ SIMULAR DEPÓSITO (TESTE)'}
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
