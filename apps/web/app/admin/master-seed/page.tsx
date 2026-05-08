'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MasterSeedRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/security?tab=master-seed');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-300">Redirecionando...</p>
      </div>
    </div>
  );
}
