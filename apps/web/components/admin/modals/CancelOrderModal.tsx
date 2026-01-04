'use client';

import { useState } from 'react';

interface CancelOrderModalProps {
  order: {
    id: string;
    cryptoType: string;
    fiatAmount: string;
    status: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelOrderModal({ order, onClose, onSuccess }: CancelOrderModalProps) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    // Validações
    if (reason.length < 20) {
      setError('O motivo deve ter pelo menos 20 caracteres');
      return;
    }

    if (confirmation !== order.id.substring(0, 8)) {
      setError('Confirmação incorreta. Digite os primeiros 8 caracteres do ID do pedido');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v1/admin/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao cancelar pedido');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            ❌ Cancelar Pedido
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Informações do Pedido */}
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">ID do Pedido</p>
              <p className="text-lg font-mono text-gray-900 dark:text-white">{order.id.substring(0, 8)}...</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Crypto</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{order.cryptoType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Valor</p>
              <p className="text-lg font-bold text-green-400">{order.fiatAmount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Status Atual</p>
              <p className="text-lg font-bold text-yellow-400">{order.status}</p>
            </div>
          </div>
        </div>

        {/* Aviso de Irreversibilidade */}
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-red-800 dark:text-red-400 font-bold mb-2">
                ATENÇÃO: Esta ação é irreversível!
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                <li>O pedido será cancelado imediatamente</li>
                <li>O colateral será desbloqueado (se existir)</li>
                <li>Ambas as partes serão notificadas</li>
                <li>Não será possível reverter esta ação</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Motivo do Cancelamento */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Motivo do Cancelamento *
            <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">
              (mínimo 20 caracteres)
            </span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500"
            placeholder="Descreva detalhadamente o motivo do cancelamento..."
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {reason.length}/20 caracteres
          </p>
        </div>

        {/* Confirmação */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Confirmar Cancelamento *
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Digite <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded font-mono">{order.id.substring(0, 8)}</code> para confirmar
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 font-mono"
            placeholder="Digite o ID para confirmar..."
          />
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Voltar
          </button>
          <button
            onClick={handleCancel}
            disabled={isSubmitting || reason.length < 20 || confirmation !== order.id.substring(0, 8)}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Cancelando...' : '❌ Cancelar Pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
