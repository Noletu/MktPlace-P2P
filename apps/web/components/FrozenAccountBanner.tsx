'use client';

import { useState } from 'react';

interface FrozenAccountBannerProps {
  frozenReason: string;
  frozenAt: string;
  frozenUntil?: string | null;
}

export function FrozenAccountBanner({ frozenReason, frozenAt, frozenUntil }: FrozenAccountBannerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isPermanent = !frozenUntil;
  const expiryDate = frozenUntil ? new Date(frozenUntil) : null;
  const now = new Date();
  const isExpired = expiryDate && expiryDate <= now;

  // Não mostrar se já expirou (o auto-unfreeze job vai desbloquear em breve)
  if (isExpired) return null;

  const timeRemaining = expiryDate
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)) // horas
    : null;

  return (
    <div className={`w-full ${isPermanent ? 'bg-red-600' : 'bg-orange-500'} text-white shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{isPermanent ? '🚫' : '⚠️'}</span>
              <h3 className="text-lg font-bold">
                {isPermanent ? 'Conta Suspensa' : 'Conta Temporariamente Suspensa'}
              </h3>
            </div>

            {!isCollapsed && (
              <>
                <p className="text-sm mb-2">
                  <strong>Motivo:</strong> {frozenReason || 'Não especificado'}
                </p>

                {!isPermanent && expiryDate && (
                  <p className="text-sm mb-2">
                    <strong>Suspensão até:</strong> {expiryDate.toLocaleString('pt-BR')}
                    {timeRemaining && timeRemaining > 0 && (
                      <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">
                        {timeRemaining}h restantes
                      </span>
                    )}
                  </p>
                )}

                <p className="text-sm mt-3 mb-2">
                  ℹ️ Enquanto sua conta estiver suspensa, você não poderá:
                </p>
                <ul className="text-sm list-disc list-inside ml-4 space-y-1">
                  <li>Criar novos pedidos (compra ou venda)</li>
                  <li>Realizar saques de saldo</li>
                  <li>Transferir criptomoedas</li>
                </ul>

                <p className="text-sm mt-3">
                  💬 Se você acredita que isso é um erro, entre em contato com o suporte.
                </p>

                <div className="mt-4">
                  <a
                    href="/support/ticket/new"
                    className="inline-block bg-white text-red-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors"
                  >
                    📧 Abrir Ticket de Suporte
                  </a>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-4 text-white hover:text-gray-200 transition-colors"
            aria-label={isCollapsed ? 'Expandir' : 'Recolher'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>
    </div>
  );
}
