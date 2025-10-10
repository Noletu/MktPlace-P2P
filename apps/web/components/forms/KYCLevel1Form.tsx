'use client';

import { useState, useEffect } from 'react';

interface UserData {
  cpf: string;
  phone: string;
  email: string;
  kycLevel: string;
}

export default function KYCLevel1Form() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Você precisa fazer login novamente');
        setLoadingUser(false);
        return;
      }

      const response = await fetch('http://localhost:3001/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        // Se sessão inválida, fazer logout automático
        if (response.status === 401 || result.error?.includes('Sessão inválida')) {
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
          return;
        }
        throw new Error(result.error || result.details || 'Erro ao buscar dados');
      }

      setUserData(result.data);
      setPhone(result.data.phone || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingUser(false);
    }
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

      // Monta payload: só envia telefone se não tinha antes ou se mudou
      const payload: { phone?: string } = {};
      if (phone && (!userData?.phone || phone.replace(/\D/g, '') !== userData.phone)) {
        payload.phone = phone.replace(/\D/g, '');
      }

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
        throw new Error(data.error || 'Erro ao ativar KYC');
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

  if (loadingUser) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-md">
        <p className="text-center text-gray-600">Carregando...</p>
      </div>
    );
  }

  if (error && !userData) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-2xl font-bold text-red-800 mb-4">Erro</h2>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Fazer Login
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-green-50 border border-green-200 rounded-lg">
        <h2 className="text-2xl font-bold text-green-800 mb-4">
          ✅ KYC Level 1 Ativado!
        </h2>
        <p className="text-green-700 mb-2">
          Seu limite de transação agora é de <strong>R$ 10.000,00/dia</strong>.
        </p>
        <p className="text-green-600 text-sm">Redirecionando para o dashboard...</p>
      </div>
    );
  }

  const needsPhone = !userData?.phone;

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2">Ativar KYC Level 1</h2>
      <p className="text-gray-600 mb-6">
        Limite de transação: R$ 10.000,00/dia
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-3">📋 Seus Dados de Registro</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Email:</span>
            <span className="font-medium text-gray-900">{userData?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">CPF:</span>
            <span className="font-medium text-gray-900">{userData?.cpf}</span>
          </div>
          {userData?.phone && (
            <div className="flex justify-between">
              <span className="text-gray-600">Telefone:</span>
              <span className="font-medium text-gray-900">{userData.phone}</span>
            </div>
          )}
        </div>
      </div>

      {needsPhone && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ Para ativar o KYC Level 1, você precisa fornecer seu telefone.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {needsPhone ? (
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Telefone com DDD *
            </label>
            <input
              type="text"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={15}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Apenas números com DDD. Ex: 11999999999
            </p>
          </div>
        ) : (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              ✅ Todos os dados necessários já estão cadastrados. Clique em "Ativar" para confirmar.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Ativando...' : '🚀 Ativar KYC Level 1'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Benefícios do KYC Level 1:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>✅ Limite de R$ 10.000/dia (vs R$ 1.000/dia sem KYC)</li>
          <li>✅ Acesso a pedidos maiores no marketplace</li>
          <li>✅ Processo rápido (sem documentos)</li>
        </ul>
      </div>
    </div>
  );
}
