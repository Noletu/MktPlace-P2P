'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface ResetPasswordModalProps {
  user: {
    id: string;
    name?: string;
    email: string;
    twoFactorEnabled?: boolean;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResetPasswordModal({ user, onClose, onSuccess }: ResetPasswordModalProps) {
  const [disable2FA, setDisable2FA] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetchWithAuth(`/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ disable2FA }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao resetar senha');
      }

      setSuccess(true);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao resetar senha');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Resetar Senha
        </h3>

        {success ? (
          <div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-700 rounded-lg mb-4">
              <p className="text-green-800 dark:text-green-300 font-medium">
                Link de reset enviado por email para {user.email}
              </p>
              {disable2FA && (
                <p className="text-green-700 dark:text-green-400 text-sm mt-2">
                  O 2FA do usuario foi desabilitado.
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Enviar link de redefinicao de senha para:
              </p>
              <p className="text-gray-900 dark:text-white font-semibold mt-1">
                {user.name || 'Sem nome'} ({user.email})
              </p>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-700 rounded-lg mb-4">
              <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                O usuario recebera um email com link de redefinicao de senha (expira em 1 hora).
              </p>
            </div>

            {/* Checkbox 2FA - so aparece se usuario tem 2FA ativado */}
            {user.twoFactorEnabled && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-700 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disable2FA}
                    onChange={(e) => setDisable2FA(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-red-800 dark:text-red-300 font-medium text-sm">
                      Desabilitar 2FA deste usuario
                    </p>
                    <p className="text-red-700 dark:text-red-400 text-xs mt-1">
                      Marque se o usuario perdeu acesso ao app autenticador. O 2FA sera removido para que ele consiga redefinir a senha.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Reset'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
