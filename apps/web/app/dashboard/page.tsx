'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import CollateralSummaryWidget from '@/components/dashboard/CollateralSummaryWidget';
import ActiveOrdersCard from '@/components/dashboard/ActiveOrdersCard';
import StatisticsCard from '@/components/dashboard/StatisticsCard';
import SecurityBanner from '@/components/dashboard/SecurityBanner';
import FloatingActionButton from '@/components/dashboard/FloatingActionButton';
import { FrozenAccountBanner } from '@/components/FrozenAccountBanner';
import { useChats } from '@/hooks/useChats';
import { fetchWithAuth } from '@/utils/api';

interface User {
  id: string;
  email: string;
  name?: string;
  cpf: string;
  reputationScore: number;
  role: string;
  // ADMIN CONTROLS: Bloqueio
  accountFrozen?: boolean;
  frozenReason?: string | null;
  frozenAt?: string | null;
  frozenUntil?: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { getTotalUnreadCount } = useChats();

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetchWithAuth('/auth/me');

      if (!response.ok) {
        throw new Error('Não autorizado');
      }

      const data = await response.json();
      const userData = data.data;

      setUser(userData);
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

  // Calcula limite diário baseado em reputação
  // Fórmula: 1000 + (reputationScore * 100) BRL
  const getDailyLimit = (reputationScore: number) => {
    const limit = 1000 + (reputationScore * 100);
    return `R$ ${limit.toLocaleString('pt-BR')}/dia`;
  };

  const getReputationDisplay = (score: number) => {
    if (score === 0) return 'Novo Usuário';
    if (score < 30) return 'Iniciante';
    if (score < 60) return 'Regular';
    if (score < 90) return 'Experiente';
    return 'Veterano';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <AppHeader />

      {/* BANNER: Aviso de conta bloqueada */}
      {user.accountFrozen && (
        <FrozenAccountBanner
          frozenReason={user.frozenReason || 'Não especificado'}
          frozenAt={user.frozenAt || ''}
          frozenUntil={user.frozenUntil}
        />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                Olá, {user.name || 'Usuário'}! 👋
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Bem-vindo ao seu painel P2P
              </p>
            </div>
            <div className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold">
                ⭐ Reputação: {user.reputationScore}/100 - {getReputationDisplay(user.reputationScore)}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                Limite: {getDailyLimit(user.reputationScore)}
              </p>
            </div>
          </div>
        </div>

        {/* Security Banner */}
        <div className="mb-8">
          <SecurityBanner />
        </div>

        {/* Collateral Summary Widget (destaque principal) */}
        <div className="mb-8">
          <CollateralSummaryWidget />
        </div>

        {/* Grid 2 Colunas - Métricas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ActiveOrdersCard />
          <StatisticsCard />
        </div>

        {/* Quick Links (opcional, para mobile) */}
        <div className="md:hidden grid grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/marketplace')}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-2">🏪</div>
            <p className="font-semibold text-gray-900 dark:text-white">Marketplace</p>
          </button>
          <button
            onClick={() => router.push('/wallets')}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-2">💳</div>
            <p className="font-semibold text-gray-900 dark:text-white">Carteiras</p>
          </button>
          <button
            onClick={() => router.push('/orders/my-orders')}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow relative"
          >
            <div className="text-3xl mb-2">📦</div>
            <p className="font-semibold text-gray-900 dark:text-white">Meus Pedidos</p>
            {getTotalUnreadCount() > 0 && (
              <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {getTotalUnreadCount()}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push('/disputes')}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-2">⚖️</div>
            <p className="font-semibold text-gray-900 dark:text-white">Disputas</p>
          </button>
        </div>
      </main>

        {/* Floating Action Button */}
        <FloatingActionButton accountFrozen={user?.accountFrozen} />
      </div>
    </>
  );
}
