'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { apiGet, apiPut } from '@/utils/api';

type NotifChannel = 'both' | 'email' | 'push' | 'none';

interface NotifPreferences {
  WITHDRAWALS: NotifChannel;
  DEPOSITS: NotifChannel;
  ORDER_MATCH: NotifChannel;
  PAYMENTS: NotifChannel;
  P2P_COMPLETED: NotifChannel;
  CANCELLATIONS: NotifChannel;
  DISPUTES: NotifChannel;
}

const CATEGORIES: { key: keyof NotifPreferences; label: string; description: string }[] = [
  { key: 'WITHDRAWALS', label: 'Saques', description: 'Saque solicitado, aprovado, concluído, rejeitado' },
  { key: 'DEPOSITS', label: 'Depósitos', description: 'Depósito creditado na carteira' },
  { key: 'ORDER_MATCH', label: 'Ordens Aceitas', description: 'Quando uma contraparte aceita seu pedido' },
  { key: 'PAYMENTS', label: 'Pagamentos', description: 'Comprovante enviado ou rejeitado' },
  { key: 'P2P_COMPLETED', label: 'Transações Concluídas', description: 'Transação P2P finalizada com sucesso' },
  { key: 'CANCELLATIONS', label: 'Cancelamentos', description: 'Cancelamento de pedido por qualquer parte' },
  { key: 'DISPUTES', label: 'Disputas', description: 'Abertura e resolução de disputas' },
];

const CHANNEL_OPTIONS: { value: NotifChannel; label: string }[] = [
  { value: 'both', label: 'Ambos' },
  { value: 'email', label: 'Só Email' },
  { value: 'push', label: 'Só Notif.' },
  { value: 'none', label: 'Nenhum' },
];

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotifPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPrefs();
  }, []);

  async function loadPrefs() {
    try {
      const data = await apiGet('/auth/notification-preferences');
      if (data.success) {
        setPrefs(data.preferences);
      }
    } catch {
      setError('Erro ao carregar preferências');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const data = await apiPut('/auth/notification-preferences', prefs);
      if (data.success) {
        setPrefs(data.preferences);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Erro ao salvar');
      }
    } catch {
      setError('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(key: keyof NotifPreferences, value: NotifChannel) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
    setSaved(false);
  }

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-xl text-gray-900 dark:text-white">Carregando...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <button
              onClick={() => router.push('/profile')}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Voltar ao Perfil"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Preferências de Notificação</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Escolha como deseja receber alertas para cada tipo de ação
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Category cards */}
          <div className="space-y-4">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cat.label}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{cat.description}</p>
                  </div>
                  {/* Segmented control */}
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 shrink-0">
                    {CHANNEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleChange(cat.key, opt.value)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                          prefs?.[cat.key] === opt.value
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Nota:</strong> Notificações de segurança (reset de senha, 2FA) e operações administrativas são sempre enviadas por ambos os canais e não podem ser desativadas.
            </p>
          </div>

          {/* Save button */}
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              {saving ? 'Salvando...' : 'Salvar Preferências'}
            </button>
            {saved && (
              <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                Preferências salvas com sucesso!
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
