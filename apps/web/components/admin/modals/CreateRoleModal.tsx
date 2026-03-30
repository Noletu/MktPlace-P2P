'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface CreateRoleModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Permission {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isCritical: boolean;
}

interface PermissionsByCategory {
  [category: string]: Permission[];
}

const levelPresets = [
  { value: 10, label: 'Muito Baixo (10)', description: 'Acima de USER, abaixo de SUPPORT' },
  { value: 30, label: 'Baixo (30)', description: 'Entre USER e SUPPORT' },
  { value: 50, label: 'Médio (50)', description: 'Entre SUPPORT e GERENTE' },
  { value: 70, label: 'Alto (70)', description: 'Entre GERENTE e ADMIN' },
  { value: 90, label: 'Muito Alto (90)', description: 'Abaixo de MASTER' },
];

const colorPresets = [
  { value: '#6B7280', label: 'Cinza' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#F59E0B', label: 'Laranja' },
  { value: '#10B981', label: 'Verde' },
  { value: '#3B82F6', label: 'Azul' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#14B8A6', label: 'Teal' },
];

const iconPresets = ['👤', '👔', '⚡', '🎯', '🛡️', '⭐', '🔧', '📊', '🎨', '🚀', '💼', '🎓'];

export default function CreateRoleModal({ onClose, onSuccess }: CreateRoleModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState(50);
  const [color, setColor] = useState('#6B7280');
  const [icon, setIcon] = useState('👤');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<PermissionsByCategory>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'basic' | 'permissions'>('basic');

  // Carregar permissões
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const response = await fetchWithAuth('/roles/permissions/all');

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Erro ao carregar permissões');
        }

        setPermissions(data.data);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar permissões');
      }
    };

    loadPermissions();
  }, []);

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
    const categoryPermissions = permissions[category] || [];
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

  const handleCreateRole = async () => {
    // Validações
    if (!name || name.length < 3) {
      setError('Nome do role deve ter pelo menos 3 caracteres');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetchWithAuth('/roles', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          level,
          color,
          icon,
          permissionIds: Array.from(selectedPermissions),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao criar role');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar role');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            ➕ Criar Novo Role Customizado
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setStep('basic')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
              step === 'basic'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            1️⃣ Informações Básicas
          </button>
          <button
            onClick={() => setStep('permissions')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
              step === 'permissions'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            2️⃣ Permissões ({selectedPermissions.size})
          </button>
        </div>

        {/* Step 1: Basic Info */}
        {step === 'basic' && (
          <div className="space-y-6">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome do Role *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Ex: Analista Financeiro, Moderador, Supervisor"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Descreva as responsabilidades deste role..."
              />
            </div>

            {/* Nível */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nível de Permissão (0-99)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {levelPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setLevel(preset.value)}
                    className={`p-3 rounded-lg border-2 transition text-left ${
                      level === preset.value
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <p className="font-bold text-gray-900 dark:text-white">{preset.label}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{preset.description}</p>
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="0"
                max="99"
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Nível atual: <span className="font-bold">{level}</span>
              </p>
            </div>

            {/* Cor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cor do Badge
              </label>
              <div className="grid grid-cols-8 gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setColor(preset.value)}
                    className={`p-4 rounded-lg border-2 transition ${
                      color === preset.value
                        ? 'border-purple-500'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.label}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Preview: <span className="px-3 py-1 rounded-full text-white font-bold" style={{ backgroundColor: color }}>{name || 'Role'}</span>
              </p>
            </div>

            {/* Ícone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ícone (Emoji)
              </label>
              <div className="grid grid-cols-12 gap-2">
                {iconPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setIcon(preset)}
                    className={`p-3 rounded-lg border-2 transition text-2xl ${
                      icon === preset
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Permissions */}
        {step === 'permissions' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Selecione as permissões que este role terá. Permissões marcadas como <span className="text-red-600 font-bold">⚠️ CRÍTICAS</span> requerem atenção especial.
            </p>

            {Object.entries(permissions).map(([category, categoryPermissions]) => {
              const allSelected = categoryPermissions.every((p) => selectedPermissions.has(p.id));
              const someSelected = categoryPermissions.some((p) => selectedPermissions.has(p.id));

              return (
                <div
                  key={category}
                  className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-900 dark:text-white text-lg capitalize">
                      {category} ({categoryPermissions.filter((p) => selectedPermissions.has(p.id)).length}/{categoryPermissions.length})
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
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mt-6">
            <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {step === 'permissions' && (
            <button
              onClick={() => setStep('basic')}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              ← Voltar
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            Cancelar
          </button>
          {step === 'basic' ? (
            <button
              onClick={() => setStep('permissions')}
              disabled={!name || name.length < 3}
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              Próximo: Permissões →
            </button>
          ) : (
            <button
              onClick={handleCreateRole}
              disabled={isSubmitting || !name || name.length < 3}
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Criando...' : `✓ Criar Role (${selectedPermissions.size} permissões)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
