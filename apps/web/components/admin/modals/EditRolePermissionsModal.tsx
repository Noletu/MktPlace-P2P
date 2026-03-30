'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface Permission {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isCritical: boolean;
}

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon: string;
  level: number;
  isSystem: boolean;
  permissions: Permission[];
}

interface EditRolePermissionsModalProps {
  role: Role;
  onClose: () => void;
  onSuccess: () => void;
}

interface PermissionsByCategory {
  [category: string]: Permission[];
}

export default function EditRolePermissionsModal({ role, onClose, onSuccess }: EditRolePermissionsModalProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [allPermissions, setAllPermissions] = useState<PermissionsByCategory>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Carregar permissões disponíveis e inicializar selecionadas
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const response = await fetchWithAuth('/roles/permissions/all');

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Erro ao carregar permissões');
        }

        setAllPermissions(data.data);

        // Inicializar permissões já selecionadas
        const initialSelected = new Set(role.permissions.map((p) => p.id));
        setSelectedPermissions(initialSelected);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar permissões');
      }
    };

    loadPermissions();
  }, [role]);

  // Verificar mudanças
  useEffect(() => {
    const initialIds = new Set(role.permissions.map((p) => p.id));
    const currentIds = selectedPermissions;

    const changed =
      initialIds.size !== currentIds.size ||
      Array.from(initialIds).some((id) => !currentIds.has(id)) ||
      Array.from(currentIds).some((id) => !initialIds.has(id));

    setHasChanges(changed);
  }, [selectedPermissions, role]);

  const handleTogglePermission = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSelectAllCategory = (category: string) => {
    const categoryPermissions = allPermissions[category] || [];
    const newSelected = new Set(selectedPermissions);

    // Verificar se todas estão selecionadas
    const allSelected = categoryPermissions.every((p) => newSelected.has(p.id));

    if (allSelected) {
      // Desselecionar todas
      categoryPermissions.forEach((p) => newSelected.delete(p.id));
    } else {
      // Selecionar todas
      categoryPermissions.forEach((p) => newSelected.add(p.id));
    }

    setSelectedPermissions(newSelected);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetchWithAuth(`/roles/${role.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({
          permissionIds: Array.from(selectedPermissions),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao atualizar permissões');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar permissões');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              ✏️ Editar Permissões do Role
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-3xl">{role.icon}</span>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{role.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{role.description || 'Sem descrição'}</p>
              </div>
              {role.isSystem && (
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold">
                  SISTEMA
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-purple-100 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-300 dark:border-purple-700">
            <p className="text-sm text-purple-700 dark:text-purple-400 mb-1">Permissões Selecionadas</p>
            <p className="text-3xl font-bold text-purple-600">{selectedPermissions.size}</p>
          </div>
          <div className="bg-blue-100 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-300 dark:border-blue-700">
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-1">Originais</p>
            <p className="text-3xl font-bold text-blue-600">{role.permissions.length}</p>
          </div>
          <div className={`rounded-lg p-4 border ${
            hasChanges
              ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
              : 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          }`}>
            <p className={`text-sm mb-1 ${
              hasChanges
                ? 'text-yellow-700 dark:text-yellow-400'
                : 'text-green-700 dark:text-green-400'
            }`}>
              Status
            </p>
            <p className={`text-lg font-bold ${
              hasChanges
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}>
              {hasChanges ? '⚠️ Alterado' : '✓ Sem Mudanças'}
            </p>
          </div>
        </div>

        {/* Permissions by Category */}
        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Marque/desmarque as permissões que este role deve ter. Permissões <span className="text-red-600 font-bold">⚠️ CRÍTICAS</span> requerem atenção especial.
          </p>

          {Object.entries(allPermissions).map(([category, categoryPermissions]) => {
            const selectedInCategory = categoryPermissions.filter((p) => selectedPermissions.has(p.id)).length;
            const allSelected = categoryPermissions.every((p) => selectedPermissions.has(p.id));

            return (
              <div
                key={category}
                className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-gray-900 dark:text-white text-lg capitalize">
                    {category} ({selectedInCategory}/{categoryPermissions.length})
                  </h4>
                  <button
                    onClick={() => handleSelectAllCategory(category)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                      allSelected
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {allSelected ? 'Desselecionar Todas' : 'Selecionar Todas'}
                  </button>
                </div>

                <div className="space-y-2">
                  {categoryPermissions.map((permission) => (
                    <label
                      key={permission.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                        selectedPermissions.has(permission.id)
                          ? 'bg-purple-100 dark:bg-purple-900/20 border-2 border-purple-500'
                          : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.has(permission.id)}
                        onChange={() => handleTogglePermission(permission.id)}
                        className="mt-1 w-5 h-5 text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {permission.displayName}
                          </p>
                          {permission.isCritical && (
                            <span className="text-red-600 text-xs font-bold">⚠️ CRÍTICA</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {permission.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-1">
                          {permission.name}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Warning for System Roles */}
        {role.isSystem && hasChanges && (
          <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-yellow-800 dark:text-yellow-400 font-bold mb-2">
                  ATENÇÃO: Modificando Role de Sistema
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Este é um role de sistema ({role.name}). Modificar suas permissões pode afetar o funcionamento
                  da plataforma. Certifique-se de que as mudanças são necessárias.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting || !hasChanges}
            className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : `✓ Salvar Alterações (${selectedPermissions.size} permissões)`}
          </button>
        </div>
      </div>
    </div>
  );
}
