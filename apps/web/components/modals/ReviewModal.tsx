'use client';

import { useState } from 'react';

export interface ReviewData {
  reviewedId: string;
  orderId: string;
  rating: number;
  reliabilityRating?: number;
  communicationRating?: number;
  speedRating?: number;
  comment: string;
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReviewData) => Promise<void>;
  reviewedId: string;
  orderId: string;
  reviewedName: string;
}

export default function ReviewModal({
  isOpen,
  onClose,
  onSubmit,
  reviewedId,
  orderId,
  reviewedName,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [reliabilityRating, setReliabilityRating] = useState(5);
  const [communicationRating, setCommunicationRating] = useState(5);
  const [speedRating, setSpeedRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (comment.trim().length < 10) {
      setError('O comentário deve ter pelo menos 10 caracteres');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await onSubmit({
        reviewedId,
        orderId,
        rating,
        reliabilityRating,
        communicationRating,
        speedRating,
        comment: comment.trim(),
      });

      // Reset form
      setRating(5);
      setReliabilityRating(5);
      setCommunicationRating(5);
      setSpeedRating(5);
      setComment('');
      onClose();
    } catch (err: any) {
      console.error('Erro ao enviar avaliação:', err);
      setError(err.message || 'Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (value: number, onChange: (value: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="text-2xl hover:scale-110 transition-transform"
          >
            {star <= value ? '⭐' : '☆'}
          </button>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                ⭐ Avaliar Transação
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Como foi sua experiência com <span className="font-semibold">{reviewedName}</span>?
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl"
              disabled={submitting}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Overall Rating */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Avaliação Geral *
              </label>
              {renderStars(rating, setRating)}
            </div>

            {/* Detailed Ratings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  🛡️ Confiabilidade
                </label>
                {renderStars(reliabilityRating, setReliabilityRating)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  💬 Comunicação
                </label>
                {renderStars(communicationRating, setCommunicationRating)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ⚡ Rapidez
                </label>
                {renderStars(speedRating, setSpeedRating)}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Comentário * <span className="text-xs text-gray-500">(mínimo 10 caracteres)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={4}
                placeholder="Descreva sua experiência..."
                required
                minLength={10}
                disabled={submitting}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {comment.length} / 10 caracteres mínimos
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting || comment.trim().length < 10}
              >
                {submitting ? '⏳ Enviando...' : '✅ Enviar Avaliação'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
