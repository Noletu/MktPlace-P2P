'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/utils/api';

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesCount: number;
}

export default function AdminSecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'complete'>('status');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchWithAuth('/2fa/status');

      if (!response.ok) {
        throw new Error('Erro ao carregar status do 2FA');
      }

      const result = await response.json();
      setStatus(result.data);
      setStep('status');
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar status');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSecret = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetchWithAuth('/2fa/generate', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar QR Code');
      }

      const result = await response.json();
      setQrCode(result.data.qrCode);
      setSecret(result.data.secret);
      setStep('setup');
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar QR Code');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetchWithAuth('/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao habilitar 2FA');
      }

      const result = await response.json();
      setBackupCodes(result.data.backupCodes);
      setShowBackupCodes(true);
      setStep('complete');
      setSuccess('2FA habilitado com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Tem certeza que deseja desabilitar o 2FA? Isso reduzirá a segurança da sua conta.')) {
      return;
    }

    const code = prompt('Digite o código do seu aplicativo autenticador para confirmar:');
    if (!code) return;

    setError('');
    setLoading(true);

    try {
      const response = await fetchWithAuth('/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ token: code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao desabilitar 2FA');
      }

      setSuccess('2FA desabilitado com sucesso');
      loadStatus();
    } catch (err: any) {
      setError(err.message || 'Erro ao desabilitar 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const code = prompt('Digite o código do seu aplicativo autenticador para regenerar os backup codes:');
    if (!code) return;

    setError('');
    setLoading(true);

    try {
      const response = await fetchWithAuth('/2fa/regenerate-backup-codes', {
        method: 'POST',
        body: JSON.stringify({ token: code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao regenerar backup codes');
      }

      const result = await response.json();
      setBackupCodes(result.data.backupCodes);
      setShowBackupCodes(true);
      setSuccess('Backup codes regenerados com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Erro ao regenerar backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copiado para a área de transferência!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Segurança da Conta</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Configure a autenticação de dois fatores (2FA) para proteger sua conta de administrador</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <p className="text-green-400">{success}</p>
        </div>
      )}

      {/* Banner: Kit de Sucessão desatualizado */}
      {status?.enabled && status.backupCodesCount === 0 && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🚨</span>
          <div>
            <h3 className="font-bold text-red-800 dark:text-red-400">Kit de Sucessão desatualizado</h3>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">
              Você não possui backup codes disponíveis. Se perder acesso ao seu autenticador,
              não haverá forma de recuperar o acesso ao sistema. Gere novos backup codes abaixo e
              atualize seu Kit de Sucessão físico executando:{' '}
              <code className="bg-red-100 dark:bg-red-800 px-1 rounded text-xs">node scripts/gerar-kit-sucessao.js</code>
            </p>
          </div>
        </div>
      )}

      {/* Status View */}
      {step === 'status' && status && (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Autenticação de Dois Fatores (2FA)</h2>

          {status.enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-3xl">✅</div>
                <div>
                  <p className="text-green-400 font-semibold">2FA Ativado</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sua conta está protegida com autenticação de dois fatores</p>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Backup Codes Disponíveis</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{status.backupCodesCount}</p>
                <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">Use em caso de perda do acesso ao app autenticador</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRegenerateBackupCodes}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white rounded-lg transition"
                  disabled={loading}
                >
                  Regenerar Backup Codes
                </button>
                <button
                  onClick={handleDisable2FA}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-gray-900 dark:text-white rounded-lg transition"
                  disabled={loading}
                >
                  Desabilitar 2FA
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="text-3xl">⚠️</div>
                <div>
                  <p className="text-yellow-400 font-semibold">2FA Desativado</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sua conta está vulnerável. Ative o 2FA para maior segurança</p>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-gray-900/50 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Por que ativar o 2FA?</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Protege contra acesso não autorizado</li>
                  <li>• Necessário para operações críticas como gerenciar Master Seed</li>
                  <li>• Adiciona uma camada extra de segurança</li>
                </ul>
              </div>

              <button
                onClick={handleGenerateSecret}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white rounded-lg font-semibold transition"
                disabled={loading}
              >
                Ativar 2FA
              </button>
            </div>
          )}
        </div>
      )}

      {/* Setup View */}
      {step === 'setup' && qrCode && (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Configurar Autenticação de Dois Fatores</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Passo 1: Instale um app autenticador</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Se você ainda não tem, instale um aplicativo como:
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">Google Authenticator</span>
                <span className="px-3 py-1 bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">Microsoft Authenticator</span>
                <span className="px-3 py-1 bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">Authy</span>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Passo 2: Escaneie o QR Code</h3>
              <div className="bg-white p-4 rounded-lg inline-block">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Ou digite o código manualmente:</h3>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded font-mono text-sm break-all">
                  {secret}
                </code>
                <button
                  onClick={() => copyToClipboard(secret!)}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-900 dark:text-white rounded transition"
                  title="Copiar"
                >
                  📋
                </button>
              </div>
            </div>

            <form onSubmit={handleEnable2FA} className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Passo 3: Digite o código de 6 dígitos</h3>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('status');
                    setQrCode(null);
                    setSecret(null);
                    setToken('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white rounded-lg font-semibold transition"
                  disabled={loading || token.length !== 6}
                >
                  {loading ? 'Verificando...' : 'Ativar 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete View with Backup Codes */}
      {step === 'complete' && showBackupCodes && backupCodes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
              <div className="text-3xl">✅</div>
              <div>
                <p className="text-green-400 font-semibold">2FA Ativado com Sucesso!</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Sua conta agora está mais segura</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <h3 className="text-red-400 font-bold mb-2">⚠️ IMPORTANTE: Backup Codes</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Guarde estes códigos em um local seguro. Você precisará deles caso perca o acesso ao seu aplicativo autenticador.
                <strong className="text-red-400"> Esta é a única vez que eles serão exibidos!</strong>
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Seus Backup Codes:</h3>
            <div className="grid grid-cols-2 gap-3">
              {backupCodes.map((code, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded">
                  <span className="text-gray-600 dark:text-gray-500 text-sm">{index + 1}.</span>
                  <code className="flex-1 text-gray-900 dark:text-white font-mono">{code}</code>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadBackupCodes}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white rounded-lg transition"
            >
              📥 Baixar Códigos
            </button>
            <button
              onClick={() => copyToClipboard(backupCodes.join('\n'))}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition"
            >
              📋 Copiar Todos
            </button>
            <button
              onClick={() => {
                setShowBackupCodes(false);
                loadStatus();
              }}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-gray-900 dark:text-white rounded-lg transition"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
