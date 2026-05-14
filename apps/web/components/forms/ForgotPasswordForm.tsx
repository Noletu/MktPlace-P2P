'use client';

import { useState } from 'react';
import { getApiUrl } from '@/config/api';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(getApiUrl('auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar solicitação');
      }

      setSuccess(true);
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Não foi possível conectar ao servidor. Verifique se a API está rodando.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="p-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-400 dark:border-green-600 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="mb-4">
              <span className="text-5xl">✉️</span>
            </div>
            <h2 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">
              Email enviado!
            </h2>
            <p className="text-green-700 dark:text-green-400 mb-4">
              Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Verifique sua caixa de entrada e spam. O link expira em 1 hora.
            </p>
            <a
              href="/login"
              className="inline-block bg-blue-600 dark:bg-blue-700 text-white py-2 px-6 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
            >
              Voltar para login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <p>
          Digite seu email cadastrado e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-200">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
          placeholder="seu@email.com"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Enviando...' : 'Enviar link de redefinição'}
      </button>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        Lembrou a senha?{' '}
        <a href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
          Voltar para login
        </a>
      </p>
    </form>
  );
}
