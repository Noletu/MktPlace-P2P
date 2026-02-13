'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { ReviewStats } from '@/components/ReviewStats';

interface UserProfile {
  id: string;
  email: string;
  cpf: string;
  name?: string;
  phone?: string;
  reputationScore: number;
  totalTransactions: number;
  successfulTransactions: number;
  createdAt: string;
  twoFactorEnabled?: boolean;
  has2FA?: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [reviewStats, setReviewStats] = useState<any>(null);
  const [activeCoupon, setActiveCoupon] = useState<any>(null);
  const [publicCoupons, setPublicCoupons] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [activatingCoupon, setActivatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

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

        // Se for SUPPORT+ (level >= 40), redirecionar para perfil admin
        if ((userData.level || 0) >= 40) {
          console.log('Redirecionando para perfil admin...');
          router.push('/admin/profile');
          return;
        }

        setProfile(userData);

        // Buscar estatísticas de avaliações
        try {
          console.log('[DEBUG] Buscando reviews para userId:', userData.id);
          const reviewRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/reviews/user/${userData.id}/stats`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          console.log('[DEBUG] Review response status:', reviewRes.status);

          if (reviewRes.ok) {
            const reviewData = await reviewRes.json();
            console.log('[DEBUG] Review data recebida:', reviewData);
            // API retorna { success: true, data: {...} }, extrair apenas data
            setReviewStats(reviewData.data || reviewData);
          } else {
            const errorData = await reviewRes.json();
            console.error('[DEBUG] Review response error:', errorData);
          }
        } catch (reviewErr) {
          // Silently fail - reviews são opcionais
          console.log('[DEBUG] Erro ao buscar reviews:', reviewErr);
        }

        // Buscar cupons (ativo e públicos)
        try {
          const [activeRes, publicRes] = await Promise.all([
            fetch('http://localhost:3001/api/v1/coupons/active', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch('http://localhost:3001/api/v1/coupons/public', {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          if (activeRes.ok) {
            const activeData = await activeRes.json();
            if (activeData.success && activeData.data) {
              setActiveCoupon(activeData.data);
            }
          }

          if (publicRes.ok) {
            const publicData = await publicRes.json();
            if (publicData.success) {
              setPublicCoupons(publicData.data);
            }
          }
        } catch (couponErr) {
          console.log('[DEBUG] Erro ao buscar cupons:', couponErr);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleOpenEditModal = () => {
    setEditForm({
      name: profile?.name || '',
      email: profile?.email || '',
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    try {
      setEditLoading(true);
      setEditError('');

      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar perfil');
      }

      const data = await response.json();
      setProfile(data.data);
      setIsEditModalOpen(false);
      alert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleActivateCoupon = async () => {
    setActivatingCoupon(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/coupons/activate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: couponCode }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao ativar cupom');
      }

      setCouponSuccess('Cupom ativado com sucesso!');
      setCouponCode('');

      // Refresh coupon data
      const token2 = localStorage.getItem('accessToken');
      const [activeRes, publicRes] = await Promise.all([
        fetch('http://localhost:3001/api/v1/coupons/active', {
          headers: { Authorization: `Bearer ${token2}` },
        }),
        fetch('http://localhost:3001/api/v1/coupons/public', {
          headers: { Authorization: `Bearer ${token2}` },
        }),
      ]);

      if (activeRes.ok) {
        const activeData = await activeRes.json();
        if (activeData.success && activeData.data) {
          setActiveCoupon(activeData.data);
        }
      }

      if (publicRes.ok) {
        const publicData = await publicRes.json();
        if (publicData.success) {
          setPublicCoupons(publicData.data);
        }
      }
    } catch (err: any) {
      setCouponError(err.message);
    } finally {
      setActivatingCoupon(false);
    }
  };

  const handleDeactivateCoupon = async () => {
    if (!confirm('Deseja realmente desativar este cupom?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/coupons/deactivate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error);
      }

      // Refresh coupon data
      const [activeRes, publicRes] = await Promise.all([
        fetch('http://localhost:3001/api/v1/coupons/active', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3001/api/v1/coupons/public', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveCoupon(activeData.success && activeData.data ? activeData.data : null);
      }

      if (publicRes.ok) {
        const publicData = await publicRes.json();
        if (publicData.success) {
          setPublicCoupons(publicData.data);
        }
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  // Calcula limite diario baseado em reputacao
  // Formula: 1000 + (reputationScore * 100) BRL
  const getDailyLimit = (reputationScore: number) => {
    const limit = 1000 + (reputationScore * 100);
    return `R$ ${limit.toLocaleString('pt-BR')}/dia`;
  };

  const getReputationLevel = (score: number) => {
    if (score === 0) return { name: 'Novo Usuario', color: 'gray' };
    if (score < 30) return { name: 'Iniciante', color: 'blue' };
    if (score < 60) return { name: 'Regular', color: 'green' };
    if (score < 90) return { name: 'Experiente', color: 'purple' };
    return { name: 'Veterano', color: 'yellow' };
  };

  const reputationLevel = getReputationLevel(profile?.reputationScore || 0);

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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Informações Básicas</h2>
            <button
              onClick={handleOpenEditModal}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors"
            >
              Editar Perfil
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Nome</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile?.name || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">ID do Usuário</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 dark:text-white font-mono text-xs truncate max-w-[180px]">
                  {profile?.id || 'N/A'}
                </p>
                <button
                  onClick={() => {
                    if (profile?.id) {
                      navigator.clipboard.writeText(profile.id);
                    }
                  }}
                  className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Copiar ID"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">CPF</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile?.cpf || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Telefone</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile?.phone || 'Não informado'}</p>
            </div>
          </div>
        </div>

        {/* Segurança */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">🔐 Segurança</h2>

          {/* Status 2FA */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-200 dark:border-blue-700 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {profile?.has2FA || profile?.twoFactorEnabled ? (
                    <div className="w-16 h-16 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-3xl">✓</span>
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-orange-500 dark:bg-orange-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-3xl">!</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    Autenticação de Dois Fatores (2FA)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {profile?.has2FA || profile?.twoFactorEnabled
                      ? '✅ Ativo - Sua conta está protegida com 2FA'
                      : '⚠️ Inativo - Recomendamos ativar para maior segurança'
                    }
                  </p>
                </div>
              </div>

              <div>
                <button
                  onClick={() => router.push('/2fa/setup')}
                  className={`px-6 py-3 font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg ${
                    profile?.has2FA || profile?.twoFactorEnabled
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800'
                  }`}
                >
                  {profile?.has2FA || profile?.twoFactorEnabled ? 'Gerenciar 2FA' : 'Ativar 2FA'}
                </button>
              </div>
            </div>
          </div>

          {/* Informações sobre 2FA */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
              📱 O que é 2FA?
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
              A autenticação de dois fatores adiciona uma camada extra de segurança. Além da sua senha, você precisará de um código gerado por um app autenticador no seu celular.
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300 font-semibold mb-1">
              Apps recomendados:
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-400 list-disc list-inside">
              <li>Google Authenticator</li>
              <li>Microsoft Authenticator</li>
              <li>Authy</li>
            </ul>
          </div>
        </div>

        {/* Limites de Transacao */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Limites de Transacao</h2>

          {/* Resumo do nivel atual */}
          <div className="flex items-center justify-between mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Nivel de Reputacao</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{reputationLevel.name}</p>
              <p className="text-lg text-gray-600 dark:text-gray-400">{profile?.reputationScore || 0}/100 pontos</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Limite Diario</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{getDailyLimit(profile?.reputationScore || 0)}</p>
            </div>
          </div>

          {/* Barra de progresso da reputacao */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Progresso da Reputacao</span>
              <span>{profile?.reputationScore || 0}/100</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${profile?.reputationScore || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Mensagem de limite maximo */}
          {(profile?.reputationScore || 0) >= 100 && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <p className="font-bold text-green-800 dark:text-green-200">Parabens!</p>
                <p className="text-green-700 dark:text-green-300 text-sm">
                  Voce atingiu o nivel maximo de reputacao e tem o limite diario maximo de R$ 11.000!
                </p>
              </div>
            </div>
          )}

          {/* Como funciona */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Como funcionam os limites?
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Cada transacao bem-sucedida aumenta sua reputacao em 10 pontos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Seu limite diario e calculado como: R$ 1.000 + (reputacao x R$ 100)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Limite inicial: R$ 1.000/dia | Limite maximo: R$ 11.000/dia</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">💡</span>
                <span>Complete mais transacoes para aumentar seu limite!</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Reputação */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Reputação</h2>

          {/* Métricas Gerais */}
          <div className="grid grid-cols-3 gap-4 mb-6">
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

          {/* Divisor */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-6"></div>

          {/* Avaliações Recebidas */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">📊 Avaliações Recebidas</h3>

            {reviewStats && reviewStats.totalReviews > 0 ? (
              <>
                <ReviewStats stats={reviewStats} compact={true} />

                {/* Botão para ver todas as avaliações */}
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/reviews')}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    Ver Todas as Avaliações →
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  Nenhuma avaliação recebida ainda
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Complete transações para começar a receber avaliações
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cupons Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6 border border-gray-300 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            🎟️ Cupons de Desconto
          </h2>

          {/* Active Coupon Display */}
          {activeCoupon ? (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-bold text-green-700 dark:text-green-400">
                    Cupom Ativo: {activeCoupon.coupon.code}
                  </h3>
                  {activeCoupon.coupon.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {activeCoupon.coupon.description}
                    </p>
                  )}
                </div>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {activeCoupon.coupon.discountPercentage}% OFF
                </span>
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    {activeCoupon.coupon.maxUsesPerUser === 0
                      ? 'Uso ilimitado'
                      : `Usos restantes: ${activeCoupon.usesRemaining} de ${activeCoupon.coupon.maxUsesPerUser}`}
                  </p>
                  {activeCoupon.coupon.expiresAt && (
                    <p>Expira em: {new Date(activeCoupon.coupon.expiresAt).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
                <button
                  onClick={handleDeactivateCoupon}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition"
                >
                  Desativar Cupom
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400 text-center">
                Você não tem nenhum cupom ativo no momento.
              </p>
            </div>
          )}

          {/* Activate Coupon Form */}
          {!activeCoupon && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Ativar Cupom
              </h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Digite o código do cupom"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  maxLength={20}
                />
                <button
                  onClick={handleActivateCoupon}
                  disabled={!couponCode || activatingCoupon}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition"
                >
                  {activatingCoupon ? 'Ativando...' : 'Ativar'}
                </button>
              </div>
              {couponError && (
                <p className="text-red-500 text-sm mt-2">{couponError}</p>
              )}
              {couponSuccess && (
                <p className="text-green-500 text-sm mt-2">{couponSuccess}</p>
              )}
            </div>
          )}

          {/* Public Coupons List */}
          {publicCoupons.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Cupons Públicos Disponíveis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publicCoupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="p-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">
                          {coupon.code}
                        </h4>
                        {coupon.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {coupon.description}
                          </p>
                        )}
                      </div>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {coupon.discountPercentage}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <p>Limite: {coupon.maxUsesPerUser === 0 ? 'Ilimitado' : `${coupon.maxUsesPerUser}x por usuário`}</p>
                        <p>Você já usou: {coupon.userTimesUsed}x</p>
                        {coupon.expiresAt && (
                          <p>Expira: {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}</p>
                        )}
                      </div>
                      {coupon.canActivate && !activeCoupon && (
                        <button
                          onClick={() => {
                            setCouponCode(coupon.code);
                            handleActivateCoupon();
                          }}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition"
                        >
                          Ativar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

    {/* Modal de Edição */}
    {isEditModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Editar Perfil</h3>

          {editError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{editError}</p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Digite seu nome"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Digite seu email"
              />
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                💡 <strong>Nota:</strong> CPF e telefone nao podem ser alterados apos o cadastro.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setIsEditModalOpen(false)}
              disabled={editLoading}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={editLoading}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {editLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
