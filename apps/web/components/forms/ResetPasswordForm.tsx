'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getApiUrl } from '@/config/api';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Password validation
  const passwordChecks = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // Countdown + redirect after success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      router.push('/login');
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, router]);

  // Invalid link check
  if (!token || !email) {
    return (
      <div className="w-full max-w-md">
        <div className="p-8 bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-600 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="mb-4">
              <span className="text-5xl">&#x26A0;&#xFE0F;</span>
            </div>
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-300 mb-2">
              Link inválido
            </h2>
            <p className="text-red-700 dark:text-red-400 mb-4">
              Este link de redefinição de senha é inválido ou está incompleto.
            </p>
            <a
              href="/forgot-password"
              className="inline-block bg-blue-600 dark:bg-blue-700 text-white py-2 px-6 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
            >
              Solicitar novo link
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="p-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-400 dark:border-green-600 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="mb-4">
              <span className="text-5xl">&#x2705;</span>
            </div>
            <h2 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">
              Senha redefinida!
            </h2>
            <p className="text-green-700 dark:text-green-400 mb-4">
              Sua senha foi alterada com sucesso. Faça login com a nova senha.
            </p>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-blue-800 dark:text-blue-300 font-semibold mb-1">
                Redirecionando para login em...
              </p>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                {countdown}
              </p>
            </div>
            <a
              href="/login"
              className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Ir para login agora
            </a>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordValid) {
      setError('A senha não atende todos os requisitos.');
      return;
    }

    if (!passwordsMatch) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const body: any = { email, token, newPassword };

      // Se 2FA é necessário, incluir o token
      if (requiresTwoFactor && twoFactorToken) {
        body.twoFactorToken = twoFactorToken;
      }

      const response = await fetch(getApiUrl('auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(data.error || 'Erro ao redefinir senha');
      }

      setSuccess(true);
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Não foi possível conectar ao servidor.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-200">
          Nova Senha
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent ${
            newPassword && (passwordValid ? 'border-green-500' : 'border-red-500')
          }`}
          placeholder="********"
        />
        <div className="text-xs mt-1 space-y-1">
          <p className={passwordChecks.length ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}>
            {passwordChecks.length ? '\u2713' : '\u25CB'} Mínimo 8 caracteres
          </p>
          <p className={passwordChecks.uppercase ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}>
            {passwordChecks.uppercase ? '\u2713' : '\u25CB'} 1 letra maiúscula
          </p>
          <p className={passwordChecks.lowercase ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}>
            {passwordChecks.lowercase ? '\u2713' : '\u25CB'} 1 letra minúscula
          </p>
          <p className={passwordChecks.number ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}>
            {passwordChecks.number ? '\u2713' : '\u25CB'} 1 número
          </p>
          <p className={passwordChecks.special ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}>
            {passwordChecks.special ? '\u2713' : '\u25CB'} 1 caractere especial (!@#$%...)
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-200">
          Confirmar Nova Senha
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent ${
            confirmPassword && (passwordsMatch ? 'border-green-500' : 'border-red-500')
          }`}
          placeholder="********"
        />
        {confirmPassword && !passwordsMatch && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">As senhas não coincidem</p>
        )}
        {confirmPassword && passwordsMatch && (
          <p className="text-xs text-green-600 mt-1">{'\u2713'} Senhas coincidem</p>
        )}
      </div>

      {/* Campo 2FA (aparece quando backend exige) */}
      {requiresTwoFactor && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-700 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3 font-medium">
            Sua conta possui 2FA ativado. Digite o código do seu app autenticador ou um backup code:
          </p>
          <input
            type="text"
            value={twoFactorToken}
            onChange={(e) => setTwoFactorToken(e.target.value.replace(/\s/g, ''))}
            placeholder="000000"
            maxLength={8}
            className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            autoFocus
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
        disabled={loading || !passwordValid || !passwordsMatch || (requiresTwoFactor && !twoFactorToken)}
        className="w-full bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Redefinindo...' : requiresTwoFactor ? 'Confirmar com 2FA' : 'Redefinir Senha'}
      </button>
    </form>
  );
}
