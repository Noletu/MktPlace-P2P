import { Star } from 'lucide-react';

interface ReviewStatsProps {
  stats: {
    totalReviews: number;
    averageRating: number;
    ratingDistribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
    averageReliability?: number;
    averageCommunication?: number;
    averageSpeed?: number;
  };
}

export function ReviewStats({ stats }: ReviewStatsProps) {
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="fill-yellow-400 text-yellow-400" size={20} />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative">
            <Star className="text-gray-300" size={20} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className="fill-yellow-400 text-yellow-400" size={20} />
            </div>
          </div>
        );
      } else {
        stars.push(<Star key={i} className="text-gray-300" size={20} />);
      }
    }
    return stars;
  };

  const getPercentage = (count: number) => {
    if (stats.totalReviews === 0) return 0;
    return Math.round((count / stats.totalReviews) * 100);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Estatísticas de Avaliações</h2>

      {/* Overall Rating */}
      <div className="text-center mb-8 pb-8 border-b border-gray-200">
        <div className="text-5xl font-bold text-gray-900 mb-2">
          {stats.averageRating.toFixed(1)}
        </div>
        <div className="flex items-center justify-center gap-1 mb-2">
          {renderStars(stats.averageRating)}
        </div>
        <p className="text-gray-600">
          Baseado em {stats.totalReviews} {stats.totalReviews === 1 ? 'avaliação' : 'avaliações'}
        </p>
      </div>

      {/* Rating Distribution */}
      <div className="space-y-3 mb-8 pb-8 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Distribuição</h3>
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution] || 0;
          const percentage = getPercentage(count);

          return (
            <div key={rating} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-16">
                <span className="text-sm font-medium text-gray-700">{rating}</span>
                <Star className="fill-yellow-400 text-yellow-400" size={16} />
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-yellow-400 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="w-16 text-right text-sm text-gray-600">
                {count} ({percentage}%)
              </div>
            </div>
          );
        })}
      </div>

      {/* Category Averages */}
      {(stats.averageReliability || stats.averageCommunication || stats.averageSpeed) && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 mb-4">Médias por Categoria</h3>

          {stats.averageReliability && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Confiabilidade</span>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.averageReliability.toFixed(1)}/5
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.averageReliability / 5) * 100}%` }}
                />
              </div>
            </div>
          )}

          {stats.averageCommunication && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Comunicação</span>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.averageCommunication.toFixed(1)}/5
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.averageCommunication / 5) * 100}%` }}
                />
              </div>
            </div>
          )}

          {stats.averageSpeed && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Rapidez</span>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.averageSpeed.toFixed(1)}/5
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-purple-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.averageSpeed / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
