'use client';

import { useState } from 'react';

interface UnfreezeAccountModalProps {
  user: {
    id: string;
    name?: string;
    email: string;
    frozenReason?: string;
    frozenAt?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function UnfreezeAccountModal({ user, onClose, onSuccess }: UnfreezeAccountModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleUnfreeze = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const adminUserId = localStorage.getItem('userId');

      const response = await fetch('http://localhost:3002/api/v1/admin/funds/unfreeze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          adminUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao desbloquear conta');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao desbloquear conta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔓 Desbloquear Conta de Usuário
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Informações do Usuário */}
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
          </div>
        </div>

        {/* Informações do Bloqueio */}
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-yellow-800 dark:text-yellow-400 mb-2">
            📋 Informações do Bloqueio Atual
          </h4>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">Motivo:</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {user.frozenReason || 'Não especificado'}
              </p>
            </div>
            {user.frozenAt && (
              <div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">Bloqueado em:</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {new Date(user.frozenAt).toLocaleString('pt-BR')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Aviso */}
        <div className="bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <p className="text-green-800 dark:text-green-400 font-bold mb-2">
                Ao desbloquear esta conta:
              </p>
              <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
                <li>O usuário poderá fazer login novamente</li>
                <li>Todas as funcionalidades serão restauradas</li>
                <li>O usuário será notificado por email</li>
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
            onClick={handleUnfreeze}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Desbloqueando...' : '🔓 Desbloquear Conta'}
          </button>
        </div>
      </div>
    </div>
  );
}
