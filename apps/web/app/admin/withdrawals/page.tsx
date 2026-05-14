'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WithdrawalsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/funds?tab=withdrawals');
  }, [router]);
  return null;
}
