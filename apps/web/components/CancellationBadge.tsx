'use client';

interface CancellationBadgeProps {
  recentCancellations: number;
  totalCancellations?: number;
  className?: string;
}

export default function CancellationBadge({
  recentCancellations,
  totalCancellations,
  className = '',
}: CancellationBadgeProps) {
  // Não mostrar se não houver cancelamentos recentes
  if (recentCancellations === 0) return null;

  // Determinar cor baseado na quantidade
  let bgColor = 'bg-yellow-100 dark:bg-yellow-900/30';
  let textColor = 'text-yellow-800 dark:text-yellow-200';
  let borderColor = 'border-yellow-300 dark:border-yellow-700';
  let icon = '⚠️';

  if (recentCancellations >= 5) {
    bgColor = 'bg-red-100 dark:bg-red-900/30';
    textColor = 'text-red-800 dark:text-red-200';
    borderColor = 'border-red-300 dark:border-red-700';
    icon = '🚨';
  } else if (recentCancellations >= 3) {
    bgColor = 'bg-orange-100 dark:bg-orange-900/30';
    textColor = 'text-orange-800 dark:text-orange-200';
    borderColor = 'border-orange-300 dark:border-orange-700';
    icon = '⚠️';
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${bgColor} ${textColor} ${borderColor} text-sm font-medium ${className}`}
      title={
        totalCancellations
          ? `${recentCancellations} cancelamentos nos últimos 30 dias (${totalCancellations} total)`
          : `${recentCancellations} cancelamentos nos últimos 30 dias`
      }
    >
      <span>{icon}</span>
      <span>
        {recentCancellations} cancelamento{recentCancellations !== 1 ? 's' : ''}{' '}
        recente{recentCancellations !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
