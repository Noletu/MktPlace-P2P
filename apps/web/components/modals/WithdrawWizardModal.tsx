'use client';

import { useState, useMemo } from 'react';
import WithdrawModal from './WithdrawModal';

type CryptoType = 'BTC' | 'USDT' | 'USDC';
type Network = 'BITCOIN' | 'BASE' | 'SOLANA';

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

interface WithdrawWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: HDWallet[];
  prices: Record<string, number>;
  onSuccess: () => void;
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
    { value: 'BASE', label: 'Base', description: 'Layer 2' },
    { value: 'SOLANA', label: 'Solana', description: 'Alta velocidade' },
  ],
  USDC: [
    { value: 'BASE', label: 'Base', description: 'Layer 2' },
    { value: 'SOLANA', label: 'Solana', description: 'Alta velocidade' },
  ],
};

export default function WithdrawWizardModal({
  isOpen,
  onClose,
  wallets,
  prices,
  onSuccess,
}: WithdrawWizardModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<HDWallet | null>(null);

  // Aggregate available balance per crypto
  const balanceByCrypto = useMemo(() => {
    const map: Record<string, number> = {};
    wallets.forEach(w => {
      map[w.cryptoType] = (map[w.cryptoType] || 0) + (parseFloat(w.availableBalance) || 0);
    });
    return map;
  }, [wallets]);

  // Get wallets for a specific crypto, grouped by network
  const getWalletsByNetwork = (crypto: CryptoType) => {
    return wallets.filter(w => w.cryptoType === crypto);
  };

  const handleSelectCrypto = (crypto: CryptoType) => {
    const cryptoWallets = getWalletsByNetwork(crypto);
    // If only one network, skip step 2
    if (cryptoWallets.length === 1) {
      setSelectedCrypto(crypto);
      setSelectedWallet(cryptoWallets[0]);
      return;
    }
    setSelectedCrypto(crypto);
    setStep(2);
  };

  const handleSelectNetwork = (wallet: HDWallet) => {
    setSelectedWallet(wallet);
  };

  const handleBack = () => {
    if (selectedWallet) {
      // If we came from step 2, go back to step 2
      // If we skipped step 2 (single network), go back to step 1
      const cryptoWallets = selectedCrypto ? getWalletsByNetwork(selectedCrypto) : [];
      if (cryptoWallets.length > 1) {
        setSelectedWallet(null);
        return;
      }
      setSelectedWallet(null);
      setSelectedCrypto(null);
      setStep(1);
    } else {
      setStep(1);
      setSelectedCrypto(null);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedCrypto(null);
    setSelectedWallet(null);
    onClose();
  };

  if (!isOpen) return null;

  // Step 3: Delegate to existing WithdrawModal
  if (selectedWallet) {
    return (
      <WithdrawModal
        isOpen={true}
        onClose={handleClose}
        wallet={{
          id: selectedWallet.id,
          cryptoType: selectedWallet.cryptoType,
          network: selectedWallet.network,
          availableBalance: selectedWallet.availableBalance,
          address: selectedWallet.address,
        }}
        cryptoPrice={prices[selectedWallet.cryptoType] || 0}
        onSuccess={() => {
          handleClose();
          onSuccess();
        }}
      />
    );
  }

  const currentStep = step;
  const formatBalance = (val: number) =>
    val > 0 ? val.toFixed(8).replace(/\.?0+$/, '') : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                {currentStep === 1 && 'Escolha a Moeda'}
                {currentStep === 2 && 'Escolha a Rede'}
              </h2>
              <p className="text-sm text-red-100 mt-1">
                {currentStep === 1 && 'Selecione qual criptomoeda deseja sacar'}
                {currentStep === 2 && `Selecione a rede para ${selectedCrypto}`}
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
            <div className={`flex-1 h-1 rounded-full ${currentStep >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-1 rounded-full ${currentStep >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            <div className="flex-1 h-1 rounded-full bg-white/30" />
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Step 1: Crypto Selector */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CRYPTO_OPTIONS.map((crypto) => {
                const balance = balanceByCrypto[crypto.value] || 0;
                const hasBalance = balance > 0;

                return (
                  <button
                    key={crypto.value}
                    onClick={() => handleSelectCrypto(crypto.value)}
                    disabled={!hasBalance}
                    className={`group p-6 border-2 rounded-xl transition-all text-left ${
                      hasBalance
                        ? 'border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 hover:shadow-lg'
                        : 'border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className={`text-4xl mb-3 ${hasBalance ? 'group-hover:scale-110' : ''} transition-transform`}>
                      {crypto.icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {crypto.label}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {crypto.value}
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      {hasBalance ? (
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatBalance(balance)} {crypto.value}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                          Sem saldo
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Network Selector */}
          {currentStep === 2 && selectedCrypto && (
            <div className="space-y-3">
              {NETWORK_OPTIONS[selectedCrypto].map((networkOpt) => {
                const wallet = wallets.find(
                  w => w.cryptoType === selectedCrypto && w.network === networkOpt.value
                );
                const balance = wallet ? (parseFloat(wallet.availableBalance) || 0) : 0;
                const hasBalance = balance > 0;

                return (
                  <button
                    key={networkOpt.value}
                    onClick={() => wallet && handleSelectNetwork(wallet)}
                    disabled={!wallet || !hasBalance}
                    className={`w-full p-4 border-2 rounded-xl transition-all text-left ${
                      hasBalance
                        ? 'border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 hover:shadow-lg'
                        : 'border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {networkOpt.label}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {networkOpt.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Disponível</p>
                        {hasBalance ? (
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {formatBalance(balance)} {selectedCrypto}
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                            Sem saldo
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between">
          <button
            onClick={currentStep === 1 ? handleClose : handleBack}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {currentStep === 1 ? 'Cancelar' : '← Voltar'}
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
            Passo {currentStep} de 3
          </p>
        </div>
      </div>
    </div>
  );
}
