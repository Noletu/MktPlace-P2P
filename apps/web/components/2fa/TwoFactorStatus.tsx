'use client';

interface TwoFactorStatusProps {
  enabled: boolean;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}

/**
 * Badge de status do 2FA
 * - Mostra se 2FA está ativo ou inativo
 * - Tamanhos configuráveis
 * - Pode mostrar/ocultar ícone e texto
 * - Suporte dark mode
 */
export default function TwoFactorStatus({
  enabled,
  size = 'md',
  showIcon = true,
  showText = true,
  className = '',
}: TwoFactorStatusProps) {
  // Configurações de tamanho
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  // Cores baseadas no status
  const statusClasses = enabled
    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700'
    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600';

  const icon = enabled ? '✅' : '⚫';
  const text = enabled ? 'Ativo' : 'Inativo';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} ${statusClasses} rounded-lg border font-semibold ${className}`}
    >
      {showIcon && <span className={iconSizes[size]}>{icon}</span>}
      {showText && <span>{text}</span>}
    </span>
  );
}
