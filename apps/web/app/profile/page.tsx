'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';

interface KYCStatus {
  kycLevel: string;
  kycData: any;
  transactionLimit: number;
}

interface UserProfile {
  id: string;
  email: string;
  cpf: string;
  name?: string;
  phone?: string;
  kycLevel: string;
  reputationScore: number;
  totalTransactions: number;
  successfulTransactions: number;
  createdAt: string;
}

interface KYCLevelData {
  level: string;
  name: string;
  limit: string;
  description: string;
  completed: boolean;
  isNext: boolean;
  url: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar perfil do usuário
        const token = localStorage.getItem('accessToken');
        const profileRes = await fetch('http://localhost:3001/api/v1/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!profileRes.ok) {
          throw new Error('Erro ao buscar perfil');
        }

        const profileData = await profileRes.json();
        const userData = profileData.data;

        // Se for ADMIN ou MASTER, redirecionar para perfil admin
        if (userData.role === 'ADMIN' || userData.role === 'MASTER') {
          console.log('Redirecionando para perfil admin...');
          router.push('/admin/profile');
          return;
        }

        setProfile(userData);

        // Buscar status KYC
        const kycRes = await fetch('http://localhost:3001/api/v1/kyc/status', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!kycRes.ok) {
          throw new Error('Erro ao buscar status KYC');
        }

        const kycData = await kycRes.json();
        setKycStatus(kycData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md p-8 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">Erro</h2>
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  // Nova lógica de verificação de níveis KYC
  const getKYCLevelsInfo = (currentLevel: string): {
    currentLevelName: string;
    currentLimit: string;
    levels: KYCLevelData[];
    allComplete: boolean;
  } => {
    const allLevels: KYCLevelData[] = [
      {
        level: 'LEVEL_1',
        name: 'Level 1',
        limit: 'R$ 10.000/dia',
        description: 'Nome completo + CPF + Telefone',
        completed: false,
        isNext: false,
        url: '/kyc/level1',
      },
      {
        level: 'LEVEL_2',
        name: 'Level 2',
        limit: 'R$ 50.000/dia',
        description: 'Endereço + Data de nascimento',
        completed: false,
        isNext: false,
        url: '/kyc/level2',
      },
      {
        level: 'LEVEL_3',
        name: 'Level 3',
        limit: 'R$ 100.000/dia',
        description: 'Documento + Selfie',
        completed: false,
        isNext: false,
        url: '/kyc/level3',
      },
      {
        level: 'LEVEL_4',
        name: 'Level 4',
        limit: 'Ilimitado',
        description: 'Comprovante de residência',
        completed: false,
        isNext: false,
        url: '/kyc/level4',
      },
    ];

    // Determinar índice do nível atual
    const currentLevelIndex = allLevels.findIndex(l => l.level === currentLevel);

    // Marcar níveis completados
    allLevels.forEach((level, index) => {
      if (currentLevel !== 'NONE' && index <= currentLevelIndex) {
        level.completed = true;
      }
    });

    // Marcar próximo nível a completar
    const nextLevelIndex = currentLevel === 'NONE' ? 0 : currentLevelIndex + 1;
    if (nextLevelIndex < allLevels.length) {
      allLevels[nextLevelIndex].isNext = true;
    }

    // Informações do nível atual
    let currentLevelName = 'Não verificado';
    let currentLimit = 'R$ 1.000/dia';

    if (currentLevel !== 'NONE' && currentLevelIndex >= 0) {
      currentLevelName = allLevels[currentLevelIndex].name;
      currentLimit = allLevels[currentLevelIndex].limit;
    }

    const allComplete = currentLevel === 'LEVEL_4';

    return {
      currentLevelName,
      currentLimit,
      levels: allLevels,
      allComplete,
    };
  };

  const kycInfo = getKYCLevelsInfo(kycStatus?.kycLevel || 'NONE');

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Meu Perfil</h1>
        </div>

        {/* Informações Básicas */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Informações Básicas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Nome</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile?.name || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">CPF</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile?.cpf}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Telefone</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile?.phone || 'Não informado'}</p>
            </div>
          </div>
        </div>

        {/* Status KYC */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Verificação KYC</h2>

          {/* Resumo do nível atual */}
          <div className="flex items-center justify-between mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Nível Atual</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{kycInfo.currentLevelName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Limite de Transação</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{kycInfo.currentLimit}</p>
            </div>
          </div>

          {/* Mensagem de todos completos */}
          {kycInfo.allComplete && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <p className="font-bold text-green-800 dark:text-green-200">Parabéns!</p>
                <p className="text-green-700 dark:text-green-300 text-sm">
                  Você completou todos os níveis de verificação KYC!
                </p>
              </div>
            </div>
          )}

          {/* Lista de níveis */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Níveis de Verificação:
            </h3>

            {kycInfo.levels.map((level) => (
              <div
                key={level.level}
                className={`p-5 rounded-lg border-2 transition-all ${
                  level.completed
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                    : level.isNext
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Informações do nível */}
                  <div className="flex items-center gap-4">
                    {/* Badge de status */}
                    <div className="flex-shrink-0">
                      {level.completed ? (
                        <div className="w-12 h-12 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-2xl font-bold">✓</span>
                        </div>
                      ) : level.isNext ? (
                        <div className="w-12 h-12 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xl font-bold">!</span>
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-gray-500 dark:text-gray-400 text-2xl">○</span>
                        </div>
                      )}
                    </div>

                    {/* Detalhes */}
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white">{level.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{level.description}</p>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">
                        Limite: {level.limit}
                      </p>
                    </div>
                  </div>

                  {/* Botão de ação */}
                  <div>
                    {level.completed ? (
                      <span className="px-4 py-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-semibold rounded-lg">
                        ✓ Completo
                      </span>
                    ) : level.isNext ? (
                      <button
                        onClick={() => router.push(level.url)}
                        className="px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                      >
                        Completar Agora
                      </button>
                    ) : (
                      <span className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-semibold rounded-lg cursor-not-allowed">
                        Bloqueado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dica */}
          {!kycInfo.allComplete && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                💡 <strong>Dica:</strong> Complete os níveis KYC em ordem para aumentar
                seu limite de transação e acessar mais recursos da plataforma.
              </p>
            </div>
          )}
        </div>

        {/* Reputação */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Reputação</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Score</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile?.reputationScore || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total de Transações</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile?.totalTransactions || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Transações Bem-sucedidas</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {profile?.successfulTransactions || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end">
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('accessToken');
              router.push('/login');
            }}
            className="py-3 px-6 bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white font-semibold rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
