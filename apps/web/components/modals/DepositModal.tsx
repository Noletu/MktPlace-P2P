'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchWithAuth } from '@/utils/api';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: {
    id: string;
    cryptoType: string;
    network: string;
    address: string;
  } | null;
}

export default function DepositModal({ isOpen, onClose, wallet }: DepositModalProps) {
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simAmount, setSimAmount] = useState('1');

  const handleSimulateDeposit = async () => {
    if (!wallet) return;
    setSimulating(true);
    try {
      const res = await fetchWithAuth(`/wallets/${wallet.id}/test-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount: simAmount }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Depósito simulado: ${simAmount} ${wallet.cryptoType} adicionado com sucesso!`);
        onClose();
      } else {
        alert(`Erro: ${data.error || 'Falha ao simular depósito'}`);
      }
    } catch {
      alert('Erro ao simular depósito');
    } finally {
      setSimulating(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!wallet) return;

    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar endereço:', error);
    }
  };

  if (!isOpen || !wallet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Depositar {wallet.cryptoType}</h2>
            <p className="text-sm text-blue-100">Rede: {wallet.network}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition"
            aria-label="Fechar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* QR Code */}
          <div className="flex justify-center mb-6 bg-white dark:bg-gray-900 p-6 rounded-xl shadow-inner">
            <QRCodeSVG
              value={wallet.address}
              size={256}
              level="H"
              includeMargin={true}
              fgColor="#1f2937"
              bgColor="#ffffff"
            />
          </div>

          {/* Address */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Endereço da Carteira
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={wallet.address}
                readOnly
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm border border-gray-300 dark:border-gray-600 focus:outline-none"
              />
              <button
                onClick={handleCopyAddress}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg transition-colors font-semibold whitespace-nowrap"
              >
                {copied ? '✓ Copiado!' : '📋 Copiar'}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-400 mb-2 flex items-center gap-2">
              <span>ℹ️</span>
              <span>Como Depositar</span>
            </h3>
            <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-2 list-decimal list-inside">
              <li>Escaneie o QR Code acima com sua carteira</li>
              <li>Ou copie o endereço e cole no app de envio</li>
              <li>Envie <strong>{wallet.cryptoType}</strong> pela rede <strong>{wallet.network}</strong></li>
              <li>Aguarde confirmações na blockchain (geralmente 5-15 min)</li>
              <li>Seu saldo será atualizado automaticamente</li>
            </ol>
          </div>

          {/* Warning */}
          <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-300 dark:border-yellow-700">
            <p className="text-xs text-yellow-800 dark:text-yellow-400 flex items-start gap-2">
              <span className="text-base">⚠️</span>
              <span>
                <strong>IMPORTANTE:</strong> Envie apenas <strong>{wallet.cryptoType}</strong> pela rede <strong>{wallet.network}</strong>.
                Envios de outras moedas ou redes diferentes serão perdidos permanentemente.
              </span>
            </p>
          </div>
        </div>

        {/* Simulate Deposit (Dev only) */}
        <div className="px-6 pb-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 mt-3 mb-2">⚡ Ambiente de Teste — Simular Depósito</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={simAmount}
              onChange={e => setSimAmount(e.target.value)}
              min="0.00000001"
              step="0.1"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-green-300 dark:border-green-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none"
              placeholder="Valor"
            />
            <button
              onClick={handleSimulateDeposit}
              disabled={simulating || !simAmount}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              {simulating ? '🔄 Simulando...' : `⚡ Simular ${wallet?.cryptoType}`}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
