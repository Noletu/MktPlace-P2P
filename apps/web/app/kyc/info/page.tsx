'use client';

import { useRouter } from 'next/navigation';
import { DAILY_LIMITS } from '@mktplace/shared';

export default function KYCInfoPage() {
  const router = useRouter();

  const kycLevels = [
    {
      level: 'NONE',
      name: 'Nível 0 - Email Verificado',
      limit: DAILY_LIMITS.NONE,
      requirements: [
        '✅ Email verificado (automático no cadastro)',
      ],
      features: [
        'Acesso básico à plataforma',
        'Visualizar marketplace',
        'Criar pedidos de até R$ 1.000/dia',
      ],
      action: 'Já liberado após cadastro',
      route: null,
    },
    {
      level: 'LEVEL_1',
      name: 'Nível 1 - CPF + Telefone',
      limit: DAILY_LIMITS.LEVEL_1,
      requirements: [
        '✅ Email verificado',
        '📱 Telefone confirmado',
        '🆔 CPF válido',
      ],
      features: [
        'Todas as funcionalidades do Nível 0',
        'Criar pedidos de até R$ 10.000/dia',
        'Aceitar pedidos do marketplace',
        'Melhor reputação na plataforma',
      ],
      action: 'Fazer KYC Nível 1',
      route: '/kyc/level1',
    },
    {
      level: 'LEVEL_2',
      name: 'Nível 2 - Verificação de Identidade',
      limit: DAILY_LIMITS.LEVEL_2,
      requirements: [
        '✅ Todos os requisitos do Nível 1',
        '🤳 Selfie com documento',
        '🆔 Foto do RG ou CNH',
        '🏠 Comprovante de endereço (últimos 3 meses)',
      ],
      features: [
        'Todas as funcionalidades do Nível 1',
        'Criar pedidos de até R$ 50.000/dia',
        'Prioridade no matching de pedidos',
        'Taxa de plataforma reduzida',
      ],
      action: 'Fazer KYC Nível 2',
      route: '/kyc/level2',
    },
    {
      level: 'LEVEL_3',
      name: 'Nível 3 - Verificação Avançada',
      limit: DAILY_LIMITS.LEVEL_3,
      requirements: [
        '✅ Todos os requisitos do Nível 2',
        '💰 Comprovante de renda',
        '🏦 Dados bancários verificados',
        '📊 Análise de compliance',
      ],
      features: [
        'Todas as funcionalidades do Nível 2',
        'Criar pedidos de até R$ 100.000/dia',
        'Acesso a recursos premium',
        'Suporte prioritário',
      ],
      action: 'Solicitar KYC Nível 3',
      route: null, // TODO: Implementar
    },
    {
      level: 'LEVEL_4',
      name: 'Nível 4 - Contas Empresariais',
      limit: '∞',
      requirements: [
        '✅ Todos os requisitos do Nível 3',
        '🏢 CNPJ da empresa',
        '📋 Contrato social',
        '👥 Documentação dos sócios',
        '🔍 Enhanced Due Diligence (EDD)',
      ],
      features: [
        'Todas as funcionalidades do Nível 3',
        'Limite diário ilimitado',
        'API dedicada para integração',
        'Gerente de conta dedicado',
        'Taxas negociáveis',
      ],
      action: 'Solicitar KYC Nível 4',
      route: null, // TODO: Implementar
    },
  ];

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
            Aumente seu limite diário completando os níveis de verificação. Quanto maior o nível, maior sua capacidade de transação e benefícios na plataforma.
          </p>
        </div>

        <div className="space-y-6">
          {kycLevels.map((level, index) => (
            <div
              key={level.level}
              className="bg-white rounded-lg shadow-md p-6 border-l-4"
              style={{
                borderLeftColor:
                  index === 0 ? '#94a3b8' :
                  index === 1 ? '#3b82f6' :
                  index === 2 ? '#10b981' :
                  index === 3 ? '#f59e0b' :
                  '#8b5cf6'
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{level.name}</h2>
                  <p className="text-3xl font-bold text-green-600">
                    Limite: R$ {typeof level.limit === 'number' ? level.limit.toLocaleString('pt-BR') : level.limit}/dia
                  </p>
                </div>
                {level.route && (
                  <button
                    onClick={() => router.push(level.route)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                  >
                    {level.action}
                  </button>
                )}
                {!level.route && level.action !== 'Já liberado após cadastro' && (
                  <button
                    disabled
                    className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed"
                  >
                    Em breve
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3">📋 Requisitos:</h3>
                  <ul className="space-y-2">
                    {level.requirements.map((req, i) => (
                      <li key={i} className="text-gray-700">{req}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">🎁 Benefícios:</h3>
                  <ul className="space-y-2">
                    {level.features.map((feature, i) => (
                      <li key={i} className="text-gray-700">• {feature}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-3">ℹ️ Informações Importantes</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• Os limites diários são cumulativos - o valor total de todas as suas transações no dia</li>
            <li>• A verificação pode levar de 1 a 48 horas úteis</li>
            <li>• Todos os documentos são armazenados com criptografia de ponta a ponta</li>
            <li>• Você pode iniciar o processo de um nível superior antes de completar o anterior</li>
            <li>• Em caso de dúvidas, entre em contato com nosso suporte</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
