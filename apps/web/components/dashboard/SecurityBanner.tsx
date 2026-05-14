'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  reputationScore: number;
  has2FA: boolean;
}

// Calcula limite diário baseado em reputação
// Fórmula: 1000 + (reputationScore * 100) BRL
const getDailyLimit = (reputationScore: number) => {
  const limit = 1000 + (reputationScore * 100);
  return `R$ ${limit.toLocaleString('pt-BR')}/dia`;
};

const getReputationLevel = (score: number) => {
  if (score === 0) return { name: 'Novo Usuário', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
  if (score < 30) return { name: 'Iniciante', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' };
  if (score < 60) return { name: 'Regular', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
  if (score < 90) return { name: 'Experiente', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' };
  return { name: 'Veterano', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' };
};

export default function SecurityBanner() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/auth/me');
      setUser(data.data);
    } catch (err) {
      console.error('Erro ao buscar dados do usuário:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <p className="text-blue-800 dark:text-blue-200">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const reputationLevel = getReputationLevel(user.reputationScore || 0);
  const dailyLimit = getDailyLimit(user.reputationScore || 0);
  const needs2FA = !user.has2FA;

  // Se 2FA está ativado, mostrar banner de sucesso
  if (!needs2FA) {
    return (
      <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200">
              Segurança em Dia!
            </p>
            <p className="text-sm text-green-600 dark:text-green-300">
              Reputação: <span className={`px-2 py-0.5 rounded text-xs font-semibold ${reputationLevel.color}`}>
                {reputationLevel.name}
              </span> | Limite: {dailyLimit}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Info de Reputação */}
      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl">⭐</span>
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-200">
                Seu Limite Diário
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Reputação: <span className={`px-2 py-0.5 rounded text-xs font-semibold ${reputationLevel.color}`}>
                  {user.reputationScore || 0}/100
                </span> | Limite: {dailyLimit}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/profile')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            Ver Detalhes
          </button>
        </div>
      </div>

      {/* 2FA Alert */}
      {needs2FA && (
        <div className="bg-orange-50 dark:bg-orange-900 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-2xl">🔐</span>
              <div>
                <p className="font-semibold text-orange-800 dark:text-orange-200">
                  Ative a Autenticação de Dois Fatores (2FA)
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Proteja sua conta com uma camada extra de segurança
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/2fa/setup')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0"
            >
              Ativar 2FA Agora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
