'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login?redirect=/admin');
        return;
      }

      try {
        const response = await fetch('http://localhost:3001/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Não autenticado');
        }

        const data = await response.json();

        // Verificar se é admin ou master
        if (data.data.role !== 'ADMIN' && data.data.role !== 'MASTER') {
          alert('Acesso negado. Apenas administradores podem acessar esta área.');
          router.push('/dashboard');
          return;
        }

        setUserName(data.data.name || data.data.email);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Admin Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-white">🔐 Painel Admin</h1>
              <span className="px-3 py-1 bg-blue-600/20 border border-blue-500/50 rounded-full text-xs font-semibold text-blue-400">
                ADMINISTRADOR
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/profile"
                className="text-sm text-gray-300 hover:text-white transition"
              >
                👤 {userName}
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-sm font-medium text-white transition"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <Link
              href="/admin"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              📊 Dashboard
            </Link>
            <Link
              href="/admin/wallets"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/wallets'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              💼 Endereços da Plataforma
            </Link>
            <Link
              href="/admin/users"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/users'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              👥 Usuários
            </Link>
            <Link
              href="/admin/orders"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/orders'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              📦 Pedidos
            </Link>
            <Link
              href="/admin/audit"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/audit'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              📋 Audit Log
            </Link>
            <Link
              href="/marketplace"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/marketplace'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              🛒 Marketplace
            </Link>
            <Link
              href="/orders/create"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/orders/create'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              ➕ Criar Pedido
            </Link>
            <Link
              href="/admin/disputes"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname.startsWith('/admin/disputes')
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              ⚖️ Disputas
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-400">
            Mktplace da Liberdade - Painel Administrativo
          </p>
        </div>
      </footer>
    </div>
  );
}
