'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/utils/api';

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesCount: number;
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        // Verifica o nível do usuário — MASTERs são redirecionados para a página de segurança admin
        const meRes = await fetchWithAuth('/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          const level = meData.data?.role?.level ?? meData.user?.level ?? 0;
          if (level >= 100) {
            router.replace('/admin/security');
            return;
          }
        }

        // Carrega status do 2FA para usuários não-MASTER
        const res = await fetchWithAuth('/2fa/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data.data);
        }
      } catch (err: any) {
        setError('Erro ao carregar informações de segurança.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Segurança da Conta</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Status do 2FA */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Autenticação de Dois Fatores (2FA)
        </h2>

        {status?.enabled ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">2FA Ativado</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sua conta está protegida com autenticação de dois fatores.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-yellow-700 dark:text-yellow-400">2FA não ativado</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Recomendamos ativar o 2FA para proteger sua conta.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Aviso para habilitar / gerenciar 2FA */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-5">
        <p className="text-blue-800 dark:text-blue-300 text-sm">
          Para ativar, desativar ou gerenciar seus códigos de backup do 2FA, acesse o painel de administração.
        </p>
        <button
          onClick={() => router.push('/admin/security')}
          className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
        >
          Gerenciar 2FA no Painel Admin
        </button>
      </div>
    </div>
  );
}
