'use client';

import { useState } from 'react';

export default function KYCLevel1Form() {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Você precisa fazer login novamente');
      }

      const payload = {
        fullName: fullName.trim(),
        cpf: cpf.replace(/\D/g, ''), // Remove formatação
        phone: phone.replace(/\D/g, ''), // Remove formatação
      };

      const response = await fetch('http://localhost:3001/api/v1/kyc/level1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Se sessão inválida, fazer logout automático
        if (response.status === 401 || data.error?.includes('Sessão inválida')) {
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
          return;
        }

        // Se erro de validação do Zod
        if (data.details) {
          const errorMessages = data.details.map((err: any) => err.message).join(', ');
          throw new Error(errorMessages);
        }

        throw new Error(data.error || 'Erro ao enviar KYC');
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-green-50 border border-green-200 rounded-lg">
        <h2 className="text-2xl font-bold text-green-800 mb-4">
          ✅ KYC Level 1 Aprovado!
        </h2>
        <p className="text-green-700 mb-2">
          Seu limite de transação agora é de <strong>R$ 10.000,00/dia</strong>.
        </p>
        <p className="text-green-600 text-sm">Redirecionando para o dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2">Verificação KYC - Nível 1</h2>
      <p className="text-gray-600 mb-6">
        Complete seus dados para aumentar seu limite de transação para <strong>R$ 10.000/dia</strong>
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <strong>Erro:</strong> {error}
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          ℹ️ Seus dados serão verificados e aprovados automaticamente. Após a aprovação, você poderá realizar transações de até R$ 10.000/dia.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nome Completo */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
            Nome Completo *
          </label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="João da Silva Santos"
            required
            minLength={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Digite seu nome completo como consta no seu documento
          </p>
        </div>

        {/* CPF */}
        <div>
          <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-2">
            CPF *
          </label>
          <input
            type="text"
            id="cpf"
            value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
            placeholder="123.456.789-00"
            required
            maxLength={14}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Apenas números. Será validado automaticamente.
          </p>
        </div>

        {/* Telefone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Telefone com DDD *
          </label>
          <input
            type="text"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(11) 99999-9999"
            required
            maxLength={15}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Celular ou fixo com DDD. Ex: (11) 99999-9999
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Enviando...' : '🚀 Enviar Verificação KYC'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Benefícios do KYC Level 1:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>✅ Limite de R$ 10.000/dia (10x mais que sem KYC)</li>
          <li>✅ Acesso a pedidos maiores no marketplace</li>
          <li>✅ Aprovação automática e rápida</li>
          <li>✅ Maior confiança da comunidade</li>
        </ul>
      </div>

      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Próximos níveis:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>📋 <strong>Level 2</strong>: Endereço + Data de nascimento → R$ 50.000/dia</li>
          <li>📸 <strong>Level 3</strong>: Documento + Selfie → R$ 100.000/dia</li>
          <li>🏠 <strong>Level 4</strong>: Comprovante de residência → Sem limite</li>
        </ul>
      </div>
    </div>
  );
}
