'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface FreezeAccountModalProps {
  user: {
    id: string;
    name?: string;
    email: string;
    role: string;
    reputationScore: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function FreezeAccountModal({ user, onClose, onSuccess }: FreezeAccountModalProps) {
  const [reason, setReason] = useState('');
  const [freezeType, setFreezeType] = useState<'TEMPORARY' | 'PERMANENT'>('TEMPORARY');
  const [duration, setDuration] = useState<number>(24); // horas
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFreeze = async () => {
    // Validação
    if (reason.length < 10) {
      setError('O motivo deve ter pelo menos 10 caracteres');
      return;
    }

    if (freezeType === 'TEMPORARY' && (!duration || duration <= 0)) {
      setError('Duração deve ser maior que zero');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const adminUserId = localStorage.getItem('userId');

      const body: any = {
        userId: user.id,
        reason,
        adminUserId,
        twoFactorCode,
      };

      // Adicionar duration apenas se for temporário
      if (freezeType === 'TEMPORARY') {
        body.duration = duration;
      }

      const response = await fetchWithAuth('/admin/funds/freeze', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao bloquear conta');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao bloquear conta');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calcular data de desbloqueio automático
  const calculateUnfreezeDate = () => {
    if (freezeType === 'PERMANENT' || !duration) return null;
    const date = new Date();
    date.setHours(date.getHours() + duration);
    return date;
  };

  const unfreezeDate = calculateUnfreezeDate();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔒 Bloquear Conta de Usuário
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
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Role</p>
              <p className="text-lg font-bold text-blue-400">{user.role}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Reputação</p>
              <p className="text-lg font-bold text-green-400">{user.reputationScore}</p>
            </div>
          </div>
        </div>

        {/* Tipo de Bloqueio */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Tipo de Bloqueio
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFreezeType('TEMPORARY')}
              className={`p-4 rounded-lg border-2 transition ${
                freezeType === 'TEMPORARY'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800'
              }`}
            >
              <div className="text-center">
                <span className="text-3xl mb-2 block">⏰</span>
                <p className="font-bold text-gray-900 dark:text-white">Temporário</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Desbloqueio automático após período
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFreezeType('PERMANENT')}
              className={`p-4 rounded-lg border-2 transition ${
                freezeType === 'PERMANENT'
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-800'
              }`}
            >
              <div className="text-center">
                <span className="text-3xl mb-2 block">🔒</span>
                <p className="font-bold text-gray-900 dark:text-white">Permanente</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Desbloqueio manual necessário
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Duração (apenas se temporário) */}
        {freezeType === 'TEMPORARY' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Duração do Bloqueio (horas)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[1, 6, 12, 24, 48, 72, 168].map(hours => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setDuration(hours)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    duration === hours
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {hours < 24 ? `${hours}h` : `${hours / 24}d`}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              min="1"
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ou digite a duração personalizada em horas"
            />
            {unfreezeDate && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                ⏰ Desbloqueio automático em:{' '}
                <span className="font-bold text-blue-400">
                  {unfreezeDate.toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Código 2FA */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Código 2FA *
            <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">(obrigatório em produção)</span>
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

        {/* Motivo do Bloqueio */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Motivo do Bloqueio *
            <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">
              (mínimo 10 caracteres)
            </span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500"
            placeholder="Descreva detalhadamente o motivo do bloqueio (ex: Suspeita de fraude, Violação dos termos de uso, etc.)"
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {reason.length}/10 caracteres
          </p>
        </div>

        {/* Aviso */}
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-red-800 dark:text-red-400 font-bold mb-2">
                ATENÇÃO: Consequências do Bloqueio
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                <li>O usuário não poderá fazer login na plataforma</li>
                <li>Todas as transações pendentes serão bloqueadas</li>
                <li>O usuário será notificado por email</li>
                <li>Esta ação ficará registrada no audit log</li>
                {freezeType === 'TEMPORARY' ? (
                  <li className="font-bold text-blue-600 dark:text-blue-400">
                    ⏰ O desbloqueio ocorrerá automaticamente após {duration} horas
                  </li>
                ) : (
                  <li className="font-bold">O bloqueio permanecerá até desbloqueio manual</li>
                )}
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
            onClick={handleFreeze}
            disabled={isSubmitting || reason.length < 10 || (freezeType === 'TEMPORARY' && duration <= 0)}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Bloqueando...' : '🔒 Bloquear Conta'}
          </button>
        </div>
      </div>
    </div>
  );
}
