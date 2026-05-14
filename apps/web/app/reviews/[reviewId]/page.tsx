'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ReviewResponseForm } from '@/components/ReviewResponseForm';
import {
  Star,
  ArrowLeft,
  MessageSquare,
  ExternalLink,
  User,
  Calendar,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '@/utils/api';

interface ReviewDetails {
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
    email: string;
    reputationScore?: number;
  };
  reviewed: {
    id: string;
    name: string;
  };
  order: {
    id: string;
    brlAmount: string;
    cryptoType: string;
    cryptoAmount: string;
    status: string;
  };
}

export default function ReviewDetailPage() {
  const router = useRouter();
  const params = useParams() ?? {};
  const reviewId = params.reviewId as string;

  const [review, setReview] = useState<ReviewDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReviewDetails();
  }, [reviewId]);

  const fetchReviewDetails = async () => {
    try {
      const userDataStr = localStorage.getItem('user');
      if (!userDataStr) return;
      const userData = JSON.parse(userDataStr);

      const response = await fetchWithAuth(`/reviews/user/${userData.id}`);

      if (response.ok) {
        const data = await response.json();
        const foundReview = data.data.reviews.find((r: any) => r.id === reviewId);

        if (foundReview) {
          setReview(foundReview);
        } else {
          setError('Avaliação não encontrada');
        }
      } else {
        setError('Erro ao carregar avaliação');
      }
    } catch (err) {
      setError('Erro ao carregar avaliação');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: number = 20) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          size={size}
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Loader2 className="animate-spin mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-600">Carregando avaliação...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Star className="mx-auto mb-4 text-gray-300" size={64} />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {error || 'Avaliação não encontrada'}
            </h2>
            <button
              onClick={() => router.push('/reviews')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Voltar para avaliações
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/reviews')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} />
          Voltar para avaliações
        </button>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">Detalhes da Avaliação</h1>
                <p className="text-blue-100">
                  Recebida em {formatDate(review.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                {renderStars(review.rating, 24)}
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Avaliado por</h3>
                    <p className="text-gray-600">{review.reviewer.name}</p>
                  </div>
                </div>
                {review.reviewer.reputationScore !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <TrendingUp size={16} />
                    <span>
                      Reputação: <strong>{review.reviewer.reputationScore}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <ExternalLink className="text-green-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Pedido Relacionado</h3>
                    <p className="text-gray-600">
                      R$ {parseFloat(review.order.brlAmount).toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/orders/${review.order.id}`)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  Ver detalhes do pedido
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Avaliação Geral</h2>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex gap-1">{renderStars(review.rating, 32)}</div>
                <span className="text-3xl font-bold text-gray-900">
                  {review.rating}.0
                </span>
                <span className="text-gray-600">/ 5</span>
              </div>

              {review.comment && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Comentário</h3>
                  <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                </div>
              )}
            </div>

            {(review.reliabilityRating ||
              review.communicationRating ||
              review.speedRating) && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Avaliações por Categoria
                </h2>
                <div className="space-y-4">
                  {review.reliabilityRating && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          Confiabilidade
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {review.reliabilityRating}/5
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {renderStars(review.reliabilityRating)}
                      </div>
                    </div>
                  )}

                  {review.communicationRating && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          Comunicação
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          {review.communicationRating}/5
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {renderStars(review.communicationRating)}
                      </div>
                    </div>
                  )}

                  {review.speedRating && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">Rapidez</span>
                        <span className="text-lg font-bold text-purple-600">
                          {review.speedRating}/5
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {renderStars(review.speedRating)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Sua Resposta</h2>
              {review.response ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare size={20} className="text-blue-600" />
                    <span className="font-medium text-blue-900">
                      Respondido em {formatDate(review.respondedAt!)}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{review.response}</p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  {isResponding ? (
                    <ReviewResponseForm
                      reviewId={review.id}
                      onSuccess={() => {
                        setIsResponding(false);
                        fetchReviewDetails();
                      }}
                      onCancel={() => setIsResponding(false)}
                    />
                  ) : (
                    <div className="text-center">
                      <MessageSquare className="mx-auto mb-4 text-gray-400" size={48} />
                      <p className="text-gray-600 mb-4">
                        Você ainda não respondeu a esta avaliação
                      </p>
                      <button
                        onClick={() => setIsResponding(true)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Responder Avaliação
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
