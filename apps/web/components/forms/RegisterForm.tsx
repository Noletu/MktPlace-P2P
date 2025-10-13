'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Validações em tempo real
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Validar senha
  const validatePassword = (password: string): boolean => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  };

  // Verificar email em tempo real
  useEffect(() => {
    const checkEmail = async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setEmailValid(null);
        return;
      }

      setEmailChecking(true);
      try {
        const response = await fetch(`http://localhost:3001/api/v1/auth/check-email?email=${encodeURIComponent(formData.email)}`);
        const data = await response.json();
        setEmailValid(data.available);
      } catch (err) {
        console.error('Erro ao verificar email:', err);
      } finally {
        setEmailChecking(false);
      }
    };

    const timer = setTimeout(checkEmail, 500);
    return () => clearTimeout(timer);
  }, [formData.email]);

  // Validar senha em tempo real
  useEffect(() => {
    setPasswordValid(validatePassword(formData.password));
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details && Array.isArray(data.details)) {
          const errorMessages = data.details.map((err: any) => err.message).join(', ');
          throw new Error(errorMessages);
        }

        if (data.error?.includes('Não foi possível completar o cadastro')) {
          throw new Error('Este email já está cadastrado. Por favor, faça login ou use outro email.');
        }

        throw new Error(data.error || 'Erro ao registrar');
      }

      // Salvar token e usuário
      if (data.data.accessToken) {
        localStorage.setItem('accessToken', data.data.accessToken);
      }
      if (data.data.refreshToken) {
        localStorage.setItem('refreshToken', data.data.refreshToken);
      }
      localStorage.setItem('user', JSON.stringify(data.data.user));

      // Mostrar mensagem de sucesso
      setSuccess(true);

      // Countdown e redirect
      let counter = 3;
      const interval = setInterval(() => {
        counter--;
        setCountdown(counter);
        if (counter === 0) {
          clearInterval(interval);
          router.push('/dashboard');
        }
      }, 1000);
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('❌ Não foi possível conectar à API. Verifique se o servidor está rodando em http://localhost:3001');
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('❌ Erro de conexão. A API pode não estar rodando.');
      } else {
        setError(err.message || 'Erro desconhecido ao registrar');
      }
    } finally {
      setLoading(false);
    }
  };

  // Renderizar card de sucesso
  if (success) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <div className="p-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="mb-4">
              <span className="text-6xl">✅</span>
            </div>
            <h2 className="text-3xl font-bold text-green-800 mb-2">
              Conta criada com sucesso!
            </h2>
            <p className="text-xl text-green-700 mb-4">
              Bem-vindo(a), <strong>{formData.name || formData.email.split('@')[0]}</strong>!
            </p>
            <div className="p-4 bg-white/70 rounded-lg mb-4">
              <p className="text-gray-700 mb-2">
                🎉 Você já pode começar a usar a plataforma!
              </p>
              <p className="text-sm text-gray-600">
                Seu limite inicial é de <strong>R$ 1.000/dia</strong>
              </p>
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-blue-800 font-semibold mb-2">
                Redirecionando para o dashboard em...
              </p>
              <p className="text-5xl font-bold text-blue-600 animate-pulse">
                {countdown}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Aguarde ou será redirecionado automaticamente
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      {/* Informação sobre o fluxo simplificado */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p>
          ℹ️ <strong>Cadastro simplificado:</strong> Apenas email e senha para começar! Você pode usar a plataforma imediatamente com limite de R$ 1.000/dia.
        </p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Nome (opcional)
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="João da Silva"
        />
        <p className="text-xs text-gray-500 mt-1">Opcional - pode ser preenchido depois</p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email *
        </label>
        <div className="relative">
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              emailValid === false ? 'border-red-500' : emailValid === true ? 'border-green-500' : ''
            }`}
            placeholder="seu@email.com"
          />
          {emailChecking && (
            <div className="absolute right-3 top-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
          {!emailChecking && emailValid === true && (
            <div className="absolute right-3 top-3 text-green-600">✓</div>
          )}
          {!emailChecking && emailValid === false && (
            <div className="absolute right-3 top-3 text-red-600">✗</div>
          )}
        </div>
        {emailValid === false && (
          <p className="text-xs text-red-600 mt-1">Este email já está cadastrado</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Senha *
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={8}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              formData.password && (passwordValid ? 'border-green-500' : 'border-red-500')
            }`}
            placeholder="********"
          />
          {formData.password && passwordValid && (
            <div className="absolute right-3 top-3 text-green-600">✓</div>
          )}
          {formData.password && !passwordValid && (
            <div className="absolute right-3 top-3 text-red-600">✗</div>
          )}
        </div>
        <div className="text-xs mt-1 space-y-1">
          <p className={formData.password.length >= 8 ? 'text-green-600' : 'text-gray-500'}>
            {formData.password.length >= 8 ? '✓' : '○'} Mínimo 8 caracteres
          </p>
          <p className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
            {/[A-Z]/.test(formData.password) ? '✓' : '○'} 1 letra maiúscula
          </p>
          <p className={/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
            {/[a-z]/.test(formData.password) ? '✓' : '○'} 1 letra minúscula
          </p>
          <p className={/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
            {/[0-9]/.test(formData.password) ? '✓' : '○'} 1 número
          </p>
          <p className={/[^A-Za-z0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
            {/[^A-Za-z0-9]/.test(formData.password) ? '✓' : '○'} 1 caractere especial (!@#$%...)
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || emailValid === false}
        className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Criando conta...' : 'Criar Conta'}
      </button>

      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
        <p className="mb-2"><strong>Após o cadastro:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>✅ Use a plataforma imediatamente (limite: R$ 1.000/dia)</li>
          <li>📈 Complete o KYC quando quiser para aumentar limites</li>
          <li>🔒 KYC Level 1 (CPF + Telefone) → R$ 10.000/dia</li>
          <li>🚀 Níveis superiores disponíveis para limites maiores</li>
        </ul>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <a href="/login" className="text-primary hover:underline">
          Fazer login
        </a>
      </p>
    </form>
  );
}
