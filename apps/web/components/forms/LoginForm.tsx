'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/config/api';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body: any = { email, password };

      // Se 2FA é necessário, incluir o token
      if (requiresTwoFactor && twoFactorToken) {
        body.twoFactorToken = twoFactorToken;
      }

      const response = await fetch(getApiUrl('auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // IMPORTANTE: Envia e recebe cookies
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // Se 2FA é necessário
      if (data.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setLoading(false);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao fazer login');
      }

      console.log('✅ Login bem-sucedido:', data);

      // Salvar token e dados do usuário
      if (data.data.accessToken) {
        localStorage.setItem('accessToken', data.data.accessToken);
      }
      localStorage.setItem('user', JSON.stringify(data.data.user));

      // Redirecionar baseado no role
      const userRole = data.data.user?.role;
      if (userRole === 'ADMIN' || userRole === 'MASTER') {
        router.push('/admin'); // Admins vão direto para o painel administrativo
      } else {
        router.push('/dashboard'); // Usuários normais vão para o dashboard
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTwoFactorToken(value);
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
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

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-200">
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={requiresTwoFactor}
          className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent disabled:opacity-50"
          placeholder="********"
        />
      </div>

      {/* Campo 2FA - Aparece apenas quando necessário */}
      {requiresTwoFactor && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🔐</span>
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-200">
                Autenticação de Dois Fatores
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Digite o código de 6 dígitos do seu app autenticador
              </p>
            </div>
          </div>
          <input
            type="text"
            value={twoFactorToken}
            onChange={handleTwoFactorTokenChange}
            placeholder="000000"
            maxLength={6}
            autoFocus
            className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-blue-900/40 dark:text-white font-mono"
          />
        </div>
      )}

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
        {loading ? 'Entrando...' : 'Entrar'}
      </button>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        Não tem uma conta?{' '}
        <a href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
          Registrar-se
        </a>
      </p>
    </form>
  );
}
