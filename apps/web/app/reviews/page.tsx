'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReviewStats } from '@/components/ReviewStats';
import { ReviewResponseForm } from '@/components/ReviewResponseForm';
import { Star, MessageSquare, ExternalLink, Loader2, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  reliabilityRating?: number;
  communicationRating?: number;
  speedRating?: number;
  comment?: string;
  response?: string;
  respondedAt?: string;
  createdAt: string;
  reviewer: {
    id: string;
    name: string;
    reputationScore?: number;
  };
  order: {
    id: string;
    brlAmount: string;
    cryptoType: string;
  };
}

export default function ReviewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdFilter = searchParams.get('orderId');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'responded' | 'not-responded'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'rating-high' | 'rating-low'>('recent');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReviews();
    fetchStats();
  }, []);

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const userDataStr = localStorage.getItem('user');
      if (!userDataStr) return;

      const userData = JSON.parse(userDataStr);
      const userId = userData.id;

      const params = new URLSearchParams();
      if (orderIdFilter) params.append('orderId', orderIdFilter);

      const response = await fetch(
        `http://localhost:3001/api/v1/reviews/user/${userId}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReviews(data.data.reviews || []);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const userDataStr = localStorage.getItem('user');
      if (!userDataStr) return;

      const userData = JSON.parse(userDataStr);
      const userId = userData.id;

      const response = await fetch(`http://localhost:3001/api/v1/reviews/user/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
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

  const toggleExpand = (reviewId: string) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId);
    } else {
      newExpanded.add(reviewId);
    }
    setExpandedReviews(newExpanded);
  };

  const filteredReviews = reviews.filter((review) => {
    if (filter === 'responded') return !!review.response;
    if (filter === 'not-responded') return !review.response;
    return true;
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'rating-high') {
      return b.rating - a.rating;
    }
    if (sortBy === 'rating-low') {
      return a.rating - b.rating;
    }
    return 0;
  });

  const respondedCount = reviews.filter((r) => r.response).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Voltar ao Perfil</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Minhas Avaliações</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Veja as avaliações que você recebeu e responda quando desejar
          </p>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <Loader2 className="animate-spin mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-600 dark:text-gray-400">Carregando avaliações...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        filter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Todas ({reviews.length})
                    </button>
                    <button
                      onClick={() => setFilter('not-responded')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        filter === 'not-responded'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Não respondidas ({reviews.length - respondedCount})
                    </button>
                    <button
                      onClick={() => setFilter('responded')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        filter === 'responded'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Respondidas ({respondedCount})
                    </button>
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="rating-high">Maior nota</option>
                    <option value="rating-low">Menor nota</option>
                  </select>
                </div>

                {sortedReviews.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={64} />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Nenhuma avaliação
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {filter === 'all'
                        ? 'Você ainda não recebeu avaliações.'
                        : filter === 'responded'
                        ? 'Você ainda não respondeu a nenhuma avaliação.'
                        : 'Todas as avaliações foram respondidas!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedReviews.map((review) => {
                      const isExpanded = expandedReviews.has(review.id);
                      const isResponding = respondingTo === review.id;

                      return (
                        <div
                          key={review.id}
                          className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                  {review.reviewer.name}
                                </h3>
                                {review.reviewer.reputationScore && (
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded">
                                    Reputação: {review.reviewer.reputationScore}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                {renderStars(review.rating)}
                                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                                  {formatDate(review.createdAt)}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() =>
                                router.push(`/orders/${review.order.id}`)
                              }
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Ver pedido"
                            >
                              <ExternalLink size={20} />
                            </button>
                          </div>

                          {review.comment && (
                            <p className="text-gray-700 dark:text-gray-300 mb-4">{review.comment}</p>
                          )}

                          {(review.reliabilityRating ||
                            review.communicationRating ||
                            review.speedRating) && (
                            <div className="flex flex-wrap gap-4 mb-4 text-sm">
                              {review.reliabilityRating && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600 dark:text-gray-400">Confiabilidade:</span>
                                  <div className="flex gap-0.5">
                                    {renderStars(review.reliabilityRating)}
                                  </div>
                                </div>
                              )}
                              {review.communicationRating && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600 dark:text-gray-400">Comunicação:</span>
                                  <div className="flex gap-0.5">
                                    {renderStars(review.communicationRating)}
                                  </div>
                                </div>
                              )}
                              {review.speedRating && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600 dark:text-gray-400">Rapidez:</span>
                                  <div className="flex gap-0.5">
                                    {renderStars(review.speedRating)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {review.response ? (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare size={16} className="text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                                  Sua resposta
                                  {review.respondedAt &&
                                    ` · ${formatDate(review.respondedAt)}`}
                                </span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300">{review.response}</p>
                            </div>
                          ) : (
                            <div>
                              {isResponding ? (
                                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                  <ReviewResponseForm
                                    reviewId={review.id}
                                    onSuccess={() => {
                                      setRespondingTo(null);
                                      fetchReviews();
                                    }}
                                    onCancel={() => setRespondingTo(null)}
                                  />
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRespondingTo(review.id)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm flex items-center gap-2"
                                >
                                  <MessageSquare size={16} />
                                  Responder avaliação
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              {stats && <ReviewStats stats={stats} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
