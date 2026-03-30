'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import Image from 'next/image';
import { fetchWithAuth } from '@/utils/api';

interface TwoFactorSetup {
  secret: string;
  qrCode: string;
}

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'initial' | 'setup' | 'backup-codes' | 'regenerate-prompt' | 'regenerate-codes'>('initial');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [backupCodesCount, setBackupCodesCount] = useState(0);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await fetchWithAuth('/2fa/status');

      if (!response.ok) {
        throw new Error('Erro ao verificar status');
      }

      const data = await response.json();
      setIsEnabled(data.data.enabled);
      setBackupCodesCount(data.data.backupCodesCount || 0);
      setStep(data.data.enabled ? 'initial' : 'initial');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSecret = async () => {
    setError('');
    setProcessing(true);

    try {
      const response = await fetchWithAuth('/2fa/generate', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao gerar QR Code');
      }

      const data = await response.json();
      setSetup({
        secret: data.data.secret,
        qrCode: data.data.qrCode,
      });
      setStep('setup');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const enableTwoFactor = async () => {
    if (!token || token.length !== 6) {
      setError('Digite um código de 6 dígitos');
      return;
    }

    setError('');
    setProcessing(true);

    try {
      const response = await fetchWithAuth('/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao ativar 2FA');
      }

      // Capturar backup codes retornados
      if (data.data?.backupCodes) {
        setBackupCodes(data.data.backupCodes);
        setStep('backup-codes');
        setSetup(null);
        setToken('');
        setIsEnabled(true);
      } else {
        // Fallback se não houver backup codes
        setSuccess('2FA ativado com sucesso!');
        setIsEnabled(true);
        setSetup(null);
        setToken('');
        setStep('initial');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!token || token.length !== 6) {
      setError('Digite um código de 6 dígitos');
      return;
    }

    setError('');
    setProcessing(true);

    try {
      const response = await fetchWithAuth('/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao desativar 2FA');
      }

      setSuccess('2FA desativado com sucesso!');
      setIsEnabled(false);
      setToken('');

      // Redirecionar para dashboard após 2 segundos
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const regenerateBackupCodes = async () => {
    if (!token || token.length !== 6) {
      setError('Digite um código de 6 dígitos');
      return;
    }

    setError('');
    setProcessing(true);

    try {
      const response = await fetchWithAuth('/2fa/regenerate-backup-codes', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao regenerar backup codes');
      }

      // Capturar backup codes retornados
      if (data.data?.backupCodes) {
        setBackupCodes(data.data.backupCodes);
        setStep('regenerate-codes');
        setToken('');
        setBackupCodesCount(data.data.backupCodes.length);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setToken(value);
    setError('');
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    alert('Códigos copiados para área de transferência!');
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mktplace-2fa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const finishBackupCodesStep = () => {
    if (!confirmedBackup) {
      setError('Por favor, confirme que guardou os códigos em local seguro');
      return;
    }
    setSuccess('2FA ativado com sucesso!');
    setStep('initial');
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 dark:text-blue-400 hover:underline mb-4 flex items-center gap-2"
            >
              ← Voltar ao Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Autenticação de Dois Fatores (2FA)
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Adicione uma camada extra de segurança à sua conta
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <p className="text-green-800 dark:text-green-200 font-semibold">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-2xl">❌</span>
                <p className="text-red-800 dark:text-red-200 font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Status Atual */}
          {step === 'initial' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🔐</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Status Atual
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isEnabled ? '2FA está ativo' : '2FA está inativo'}
                    </p>
                  </div>
                </div>
                <div>
                  {isEnabled ? (
                    <span className="px-4 py-2 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded-lg font-semibold">
                      ✅ Ativo
                    </span>
                  ) : (
                    <span className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg font-semibold">
                      ⚫ Inativo
                    </span>
                  )}
                </div>
              </div>

              {/* Informações sobre 2FA */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                  📱 O que é 2FA?
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                  A autenticação de dois fatores adiciona uma camada extra de segurança. Além da sua senha, você precisará de um código gerado por um app autenticador no seu celular.
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-300 font-semibold">
                  Apps recomendados:
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-400 list-disc list-inside mt-1">
                  <li>Google Authenticator</li>
                  <li>Microsoft Authenticator</li>
                  <li>Authy</li>
                </ul>
              </div>

              {/* Ações */}
              {!isEnabled ? (
                <button
                  onClick={generateSecret}
                  disabled={processing}
                  className="w-full px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {processing ? 'Gerando...' : '🔐 Ativar 2FA'}
                </button>
              ) : (
                <div className="space-y-6">
                  {/* Seção de Backup Codes */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🔑</span>
                        <div>
                          <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                            Códigos de Recuperação
                          </h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {backupCodesCount > 0
                              ? `Você tem ${backupCodesCount} código${backupCodesCount !== 1 ? 's' : ''} de recuperação disponível${backupCodesCount !== 1 ? 'is' : ''}`
                              : 'Você não tem códigos de recuperação disponíveis'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {backupCodesCount === 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-3 mb-3">
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                          ⚠️ Você usou todos os códigos de recuperação. Recomendamos gerar novos códigos.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => setStep('regenerate-prompt')}
                      className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      🔄 Gerar Novos Códigos de Recuperação
                    </button>
                  </div>

                  {/* Desativar 2FA */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Para desativar o 2FA, você precisará confirmar com um código do seu app autenticador.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Código do App Autenticador
                        </label>
                        <input
                          type="text"
                          value={token}
                          onChange={handleTokenChange}
                          placeholder="000000"
                          maxLength={6}
                          className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                        />
                      </div>
                      <button
                        onClick={disableTwoFactor}
                        disabled={processing || token.length !== 6}
                        className="w-full px-6 py-3 bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {processing ? 'Desativando...' : '🔓 Desativar 2FA'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Setup - Mostrar QR Code */}
          {step === 'setup' && setup && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Etapa 1: Escaneie o QR Code
              </h2>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Abra seu app autenticador e escaneie este QR Code:
                </p>

                <div className="flex justify-center mb-4">
                  <div className="bg-white p-4 rounded-lg">
                    <img
                      src={setup.qrCode}
                      alt="QR Code 2FA"
                      className="w-64 h-64"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Não consegue escanear? Digite este código manualmente:
                  </p>
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-4 py-2 font-mono text-sm break-all">
                    {setup.secret}
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Etapa 2: Digite o Código
              </h2>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Digite o código de 6 dígitos gerado pelo seu app autenticador:
              </p>

              <div className="space-y-4">
                <input
                  type="text"
                  value={token}
                  onChange={handleTokenChange}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep('initial');
                      setSetup(null);
                      setToken('');
                      setError('');
                    }}
                    className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={enableTwoFactor}
                    disabled={processing || token.length !== 6}
                    className="flex-1 px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing ? 'Verificando...' : '✅ Confirmar e Ativar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Regenerate Prompt - Solicitar token 2FA */}
          {step === 'regenerate-prompt' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="text-center mb-6">
                <span className="text-5xl">🔐</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
                  Gerar Novos Códigos de Recuperação
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Para sua segurança, confirme sua identidade com um código do app autenticador
                </p>
              </div>

              {/* Avisos */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div className="text-sm">
                    <p className="font-semibold text-orange-900 dark:text-orange-200 mb-2">
                      IMPORTANTE:
                    </p>
                    <ul className="text-orange-800 dark:text-orange-300 space-y-1 list-disc list-inside">
                      <li>Todos os códigos antigos serão invalidados</li>
                      <li>Você receberá 10 novos códigos</li>
                      <li>Guarde os novos códigos em local seguro</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Código do App Autenticador
                  </label>
                  <input
                    type="text"
                    value={token}
                    onChange={handleTokenChange}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep('initial');
                      setToken('');
                      setError('');
                    }}
                    className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={regenerateBackupCodes}
                    disabled={processing || token.length !== 6}
                    className="flex-1 px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing ? 'Gerando...' : '✅ Gerar Novos Códigos'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Regenerate Codes - Exibir novos códigos */}
          {step === 'regenerate-codes' && backupCodes.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="text-center mb-6">
                <span className="text-5xl">🔑</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
                  Novos Códigos Gerados!
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Guarde estes códigos em local seguro. Cada código pode ser usado apenas UMA VEZ para fazer login se você perder acesso ao seu app autenticador.
                </p>
              </div>

              {/* Avisos de Segurança */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div className="text-sm">
                    <p className="font-semibold text-orange-900 dark:text-orange-200 mb-2">
                      IMPORTANTE - Leia com atenção:
                    </p>
                    <ul className="text-orange-800 dark:text-orange-300 space-y-1 list-disc list-inside">
                      <li>Todos os códigos antigos foram invalidados</li>
                      <li>Estes códigos são mostrados apenas UMA VEZ</li>
                      <li>Cada código pode ser usado apenas UMA VEZ</li>
                      <li>Guarde em local seguro (gerenciador de senhas, cofre, etc)</li>
                      <li>Não compartilhe estes códigos com ninguém</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Grid de Códigos */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-4 py-3 font-mono text-center text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3">
                  <button
                    onClick={copyBackupCodes}
                    className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    📋 Copiar Todos
                  </button>
                  <button
                    onClick={downloadBackupCodes}
                    className="flex-1 px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    💾 Baixar como TXT
                  </button>
                </div>
              </div>

              {/* Confirmação */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedBackup}
                    onChange={(e) => {
                      setConfirmedBackup(e.target.checked);
                      setError('');
                    }}
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-blue-900 dark:text-blue-200">
                    Confirmo que copiei e guardei estes códigos em local seguro. Entendo que eles não serão mostrados novamente.
                  </span>
                </label>
              </div>

              {/* Botão Continuar */}
              <button
                onClick={() => {
                  if (!confirmedBackup) {
                    setError('Por favor, confirme que guardou os códigos em local seguro');
                    return;
                  }
                  setSuccess('Códigos regenerados com sucesso!');
                  setStep('initial');
                  setBackupCodes([]);
                  setConfirmedBackup(false);
                  setTimeout(() => {
                    setSuccess('');
                  }, 3000);
                }}
                disabled={!confirmedBackup}
                className="w-full px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ✅ Continuar
              </button>
            </div>
          )}

          {/* Backup Codes - Exibir após ativar 2FA */}
          {step === 'backup-codes' && backupCodes.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="text-center mb-6">
                <span className="text-5xl">🔑</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
                  Códigos de Recuperação
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Guarde estes códigos em local seguro. Cada código pode ser usado apenas UMA VEZ para fazer login se você perder acesso ao seu app autenticador.
                </p>
              </div>

              {/* Avisos de Segurança */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div className="text-sm">
                    <p className="font-semibold text-orange-900 dark:text-orange-200 mb-2">
                      IMPORTANTE - Leia com atenção:
                    </p>
                    <ul className="text-orange-800 dark:text-orange-300 space-y-1 list-disc list-inside">
                      <li>Estes códigos são mostrados apenas UMA VEZ</li>
                      <li>Cada código pode ser usado apenas UMA VEZ</li>
                      <li>Guarde em local seguro (gerenciador de senhas, cofre, etc)</li>
                      <li>Não compartilhe estes códigos com ninguém</li>
                      <li>Se perder os códigos, você precisará desativar e reativar o 2FA</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Grid de Códigos */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-4 py-3 font-mono text-center text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3">
                  <button
                    onClick={copyBackupCodes}
                    className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    📋 Copiar Todos
                  </button>
                  <button
                    onClick={downloadBackupCodes}
                    className="flex-1 px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    💾 Baixar como TXT
                  </button>
                </div>
              </div>

              {/* Confirmação */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedBackup}
                    onChange={(e) => {
                      setConfirmedBackup(e.target.checked);
                      setError('');
                    }}
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-blue-900 dark:text-blue-200">
                    Confirmo que copiei e guardei estes códigos em local seguro. Entendo que eles não serão mostrados novamente.
                  </span>
                </label>
              </div>

              {/* Botão Continuar */}
              <button
                onClick={finishBackupCodesStep}
                disabled={!confirmedBackup}
                className="w-full px-6 py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ✅ Continuar para Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
