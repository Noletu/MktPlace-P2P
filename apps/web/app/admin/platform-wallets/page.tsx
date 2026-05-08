'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlatformWalletsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/funds?tab=wallets');
  }, [router]);
  return null;
}
