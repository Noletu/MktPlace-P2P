'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  kycLevel: string;
  has2FA: boolean;
}

const kycLevels: Record<string, { label: string; limit: string; color: string }> = {
  NONE: { label: 'Email Verificado', limit: 'R$ 1.000/dia', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  LEVEL_1: { label: 'Nível 1', limit: 'R$ 10.000/dia', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  LEVEL_2: { label: 'Nível 2', limit: 'R$ 50.000/dia', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  LEVEL_3: { label: 'Nível 3', limit: 'R$ 100.000/dia', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  LEVEL_4: { label: 'Nível 4', limit: 'Ilimitado', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
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

  const currentKyc = kycLevels[user.kycLevel] || kycLevels.NONE;
  const needs2FA = !user.has2FA;
  const needsKYC = user.kycLevel === 'NONE' || user.kycLevel === 'LEVEL_1';

  // Não mostrar banner se tudo estiver OK
  if (!needs2FA && !needsKYC) {
    return (
      <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200">
              Segurança em Dia!
            </p>
            <p className="text-sm text-green-600 dark:text-green-300">
              Seu nível KYC: {currentKyc.label} ({currentKyc.limit})
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* KYC Alert */}
      {needsKYC && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Aumente seu Limite Diário
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Seu nível atual: <span className={`px-2 py-0.5 rounded text-xs font-semibold ${currentKyc.color}`}>
                    {currentKyc.label}
                  </span> (Limite: {currentKyc.limit})
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => router.push('/kyc/info')}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                Ver Níveis KYC
              </button>
              {user.kycLevel === 'NONE' && (
                <button
                  onClick={() => router.push('/kyc/level1')}
                  className="px-4 py-2 bg-yellow-700 text-white rounded-lg hover:bg-yellow-800 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  Fazer KYC Nível 1
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
