'use client';

import { useRouter } from 'next/navigation';

interface SecurityBannerProps {
  kycLevel: string;
  reputationScore: number;
}

export default function SecurityBanner({ kycLevel, reputationScore }: SecurityBannerProps) {
  const router = useRouter();

  const getKYCInfo = (level: string) => {
    const levels: Record<string, { label: string; color: string; badge: string }> = {
      'NONE': { label: 'Nível 0', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200', badge: '📧' },
      'LEVEL_1': { label: 'Nível 1', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200', badge: '🆔' },
      'LEVEL_2': { label: 'Nível 2', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200', badge: '✅' },
      'LEVEL_3': { label: 'Nível 3', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200', badge: '🏆' },
      'LEVEL_4': { label: 'Nível 4', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200', badge: '👑' },
    };
    return levels[level] || levels['NONE'];
  };

  const kycInfo = getKYCInfo(kycLevel);
  const canUpgrade = kycLevel !== 'LEVEL_4';

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6 shadow-md">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-1">
          {/* KYC Status */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md">
              <span className="text-2xl">🔐</span>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status KYC</p>
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${kycInfo.color} inline-flex items-center gap-1`}>
                <span>{kycInfo.badge}</span>
                <span>{kycInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Reputation Score */}
          <div className="hidden md:block w-px h-12 bg-gray-300 dark:bg-gray-600"></div>
          <div className="hidden md:flex items-center gap-3">
            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md">
              <span className="text-2xl">⭐</span>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Reputação</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {reputationScore}/100
              </p>
            </div>
          </div>

          {/* 2FA Status (placeholder) */}
          <div className="hidden md:block w-px h-12 bg-gray-300 dark:bg-gray-600"></div>
          <div className="hidden md:flex items-center gap-3">
            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md">
              <span className="text-2xl">🔒</span>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">2FA</p>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                ✅ Ativo
              </p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        {canUpgrade && (
          <button
            onClick={() => router.push('/kyc/info')}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105 whitespace-nowrap"
          >
            ⬆️ Aumentar Limite
          </button>
        )}
      </div>
    </div>
  );
}
