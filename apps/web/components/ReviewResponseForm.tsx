import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/utils/api';

interface ReviewResponseFormProps {
  reviewId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReviewResponseForm({ reviewId, onSuccess, onCancel }: ReviewResponseFormProps) {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const maxLength = 500;
  const remainingChars = maxLength - response.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!response.trim()) {
      setError('Por favor, escreva uma resposta');
      return;
    }

    if (response.length > maxLength) {
      setError(`A resposta não pode ter mais de ${maxLength} caracteres`);
      return;
    }

    setLoading(true);

    try {
      const res = await fetchWithAuth(`/reviews/${reviewId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response: response.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao enviar resposta');
      }

      setResponse('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar resposta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="response" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Sua Resposta
        </label>
        <textarea
          id="response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={4}
          maxLength={maxLength}
          placeholder="Escreva sua resposta à avaliação..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          disabled={loading}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Máximo {maxLength} caracteres
          </p>
          <p className={`text-sm ${remainingChars < 50 ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
            {remainingChars} restantes
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !response.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Enviando...
            </>
          ) : (
            <>
              <Send size={18} />
              Enviar Resposta
            </>
          )}
        </button>
      </div>
    </form>
  );
}
