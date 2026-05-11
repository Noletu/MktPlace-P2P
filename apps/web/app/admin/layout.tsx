'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getApiUrl } from '@/config/api';
import { NotificationBell } from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import CryptoPriceCards from '@/components/CryptoPriceCards';
import { fetchWithAuth } from '@/utils/api';
import DraggableTabBar, { TabConfig } from '@/components/admin/DraggableTabBar';

const ADMIN_NAV_TABS: (TabConfig & { minLevel?: number; pathMatch?: 'exact' | 'prefix' })[] = [
  { key: '/admin',               label: 'Dashboard',   icon: '📊', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'exact' },
  { key: '/admin/users',         label: 'Usuários',    icon: '👥', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'exact' },
  { key: '/admin/orders',        label: 'Pedidos',     icon: '📦', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'exact' },
  { key: '/admin/audit',         label: 'Audit',       labelLine2: 'Log',       icon: '📋', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'exact' },
  { key: '/admin/marketplace',   label: 'Marketplace', icon: '🛒', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'exact' },
  { key: '/admin/orders/create', label: 'Criar',       labelLine2: 'Pedido',    icon: '➕', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'prefix' },
  { key: '/admin/coupons',       label: 'Cupons',      icon: '🎟️', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'exact' },
  { key: '/admin/disputes',      label: 'Disputas',    icon: '⚖️', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'prefix' },
  { key: '/admin/support',       label: 'Suporte',     icon: '🎫', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'prefix' },
  { key: '/admin/security',      label: 'Segurança',   icon: '🔒', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'prefix' },
  { key: '/admin/funds',         label: 'Controle',    labelLine2: 'de Fundos', icon: '💰', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'prefix' },
  { key: '/admin/workers',       label: 'Workers',     icon: '🤖', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'exact' },
  { key: '/admin/comunicacoes',  label: 'Comuni-',     labelLine2: 'cações',    icon: '📢', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400', pathMatch: 'prefix', minLevel: 80 },
];

function getActiveNavKey(pathname: string): string {
  // Check prefix matches first (longer paths first to avoid /admin/orders vs /admin/orders/create conflict)
  const prefixTabs = ADMIN_NAV_TABS
    .filter(t => t.pathMatch === 'prefix')
    .sort((a, b) => b.key.length - a.key.length);

  for (const t of prefixTabs) {
    if (pathname.startsWith(t.key)) return t.key;
  }
  for (const t of ADMIN_NAV_TABS) {
    if (pathname === t.key) return t.key;
  }
  return '/admin';
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userLevel, setUserLevel] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hasActiveDelegation, setHasActiveDelegation] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetchWithAuth('/auth/me');

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

        // Verifica delegação ativa para exibir menu de aprovações a delegados
        if (userLevel < 100) {
          try {
            const delegRes = await fetchWithAuth('/admin/delegations/my-delegation');
            if (delegRes.ok) {
              const delegData = await delegRes.json();
              setHasActiveDelegation(!!delegData.data);
            }
          } catch {
            // Silencioso — se falhar, apenas não exibe o menu
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/login?redirect=/admin');
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetchWithAuth('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout: servidor não confirmou.', error);
    }
    localStorage.removeItem('user');
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
          <div className="flex items-center justify-between py-3 gap-2">
            {/* LEFT: Logo clicável + Badge */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Logo clicável - leva para homepage mantendo login */}
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-7 h-7 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">MP</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white hidden xl:block">MktPlace</span>
              </button>

              {/* Badge ADMIN/MASTER/SUPPORT/GERENTE */}
              <span className={`px-2 py-0.5 border rounded-full text-[10px] font-semibold whitespace-nowrap ${
                userRole === 'MASTER'
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-600 dark:text-purple-400'
                  : userRole === 'ADMIN'
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-600 dark:text-blue-400'
                  : userRole === 'GERENTE'
                  ? 'bg-green-600/20 border-green-500/50 text-green-600 dark:text-green-400'
                  : 'bg-orange-600/20 border-orange-500/50 text-orange-600 dark:text-orange-400'
              }`}>
                {userRole === 'MASTER' ? '👑 Master'
                 : userRole === 'ADMIN' ? '⚡ Admin'
                 : userRole === 'GERENTE' ? '📊 Gerente'
                 : '🎧 Suporte'}
              </span>
            </div>

            {/* CENTER: Crypto Price Cards */}
            <div className="flex justify-center flex-1 min-w-0">
              <CryptoPriceCards />
            </div>

            {/* RIGHT: Notificações, Tema, Perfil */}
            <div className="flex items-center justify-end gap-2 flex-shrink-0">
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
          <DraggableTabBar
            tabs={ADMIN_NAV_TABS.filter(t => !t.minLevel || userLevel >= t.minLevel)}
            activeTab={getActiveNavKey(pathname)}
            onTabChange={(key) => router.push(key)}
            storageKey="admin-nav-tabs"
            variant="stacked"
          />
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
