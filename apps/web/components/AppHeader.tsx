'use client';

import { useRouter, usePathname } from 'next/navigation';
import { NotificationBell } from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { useState } from 'react';

const navigationLinks = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Carteiras', path: '/wallets' },
  { name: 'Meus Pedidos', path: '/orders/my-orders' },
  { name: 'Perfil', path: '/profile' },
];

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === path;
    return pathname?.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo & Brand */}
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MP</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white hidden sm:block">
              MktPlace P2P
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center px-4">
            {navigationLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => router.push(link.path)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  isActive(link.path)
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {link.name}
              </button>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <NotificationBell />
            <ThemeToggle />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg
                className="w-6 h-6 text-gray-600 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            {navigationLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => {
                  router.push(link.path);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-l-4 border-blue-600'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {link.name}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
