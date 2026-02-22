'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
}

export default function AdminProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('http://localhost:3002/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error('Erro ao buscar perfil');
        }

        const data = await res.json();
        setProfile(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-white">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md p-8 bg-red-900/30 border border-red-700 rounded-lg">
          <h2 className="text-xl font-bold text-red-200 mb-2">Erro</h2>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Perfil do Administrador</h1>
        <p className="text-gray-400 mt-2">Gerencie as informações da sua conta administrativa</p>
      </div>

        {/* Informações Básicas */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-white">Informações da Conta</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-700 pb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Nome</p>
                <p className="text-lg font-semibold text-white">
                  {profile?.name || 'Não informado'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-700 pb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Email</p>
                <p className="text-lg font-semibold text-white">{profile?.email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-700 pb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Nível de Acesso</p>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  profile?.role === 'MASTER'
                    ? 'bg-purple-600/20 border border-purple-500/50 text-purple-400'
                    : profile?.role === 'ADMIN'
                    ? 'bg-blue-600/20 border border-blue-500/50 text-blue-400'
                    : profile?.role === 'GERENTE'
                    ? 'bg-green-600/20 border border-green-500/50 text-green-400'
                    : 'bg-orange-600/20 border border-orange-500/50 text-orange-400'
                }`}>
                  {profile?.role === 'MASTER' ? '👑 Master Admin'
                   : profile?.role === 'ADMIN' ? '⚡ Admin'
                   : profile?.role === 'GERENTE' ? '📊 Gerente'
                   : '🎧 Suporte'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Membro desde</p>
                <p className="text-lg font-semibold text-white">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Permissões */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-white">Permissões</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
              <span className="text-2xl text-green-400">✓</span>
              <span className="text-gray-200">Gerenciar Usuários</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
              <span className="text-2xl text-green-400">✓</span>
              <span className="text-gray-200">Gerenciar Pedidos</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
              <span className="text-2xl text-green-400">✓</span>
              <span className="text-gray-200">Resolver Disputas</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
              <span className="text-2xl text-green-400">✓</span>
              <span className="text-gray-200">Visualizar Finanças</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
              <span className="text-2xl text-green-400">✓</span>
              <span className="text-gray-200">Gerenciar Disputas</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
              <span className="text-2xl text-green-400">✓</span>
              <span className="text-gray-200">Audit Logs</span>
            </div>
          </div>
        </div>

        {/* Ação de Logout */}
        <div className="flex justify-end">
          <button
            onClick={handleLogout}
            className="py-3 px-6 bg-red-600 hover:bg-red-700 border border-red-500 text-white font-semibold rounded-lg transition-colors shadow-lg"
          >
            Sair da Conta
          </button>
        </div>
    </div>
  );
}
