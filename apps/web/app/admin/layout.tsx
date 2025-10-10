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

        // Verificar se é admin
        if (data.data.role !== 'ADMIN') {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-red-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">🔐 Painel Admin</h1>
              <span className="px-3 py-1 bg-red-800 rounded-full text-xs font-semibold">
                ADMINISTRADOR
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm">{userName}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-800 hover:bg-red-900 rounded-lg text-sm font-medium transition"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <Link
              href="/admin"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Dashboard
            </Link>
            <Link
              href="/admin/wallets"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/wallets'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💼 Endereços da Plataforma
            </Link>
            <Link
              href="/admin/users"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/users'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Usuários
            </Link>
            <Link
              href="/admin/orders"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/orders'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📦 Pedidos
            </Link>
            <Link
              href="/admin/audit"
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                pathname === '/admin/audit'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Audit Log
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            Mktplace da Liberdade - Painel Administrativo
          </p>
        </div>
      </footer>
    </div>
  );
}
