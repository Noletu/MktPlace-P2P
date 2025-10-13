'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DAILY_LIMITS } from '@mktplace/shared';

export default function KYCInfoPage() {
  const router = useRouter();
  const [currentKycLevel, setCurrentKycLevel] = useState<string>('NONE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKycStatus = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:3001/api/v1/kyc/status', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar status KYC');
        }

        const data = await response.json();
        setCurrentKycLevel(data.kycLevel || 'NONE');
      } catch (err) {
        console.error('Erro ao buscar status KYC:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchKycStatus();
  }, [router]);

  const getLevelStatus = (levelKey: string): 'completed' | 'next' | 'blocked' => {
    const levelOrder = ['NONE', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4'];
    const currentIndex = levelOrder.indexOf(currentKycLevel);
    const levelIndex = levelOrder.indexOf(levelKey);

    if (levelIndex <= currentIndex) {
      return 'completed';
    } else if (levelIndex === currentIndex + 1) {
      return 'next';
    } else {
      return 'blocked';
    }
  };

  const kycLevels = [
    {
      level: 'NONE',
      name: 'Nível 0 - Email Verificado',
      limit: DAILY_LIMITS.NONE,
      requirements: ['Email verificado (automático no cadastro)'],
      features: [
        'Acesso básico à plataforma',
        'Visualizar marketplace',
        'Criar pedidos de até R$ 1.000/dia',
      ],
    },
    {
      level: 'LEVEL_1',
      name: 'Nível 1 - CPF + Telefone',
      limit: DAILY_LIMITS.LEVEL_1,
      requirements: ['Email verificado', 'Telefone confirmado', 'CPF válido'],
      features: [
        'Todas as funcionalidades do Nível 0',
        'Criar pedidos de até R$ 10.000/dia',
        'Aceitar pedidos do marketplace',
        'Melhor reputação na plataforma',
      ],
      route: '/kyc/level1',
    },
    {
      level: 'LEVEL_2',
      name: 'Nível 2 - Verificação de Identidade',
      limit: DAILY_LIMITS.LEVEL_2,
      requirements: [
        'Todos os requisitos do Nível 1',
        'Selfie com documento',
        'Foto do RG ou CNH',
        'Comprovante de endereço',
      ],
      features: [
        'Todas as funcionalidades do Nível 1',
        'Criar pedidos de até R$ 50.000/dia',
        'Prioridade no matching de pedidos',
        'Taxa de plataforma reduzida',
      ],
      route: '/kyc/level2',
    },
    {
      level: 'LEVEL_3',
      name: 'Nível 3 - Verificação Avançada',
      limit: DAILY_LIMITS.LEVEL_3,
      requirements: [
        'Todos os requisitos do Nível 2',
        'Comprovante de renda',
        'Dados bancários verificados',
        'Análise de compliance',
      ],
      features: [
        'Todas as funcionalidades do Nível 2',
        'Criar pedidos de até R$ 100.000/dia',
        'Acesso a recursos premium',
        'Suporte prioritário',
      ],
      route: null,
    },
    {
      level: 'LEVEL_4',
      name: 'Nível 4 - Contas Empresariais',
      limit: DAILY_LIMITS.LEVEL_4,
      requirements: [
        'Todos os requisitos do Nível 3',
        'CNPJ da empresa',
        'Contrato social',
        'Documentação dos sócios',
        'Enhanced Due Diligence',
      ],
      features: [
        'Todas as funcionalidades do Nível 3',
        'Limite diário ilimitado',
        'API dedicada para integração',
        'Gerente de conta dedicado',
        'Taxas negociáveis',
      ],
      route: null,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 text-blue-600 hover:text-blue-700 font-semibold"
          >
            ← Voltar ao Dashboard
          </button>
          <h1 className="text-4xl font-bold mb-4">Níveis de Verificação (KYC)</h1>
          <p className="text-gray-600 text-lg">
            Aumente seu limite diário completando os níveis de verificação.
          </p>
        </div>

        <div className="space-y-6">
          {kycLevels.map((level) => {
            const status = getLevelStatus(level.level);
            const isCompleted = status === 'completed';
            const isNext = status === 'next';
            const isBlocked = status === 'blocked';

            return (
              <div
                key={level.level}
                className={`rounded-lg shadow-md p-6 border-l-4 ${
                  isCompleted ? 'bg-green-50' : isNext ? 'bg-blue-50' : 'bg-gray-50'
                }`}
                style={{
                  borderLeftColor: isCompleted ? '#10b981' : isNext ? '#3b82f6' : '#94a3b8',
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold">{level.name}</h2>
                      {isCompleted && (
                        <span className="text-sm px-3 py-1 bg-green-100 text-green-700 font-semibold rounded-full">
                          ✓ Concluído
                        </span>
                      )}
                      {isNext && (
                        <span className="text-sm px-3 py-1 bg-blue-100 text-blue-700 font-semibold rounded-full animate-pulse">
                          → Próximo
                        </span>
                      )}
                    </div>
                    <p className="text-3xl font-bold text-green-600">
                      {level.limit >= 999999999
                        ? 'Limite: Ilimitado'
                        : `Limite: R$ ${level.limit.toLocaleString('pt-BR')}/dia`}
                    </p>
                  </div>

                  <div>
                    {isCompleted && (
                      <div className="px-6 py-3 bg-green-100 text-green-700 font-semibold rounded-lg flex items-center gap-2">
                        <span className="text-xl">✓</span>
                        <span>Completo</span>
                      </div>
                    )}
                    {isNext && level.route && (
                      <button
                        onClick={() => router.push(level.route)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                      >
                        Completar Agora
                      </button>
                    )}
                    {isNext && !level.route && (
                      <button disabled className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed">
                        Em breve
                      </button>
                    )}
                    {isBlocked && (
                      <div className="px-6 py-3 bg-gray-200 text-gray-500 font-semibold rounded-lg">
                        Bloqueado
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3">📋 Requisitos:</h3>
                    <ul className="space-y-2">
                      {level.requirements.map((req, i) => (
                        <li key={i} className="text-gray-700">
                          • {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">🎁 Benefícios:</h3>
                    <ul className="space-y-2">
                      {level.features.map((feature, i) => (
                        <li key={i} className="text-gray-700">
                          • {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-3">ℹ️ Informações Importantes</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• Os limites diários são cumulativos</li>
            <li>• A verificação pode levar de 1 a 48 horas úteis</li>
            <li>• Todos os documentos são criptografados</li>
            <li>• Em caso de dúvidas, entre em contato com o suporte</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
