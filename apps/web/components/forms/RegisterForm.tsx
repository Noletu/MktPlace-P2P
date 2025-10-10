'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    cpf: '',
    password: '',
    name: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Validações em tempo real
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);
  const [cpfChecking, setCpfChecking] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const formatCPF = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 11);
  };

  // Validar CPF (dígitos verificadores)
  const validateCPF = (cpf: string): boolean => {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (cpf.split('').every((c) => c === cpf[0])) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
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

  // Verificar CPF em tempo real
  useEffect(() => {
    const checkCPF = async () => {
      const cpf = formatCPF(formData.cpf);
      if (cpf.length !== 11) {
        setCpfValid(null);
        return;
      }

      // Validar dígitos verificadores
      const isValid = validateCPF(cpf);
      if (!isValid) {
        setCpfValid(false);
        return;
      }

      // Verificar se já existe no banco
      setCpfChecking(true);
      try {
        const response = await fetch(`http://localhost:3001/api/v1/auth/check-cpf?cpf=${cpf}`);
        const data = await response.json();
        setCpfValid(data.available);
      } catch (err) {
        console.error('Erro ao verificar CPF:', err);
      } finally {
        setCpfChecking(false);
      }
    };

    const timer = setTimeout(checkCPF, 500);
    return () => clearTimeout(timer);
  }, [formData.cpf]);

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
      // Formatar CPF (apenas números)
      const cpf = formatCPF(formData.cpf);

      const response = await fetch('http://localhost:3001/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // IMPORTANTE: Envia e recebe cookies
        body: JSON.stringify({
          ...formData,
          cpf,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Exibir detalhes do erro Zod se disponíveis
        if (data.details && Array.isArray(data.details)) {
          const errorMessages = data.details.map((err: any) => err.message).join(', ');
          throw new Error(errorMessages);
        }

        // Melhorar mensagem de erro genérico
        if (data.error?.includes('Não foi possível completar o cadastro')) {
          throw new Error('Este email ou CPF já está cadastrado. Por favor, faça login ou use outros dados.');
        }

        throw new Error(data.error || 'Erro ao registrar');
      }

      // SECURITY: Token agora vem em HttpOnly cookie (não em localStorage)
      // Apenas salvar dados do usuário (não sensíveis)
      localStorage.setItem('user', JSON.stringify(data.data.user));

      // Redirecionar para dashboard
      router.push('/dashboard');
    } catch (err: any) {
      // Melhorar mensagem de erro
      if (err.message === 'Failed to fetch') {
        setError('❌ Não foi possível conectar à API. Verifique se o servidor está rodando em http://localhost:3001');
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('❌ Erro de conexão. A API pode não estar rodando. Execute: ./iniciar-simples.sh');
      } else {
        setError(err.message || 'Erro desconhecido ao registrar');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Nome Completo
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
        <label htmlFor="cpf" className="block text-sm font-medium mb-2">
          CPF * (apenas números)
        </label>
        <div className="relative">
          <input
            id="cpf"
            name="cpf"
            type="text"
            value={formData.cpf}
            onChange={handleChange}
            required
            pattern="\d{11}"
            maxLength={11}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              cpfValid === false ? 'border-red-500' : cpfValid === true ? 'border-green-500' : ''
            }`}
            placeholder="11144477735"
          />
          {cpfChecking && (
            <div className="absolute right-3 top-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
          {!cpfChecking && cpfValid === true && (
            <div className="absolute right-3 top-3 text-green-600">✓</div>
          )}
          {!cpfChecking && cpfValid === false && (
            <div className="absolute right-3 top-3 text-red-600">✗</div>
          )}
        </div>
        {cpfValid === false && formData.cpf.length === 11 && (
          <p className="text-xs text-red-600 mt-1">
            {validateCPF(formData.cpf) ? 'Este CPF já está cadastrado' : 'CPF inválido'}
          </p>
        )}
        {cpfValid === true && (
          <p className="text-xs text-green-600 mt-1">✓ CPF válido e disponível</p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-2">
          Telefone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="11987654321"
        />
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
        disabled={loading}
        className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Registrando...' : 'Registrar'}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <a href="/login" className="text-primary hover:underline">
          Fazer login
        </a>
      </p>
    </form>
  );
}
