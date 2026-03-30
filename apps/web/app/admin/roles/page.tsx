'use client';

import { useState, useEffect } from 'react';
import CreateRoleModal from '@/components/admin/modals/CreateRoleModal';
import EditRolePermissionsModal from '@/components/admin/modals/EditRolePermissionsModal';
import { fetchWithAuth } from '@/utils/api';

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon: string;
  level: number;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissions: Array<{
    id: string;
    name: string;
    displayName: string;
    category: string;
    isCritical: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Carregar roles
  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/roles');

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao carregar roles');
      }

      setRoles(data.data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  // Deletar role
  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Tem certeza que deseja deletar o role "${roleName}"?\n\nTodos os usuários com este role serão movidos para USER.`)) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/roles/${roleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao deletar role');
      }

      alert(`Role "${roleName}" deletado com sucesso!\n${data.usersMovedToUser} usuários movidos para USER.`);
      loadRoles();
    } catch (err: any) {
      alert(`Erro ao deletar role: ${err.message}`);
    }
  };

  // Ativar/Desativar role
  const handleToggleActive = async (role: Role) => {
    try {
      const response = await fetchWithAuth(`/roles/${role.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: !role.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao atualizar role');
      }

      loadRoles();
    } catch (err: any) {
      alert(`Erro ao atualizar role: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando roles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              👑 Gerenciamento de Roles
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Sistema RBAC - Crie roles customizados e gerencie permissões granulares
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <span className="text-xl">➕</span>
            Criar Novo Role
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total de Roles</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{roles.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Roles de Sistema</p>
          <p className="text-3xl font-bold text-blue-600">{roles.filter(r => r.isSystem).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Roles Customizados</p>
          <p className="text-3xl font-bold text-purple-600">{roles.filter(r => !r.isSystem).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total de Usuários</p>
          <p className="text-3xl font-bold text-green-600">{roles.reduce((acc, r) => acc + r.userCount, 0)}</p>
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Role
                </th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Nível
                </th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Permissões
                </th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Usuários
                </th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition"
                >
                  {/* Role */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{role.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-white">{role.name}</p>
                          {role.isSystem && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs font-bold">
                              SISTEMA
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{role.description || 'Sem descrição'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-1">{role.slug}</p>
                      </div>
                    </div>
                  </td>

                  {/* Nível */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${role.level}px`,
                          backgroundColor: role.color,
                        }}
                      />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{role.level}</span>
                    </div>
                  </td>

                  {/* Permissões */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-purple-600">{role.permissions.length}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">permissões</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {role.permissions.filter(p => p.isCritical).length} críticas
                    </p>
                  </td>

                  {/* Usuários */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-green-600">{role.userCount}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">usuários</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-6">
                    {role.isActive ? (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-bold">
                        ✓ ATIVO
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 rounded-full text-xs font-bold">
                        ⏸ INATIVO
                      </span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedRole(role);
                          setShowEditModal(true);
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                        title="Editar permissões"
                      >
                        ✏️ Editar
                      </button>

                      {!role.isSystem && (
                        <>
                          <button
                            onClick={() => handleToggleActive(role)}
                            className={`px-3 py-2 ${
                              role.isActive
                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                : 'bg-green-600 hover:bg-green-700'
                            } text-white rounded-lg text-sm font-medium transition`}
                            title={role.isActive ? 'Desativar' : 'Ativar'}
                          >
                            {role.isActive ? '⏸' : '▶️'}
                          </button>

                          <button
                            onClick={() => handleDeleteRole(role.id, role.name)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                            title="Deletar role"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateRoleModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            loadRoles();
            setShowCreateModal(false);
          }}
        />
      )}

      {showEditModal && selectedRole && (
        <EditRolePermissionsModal
          role={selectedRole}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRole(null);
          }}
          onSuccess={() => {
            loadRoles();
            setShowEditModal(false);
            setSelectedRole(null);
          }}
        />
      )}
    </div>
  );
}
