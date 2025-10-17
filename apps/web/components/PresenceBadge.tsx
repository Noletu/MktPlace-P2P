'use client';

interface PresenceBadgeProps {
  online: boolean;
  lastSeenAt: string;
  size?: 'small' | 'medium' | 'large';
}

export default function PresenceBadge({ online, lastSeenAt, size = 'medium' }: PresenceBadgeProps) {
  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  const sizeClasses = {
    small: 'w-2 h-2 text-xs',
    medium: 'w-3 h-3 text-sm',
    large: 'w-4 h-4 text-base',
  };

  return (
    <div className="flex items-center gap-2">
      {online ? (
        <>
          <span className={`${sizeClasses[size].split(' ')[0]} ${sizeClasses[size].split(' ')[1]} bg-green-500 rounded-full animate-pulse`} />
          <span className={`${sizeClasses[size].split(' ')[2]} font-semibold text-green-700 dark:text-green-400`}>
            ONLINE
          </span>
          <span className={`${sizeClasses[size].split(' ')[2]} text-gray-500 dark:text-gray-400`}>
            Ativo agora
          </span>
        </>
      ) : (
        <>
          <span className={`${sizeClasses[size].split(' ')[0]} ${sizeClasses[size].split(' ')[1]} bg-gray-400 rounded-full`} />
          <span className={`${sizeClasses[size].split(' ')[2]} font-semibold text-gray-600 dark:text-gray-400`}>
            OFFLINE
          </span>
          <span className={`${sizeClasses[size].split(' ')[2]} text-gray-500 dark:text-gray-400`}>
            {getTimeAgo(lastSeenAt)}
          </span>
        </>
      )}
    </div>
  );
}
