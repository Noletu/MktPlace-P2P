interface StatusBadgeProps {
  status?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children?: React.ReactNode;
}

const variantStyles = {
  default: 'bg-gray-600/20 border-gray-500/50 text-gray-300',
  success: 'bg-green-600/20 border-green-500/50 text-green-400',
  warning: 'bg-yellow-600/20 border-yellow-500/50 text-yellow-400',
  danger: 'bg-red-600/20 border-red-500/50 text-red-400',
  info: 'bg-blue-600/20 border-blue-500/50 text-blue-400',
};

export default function StatusBadge({ status, variant = 'default', children }: StatusBadgeProps) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${variantStyles[variant]}`}>
      {children ?? status}
    </span>
  );
}
