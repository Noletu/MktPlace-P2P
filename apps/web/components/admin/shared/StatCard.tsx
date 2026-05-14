interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  change?: {
    value: string;
    isPositive: boolean;
  };
  bgColor?: string;
}

export default function StatCard({ title, value, icon, change, bgColor = 'bg-blue-600/10' }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          {change && (
            <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {change.isPositive ? '↑' : '↓'} {change.value}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 ${bgColor} border border-blue-500/30 rounded-full flex items-center justify-center flex-shrink-0`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}
