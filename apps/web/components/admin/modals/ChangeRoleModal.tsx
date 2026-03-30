'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface ChangeRoleModalProps {
  user: {
    id: string;
    name?: string;
    email: string;
    role: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const roleHierarchy: Record<string, number> = {
  USER: 0,
  SUPPORT: 1,
  GERENTE: 2,
  ADMIN: 3,
  MASTER: 4,
};

const roleDescriptions: Record<string, string> = {
  USER: 'Usuário padrão da plataforma',
  SUPPORT: 'Suporte básico ao cliente',
  GERENTE: 'Gerente operacional - disputas, pedidos, freeze (SEM acesso financeiro)',
  ADMIN: 'Administrador com god mode operacional e financeiro',
  MASTER: 'Super administrador com controle total da plataforma',
};

const roleColors: Record<string, string> = {
  USER: 'bg-gray-500',
  SUPPORT: 'bg-yellow-500',
  GERENTE: 'bg-green-500',
  ADMIN: 'bg-blue-500',
  MASTER: 'bg-purple-600',
};

export default function ChangeRoleModal({ user, onClose, onSuccess }: ChangeRoleModalProps) {
  const [newRole, setNewRole] = useState<string>(user.role);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [adminRole, setAdminRole] = useState<string>('USER');

  useEffect(() => {
    // Buscar role do objeto user no localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role) setAdminRole(user.role);
      } catch (e) {
        console.error('Erro ao parsear user do localStorage:', e);
      }
    }
  }, []);

  const handleChangeRole = async () => {
    // Validações
    if (newRole === user.role) {
      setError('Selecione um role diferente do atual');
      return;
    }

    if (reason.length < 10) {
      setError('O motivo deve ter pelo menos 10 caracteres');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetchWithAuth(`/admin/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          role: newRole,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao alterar role');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar role');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verificar quais roles o admin pode atribuir
  const adminLevel = roleHierarchy[adminRole] || 0;
  const currentUserLevel = roleHierarchy[user.role] || 0;

  // Não pode alterar alguém do mesmo nível ou superior
  const canChangeThisUser = currentUserLevel < adminLevel;

  // Roles disponíveis: abaixo do nível do admin
  const availableRoles = Object.keys(roleHierarchy).filter(role => {
    const roleLevel = roleHierarchy[role];
    return roleLevel < adminLevel; // Apenas roles abaixo do nível do admin
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔄 Alterar Role de Usuário
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
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Nome</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{user.name || 'Sem nome'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Role Atual</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 ${roleColors[user.role]} text-white rounded-full text-sm font-bold`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verificar permissão */}
        {!canChangeThisUser ? (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <span className="text-2xl">🚫</span>
              <div>
                <p className="text-red-800 dark:text-red-400 font-bold mb-2">
                  Permissão Negada
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Você não tem permissão para alterar o role deste usuário.
                  Apenas usuários de nível superior podem alterar roles de nível inferior.
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                  Seu nível: <span className="font-bold">{adminRole}</span> |
                  Nível do usuário: <span className="font-bold">{user.role}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Seleção de Novo Role */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Novo Role *
              </label>

              <div className="space-y-3">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setNewRole(role)}
                    disabled={role === user.role}
                    className={`w-full p-4 rounded-lg border-2 transition text-left ${
                      newRole === role
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                    } ${
                      role === user.role
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={newRole === role}
                          onChange={() => setNewRole(role)}
                          disabled={role === user.role}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 ${roleColors[role]} text-white rounded-full text-sm font-bold`}>
                              {role}
                            </span>
                            {role === user.role && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">(atual)</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {roleDescriptions[role]}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Nível de Permissão</p>
                        <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{roleHierarchy[role]}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {availableRoles.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Nenhum role disponível para atribuição no seu nível de permissão.
                </p>
              )}
            </div>

            {/* Preview da Mudança */}
            {newRole !== user.role && (
              <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">DE</p>
                    <span className={`px-3 py-1 ${roleColors[user.role]} text-white rounded-full text-sm font-bold`}>
                      {user.role}
                    </span>
                  </div>
                  <span className="text-2xl">→</span>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">PARA</p>
                    <span className={`px-3 py-1 ${roleColors[newRole]} text-white rounded-full text-sm font-bold`}>
                      {newRole}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Motivo da Mudança */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Motivo da Mudança de Role *
                <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">
                  (mínimo 10 caracteres)
                </span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Descreva detalhadamente o motivo da mudança de role (ex: Promoção para gerente operacional, Rebaixamento por violação de políticas, etc.)"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {reason.length}/10 caracteres
              </p>
            </div>

            {/* Aviso de Permissões */}
            {newRole !== user.role && (
              <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-yellow-800 dark:text-yellow-400 font-bold mb-2">
                      ATENÇÃO: Mudança de Permissões
                    </p>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                      <li>As permissões do usuário serão alteradas imediatamente</li>
                      <li>O usuário precisará fazer logout e login novamente para aplicar as mudanças</li>
                      <li>O acesso a recursos será ajustado conforme o novo role</li>
                      <li>Esta ação ficará registrada no audit log</li>
                      <li className="font-bold">
                        {roleHierarchy[newRole] > roleHierarchy[user.role]
                          ? '⬆️ PROMOÇÃO: Usuário ganhará mais permissões'
                          : '⬇️ REBAIXAMENTO: Usuário perderá permissões'}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
                <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}
          </>
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
          {canChangeThisUser && (
            <button
              onClick={handleChangeRole}
              disabled={isSubmitting || newRole === user.role || reason.length < 10 || availableRoles.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Alterando...' : '🔄 Alterar Role'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
