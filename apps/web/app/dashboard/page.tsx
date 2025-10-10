'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KYCLevel } from '@mktplace/shared';

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
    <main className="flex min-h-screen flex-col p-24">
      <div className="z-10 w-full max-w-5xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">
            Dashboard
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/profile')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Meu Perfil
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <h2 className="text-xl font-bold mb-4">Informações Pessoais</h2>
            <div className="space-y-3">
              <p><strong>Nome:</strong> {user.name || 'Não informado'}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>CPF:</strong> {user.cpf}</p>
              <div className="pt-2 border-t">
                <p className="text-sm text-gray-600 mb-1">Nível de Verificação:</p>
                <p className={`text-lg font-bold ${getKYCLevelDisplay(user.kycLevel).color}`}>
                  {getKYCLevelDisplay(user.kycLevel).label}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {getKYCLevelDisplay(user.kycLevel).limit}
                </p>
              </div>
              {user.kycLevel === 'NONE' && (
                <button
                  onClick={() => router.push('/kyc/level1')}
                  className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  ⬆️ Completar KYC Level 1
                </button>
              )}
              {user.kycLevel !== 'NONE' && user.kycLevel !== 'LEVEL_4' && (
                <button
                  onClick={() => router.push('/kyc/info')}
                  className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  ⬆️ Aumentar Limite
                </button>
              )}
            </div>
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-bold mb-4">Reputação</h2>
            <div className="space-y-2">
              <p><strong>Score:</strong> {user.reputationScore}</p>
              <p><strong>Role:</strong> {user.role}</p>
            </div>
          </div>

          <div className="p-6 border rounded-lg bg-gradient-to-br from-purple-50 to-pink-50">
            <h2 className="text-xl font-bold mb-4">💳 Meus Endereços</h2>
            <p className="text-gray-600 mb-4">Gerencie seus endereços de criptomoedas</p>
            <button
              onClick={() => router.push('/wallets')}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              Gerenciar Endereços
            </button>
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-bold mb-4">Marketplace</h2>
            <p className="text-gray-600 mb-4">Veja pedidos disponíveis ou crie o seu</p>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/marketplace')}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Ver Marketplace
              </button>
              <button
                onClick={() => router.push('/orders/create')}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Criar Pedido
              </button>
              <button
                onClick={() => router.push('/orders/my-orders')}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
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
