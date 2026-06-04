'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/config/api';

const INITIAL_ATTEMPTS = 3;

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Mensagem amigável para qualquer erro (rede ou aplicação).
  const humanizeError = (err: any): string => {
    if (err?.message === 'Failed to fetch') {
      return 'Erro ao conectar. Tente novamente.';
    }
    return err?.message || 'Erro ao fazer login';
  };

  // Volta ao Passo 1 (limpa o estado de 2FA). NÃO chama o backend — o
  // cookie pendingLoginToken expira sozinho em 120s.
  const resetTwoFactor = () => {
    setRequiresTwoFactor(false);
    setTwoFactorToken('');
    setAttemptsRemaining(null);
  };

  // Navega conforme o role após login completo.
  const navigateByRole = (role?: string) => {
    if (role === 'ADMIN' || role === 'MASTER') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  // Passo 2 (sempre): POST /auth/complete-login. Sem código → o servidor
  // decide se exige 2FA; com código → valida o 2FA. Usa o cookie HttpOnly
  // pendingLoginToken (enviado automaticamente via credentials:'include').
  const completeLogin = async (token?: string) => {
    const response = await fetch(getApiUrl('auth/complete-login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(token ? { twoFactorToken: token } : {}),
    });

    const data = await response.json();

    // 200 + requires2FA → usuário tem 2FA; pedir o código (Passo 2 visível)
    if (response.ok && data.success && data.data?.requires2FA) {
      setRequiresTwoFactor(true);
      setAttemptsRemaining(
        typeof data.data.attemptsRemaining === 'number' ? data.data.attemptsRemaining : null
      );
      return;
    }

    // 200 + user → login completo
    if (response.ok && data.success && data.data?.user) {
      // SECURITY (SER-34): tokens NÃO são gravados em localStorage (vivem só
      // em cookies HttpOnly). O objeto `user` (não sensível: id/role) é mantido
      // como cache leve consumido por chat/reviews/orders/admin.
      localStorage.setItem('user', JSON.stringify(data.data.user));
      navigateByRole(data.data.user?.role);
      return;
    }

    // 401 com código 2FA errado mas ainda há tentativas → permanecer no Passo 2
    if (requiresTwoFactor && typeof data.attemptsRemaining === 'number') {
      setAttemptsRemaining(data.attemptsRemaining);
      setTwoFactorToken('');
      setError(data.error || 'Código 2FA inválido');
      return;
    }

    // Tentativas esgotadas, sessão expirada/inválida, ou qualquer outro 401 →
    // resetar para o Passo 1 com mensagem clara.
    resetTwoFactor();
    setError(data.error || 'Sessão expirada. Faça login novamente.');
  };

  // Passo 1: POST /auth/login → em seguida, complete-login sem código.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(getApiUrl('auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // 401 uniforme (credencial inválida) ou 400 (input inválido)
        throw new Error(data.error || 'Credenciais inválidas');
      }

      // data.data.nextStep === 'COMPLETE_LOGIN' — finalizar imediatamente.
      await completeLogin();
    } catch (err: any) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  };

  // Passo 2: submit do código 2FA.
  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await completeLogin(twoFactorToken);
    } catch (err: any) {
      setError(humanizeError(err));
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
    <form
      onSubmit={requiresTwoFactor ? handleTwoFactorSubmit : handleSubmit}
      className="space-y-4 w-full max-w-md"
    >
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
          disabled={requiresTwoFactor}
          className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent disabled:opacity-50"
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

      <div className="text-right">
        <a href="/forgot-password" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Esqueceu a senha?
        </a>
      </div>

      {/* Passo 2 — Código 2FA: aparece apenas quando o servidor exige */}
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
            inputMode="numeric"
            className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-blue-900/40 dark:text-white font-mono"
          />
          {attemptsRemaining !== null && attemptsRemaining < INITIAL_ATTEMPTS && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
              Tentativas restantes: {attemptsRemaining}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              resetTwoFactor();
              setError('');
            }}
            className="mt-3 text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            ← Cancelar e voltar
          </button>
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
        {loading ? 'Entrando...' : requiresTwoFactor ? 'Confirmar' : 'Entrar'}
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
