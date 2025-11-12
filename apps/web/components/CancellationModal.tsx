'use client';

import { useState, useEffect } from 'react';
import {
  CancellationReason,
  CANCELLATION_REASON_LABELS,
  CancellationWarning,
  AntiSpamStats,
} from '@/types/cancellation';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: CancellationReason, note: string) => Promise<void>;
  isSeller: boolean; // true = vendedor, false = comprador
  orderId: string;
}

export default function CancellationModal({
  isOpen,
  onClose,
  onConfirm,
  isSeller,
  orderId,
}: CancellationModalProps) {
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warning, setWarning] = useState<CancellationWarning | null>(null);
  const [loadingWarning, setLoadingWarning] = useState(false);
  const [antiSpamStats, setAntiSpamStats] = useState<AntiSpamStats | null>(null);

  // Validação
  const isNoteValid = note.trim().length >= 20;
  const isReasonValid = reason !== '';
  const canSubmit = isNoteValid && isReasonValid && !isSubmitting;

  // Carregar advertência ao abrir modal
  useEffect(() => {
    if (isOpen) {
      loadCancellationWarning();
      loadAntiSpamStats();
    } else {
      // Reset ao fechar
      setReason('');
      setNote('');
      setWarning(null);
      setAntiSpamStats(null);
    }
  }, [isOpen]);

  const loadCancellationWarning = async () => {
    try {
      setLoadingWarning(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/orders/cancellation/warning', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWarning(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar advertência:', error);
    } finally {
      setLoadingWarning(false);
    }
  };

  const loadAntiSpamStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/orders/anti-spam/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAntiSpamStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas anti-spam:', error);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason as CancellationReason, note);
      onClose();
    } catch (error) {
      // Erro já tratado pelo componente pai
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReasonOptions = (): CancellationReason[] => {
    if (isSeller) {
      return [
        CancellationReason.BUYER_SUSPICIOUS,
        CancellationReason.BUYER_UNRESPONSIVE,
        CancellationReason.NO_LONGER_AVAILABLE,
        CancellationReason.TECHNICAL_ISSUE,
        CancellationReason.PERSONAL_EMERGENCY,
        CancellationReason.OTHER,
      ];
    } else {
      return [
        CancellationReason.USER_CHANGED_MIND,
        CancellationReason.FOUND_BETTER_PRICE,
        CancellationReason.PAYMENT_ISSUE,
        CancellationReason.SELLER_UNRESPONSIVE,
        CancellationReason.TECHNICAL_ISSUE,
        CancellationReason.PERSONAL_EMERGENCY,
        CancellationReason.OTHER,
      ];
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            ⚠️ Cancelar Pedido
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Por favor, informe o motivo do cancelamento
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Advertência (se houver) */}
          {loadingWarning && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Carregando informações...
              </p>
            </div>
          )}

          {warning && warning.shouldWarn && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Atenção: Penalidade será aplicada
                  </p>
                  <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    {warning.warningMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Avisos Anti-Spam */}
          {antiSpamStats && (
            <>
              {/* Aviso de Rate Limiting */}
              {antiSpamStats.pendingCancellationsToday >= 2 && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⏱️</span>
                    <div className="flex-1">
                      <p className="font-semibold text-orange-800 dark:text-orange-200">
                        Limite de Cancelamentos
                      </p>
                      <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                        Você cancelou {antiSpamStats.pendingCancellationsToday} pedido(s) hoje. Limite máximo: 3 por dia.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Aviso Warning Level */}
              {antiSpamStats.warningLevel === 'warning' && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                        Atenção: Muitos Cancelamentos
                      </p>
                      <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                        Você cancelou {antiSpamStats.pendingCancellationsLast7Days} pedido(s) nos últimos 7 dias.
                        Continue cancelando e poderá sofrer restrições temporárias.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bloqueio Restricted */}
              {antiSpamStats.warningLevel === 'restricted' && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🚫</span>
                    <div className="flex-1">
                      <p className="font-semibold text-red-800 dark:text-red-200">
                        Cancelamento Bloqueado
                      </p>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                        Você cancelou {antiSpamStats.pendingCancellationsLast7Days} pedidos em 7 dias.
                        Por medidas anti-spam, você precisa aguardar 24 horas antes de cancelar novos pedidos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bloqueio Penalized */}
              {antiSpamStats.warningLevel === 'penalized' && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🚨</span>
                    <div className="flex-1">
                      <p className="font-semibold text-red-800 dark:text-red-200">
                        Comportamento de Spam Detectado
                      </p>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                        Você cancelou {antiSpamStats.pendingCancellationsLast7Days} pedidos em 7 dias.
                        Sua reputação foi penalizada e você não pode criar novos pedidos por 24 horas.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Motivo do cancelamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Motivo do cancelamento <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as CancellationReason)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            >
              <option value="">Selecione um motivo...</option>
              {getReasonOptions().map((r) => (
                <option key={r} value={r}>
                  {CANCELLATION_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {/* Justificativa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Justificativa detalhada <span className="text-red-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Por favor, explique o motivo do cancelamento... (mínimo 20 caracteres)"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Mínimo 20 caracteres
              </p>
              <p
                className={`text-xs font-medium ${
                  isNoteValid
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {note.trim().length}/20
              </p>
            </div>
          </div>

          {/* Informação sobre consequências */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              O que acontece ao cancelar:
            </h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {isSeller ? (
                <>
                  <li>• O pedido será cancelado definitivamente</li>
                  <li>• Seu colateral será desbloqueado</li>
                  <li>• O comprador (se houver) será notificado</li>
                </>
              ) : (
                <>
                  <li>• O pedido voltará ao marketplace</li>
                  <li>• O vendedor manterá o colateral bloqueado</li>
                  <li>• Outros compradores poderão aceitar o pedido</li>
                </>
              )}
              {warning && warning.nextPenaltyPoints > 0 && (
                <li className="font-semibold text-yellow-700 dark:text-yellow-300">
                  • Sua reputação será reduzida em {warning.nextPenaltyPoints}{' '}
                  pontos
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Cancelando...
              </>
            ) : (
              <>
                <span>🗑️</span>
                Confirmar Cancelamento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
