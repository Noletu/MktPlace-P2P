'use client';

import { useState } from 'react';
import { apiPost, apiGet } from '@/utils/api';

type CryptoType = 'BTC' | 'USDT' | 'USDC';
type Network = 'BITCOIN' | 'BASE' | 'SOLANA';

interface GenerateWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingWallets?: Array<{ cryptoType: string; network: string }>;
  onSuccess?: () => void;
}

interface WizardState {
  step: 1 | 2 | 3;
  selectedCrypto: CryptoType | null;
  loading: boolean;
  error: string | null;
  createdWallet: {
    id: string;
    address: string;
    cryptoType: string;
    network: string;
  } | null;
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
}>> = {
  BTC: [
    { value: 'BITCOIN', label: 'Bitcoin', description: 'Rede principal' },
  ],
  USDT: [
    { value: 'BASE', label: 'Base', description: 'Layer 2 Ethereum' },
    { value: 'SOLANA', label: 'Solana', description: 'Alta velocidade' },
  ],
  USDC: [
    { value: 'BASE', label: 'Base', description: 'Layer 2 Ethereum' },
    { value: 'SOLANA', label: 'Solana', description: 'Alta velocidade' },
  ],
};

export default function GenerateWalletModal({ isOpen, onClose, existingWallets = [], onSuccess }: GenerateWalletModalProps) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    selectedCrypto: null,
    loading: false,
    error: null,
    createdWallet: null,
  });
  const [copied, setCopied] = useState(false);

  const handleSelectCrypto = (crypto: CryptoType) => {
    // Se só tem uma rede e já existe wallet, mostrar erro
    const networks = NETWORK_OPTIONS[crypto];
    const available = networks.filter(
      n => !existingWallets.some(w => w.cryptoType === crypto && w.network === n.value)
    );

    if (available.length === 0) {
      setState(prev => ({
        ...prev,
        error: `Você já possui carteiras para todas as redes de ${crypto}.`,
      }));
      return;
    }

    // Se só tem uma rede disponível, criar direto
    if (available.length === 1) {
      setState(prev => ({
        ...prev,
        selectedCrypto: crypto,
        step: 2,
        error: null,
      }));
      handleCreateWallet(crypto, available[0].value);
      return;
    }

    setState(prev => ({
      ...prev,
      selectedCrypto: crypto,
      step: 2,
      error: null,
    }));
  };

  const handleCreateWallet = async (crypto: CryptoType, network: Network) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiPost('/wallets', {
        cryptoType: crypto,
        network: network,
      });

      setState(prev => ({
        ...prev,
        createdWallet: {
          id: response.data.id,
          address: response.data.address,
          cryptoType: response.data.cryptoType,
          network: response.data.network,
        },
        step: 3,
        loading: false,
      }));

      onSuccess?.();
    } catch (error: any) {
      const msg = error.message || 'Erro ao criar carteira';
      setState(prev => ({
        ...prev,
        error: msg.includes('already exists')
          ? 'Você já possui uma carteira para esta combinação de moeda e rede.'
          : msg,
        loading: false,
      }));
    }
  };

  const handleSelectNetwork = (network: Network) => {
    if (!state.selectedCrypto) return;
    handleCreateWallet(state.selectedCrypto, network);
  };

  const handleBack = () => {
    if (state.step === 2) {
      setState(prev => ({ ...prev, step: 1, selectedCrypto: null, error: null }));
    }
  };

  const handleClose = () => {
    setState({
      step: 1,
      selectedCrypto: null,
      loading: false,
      error: null,
      createdWallet: null,
    });
    setCopied(false);
    onClose();
  };

  const handleCopyAddress = () => {
    if (state.createdWallet?.address) {
      navigator.clipboard.writeText(state.createdWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  // Redes disponíveis (filtrar redes onde já existe wallet)
  const availableNetworks = state.selectedCrypto
    ? NETWORK_OPTIONS[state.selectedCrypto].filter(
        n => !existingWallets.some(w => w.cryptoType === state.selectedCrypto && w.network === n.value)
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                {state.step === 1 && 'Gerar Endereço'}
                {state.step === 2 && 'Escolha a Rede'}
                {state.step === 3 && 'Endereço Gerado'}
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                {state.step === 1 && 'Selecione qual criptomoeda deseja gerar um endereço'}
                {state.step === 2 && `Selecione a rede para ${state.selectedCrypto}`}
                {state.step === 3 && 'Sua carteira HD foi criada com sucesso'}
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

          {/* Progress */}
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

          {/* Step 1: Crypto Selection */}
          {state.step === 1 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  Uma carteira HD será criada permanentemente para a rede selecionada. O endereço gerado é exclusivo da sua conta.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CRYPTO_OPTIONS.map((crypto) => {
                  const networks = NETWORK_OPTIONS[crypto.value];
                  const available = networks.filter(
                    n => !existingWallets.some(w => w.cryptoType === crypto.value && w.network === n.value)
                  );
                  const allCreated = available.length === 0;

                  return (
                    <button
                      key={crypto.value}
                      onClick={() => handleSelectCrypto(crypto.value)}
                      disabled={allCreated}
                      className={`group p-6 border-2 rounded-xl transition-all text-center ${
                        allCreated
                          ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg'
                      }`}
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
                      {allCreated && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                          Todas as redes criadas
                        </p>
                      )}
                      {!allCreated && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {available.length} rede{available.length > 1 ? 's' : ''} disponível
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Network Selection */}
          {state.step === 2 && state.selectedCrypto && !state.loading && (
            <div className="space-y-3">
              {availableNetworks.map((network) => (
                <button
                  key={network.value}
                  onClick={() => handleSelectNetwork(network.value)}
                  className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl transition-all hover:shadow-lg text-left"
                >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {network.label}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {network.description}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {state.loading && (
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gerando endereço HD...</p>
            </div>
          )}

          {/* Step 3: Success - Show Address */}
          {state.step === 3 && state.createdWallet && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-400">
                    Carteira criada com sucesso!
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Moeda:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{state.createdWallet.cryptoType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Rede:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{state.createdWallet.network}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Endereço:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 font-mono text-sm text-gray-900 dark:text-white break-all">
                    {state.createdWallet.address}
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className={`flex-shrink-0 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-400">
                  Este endereço é permanente e vinculado exclusivamente à sua conta. Use-o para receber {state.createdWallet.cryptoType} na rede {state.createdWallet.network}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between items-center">
          {state.step < 3 ? (
            <>
              <button
                onClick={state.step === 1 ? handleClose : handleBack}
                disabled={state.loading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {state.step === 1 ? 'Cancelar' : 'Voltar'}
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Passo {state.step} de 3
              </p>
            </>
          ) : (
            <>
              <div />
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
