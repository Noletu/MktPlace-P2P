'use client';

import { useState } from 'react';
import DepositModal from './DepositModal';

type CryptoType = 'BTC' | 'USDT' | 'USDC';
type Network = 'BITCOIN' | 'ETHEREUM' | 'BASE' | 'ARBITRUM' | 'SOLANA';

interface DepositWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WizardState {
  step: 1 | 2 | 3;
  selectedCrypto: CryptoType | null;
  selectedNetwork: Network | null;
  wallet: {
    id: string;
    address: string;
    cryptoType: string;
    network: string;
  } | null;
  loading: boolean;
  error: string | null;
}

const CRYPTO_OPTIONS: Array<{
  value: CryptoType;
  label: string;
  icon: string;
  description: string;
}> = [
  { value: 'BTC', label: 'Bitcoin', icon: '₿', description: 'Bitcoin Network' },
  { value: 'USDT', label: 'Tether', icon: '₮', description: 'Stablecoin USD' },
  { value: 'USDC', label: 'USD Coin', icon: '$', description: 'Stablecoin USD' },
];

const NETWORK_OPTIONS: Record<CryptoType, Array<{
  value: Network;
  label: string;
  description: string;
  fee: string;
  time: string;
}>> = {
  BTC: [
    { value: 'BITCOIN', label: 'Bitcoin', description: 'Rede principal', fee: '~$5', time: '30-60 min' },
  ],
  USDT: [
    { value: 'BASE', label: 'Base', description: 'Layer 2', fee: '~$0.50', time: '5-10 min' },
    { value: 'SOLANA', label: 'Solana', description: 'Alta velocidade', fee: '~$0.01', time: '1-2 min' },
  ],
  USDC: [
    { value: 'BASE', label: 'Base', description: 'Layer 2', fee: '~$0.50', time: '5-10 min' },
    { value: 'SOLANA', label: 'Solana', description: 'Alta velocidade', fee: '~$0.01', time: '1-2 min' },
  ],
};

export default function DepositWizardModal({ isOpen, onClose }: DepositWizardModalProps) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    selectedCrypto: null,
    selectedNetwork: null,
    wallet: null,
    loading: false,
    error: null,
  });

  const handleSelectCrypto = (crypto: CryptoType) => {
    setState(prev => ({
      ...prev,
      selectedCrypto: crypto,
      step: 2,
    }));
  };

  const handleSelectNetwork = async (network: Network) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Chamar API para criar/obter carteira
      const { apiPost } = await import('@/utils/api');
      const response = await apiPost('/collateral-balance/deposit', {
        cryptoType: state.selectedCrypto,
        network: network,
      });

      setState(prev => ({
        ...prev,
        selectedNetwork: network,
        wallet: response.data.depositAddress,
        step: 3,
        loading: false,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Erro ao criar carteira',
        loading: false,
      }));
    }
  };

  const handleBack = () => {
    setState(prev => ({
      ...prev,
      step: (prev.step - 1) as 1 | 2 | 3,
      error: null,
    }));
  };

  const handleClose = () => {
    setState({
      step: 1,
      selectedCrypto: null,
      selectedNetwork: null,
      wallet: null,
      loading: false,
      error: null,
    });
    onClose();
  };

  if (!isOpen) return null;

  // Step 3: Reusar DepositModal existente
  if (state.step === 3 && state.wallet) {
    return (
      <DepositModal
        isOpen={true}
        onClose={handleClose}
        wallet={state.wallet}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                {state.step === 1 && 'Escolha a Moeda'}
                {state.step === 2 && 'Escolha a Rede'}
              </h2>
              <p className="text-sm text-green-100 mt-1">
                {state.step === 1 && 'Selecione qual criptomoeda deseja depositar'}
                {state.step === 2 && `Selecione a rede para ${state.selectedCrypto}`}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex-1 h-1 rounded-full ${state.step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-1 rounded-full ${state.step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-1 rounded-full ${state.step >= 3 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {state.error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-400">{state.error}</p>
            </div>
          )}

          {/* Step 1: Crypto Selector */}
          {state.step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CRYPTO_OPTIONS.map((crypto) => (
                <button
                  key={crypto.value}
                  onClick={() => handleSelectCrypto(crypto.value)}
                  className="group p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 rounded-xl transition-all hover:shadow-lg"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                    {crypto.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {crypto.label}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {crypto.value}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-500 mt-2">
                    {crypto.description}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Network Selector */}
          {state.step === 2 && state.selectedCrypto && (
            <div className="space-y-3">
              {/* Aviso sobre auto-criação de carteira */}
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-400">
                  ⚠️ Ao selecionar uma rede, uma carteira será criada automaticamente caso você ainda não tenha uma. O endereço gerado é permanente e vinculado à sua conta.
                </p>
              </div>
              {NETWORK_OPTIONS[state.selectedCrypto].map((network) => (
                <button
                  key={network.value}
                  onClick={() => handleSelectNetwork(network.value)}
                  disabled={state.loading}
                  className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 rounded-xl transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {network.label}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {network.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Taxa</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {network.fee}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>⏱️ Tempo: {network.time}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {state.loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between">
          <button
            onClick={state.step === 1 ? handleClose : handleBack}
            disabled={state.loading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {state.step === 1 ? 'Cancelar' : '← Voltar'}
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
            Passo {state.step} de 3
          </p>
        </div>
      </div>
    </div>
  );
}
