'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KYCLevel } from '@mktplace/shared';
import ThemeToggle from '@/components/ThemeToggle';

interface User {
  id: string;
  email: string;
  name?: string;
  cpf: string;
  kycLevel: string;
  reputationScore: number;
  role: string;
}

const getKYCLevelDisplay = (level: string) => {
  const kycLabels: Record<string, { label: string; color: string; limit: string }> = {
    'NONE': { label: 'Nível 0 - Email Verificado', color: 'text-gray-600', limit: 'Limite: R$ 1.000/dia' },
    'LEVEL_1': { label: 'Nível 1 - CPF Verificado', color: 'text-blue-600', limit: 'Limite: R$ 10.000/dia' },
    'LEVEL_2': { label: 'Nível 2 - Identidade Verificada', color: 'text-green-600', limit: 'Limite: R$ 50.000/dia' },
    'LEVEL_3': { label: 'Nível 3 - Verificação Avançada', color: 'text-purple-600', limit: 'Limite: R$ 100.000/dia' },
    'LEVEL_4': { label: 'Nível 4 - Conta Empresarial', color: 'text-orange-600', limit: 'Limite: Ilimitado' },
  };
  return kycLabels[level] || kycLabels['NONE'];
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          throw new Error('Token não encontrado');
        }

        const response = await fetch('http://localhost:3001/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Não autorizado');
        }

        const data = await response.json();
        setUser(data.data);
      } catch (error) {
        console.error('Error fetching user:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      await fetch('http://localhost:3001/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <p>Carregando...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col p-24 bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="z-10 w-full max-w-5xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <div className="flex gap-3 items-center">
            <ThemeToggle />
            <button
              onClick={() => router.push('/profile')}
              className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700"
            >
              Meu Perfil
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Informações Pessoais</h2>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p><strong>Nome:</strong> {user.name || 'Não informado'}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>CPF:</strong> {user.cpf}</p>
              <div className="pt-2 border-t border-gray-300 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Nível de Verificação:</p>
                <p className={`text-lg font-bold ${getKYCLevelDisplay(user.kycLevel).color}`}>
                  {getKYCLevelDisplay(user.kycLevel).label}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {getKYCLevelDisplay(user.kycLevel).limit}
                </p>
              </div>
              {user.kycLevel === 'NONE' && (
                <button
                  onClick={() => router.push('/kyc/level1')}
                  className="mt-4 w-full px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700"
                >
                  ⬆️ Completar KYC Level 1
                </button>
              )}
              {user.kycLevel !== 'NONE' && user.kycLevel !== 'LEVEL_4' && (
                <button
                  onClick={() => router.push('/kyc/info')}
                  className="mt-4 w-full px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700"
                >
                  ⬆️ Aumentar Limite
                </button>
              )}
            </div>
          </div>

          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Reputação</h2>
            <div className="space-y-2 text-gray-700 dark:text-gray-300">
              <p><strong>Score:</strong> {user.reputationScore}</p>
              <p><strong>Role:</strong> {user.role}</p>
            </div>
          </div>

          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">💳 Meus Endereços</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Gerencie seus endereços de criptomoedas</p>
            <button
              onClick={() => router.push('/wallets')}
              className="w-full px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700"
            >
              Gerenciar Endereços
            </button>
          </div>

          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Marketplace</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Veja pedidos disponíveis ou crie o seu</p>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/marketplace')}
                className="w-full px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700"
              >
                Ver Marketplace
              </button>
              <button
                onClick={() => router.push('/orders/create')}
                className="w-full px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700"
              >
                Criar Pedido
              </button>
              <button
                onClick={() => router.push('/orders/my-orders')}
                className="w-full px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700"
              >
                Meus Pedidos
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
