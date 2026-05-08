'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RolesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/security?tab=roles');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecionando...</p>
      </div>
    </div>
  );
}
