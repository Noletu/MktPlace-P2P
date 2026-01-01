'use client';

import ThemeToggle from './ThemeToggle';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  // Não mostrar header no dashboard, marketplace, meus pedidos, criar pedido,
  // detalhes de pedido, profile, wallets, KYC e admin (já têm navegação própria)
  const pagesWithOwnNavigation = [
    '/dashboard',
    '/marketplace',
    '/orders/my-orders',
    '/orders/create',
    '/profile',
    '/wallets',
    '/kyc',
    '/admin'
  ];

  const shouldHide = pagesWithOwnNavigation.some(page => pathname?.startsWith(page)) ||
                     pathname?.match(/^\/orders\/[a-z0-9]+$/); // detalhes do pedido

  if (shouldHide) {
    return null;
  }

  return (
    <header className="fixed top-4 right-4 z-50">
      <ThemeToggle />
    </header>
  );
}
