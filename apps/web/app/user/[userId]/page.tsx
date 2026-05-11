'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ReviewStats } from '@/components/ReviewStats';
import { Star, ArrowLeft, Shield, Clock, CheckCircle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import CancellationBadge from '@/components/CancellationBadge';
import { fetchWithAuth } from '@/utils/api';

interface PublicProfile {
  id: string;
  name: string;
  reputationScore: number;
  totalTransactions: number;
  successfulTransactions: number;
  totalCancellations: number;
  recentCancellations: number;
  createdAt: string;
}

interface Review {
  id: string;
  rating: number;
  reliabilityRating?: number;
  communicationRating?: number;
  speedRating?: number;
  comment?: string;
  createdAt: string;
  reviewer: {
    id: string;
    name: string;
  };
}

export default function PublicUserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviewStats, setReviewStats] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userId) {
      fetchPublicProfile();
      fetchReviewStats();
      fetchReviews();
    }
  }, [userId]);

  const fetchPublicProfile = async () => {
    try {
      const response = await fetchWithAuth(`/auth/public-profile/${userId}`);

      if (!response.ok) {
        throw new Error('Usuário não encontrado');
      }

      const data = await response.json();
      setProfile(data.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar perfil');
    }
  };

  const fetchReviewStats = async () => {
    try {
      const response = await fetchWithAuth(`/reviews/user/${userId}/stats`);

      if (response.ok) {
        const data = await response.json();
        setReviewStats(data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar stats de reviews:', err);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetchWithAuth(`/reviews/user/${userId}`);

      if (response.ok) {
        const data = await response.json();
        setReviews(data.data.reviews || []);
      }
    } catch (err) {
      console.error('Erro ao buscar reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
          size={20}
        />
      );
    }
    return stars;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-xl text-gray-900 dark:text-white">Carregando...</div>
        </div>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Usuário não encontrado</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'Este perfil não existe.'}</p>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header com botão voltar */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Voltar</span>
          </button>

          {/* Perfil Público */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{profile.name}</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Membro desde {formatDate(profile.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Shield className={`${profile.reputationScore >= 50 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} size={24} />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Limite Diário</p>
                  <p className="font-bold text-gray-900 dark:text-white">R$ {(1000 + profile.reputationScore * 100).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </div>

            {/* Badge de Cancelamentos (se houver) */}
            {profile.recentCancellations > 0 && (
              <div className="mt-6">
                <CancellationBadge
                  recentCancellations={profile.recentCancellations}
                  totalCancellations={profile.totalCancellations}
                />
              </div>
            )}

            {/* Estatísticas de Reputação */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="text-yellow-400" size={20} />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Score de Reputação</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.reputationScore}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-blue-600 dark:text-blue-400" size={20} />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total de Transações</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.totalTransactions}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transações Bem-sucedidas</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.successfulTransactions}</p>
                {profile.totalTransactions > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {Math.round((profile.successfulTransactions / profile.totalTransactions) * 100)}% de sucesso
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Avaliações Recebidas</h2>

                {reviews.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={64} />
                    <p className="text-gray-600 dark:text-gray-400">Ainda não há avaliações.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{review.reviewer.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(review.createdAt)}</p>
                          </div>
                          <div className="flex gap-0.5">{renderStars(review.rating)}</div>
                        </div>

                        {review.comment && (
                          <p className="text-gray-700 dark:text-gray-300 mb-3">{review.comment}</p>
                        )}

                        {(review.reliabilityRating || review.communicationRating || review.speedRating) && (
                          <div className="flex flex-wrap gap-3 text-sm">
                            {review.reliabilityRating && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600 dark:text-gray-400">Confiabilidade:</span>
                                <div className="flex gap-0.5">
                                  {Array.from({ length: review.reliabilityRating }).map((_, i) => (
                                    <Star key={i} className="fill-yellow-400 text-yellow-400" size={14} />
                                  ))}
                                </div>
                              </div>
                            )}
                            {review.communicationRating && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600 dark:text-gray-400">Comunicação:</span>
                                <div className="flex gap-0.5">
                                  {Array.from({ length: review.communicationRating }).map((_, i) => (
                                    <Star key={i} className="fill-yellow-400 text-yellow-400" size={14} />
                                  ))}
                                </div>
                              </div>
                            )}
                            {review.speedRating && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600 dark:text-gray-400">Rapidez:</span>
                                <div className="flex gap-0.5">
                                  {Array.from({ length: review.speedRating }).map((_, i) => (
                                    <Star key={i} className="fill-yellow-400 text-yellow-400" size={14} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Sidebar */}
            <div className="lg:col-span-1">
              {reviewStats && reviewStats.totalReviews > 0 ? (
                <ReviewStats stats={reviewStats} compact={false} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
                  <p className="text-gray-600 dark:text-gray-400">Sem estatísticas de avaliações ainda</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
