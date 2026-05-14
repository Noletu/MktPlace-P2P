'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatBRL } from '@/utils/formatters';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: {
    id: string;
    cryptoType: string;
    network: string;
    availableBalance: string;
    address: string;
  };
  cryptoPrice: number;
  onSuccess: () => void;
}

interface FeeEstimate {
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

interface WithdrawState {
  step: 1 | 2 | 3;
  amount: string;
  toAddress: string;
  loading: boolean;
  estimateLoading: boolean;
  error: string | null;
  success: boolean;
  successData: { requiresApproval?: boolean } | null;
  feeEstimate: FeeEstimate | null;
  addressValid: boolean | null;
}

// Validação de endereço por rede (client-side)
function validateAddress(address: string, network: string): boolean {
  if (!address || address.trim().length < 10) return false;
  switch (network) {
    case 'BITCOIN':
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    case 'ETHEREUM':
    case 'BASE':
    case 'ARBITRUM':
      return /^0x[0-9a-fA-F]{40}$/.test(address);
    case 'SOLANA':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    default:
      return false;
  }
}

function getAddressPlaceholder(network: string): string {
  switch (network) {
    case 'BITCOIN': return 'bc1q...';
    case 'SOLANA': return 'So1...';
    default: return '0x...';
  }
}

export default function WithdrawModal({
  isOpen,
  onClose,
  wallet,
  cryptoPrice,
  onSuccess,
}: WithdrawModalProps) {
  const [state, setState] = useState<WithdrawState>({
    step: 1,
    amount: '',
    toAddress: '',
    loading: false,
    estimateLoading: false,
    error: null,
    success: false,
    successData: null,
    feeEstimate: null,
    addressValid: null,
  });

  const handleClose = () => {
    setState({
      step: 1,
      amount: '',
      toAddress: '',
      loading: false,
      estimateLoading: false,
      error: null,
      success: false,
      successData: null,
      feeEstimate: null,
      addressValid: null,
    });
    onClose();
  };

  const handleBack = () => {
    setState(prev => ({
      ...prev,
      step: (prev.step - 1) as 1 | 2 | 3,
      error: null,
      feeEstimate: null,
    }));
  };

  const availableNum = parseFloat(wallet.availableBalance) || 0;
  const amountNum = parseFloat(state.amount) || 0;
  const brlEquivalent = amountNum * cryptoPrice;

  // Validar endereço em tempo real
  useEffect(() => {
    if (state.toAddress.trim().length > 0) {
      setState(prev => ({
        ...prev,
        addressValid: validateAddress(prev.toAddress.trim(), wallet.network),
      }));
    } else {
      setState(prev => ({ ...prev, addressValid: null }));
    }
  }, [state.toAddress, wallet.network]);

  // Buscar estimativa de fee ao entrar no step 3
  const fetchEstimate = useCallback(async () => {
    if (!state.amount || !state.toAddress) return;

    setState(prev => ({ ...prev, estimateLoading: true, error: null }));

    try {
      const { apiGet } = await import('@/utils/api');
      const response = await apiGet(
        `/wallets/${wallet.id}/withdrawal-estimate?amount=${encodeURIComponent(state.amount)}&toAddress=${encodeURIComponent(state.toAddress.trim())}`
      );
      setState(prev => ({
        ...prev,
        estimateLoading: false,
        feeEstimate: response.data,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        estimateLoading: false,
        error: error?.message || 'Erro ao estimar taxas.',
      }));
    }
  }, [state.amount, state.toAddress, wallet.id]);

  const validateAmount = (): boolean => {
    if (!state.amount || amountNum <= 0) {
      setState(prev => ({ ...prev, error: 'Informe um valor maior que zero.' }));
      return false;
    }
    if (amountNum > availableNum) {
      setState(prev => ({ ...prev, error: 'Saldo disponível insuficiente.' }));
      return false;
    }
    return true;
  };

  const validateAddressStep = (): boolean => {
    if (!state.toAddress || state.toAddress.trim().length < 10) {
      setState(prev => ({ ...prev, error: 'Endereço inválido. Verifique e tente novamente.' }));
      return false;
    }
    if (!validateAddress(state.toAddress.trim(), wallet.network)) {
      setState(prev => ({ ...prev, error: `Formato de endereço inválido para a rede ${wallet.network}.` }));
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    setState(prev => ({ ...prev, error: null }));

    if (state.step === 1) {
      if (validateAmount()) {
        setState(prev => ({ ...prev, step: 2 }));
      }
    } else if (state.step === 2) {
      if (validateAddressStep()) {
        setState(prev => ({ ...prev, step: 3 }));
        // Buscar estimativa ao avançar para step 3
        setTimeout(fetchEstimate, 100);
      }
    }
  };

  const handleConfirm = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { apiPost } = await import('@/utils/api');
      const response = await apiPost(`/wallets/${wallet.id}/withdraw`, {
        toAddress: state.toAddress.trim(),
        amount: state.amount,
      });

      setState(prev => ({
        ...prev,
        loading: false,
        success: true,
        successData: response.data,
      }));
      onSuccess();
    } catch (error: any) {
      const msg = error?.message || 'Erro ao solicitar saque.';
      setState(prev => ({ ...prev, loading: false, error: msg }));
    }
  };

  const handleSetMax = () => {
    setState(prev => ({
      ...prev,
      amount: availableNum.toFixed(8).replace(/\.?0+$/, ''),
      error: null,
    }));
  };

  if (!isOpen) return null;

  // Success screen
  if (state.success) {
    const requiresApproval = state.successData?.requiresApproval;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
          <div className={`bg-gradient-to-r ${requiresApproval ? 'from-yellow-600 to-yellow-700 dark:from-yellow-700 dark:to-yellow-800' : 'from-green-600 to-green-700 dark:from-green-700 dark:to-green-800'} px-6 py-4`}>
            <h2 className="text-xl font-bold text-white">
              {requiresApproval ? 'Saque Aguardando Aprovação' : 'Saque Solicitado!'}
            </h2>
          </div>
          <div className="p-6 text-center">
            <div className={`w-16 h-16 ${requiresApproval ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-100 dark:bg-green-900/30'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {requiresApproval ? (
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Saque de {state.amount} {wallet.cryptoType} solicitado!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {requiresApproval
                ? 'Sua conta requer aprovação manual. O saque será revisado pela equipe.'
                : state.feeEstimate
                  ? `Tempo estimado: ${state.feeEstimate.estimatedTime}`
                  : 'Processamento automático iniciado.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Destino: {state.toAddress.slice(0, 12)}...{state.toAddress.slice(-8)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end">
            <button
              onClick={handleClose}
              className={`px-6 py-2 ${requiresApproval ? 'bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800' : 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800'} text-white font-semibold rounded-lg transition-colors`}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                {state.step === 1 && 'Valor do Saque'}
                {state.step === 2 && 'Endereço de Destino'}
                {state.step === 3 && 'Confirmar Saque'}
              </h2>
              <p className="text-sm text-red-100 mt-1">
                {wallet.cryptoType} ({wallet.network})
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

          {/* Progress Bar */}
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

          {/* Step 1: Amount */}
          {state.step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quanto deseja sacar?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.00000001"
                    min="0"
                    max={availableNum}
                    value={state.amount}
                    onChange={(e) => setState(prev => ({ ...prev, amount: e.target.value, error: null }))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white text-lg"
                    placeholder="0.00000000"
                    autoFocus
                  />
                  <button
                    onClick={handleSetMax}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Disponível: {availableNum.toFixed(8)} {wallet.cryptoType}
                </span>
                {amountNum > 0 && (
                  <span className="text-gray-600 dark:text-gray-400">
                    ≈ {formatBRL(brlEquivalent)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Address */}
          {state.step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Endereço de destino ({wallet.network})
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={state.toAddress}
                    onChange={(e) => setState(prev => ({ ...prev, toAddress: e.target.value, error: null }))}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white font-mono text-sm ${
                      state.addressValid === null
                        ? 'border-gray-300 dark:border-gray-600'
                        : state.addressValid
                          ? 'border-green-500 dark:border-green-500'
                          : 'border-red-500 dark:border-red-500'
                    }`}
                    placeholder={getAddressPlaceholder(wallet.network)}
                    autoFocus
                  />
                  {state.addressValid !== null && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${state.addressValid ? 'text-green-500' : 'text-red-500'}`}>
                      {state.addressValid ? '\u2713' : '\u2717'}
                    </span>
                  )}
                </div>
                {state.addressValid === false && state.toAddress.length > 5 && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    Formato inválido para a rede {wallet.network}
                  </p>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-300 dark:border-yellow-700">
                <p className="text-xs text-yellow-800 dark:text-yellow-400 flex items-start gap-2">
                  <span className="text-base">⚠️</span>
                  <span>
                    Verifique o endereço com cuidado. Envios para endereços incorretos
                    na rede <strong>{wallet.network}</strong> não podem ser revertidos.
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation with Fee Breakdown */}
          {state.step === 3 && (
            <div className="space-y-4">
              {state.estimateLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 dark:border-red-400" />
                  <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
                    Estimando taxas de rede...
                  </span>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Moeda</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {wallet.cryptoType} ({wallet.network})
                      </span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-600" />

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Valor do saque</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {state.amount} {wallet.cryptoType}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ≈ {formatBRL(brlEquivalent)}
                        </p>
                      </div>
                    </div>

                    {state.feeEstimate && (
                      <>
                        <div className="border-t border-gray-200 dark:border-gray-600" />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Taxa de rede</span>
                          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            {parseFloat(state.feeEstimate.networkFee) > 0.000001
                              ? `${state.feeEstimate.networkFee} ${state.feeEstimate.isToken ? (wallet.network === 'SOLANA' ? 'SOL' : 'ETH') : wallet.cryptoType}`
                              : 'Mínima'}
                          </span>
                        </div>

                        {!state.feeEstimate.isToken && (
                          <>
                            <div className="border-t border-gray-200 dark:border-gray-600" />
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Destinatário recebe
                              </span>
                              <span className="text-lg font-bold text-green-700 dark:text-green-400">
                                {state.feeEstimate.amountToReceive} {wallet.cryptoType}
                              </span>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-600" />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Destino</span>
                      <span className="text-sm font-mono text-gray-900 dark:text-white text-right max-w-[250px] break-all">
                        {state.toAddress}
                      </span>
                    </div>
                  </div>

                  {/* Fee note */}
                  {state.feeEstimate && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                        <span className="text-base">ℹ️</span>
                        <span>{state.feeEstimate.feeNote}</span>
                      </p>
                    </div>
                  )}

                  {/* Estimated time */}
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏱️</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Tempo estimado:{' '}
                        <strong>
                          {state.feeEstimate?.estimatedTime || 'Calculando...'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Validation warnings */}
                  {state.feeEstimate && !state.feeEstimate.isAboveMinimum && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-300 dark:border-red-800">
                      <p className="text-xs text-red-700 dark:text-red-400">
                        Valor mínimo de saque: {state.feeEstimate.minimumAmount} {wallet.cryptoType}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between items-center">
          <button
            onClick={state.step === 1 ? handleClose : handleBack}
            disabled={state.loading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {state.step === 1 ? 'Cancelar' : '\u2190 Voltar'}
          </button>

          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Passo {state.step} de 3
            </p>

            {state.step < 3 ? (
              <button
                onClick={handleNextStep}
                disabled={state.step === 2 && state.addressValid === false}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo →
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={state.loading || state.estimateLoading || (state.feeEstimate ? !state.feeEstimate.isValid : false)}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.loading ? 'Processando...' : 'Confirmar Saque'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
