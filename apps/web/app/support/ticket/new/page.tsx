'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TicketCategory, CATEGORY_LABELS } from '../../../../types/support';

export default function NewTicketPage() {
  const router = useRouter();
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações frontend
    if (!category) {
      setError('Selecione uma categoria');
      return;
    }

    if (subject.length < 5) {
      setError('O assunto deve ter no mínimo 5 caracteres');
      return;
    }

    if (subject.length > 200) {
      setError('O assunto deve ter no máximo 200 caracteres');
      return;
    }

    if (description.length < 20) {
      setError('A descrição deve ter no mínimo 20 caracteres');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://localhost:3002/api/v1/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          subject,
          description,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirecionar para o ticket criado
        router.push(`/support/ticket/${data.data.id}`);
      } else {
        setError(data.error || 'Erro ao criar ticket');
      }
    } catch (err: any) {
      setError('Erro ao conectar com servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2">
            ← Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Criar Novo Ticket de Suporte</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Descreva seu problema ou dúvida e nossa equipe responderá em breve
          </p>
        </div>

        {/* Info Box */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Dica:</strong> Seja o mais específico possível ao descrever seu problema. Inclua detalhes como mensagens de
            erro, passos realizados e quando o problema ocorreu.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">{error}</div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categoria <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecione uma categoria</option>
              {Object.values(TicketCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Assunto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assunto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="Ex: Não consigo fazer login na minha conta"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {subject.length}/200 caracteres (mínimo 5)
            </p>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descrição <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              placeholder="Descreva seu problema ou dúvida com o máximo de detalhes possível..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {description.length} caracteres (mínimo 20)
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Criando...' : 'Criar Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
