'use client';

import { useState } from 'react';
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const formatCPF = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 11);
  };

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
        throw new Error(data.error || 'Erro ao registrar');
      }

      // SECURITY: Token agora vem em HttpOnly cookie (não em localStorage)
      // Apenas salvar dados do usuário (não sensíveis)
      localStorage.setItem('user', JSON.stringify(data.data.user));

      // Redirecionar para dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
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
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="seu@email.com"
        />
      </div>

      <div>
        <label htmlFor="cpf" className="block text-sm font-medium mb-2">
          CPF * (apenas números)
        </label>
        <input
          id="cpf"
          name="cpf"
          type="text"
          value={formData.cpf}
          onChange={handleChange}
          required
          pattern="\d{11}"
          maxLength={11}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="12345678900"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Digite apenas os 11 números do CPF
        </p>
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
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
          minLength={8}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="********"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Requisitos: Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial (!@#$%...)
        </p>
        <p className="text-xs text-green-600 mt-1">
          ✅ Exemplo válido: <strong>MinhaSenha@123!</strong>
        </p>
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
