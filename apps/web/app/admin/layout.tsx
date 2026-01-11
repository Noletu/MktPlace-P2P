'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getApiUrl } from '@/config/api';
import { NotificationBell } from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import CryptoPriceCards from '@/components/CryptoPriceCards';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userLevel, setUserLevel] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login?redirect=/admin');
        return;
      }

      try {
        const response = await fetch(getApiUrl('auth/me'), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Não autenticado');
        }

        const data = await response.json();

        // Verificar se tem level >= 40 (SUPPORT, GERENTE, ADMIN, MASTER)
        const userLevel = data.data.level || 0;

        if (userLevel < 40) {
          alert('Acesso negado. Você precisa de permissões administrativas para acessar esta área.');
          router.push('/dashboard');
          return;
        }

        setUserName(data.data.name || data.data.email);
        setUserRole(data.data.role);
        setUserLevel(userLevel);
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/login?redirect=/admin');
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
        {/* Header com ThemeToggle sempre visível */}
        <header className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border-b border-gray-300 dark:border-gray-700 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">MP</span>
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">MktPlace P2P</span>
              </div>

              {/* ThemeToggle SEMPRE visível mesmo durante loading */}
              <div className="flex items-center gap-3">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        {/* Loading content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Verificando permissões...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Admin Header */}
      <header className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border-b border-gray-300 dark:border-gray-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 items-center py-4 gap-4">
            {/* LEFT: Logo clicável + Badge */}
            <div className="flex items-center space-x-4 justify-start">
              {/* Logo clicável - leva para homepage mantendo login */}
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">MP</span>
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">MktPlace P2P</span>
              </button>

              {/* Badge ADMIN/MASTER/SUPPORT/GERENTE */}
              <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${
                userRole === 'MASTER'
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-600 dark:text-purple-400'
                  : userRole === 'ADMIN'
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-600 dark:text-blue-400'
                  : userRole === 'GERENTE'
                  ? 'bg-green-600/20 border-green-500/50 text-green-600 dark:text-green-400'
                  : 'bg-orange-600/20 border-orange-500/50 text-orange-600 dark:text-orange-400'
              }`}>
                {userRole === 'MASTER' ? '👑 MASTER'
                 : userRole === 'ADMIN' ? '⚡ ADMINISTRADOR'
                 : userRole === 'GERENTE' ? '📊 GERENTE'
                 : '🎧 SUPORTE'}
                {' '}
                <span className="opacity-70">(Nv. {userLevel})</span>
              </span>
            </div>

            {/* CENTER: Crypto Price Cards */}
            <div className="flex justify-center">
              <CryptoPriceCards />
            </div>

            {/* RIGHT: Notificações, Tema, Perfil */}
            <div className="flex items-center justify-end gap-3">
              <NotificationBell />
              <ThemeToggle />

              {/* Dropdown de Perfil */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {userName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white hidden sm:block">
                    {userName}
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
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        router.push('/admin/profile');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      👤 Meu Perfil
                    </button>
                    <div className="border-t border-gray-300 dark:border-gray-700"></div>
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
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <Link
              href="/admin"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              📊 Dashboard
            </Link>
            <Link
              href="/admin/users"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/users'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              👥 Usuários
            </Link>
            <Link
              href="/admin/orders"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/orders'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              📦 Pedidos
            </Link>
            <Link
              href="/admin/audit"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/audit'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              📋 Audit Log
            </Link>
            <Link
              href="/admin/marketplace"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/marketplace'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              🛒 Marketplace
            </Link>
            <Link
              href="/admin/roles"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/roles'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              👑 Roles (MASTER)
            </Link>
            <Link
              href="/admin/orders/create"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname.startsWith('/admin/orders/create')
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              ➕ Criar Pedido
            </Link>
            <Link
              href="/admin/disputes"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname.startsWith('/admin/disputes')
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              ⚖️ Disputas
            </Link>
            <Link
              href="/admin/support"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname.startsWith('/admin/support')
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              🎫 Suporte
            </Link>
            <Link
              href="/admin/security"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/security'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              🔒 Segurança
            </Link>
            <Link
              href="/admin/master-seed"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/master-seed'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              🔐 Master Seed
            </Link>
            <Link
              href="/admin/funds"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname.startsWith('/admin/funds')
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              💰 Controle de Fundos
            </Link>
            <Link
              href="/admin/workers"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/workers'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              🤖 Workers
            </Link>
            <Link
              href="/admin/platform-wallets"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname.startsWith('/admin/platform-wallets')
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              🏦 Carteiras
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Mktplace da Liberdade - Painel Administrativo
          </p>
        </div>
      </footer>
    </div>
  );
}
