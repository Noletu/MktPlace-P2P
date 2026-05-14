'use client';

import { useRouter, usePathname } from 'next/navigation';
import { NotificationBell } from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import CryptoPriceCards from './CryptoPriceCards';
import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface User {
  id: string;
  name?: string;
  email: string;
  role?: string;
  level?: number;
}

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  // FIX: Mounted state pattern para evitar erro de hidratação
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    // Marcar componente como montado
    setMounted(true);

    // Verificar se o usuário está logado via cookie HttpOnly
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetchWithAuth('/auth/me');

      if (response.ok) {
        const data = await response.json();
        setUser(data.data);
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setIsLoggedIn(false);
      setUser(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetchWithAuth('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout: servidor não confirmou.', error);
    }

    localStorage.removeItem('user');
    setUser(null);
    setIsLoggedIn(false);
    router.push('/');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === path;
    return pathname?.startsWith(path);
  };

  // Detectar se é admin (level >= 40: SUPPORT, GERENTE, ADMIN, MASTER)
  const isAdmin = (user?.level || 0) >= 40;

  // Links para usuários normais
  const userNavigationLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Carteira', path: '/wallet' },
    { name: 'Meus Pedidos', path: '/orders/my-orders' },
    { name: 'Disputas', path: '/disputes' },
    { name: 'Suporte', path: '/support' },
    { name: 'Perfil', path: '/profile' },
  ];

  // Header único - sempre visível
  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-2">
          {/* Left: Logo & Brand */}
          <div className="flex items-center flex-shrink-0">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">MP</span>
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white hidden xl:block">
                MktPlace P2P
              </span>
            </button>
          </div>

          {/* Center: Crypto Price Cards - SEMPRE visível */}
          <div className="flex justify-center flex-1 min-w-0">
            <CryptoPriceCards />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
            {/* NotificationBell apenas quando logado - mounted state previne hydration error */}
            {mounted && isLoggedIn && <NotificationBell />}

            {/* ThemeToggle SEMPRE visível */}
            <ThemeToggle />

            {/* User Menu Dropdown - Apenas quando logado */}
            {isLoggedIn && (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {user?.name?.charAt(0).toUpperCase() || user?.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white hidden sm:block">
                    {user?.name || user?.email.split('@')[0]}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-600 dark:text-gray-300 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        router.push('/profile');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      👤 Meu Perfil
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700"></div>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      🚪 Sair
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Menu Button - Apenas quando logado E não for admin */}
            {isLoggedIn && !isAdmin && (
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
            )}
          </div>
        </div>

        {/* Desktop Navigation - Apenas quando logado E não for admin */}
        {isLoggedIn && !isAdmin && (
          <nav className="hidden md:flex items-center gap-1 justify-center py-2 border-t border-gray-200 dark:border-gray-700">
            {/* Links normais para usuários */}
            {userNavigationLinks.map((link) => (
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
        )}

        {/* Mobile Navigation - Apenas para usuários normais */}
        {mobileMenuOpen && !isAdmin && (
          <nav className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            {/* Links normais para usuários (mobile) */}
            {userNavigationLinks.map((link) => (
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
            <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push('/profile');
                }}
                className="w-full text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                👤 Meu Perfil
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-4 py-3 font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                🚪 Sair
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
