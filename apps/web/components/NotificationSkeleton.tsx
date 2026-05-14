export function NotificationSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-5 animate-pulse">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-4 bg-gray-300 rounded w-32"></div>
            <div className="h-5 bg-gray-200 rounded w-20"></div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-5 w-5 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-3 bg-gray-200 rounded w-24 ml-2"></div>
          </div>
        </div>
        <div className="h-8 w-8 bg-gray-200 rounded-lg"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    </div>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <NotificationSkeleton key={i} />
      ))}
    </div>
  );
}
