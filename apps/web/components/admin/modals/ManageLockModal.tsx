'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/utils/api';

// Enum de categorias (deve espelhar o backend)
export enum LockCategory {
  ORPHAN_COLLATERAL = 'ORPHAN_COLLATERAL',
  DISPUTE = 'DISPUTE',
  SECURITY = 'SECURITY',
  FRAUD_INVESTIGATION = 'FRAUD_INVESTIGATION',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  LEGAL_HOLD = 'LEGAL_HOLD',
}

export const LockCategoryLabels: Record<LockCategory, string> = {
  [LockCategory.ORPHAN_COLLATERAL]: 'Colateral Órfão',
  [LockCategory.DISPUTE]: 'Disputa',
  [LockCategory.SECURITY]: 'Segurança',
  [LockCategory.FRAUD_INVESTIGATION]: 'Investigação de Fraude',
  [LockCategory.ADMINISTRATIVE]: 'Administrativo',
  [LockCategory.LEGAL_HOLD]: 'Bloqueio Legal',
};

export const LockCategoryDescriptions: Record<LockCategory, string> = {
  [LockCategory.ORPHAN_COLLATERAL]: 'Saldo bloqueado de um pedido que foi cancelado/finalizado mas não teve o colateral liberado automaticamente',
  [LockCategory.DISPUTE]: 'Saldo retido enquanto uma disputa está sendo analisada',
  [LockCategory.SECURITY]: 'Bloqueio preventivo por atividade suspeita detectada',
  [LockCategory.FRAUD_INVESTIGATION]: 'Saldo retido durante investigação de possível fraude',
  [LockCategory.ADMINISTRATIVE]: 'Bloqueio/desbloqueio por motivo administrativo interno',
  [LockCategory.LEGAL_HOLD]: 'Bloqueio por determinação judicial ou compliance',
};

interface WalletInfo {
  walletId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  lockedBalance: string;
  availableBalance: string;
}

interface ManageLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletInfo;
  mode: 'lock' | 'unlock';
  onSuccess: () => void;
}

export default function ManageLockModal({
  isOpen,
  onClose,
  wallet,
  mode,
  onSuccess,
}: ManageLockModalProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<LockCategory>(LockCategory.ORPHAN_COLLATERAL);
  const [reason, setReason] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{ id: string; operationType: string } | null>(null);

  const isLock = mode === 'lock';
  const maxAmount = isLock ? wallet.availableBalance : wallet.lockedBalance;

  const handleSetMaxAmount = () => {
    setAmount(maxAmount);
  };

  const validateForm = (): boolean => {
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Valor deve ser um número positivo');
      return false;
    }

    const maxNum = parseFloat(maxAmount);
    if (amountNum > maxNum) {
      setError(`Valor excede o máximo permitido (${maxNum} ${wallet.cryptoType})`);
      return false;
    }

    if (reason.trim().length < 20) {
      setError('Justificativa deve ter pelo menos 20 caracteres');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const endpoint = isLock ? 'lock-balance' : 'unlock-balance';

      const response = await fetchWithAuth(`/admin/funds/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({
          walletId: wallet.walletId,
          amount,
          category,
          reason: reason.trim(),
          twoFactorCode,
        }),
      });

      const data = await response.json();

      if (response.status === 202 && data.success) {
        setPendingApproval(data.data);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Erro ao ${isLock ? 'bloquear' : 'desbloquear'} saldo`);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || `Erro ao ${isLock ? 'bloquear' : 'desbloquear'} saldo`);
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (showConfirmation) {
      setShowConfirmation(false);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  if (pendingApproval) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
          <div className="text-center">
            <span className="text-5xl mb-4 block">🔐</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Solicitação Enviada
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              A operação foi criada com sucesso e aguarda aprovação de um segundo MASTER.
            </p>
            <p className="text-xs text-gray-500 font-mono mb-6">ID: {pendingApproval.id}</p>
            <button
              onClick={() => { setPendingApproval(null); onSuccess(); }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isLock ? '🔒 Bloquear Saldo' : '🔓 Desbloquear Saldo'}
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl disabled:opacity-50"
          >
            x
          </button>
        </div>

        {/* Warning Banner */}
        <div className={`mb-6 p-4 rounded-lg ${isLock ? 'bg-orange-900/20 border border-orange-600/50' : 'bg-green-900/20 border border-green-600/50'}`}>
          <p className={`text-sm ${isLock ? 'text-orange-300' : 'text-green-300'}`}>
            <strong>Atenção:</strong>{' '}
            {isLock
              ? 'Bloquear saldo move o valor de "disponível" para "bloqueado". O usuário não poderá usar esse saldo até que seja desbloqueado.'
              : 'Desbloquear saldo move o valor de "bloqueado" para "disponível". O usuário poderá usar esse saldo novamente.'}
          </p>
        </div>

        {/* Wallet Info */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Informações da Carteira</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Usuário:</span>
              <span className="text-white ml-2">{wallet.userEmail}</span>
            </div>
            <div>
              <span className="text-gray-500">Crypto:</span>
              <span className="text-white ml-2">{wallet.cryptoType} / {wallet.network}</span>
            </div>
            <div>
              <span className="text-gray-500">Saldo Total:</span>
              <span className="text-white ml-2 font-mono">{wallet.balance} {wallet.cryptoType}</span>
            </div>
            <div>
              <span className="text-gray-500">Bloqueado:</span>
              <span className="text-yellow-400 ml-2 font-mono font-bold">{wallet.lockedBalance} {wallet.cryptoType}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Disponível:</span>
              <span className="text-green-400 ml-2 font-mono">{wallet.availableBalance} {wallet.cryptoType}</span>
            </div>
          </div>
        </div>

        {/* Confirmation View */}
        {showConfirmation ? (
          <div className="space-y-6">
            <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4">
              <h4 className="text-red-300 font-bold mb-2">Confirmar Operação</h4>
              <div className="text-sm text-gray-300 space-y-2">
                <p><strong>Ação:</strong> {isLock ? 'BLOQUEAR' : 'DESBLOQUEAR'} saldo</p>
                <p><strong>Valor:</strong> {amount} {wallet.cryptoType}</p>
                <p><strong>Categoria:</strong> {LockCategoryLabels[category]}</p>
                <p><strong>Justificativa:</strong> {reason}</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg font-medium transition"
              >
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 px-6 py-3 ${isLock ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} disabled:bg-gray-600 text-white rounded-lg font-medium transition`}
              >
                {isSubmitting ? 'Processando...' : `Confirmar ${isLock ? 'Bloqueio' : 'Desbloqueio'}`}
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <div className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Valor a {isLock ? 'bloquear' : 'desbloquear'}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.00000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00000000"
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleSetMaxAmount}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition"
                >
                  Max ({parseFloat(maxAmount).toFixed(8)})
                </button>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LockCategory)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              >
                {Object.entries(LockCategoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {LockCategoryDescriptions[category]}
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Justificativa (mínimo 20 caracteres)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo detalhado para esta operação..."
                rows={4}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                {reason.length}/20 caracteres mínimos
              </p>
            </div>

            {/* 2FA Code */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código 2FA *
                <span className="text-gray-500 ml-2 font-normal">(obrigatório)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-orange-500 font-mono tracking-widest text-center text-lg"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 px-6 py-3 ${isLock ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} disabled:bg-gray-600 text-white rounded-lg font-medium transition`}
              >
                {isLock ? '🔒 Bloquear Saldo' : '🔓 Desbloquear Saldo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
