'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface EditOrderModalProps {
  order: {
    id: string;
    type: string;
    cryptoType: string;
    cryptoAmount: string;
    fiatAmount: string;
    status: string;
    createdAt: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditOrderModal({ order, onClose, onSuccess }: EditOrderModalProps) {
  const [amount, setAmount] = useState(order.fiatAmount);
  const [cryptoAmount, setCryptoAmount] = useState(order.cryptoAmount);
  const [status, setStatus] = useState(order.status);
  const [notes, setNotes] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const hasChanges = () => {
    return (
      amount !== order.fiatAmount ||
      cryptoAmount !== order.cryptoAmount ||
      status !== order.status ||
      notes.trim() !== ''
    );
  };

  const handleEdit = async () => {
    if (!hasChanges()) {
      setError('Nenhuma alteração foi feita');
      return;
    }

    if (parseFloat(amount) <= 0) {
      setError('Valor BRL deve ser maior que zero');
      return;
    }

    if (parseFloat(cryptoAmount) <= 0) {
      setError('Quantidade de crypto deve ser maior que zero');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const updates: any = {};
      if (amount !== order.fiatAmount) updates.amount = amount;
      if (cryptoAmount !== order.cryptoAmount) updates.cryptoAmount = cryptoAmount;
      if (status !== order.status) updates.status = status;
      if (notes.trim()) updates.notes = notes.trim();

      const response = await fetchWithAuth(`/admin/orders/${order.id}/edit`, {
        method: 'PUT',
        body: JSON.stringify({ ...updates, twoFactorCode }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao editar pedido');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao editar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getChanges = () => {
    const changes: string[] = [];
    if (amount !== order.fiatAmount) {
      changes.push(`Valor BRL: ${order.fiatAmount} → ${amount}`);
    }
    if (cryptoAmount !== order.cryptoAmount) {
      changes.push(`Qtd Crypto: ${order.cryptoAmount} → ${cryptoAmount}`);
    }
    if (status !== order.status) {
      changes.push(`Status: ${order.status} → ${status}`);
    }
    if (notes.trim()) {
      changes.push(`Notas adicionadas`);
    }
    return changes;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            ✏️ Editar Pedido
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Informações Atuais */}
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-gray-900 dark:text-white mb-3">Informações Atuais</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">ID</p>
              <p className="text-lg font-mono text-gray-900 dark:text-white">{order.id.substring(0, 8)}...</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tipo</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{order.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Crypto</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{order.cryptoType}</p>
            </div>
          </div>
        </div>

        {/* Formulário de Edição */}
        <div className="space-y-4 mb-6">
          {/* Valor BRL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Valor em BRL
            </label>
            <div className="flex items-center gap-4">
              <span className="text-gray-600 dark:text-gray-400">R$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {amount !== order.fiatAmount && (
                <span className="text-yellow-500 text-sm">
                  Alterado de: {order.fiatAmount}
                </span>
              )}
            </div>
          </div>

          {/* Quantidade Crypto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantidade de {order.cryptoType}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={cryptoAmount}
                onChange={(e) => setCryptoAmount(e.target.value)}
                className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              />
              {cryptoAmount !== order.cryptoAmount && (
                <span className="text-yellow-500 text-sm">
                  Alterado de: {order.cryptoAmount}
                </span>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <div className="flex items-center gap-4">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="PENDING">PENDING</option>
                <option value="MATCHED">MATCHED</option>
                <option value="PAYMENT_SENT">PAYMENT_SENT</option>
                <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
              {status !== order.status && (
                <span className="text-yellow-500 text-sm">
                  Alterado de: {order.status}
                </span>
              )}
            </div>
            {status === 'COMPLETED' && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                ⚠️ Atenção: Marcar como COMPLETED pode ter implicações de colateral
              </p>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notas da Edição (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Adicione notas sobre esta edição..."
            />
          </div>
        </div>

        {/* Preview das Mudanças */}
        {hasChanges() && (
          <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-6">
            <h4 className="font-bold text-blue-800 dark:text-blue-400 mb-2">
              📝 Mudanças a serem aplicadas:
            </h4>
            <ul className="list-disc list-inside space-y-1">
              {getChanges().map((change, index) => (
                <li key={index} className="text-sm text-blue-700 dark:text-blue-300">
                  {change}
                </li>
              ))}
            </ul>
          </div>
        )}

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
            <span className="text-xl">ℹ️</span>
            <div>
              <p className="text-yellow-800 dark:text-yellow-400 font-bold mb-1">
                Informações Importantes:
              </p>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                <li>As mudanças serão aplicadas imediatamente</li>
                <li>Ambas as partes serão notificadas das alterações</li>
                <li>As fees serão recalculadas se o valor for alterado</li>
                <li>Esta ação ficará registrada no audit log</li>
              </ul>
            </div>
          </div>
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
            Cancelar
          </button>
          <button
            onClick={handleEdit}
            disabled={isSubmitting || !hasChanges()}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Salvando...' : '✏️ Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
