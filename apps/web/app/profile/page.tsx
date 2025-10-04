'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Buscar perfil do usuário
        const profileRes = await fetch('http://localhost:3001/api/v1/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!profileRes.ok) {
          throw new Error('Erro ao buscar perfil');
        }

        const profileData = await profileRes.json();
        setProfile(profileData);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md p-8 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-bold text-red-800 mb-2">Erro</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const getKYCLevelInfo = (level: string) => {
    switch (level) {
      case 'NONE':
        return {
          name: 'Não verificado',
          limit: 'R$ 0,00',
          color: 'gray',
          nextStep: 'Completar KYC Level 1',
          nextUrl: '/kyc/level1',
        };
      case 'LEVEL_1':
        return {
          name: 'Level 1',
          limit: 'R$ 500,00',
          color: 'green',
          nextStep: 'Completar KYC Level 2',
          nextUrl: '/kyc/level2',
        };
      case 'LEVEL_2':
        return {
          name: 'Level 2',
          limit: 'R$ 2.000,00',
          color: 'blue',
          nextStep: 'Completar KYC Level 3',
          nextUrl: '/kyc/level3',
        };
      case 'LEVEL_3':
        return {
          name: 'Level 3',
          limit: 'R$ 10.000,00',
          color: 'purple',
          nextStep: 'Completar KYC Level 4',
          nextUrl: '/kyc/level4',
        };
      case 'LEVEL_4':
        return {
          name: 'Level 4 (Máximo)',
          limit: 'Ilimitado',
          color: 'yellow',
          nextStep: null,
          nextUrl: null,
        };
      default:
        return {
          name: 'Desconhecido',
          limit: 'R$ 0,00',
          color: 'gray',
          nextStep: null,
          nextUrl: null,
        };
    }
  };

  const kycInfo = getKYCLevelInfo(kycStatus?.kycLevel || 'NONE');

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Meu Perfil</h1>

        {/* Informações Básicas */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">Informações Básicas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="font-semibold">{profile?.name || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold">{profile?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="font-semibold">{profile?.cpf}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Telefone</p>
              <p className="font-semibold">{profile?.phone || 'Não informado'}</p>
            </div>
          </div>
        </div>

        {/* Status KYC */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">Verificação KYC</h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600">Nível Atual</p>
              <p className="text-2xl font-bold text-blue-600">{kycInfo.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Limite de Transação</p>
              <p className="text-2xl font-bold text-green-600">{kycInfo.limit}</p>
            </div>
          </div>

          {kycInfo.nextStep && kycInfo.nextUrl && (
            <button
              onClick={() => router.push(kycInfo.nextUrl)}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              {kycInfo.nextStep}
            </button>
          )}

          {kycStatus?.kycLevel === 'LEVEL_4' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              ✓ Você completou todos os níveis de verificação KYC!
            </div>
          )}
        </div>

        {/* Reputação */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">Reputação</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Score</p>
              <p className="text-2xl font-bold">{profile?.reputationScore || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Transações</p>
              <p className="text-2xl font-bold">{profile?.totalTransactions || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Transações Bem-sucedidas</p>
              <p className="text-2xl font-bold text-green-600">
                {profile?.successfulTransactions || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
          >
            Voltar ao Dashboard
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              router.push('/login');
            }}
            className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
