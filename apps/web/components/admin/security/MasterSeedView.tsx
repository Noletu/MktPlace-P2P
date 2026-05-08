'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface PlatformWallet {
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  totalFeesCollected: string;
}

interface MasterSeedStatus {
  initialized: boolean;
  message?: string;
  createdAt?: string;
  encryption?: string;
  supportedNetworks?: string[];
  stats?: {
    usersWithWallets: number;
    totalUserWallets: number;
    platformWalletsCount: number;
  };
  platformWallets?: PlatformWallet[];
}

export default function MasterSeedView() {
  const [status, setStatus] = useState<MasterSeedStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [encryptedSeed, setEncryptedSeed] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetchWithAuth('/admin/master-seed/status');

      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      setError('Erro ao buscar status da master seed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setError('');
      setSuccess('');
      const response = await fetchWithAuth('/admin/master-seed/generate', {
        method: 'POST',
        body: JSON.stringify({ twoFactorCode }),
      });

      const data = await response.json();

      if (data.success && data.data.success) {
        setMnemonic(data.data.mnemonic);
        setEncryptedSeed(data.data.encryptedSeed);
        setSuccess('Master seed gerada com sucesso!');
        setTwoFactorCode('');
      } else {
        setError(data.error || 'Erro ao gerar master seed');
      }
    } catch (error) {
      console.error('Erro ao gerar master seed:', error);
      setError('Erro ao gerar master seed');
    }
  };

  const handleRecover = async () => {
    try {
      setError('');
      setSuccess('');
      const response = await fetchWithAuth('/admin/master-seed/recover', {
        method: 'POST',
        body: JSON.stringify({ mnemonic: mnemonicInput, twoFactorCode }),
      });

      const data = await response.json();

      if (data.success) {
        setEncryptedSeed(data.data.encryptedSeed);
        setSuccess('Master seed recuperada com sucesso!');
        setShowRecoverModal(false);
        setTwoFactorCode('');
        fetchStatus();
      } else {
        setError(data.error || 'Erro ao recuperar master seed');
      }
    } catch (error) {
      console.error('Erro ao recuperar master seed:', error);
      setError('Erro ao recuperar master seed');
    }
  };

  const handleReset = async () => {
    try {
      setError('');
      setResetting(true);
      const response = await fetchWithAuth('/admin/master-seed/reset', {
        method: 'POST',
        body: JSON.stringify({ twoFactorCode }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.data.message);
        setShowResetModal(false);
        setTwoFactorCode('');
        fetchStatus();
      } else {
        setError(data.error || 'Erro ao resetar master seed');
      }
    } catch (error) {
      console.error('Erro ao resetar master seed:', error);
      setError('Erro ao resetar master seed');
    } finally {
      setResetting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copiado para área de transferência!');
    setTimeout(() => setSuccess(''), 3000);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-300">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg text-green-400">
          {success}
        </div>
      )}

      {/* Encrypted Seed — salvar no .env antes de reiniciar o backend */}
      {encryptedSeed && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg">
          <p className="text-yellow-400 font-bold mb-2">⚠️ Salve este valor no .env antes de reiniciar o backend!</p>
          <p className="text-yellow-300 text-sm mb-3">Adicione a linha abaixo no arquivo <code>apps/api/.env</code>:</p>
          <div className="bg-gray-900 rounded p-3 mb-3">
            <code className="text-xs text-gray-300 break-all">MASTER_SEED_ENCRYPTED={encryptedSeed}</code>
          </div>
          <button
            onClick={() => copyToClipboard(`MASTER_SEED_ENCRYPTED=${encryptedSeed}`)}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors"
          >
            📋 Copiar linha completa para o .env
          </button>
        </div>
      )}

      {/* Status Card */}
      {!status?.initialized ? (
        <div className="bg-yellow-100 dark:bg-yellow-500/10 border border-yellow-500 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-400 mb-4">⚠️ Sistema Não Inicializado</h2>
          <p className="text-gray-900 dark:text-gray-300 mb-6">
            Nenhuma master seed configurada. É necessário gerar ou importar uma seed para que o sistema de carteiras HD funcione.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              🔐 Gerar Nova Seed
            </button>
            <button
              onClick={() => setShowRecoverModal(true)}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              🆘 Importar Seed Existente
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-green-400 mb-4">✅ Master Seed Configurada</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
            <div>
              <p className="text-sm text-gray-400">Criada em:</p>
              <p className="font-semibold">{status.createdAt ? new Date(status.createdAt).toLocaleString('pt-BR') : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Criptografia:</p>
              <p className="font-semibold">{status.encryption}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Carteiras da Plataforma (Sócios):</p>
              <p className="font-semibold text-blue-400">{status.stats?.platformWalletsCount || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Usuários com Carteiras:</p>
              <p className="font-semibold">{status.stats?.usersWithWallets || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total de Carteiras de Usuários:</p>
              <p className="font-semibold">{status.stats?.totalUserWallets || 0}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-2">Redes Suportadas:</p>
            <div className="flex gap-2 flex-wrap">
              {status.supportedNetworks?.map(network => (
                <span key={network} className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm">
                  {network}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-700">
            <button
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Resetar Master Seed
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Remove todas as platform wallets e permite gerar uma nova seed do zero.
            </p>
          </div>
        </div>
      )}

      {/* Platform Wallets Card - MASTER/ADMIN Partner Addresses */}
      {status?.initialized && status.platformWallets && status.platformWallets.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-blue-400">💼 Carteiras dos Sócios (MASTER/ADMIN)</h2>
              <p className="text-sm text-gray-400 mt-1">
                Endereços derivados da Master Seed (Account 0) para receber fees e depósitos dos sócios
              </p>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-300">
              ⚠️ <strong>IMPORTANTE:</strong> Use APENAS estes endereços para depósitos de cold wallet → hot wallet.
              Nunca deposite em endereços derivados de usuários (Account &gt;= 1).
            </p>
          </div>

          {/* Agrupar por cryptoType */}
          {['BTC', 'USDT', 'USDC'].map((crypto) => {
            const walletsForCrypto = status.platformWallets!.filter(w => w.cryptoType === crypto);

            if (walletsForCrypto.length === 0) return null;

            return (
              <div key={crypto} className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-600 rounded-full text-sm">{crypto}</span>
                  <span className="text-sm text-gray-400">
                    ({walletsForCrypto.length} {walletsForCrypto.length === 1 ? 'rede' : 'redes'})
                  </span>
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {walletsForCrypto.map((wallet) => (
                    <div
                      key={`${wallet.cryptoType}-${wallet.network}`}
                      className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-gray-700 text-blue-400 rounded text-xs font-semibold">
                              {wallet.network}
                            </span>
                          </div>

                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Endereço:</p>
                            <div className="flex items-center gap-2">
                              <code className="text-sm text-gray-300 font-mono break-all bg-gray-800 px-2 py-1 rounded">
                                {wallet.address}
                              </code>
                              <button
                                onClick={() => copyToClipboard(wallet.address)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors flex-shrink-0"
                                title="Copiar endereço"
                              >
                                📋
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 text-xs">Saldo Atual:</p>
                              <p className="text-white font-semibold">
                                {parseFloat(wallet.balance || '0').toFixed(8)} {crypto}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Total Fees Recebidas:</p>
                              <p className="text-green-400 font-semibold">
                                {parseFloat(wallet.totalFeesCollected || '0').toFixed(8)} {crypto}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400">
              <strong className="text-blue-400">Derivação HD:</strong> Estas carteiras são derivadas da Master Seed usando
              BIP44 path <code className="text-gray-300 bg-gray-800 px-2 py-1 rounded">m/44'/coin_type'/0'/0'/0'</code>
              (Account 0 = Plataforma). Carteiras de usuários usam Account &gt;= 1.
            </p>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Gerar Nova Master Seed</h2>

            {!mnemonic.length ? (
              <>
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6">
                  <p className="text-red-400 font-semibold mb-2">⚠️ ATENÇÃO - LEIA COM CUIDADO!</p>
                  <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                    <li>Uma seed será gerada com 24 palavras BIP39</li>
                    <li>Esta é a ÚNICA vez que verá estas palavras</li>
                    <li>Guarde em local seguro (papel, cofre, nunca digital)</li>
                    <li>Com estas palavras é possível recuperar TODAS as carteiras</li>
                    <li>Sem estas palavras, perda irreversível de fundos</li>
                  </ul>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Código 2FA (do seu app autenticador)
                  </label>
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setShowGenerateModal(false);
                      setTwoFactorCode('');
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={twoFactorCode.length > 0 && twoFactorCode.length !== 6}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Gerar Seed
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6">
                  <p className="text-red-400 font-semibold mb-2">🔴 COPIE E GUARDE EM LOCAL SEGURO</p>
                  <p className="text-sm text-gray-300">Esta é a ÚNICA vez que verá estas palavras</p>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-3 gap-2">
                    {mnemonic.map((word, i) => (
                      <div key={i} className="p-2 bg-gray-800 rounded border border-gray-700">
                        <span className="text-gray-500 text-xs">{i + 1}.</span>{' '}
                        <span className="text-white font-mono">{word}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(mnemonic.join(' '))}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg mb-4 transition-colors"
                >
                  📋 Copiar Mnemonic
                </button>

                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-400 mb-2">Encrypted Seed (adicione no .env):</p>
                  <div className="bg-gray-800 p-2 rounded border border-gray-700">
                    <code className="text-xs text-gray-300 break-all">{encryptedSeed}</code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(encryptedSeed)}
                    className="mt-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                  >
                    📋 Copiar Encrypted Seed
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    fetchStatus();
                  }}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Resetar Master Seed</h2>

            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-400 font-semibold mb-2">ATENÇÃO - Operação Destrutiva!</p>
              <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                <li>Todas as platform wallets serão apagadas</li>
                <li>A master seed será removida da memória</li>
                <li>Será necessário gerar uma nova seed</li>
                <li>Certifique-se de ter o backup do mnemonic atual</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código 2FA para confirmar
              </label>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setTwoFactorCode('');
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={twoFactorCode.length !== 6 || resetting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? 'Resetando...' : 'Confirmar Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recover Modal */}
      {showRecoverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Recuperar Master Seed</h2>

            <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 text-sm">
                Cole as 24 palavras do mnemonic separadas por espaço
              </p>
            </div>

            <textarea
              value={mnemonicInput}
              onChange={(e) => setMnemonicInput(e.target.value)}
              placeholder="word1 word2 word3 ... word24"
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm mb-4"
              rows={4}
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código 2FA (do seu app autenticador)
              </label>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>

            {encryptedSeed && (
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-400 mb-2">Encrypted Seed recuperado (adicione no .env):</p>
                <div className="bg-gray-800 p-2 rounded border border-gray-700">
                  <code className="text-xs text-gray-300 break-all">{encryptedSeed}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(encryptedSeed)}
                  className="mt-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                >
                  📋 Copiar
                </button>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowRecoverModal(false);
                  setMnemonicInput('');
                  setEncryptedSeed('');
                  setTwoFactorCode('');
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecover}
                disabled={!mnemonicInput.trim() || (twoFactorCode.length > 0 && twoFactorCode.length !== 6)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Recuperar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
