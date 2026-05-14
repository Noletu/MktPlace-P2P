import { NextRequest, NextResponse } from 'next/server';

/**
 * Rotas que requerem autenticação (qualquer usuário logado)
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/orders',
  '/profile',
  '/transactions',
  '/chat',
  '/disputes',
  '/support',
];

/**
 * Rotas que requerem role de admin (ADMIN, MASTER)
 */
const ADMIN_ROUTES = ['/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAdmin = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  if (!isProtected && !isAdmin) {
    return NextResponse.next();
  }

  // Verificar token via cookie HttpOnly (enviado pelo backend no login)
  const token = request.cookies.get('accessToken')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Para rotas admin: verificar role no cookie de role (enviado pelo backend)
  if (isAdmin) {
    const userRole = request.cookies.get('userRole')?.value;
    const isAdminRole = userRole === 'ADMIN' || userRole === 'MASTER';

    if (!isAdminRole) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/profile/:path*',
    '/transactions/:path*',
    '/chat/:path*',
    '/disputes/:path*',
    '/support/:path*',
    '/admin/:path*',
  ],
};
