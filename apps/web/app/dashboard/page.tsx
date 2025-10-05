'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name?: string;
  cpf: string;
  kycLevel: string;
  reputationScore: number;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/v1/auth/me', {
          credentials: 'include', // SECURITY: Envia cookies HttpOnly
        });

        if (!response.ok) {
          throw new Error('Não autorizado');
        }

        const data = await response.json();
        setUser(data.data);
      } catch (error) {
        console.error('Error fetching user:', error);
        localStorage.removeItem('token');
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
      await fetch('http://localhost:3001/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include', // SECURITY: Envia cookies para revogação
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }

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
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-bold mb-4">Informações Pessoais</h2>
            <div className="space-y-2">
              <p><strong>Nome:</strong> {user.name || 'Não informado'}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>CPF:</strong> {user.cpf}</p>
              <p><strong>Nível KYC:</strong> {user.kycLevel}</p>
              {user.kycLevel === 'NONE' && (
                <button
                  onClick={() => router.push('/kyc/level1')}
                  className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Completar KYC Level 1
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

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-bold mb-4">Carteiras</h2>
            <p className="text-gray-600 mb-4">Gerencie suas carteiras de criptomoedas</p>
            <button
              onClick={() => router.push('/wallets')}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              Ver Carteiras
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
