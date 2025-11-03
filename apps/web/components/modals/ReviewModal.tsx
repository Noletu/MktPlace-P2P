'use client';

import { useState } from 'react';
import StarRating from '../StarRating';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReviewData) => Promise<void>;
  reviewedUserName: string;
  orderId: string;
}

export interface ReviewData {
  reliabilityRating: number;
  communicationRating: number;
  speedRating: number;
  comment?: string;
}

export default function ReviewModal({
  isOpen,
  onClose,
  onSubmit,
  reviewedUserName,
  orderId
}: ReviewModalProps) {
  const [reliabilityRating, setReliabilityRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [speedRating, setSpeedRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    // Validar: todas as 3 categorias obrigatórias
    if (!reliabilityRating || !communicationRating || !speedRating) {
      setError('Por favor, avalie todas as 3 categorias antes de enviar.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await onSubmit({
        reliabilityRating,
        communicationRating,
        speedRating,
        comment: comment.trim() || undefined,
      });

      // Resetar form
      setReliabilityRating(0);
      setCommunicationRating(0);
      setSpeedRating(0);
      setComment('');
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar avaliação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return; // Não permitir fechar durante envio
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-3xl">⭐</span>
            Avalie sua experiência
          </h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
            aria-label="Fechar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Subtitle */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <p className="text-gray-700 dark:text-gray-300">
            Avalie <span className="font-bold text-blue-600 dark:text-blue-400">{reviewedUserName}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pedido #{orderId.substring(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Ratings */}
        <div className="space-y-6 mb-6">
          {/* Confiabilidade */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl flex-shrink-0">🤝</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white">Confiabilidade</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">O usuário cumpriu o que prometeu?</p>
              </div>
            </div>
            <StarRating
              value={reliabilityRating}
              onChange={setReliabilityRating}
              size="lg"
            />
          </div>

          {/* Comunicação */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-100 dark:border-green-800">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl flex-shrink-0">💬</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white">Comunicação</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Respondeu rápido e foi claro?</p>
              </div>
            </div>
            <StarRating
              value={communicationRating}
              onChange={setCommunicationRating}
              size="lg"
            />
          </div>

          {/* Rapidez */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl flex-shrink-0">⚡</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white">Rapidez</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">A transação foi ágil?</p>
              </div>
            </div>
            <StarRating
              value={speedRating}
              onChange={setSpeedRating}
              size="lg"
            />
          </div>
        </div>

        {/* Comentário (Opcional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            💭 Comentário (opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Deixe um comentário sobre sua experiência..."
            maxLength={500}
            rows={4}
            disabled={submitting}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
            {comment.length}/500 caracteres
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Enviando...
              </>
            ) : (
              <>
                Enviar Avaliação ✨
              </>
            )}
          </button>
        </div>

        {/* Info */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
          Sua avaliação ajuda a construir uma comunidade confiável 🤝
        </p>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
