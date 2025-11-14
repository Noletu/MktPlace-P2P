'use client';

import { useState } from 'react';
import Image from 'next/image';

interface QRCodeDisplayProps {
  qrCodeDataUrl: string;
  secret: string;
  loading?: boolean;
}

/**
 * Componente para exibir QR Code de 2FA
 * - Mostra QR Code para scan
 * - Fallback com secret manual
 * - Botão para copiar secret
 * - Loading state
 */
export default function QRCodeDisplay({
  qrCodeDataUrl,
  secret,
  loading = false,
}: QRCodeDisplayProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Gerando QR Code...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
      {/* Instruções */}
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          📱 Passo 1: Escaneie o QR Code
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Abra seu app autenticador (Google Authenticator, Authy, etc) e
          escaneie este código:
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <img
            src={qrCodeDataUrl}
            alt="QR Code 2FA"
            className="w-64 h-64"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            ou
          </span>
        </div>
      </div>

      {/* Secret Manual */}
      <div>
        <button
          onClick={() => setShowSecret(!showSecret)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 flex items-center gap-1"
        >
          {showSecret ? '▼' : '▶'} Não consegue escanear? Digite manualmente
        </button>

        {showSecret && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Se o QR Code não funcionar, digite este código no seu app:
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 font-mono text-sm break-all overflow-auto max-h-20">
                {secret}
              </div>
              <button
                onClick={copySecret}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white rounded transition-colors flex-shrink-0"
              >
                {copied ? '✓' : '📋'}
              </button>
            </div>
            {copied && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Copiado!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Apps recomendados */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
          Apps recomendados:
        </p>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
          <li>• Google Authenticator</li>
          <li>• Microsoft Authenticator</li>
          <li>• Authy</li>
          <li>• 1Password</li>
        </ul>
      </div>
    </div>
  );
}
