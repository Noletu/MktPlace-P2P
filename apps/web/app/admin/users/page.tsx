'use client';

import { useEffect, useState } from 'react';
import UserAvatar from '@/components/admin/shared/UserAvatar';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import FreezeAccountModal from '@/components/admin/modals/FreezeAccountModal';
import UnfreezeAccountModal from '@/components/admin/modals/UnfreezeAccountModal';
import ChangeRoleModal from '@/components/admin/modals/ChangeRoleModal';
import UserDetailsModal from '@/components/admin/modals/UserDetailsModal';

interface User {
  id: string;
  email: string;
  name?: string;
  kycLevel: string;
  role: string;
  level?: number;
  reputationScore: number;
  totalTransactions: number;
  createdAt: string;
  accountFrozen?: boolean;
  frozenReason?: string;
  frozenAt?: string;
  frozenUntil?: string; // Data/hora de auto-desbloqueio (null = permanente)
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterKYC, setFilterKYC] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showUnfreezeModal, setShowUnfreezeModal] = useState(false);
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       user.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'ALL' || user.role === filterRole;
    const matchKYC = filterKYC === 'ALL' || user.kycLevel === filterKYC;
    return matchSearch && matchRole && matchKYC;
  });

  const getKYCBadgeVariant = (level: string) => {
    if (level === 'NONE') return 'default';
    if (level === 'LEVEL_1' || level === 'LEVEL_2') return 'warning';
    return 'success';
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'MASTER') return 'danger';
    if (role === 'ADMIN') return 'info';
    return 'default';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-700 dark:text-gray-300">Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gerenciar Usuários</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total de Usuários</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{users.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">KYC Completo</p>
          <p className="text-3xl font-bold text-green-400 mt-2">
            {users.filter(u => u.kycLevel === 'LEVEL_4').length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Equipe (Staff)</p>
          <p className="text-3xl font-bold text-blue-400 mt-2">
            {users.filter(u => (u.level || 0) >= 40).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Sem KYC</p>
          <p className="text-3xl font-bold text-yellow-400 mt-2">
            {users.filter(u => u.kycLevel === 'NONE').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Email ou nome..."
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos</option>
              <option value="USER">Usuários</option>
              <option value="ADMIN">Admins</option>
              <option value="MASTER">Masters</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">KYC Level</label>
            <select
              value={filterKYC}
              onChange={(e) => setFilterKYC(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos</option>
              <option value="NONE">Sem KYC</option>
              <option value="LEVEL_1">Level 1</option>
              <option value="LEVEL_2">Level 2</option>
              <option value="LEVEL_3">Level 3</option>
              <option value="LEVEL_4">Level 4</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Usuário</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">KYC</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Role</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Reputação</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Transações</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Cadastro</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-700/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <UserAvatar name={user.name} email={user.email} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name || 'Sem nome'}</p>
                          {user.accountFrozen && (
                            <div className="flex flex-col gap-1">
                              <span className="px-2 py-1 bg-red-600/20 text-red-300 rounded-full text-xs font-bold">
                                🔒 BLOQUEADA
                              </span>
                              {user.frozenUntil && new Date(user.frozenUntil) > new Date() && (
                                <span className="px-2 py-1 bg-yellow-600/20 text-yellow-300 rounded-full text-xs">
                                  ⏰ até {new Date(user.frozenUntil).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={user.kycLevel === 'NONE' ? 'Sem KYC' : user.kycLevel}
                      variant={getKYCBadgeVariant(user.kycLevel)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={user.role} variant={getRoleBadgeVariant(user.role)} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 dark:text-white font-semibold">{user.reputationScore}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{user.totalTransactions}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {/* Ver Detalhes */}
                      <button
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setShowDetailsModal(true);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                        title="Ver detalhes completos do usuário"
                      >
                        👁️ Detalhes
                      </button>

                      {/* Mudar Role */}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowChangeRoleModal(true);
                        }}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition"
                        title="Alterar role do usuário"
                      >
                        🔄 Role
                      </button>

                      {/* Bloquear/Desbloquear */}
                      {user.accountFrozen ? (
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUnfreezeModal(true);
                          }}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition"
                          title={`Bloqueada em: ${user.frozenAt ? new Date(user.frozenAt).toLocaleDateString('pt-BR') : ''}\nMotivo: ${user.frozenReason || 'N/A'}${user.frozenUntil ? `\nAuto-desbloqueio: ${new Date(user.frozenUntil).toLocaleString('pt-BR')}` : '\nTipo: Permanente (manual)'}`}
                        >
                          🔓 Desbloquear
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowFreezeModal(true);
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
                          title="Bloquear conta"
                        >
                          🔒 Bloquear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {/* Modais */}
      {showFreezeModal && selectedUser && (
        <FreezeAccountModal
          user={selectedUser}
          onClose={() => {
            setShowFreezeModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            fetchUsers(); // Recarregar lista de usuários
          }}
        />
      )}

      {showUnfreezeModal && selectedUser && (
        <UnfreezeAccountModal
          user={selectedUser}
          onClose={() => {
            setShowUnfreezeModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            fetchUsers(); // Recarregar lista de usuários
          }}
        />
      )}

      {showChangeRoleModal && selectedUser && (
        <ChangeRoleModal
          user={selectedUser}
          onClose={() => {
            setShowChangeRoleModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            fetchUsers(); // Recarregar lista de usuários
          }}
        />
      )}

      {showDetailsModal && selectedUserId && (
        <UserDetailsModal
          userId={selectedUserId}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedUserId(null);
          }}
        />
      )}
    </div>
  );
}
