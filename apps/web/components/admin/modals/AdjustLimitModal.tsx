'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface AdjustLimitModalProps {
  user: {
    id: string;
    name?: string;
    email: string;
    reputationScore: number;
    customDailyLimit?: number;
    dailyLimit?: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdjustLimitModal({ user, onClose, onSuccess }: AdjustLimitModalProps) {
  const formulaLimit = 1000 + (user.reputationScore * 100);
  const currentIsCustom = user.customDailyLimit !== undefined && user.customDailyLimit !== null;
  const currentLimit = currentIsCustom ? user.customDailyLimit! : formulaLimit;

  const [mode, setMode] = useState<'AUTO' | 'CUSTOM'>(currentIsCustom ? 'CUSTOM' : 'AUTO');
  const [customLimit, setCustomLimit] = useState<number>(currentIsCustom ? user.customDailyLimit! : formulaLimit);
  const [note, setNote] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const newLimit = mode === 'AUTO' ? formulaLimit : customLimit;
  const hasChanged = mode === 'AUTO'
    ? currentIsCustom // Mudou de custom para auto
    : (customLimit !== currentLimit || !currentIsCustom); // Mudou valor ou de auto para custom

  const handleSubmit = async () => {
    if (note.length < 10) {
      setError('A nota deve ter no mínimo 10 caracteres');
      return;
    }

    if (mode === 'CUSTOM' && (isNaN(customLimit) || customLimit < 0)) {
      setError('Limite deve ser um valor positivo');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetchWithAuth(`/admin/users/${user.id}/custom-limit`, {
        method: 'POST',
        body: JSON.stringify({
          customDailyLimit: mode === 'AUTO' ? null : customLimit,
          note,
          twoFactorCode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao ajustar limite');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao ajustar limite');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Ajustar Limite Diário
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Info do usuario */}
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-gray-900 dark:text-white mb-3">Informações do Usuário</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Nome</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{user.name || 'Sem nome'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Reputação</p>
              <p className="text-lg font-bold text-green-400">{user.reputationScore}/100</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Limite Atual</p>
              <p className="text-lg font-bold text-blue-400">
                R$ {currentLimit.toLocaleString('pt-BR')}
                {currentIsCustom && (
                  <span className="text-xs ml-2 px-2 py-0.5 bg-yellow-600/20 text-yellow-400 rounded">personalizado</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Tipo de limite */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Tipo de Limite
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMode('AUTO')}
              className={`p-4 rounded-lg border-2 transition ${
                mode === 'AUTO'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800'
              }`}
            >
              <div className="text-center">
                <span className="text-3xl mb-2 block">🔄</span>
                <p className="font-bold text-gray-900 dark:text-white">Automático (Fórmula)</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  R$ {formulaLimit.toLocaleString('pt-BR')}/dia
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  1.000 + (rep × 100)
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('CUSTOM')}
              className={`p-4 rounded-lg border-2 transition ${
                mode === 'CUSTOM'
                  ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-gray-300 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-800'
              }`}
            >
              <div className="text-center">
                <span className="text-3xl mb-2 block">✏️</span>
                <p className="font-bold text-gray-900 dark:text-white">Personalizado</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Definir valor manualmente
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Input de valor personalizado */}
        {mode === 'CUSTOM' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Limite Diário (BRL)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[1000, 5000, 10000, 25000, 50000, 100000].map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCustomLimit(value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    customLimit === value
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  R$ {value.toLocaleString('pt-BR')}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 font-medium">R$</span>
              <input
                type="number"
                value={customLimit}
                onChange={(e) => setCustomLimit(parseFloat(e.target.value) || 0)}
                min="0"
                step="100"
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-yellow-500"
                placeholder="Valor em BRL"
              />
            </div>
          </div>
        )}

        {/* Preview da mudanca */}
        {hasChanged && (
          <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-6">
            <p className="text-blue-800 dark:text-blue-400 font-bold mb-2">Preview da Mudança</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                R$ {currentLimit.toLocaleString('pt-BR')}
                {currentIsCustom ? ' (personalizado)' : ' (auto)'}
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">→</span>
              <span className="text-blue-700 dark:text-blue-300 font-bold">
                R$ {newLimit.toLocaleString('pt-BR')}
                {mode === 'AUTO' ? ' (auto)' : ' (personalizado)'}
              </span>
            </div>
          </div>
        )}

        {/* Nota obrigatoria */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Motivo / Nota *
            <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">
              (mínimo 10 caracteres)
            </span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Usuário VIP com histórico comprovado, liberando limite maior..."
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {note.length}/10 caracteres
          </p>
        </div>

        {/* Código 2FA */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Código 2FA *
            <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">(obrigatório)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-mono tracking-widest text-center text-lg"
          />
        </div>

        {/* Aviso */}
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-yellow-800 dark:text-yellow-400 font-bold mb-1">Importante</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Esta ação ficará registrada no audit log. O limite personalizado sobrepõe a fórmula automática
                até ser manualmente resetado para automático.
              </p>
            </div>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Acoes */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || note.length < 10 || !hasChanged}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Limite'}
          </button>
        </div>
      </div>
    </div>
  );
}
