import { Response } from 'express';

// SECURITY: Configurações de cookie seguro
const COOKIE_OPTIONS = {
  httpOnly: true, // Prevenir acesso via JavaScript (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only em produção
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'none' as const, // CSRF protection - 'none' em dev para permitir cross-origin
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias em millisegundos
  path: '/',
  domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost', // Domínio localhost em dev
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
};

/**
 * SECURITY: Armazenar access token em HttpOnly cookie
 */
export const setAccessTokenCookie = (res: Response, token: string): void => {
  res.cookie('accessToken', token, COOKIE_OPTIONS);
};

/**
 * SECURITY: Armazenar refresh token em HttpOnly cookie
 */
export const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie('refreshToken', token, REFRESH_COOKIE_OPTIONS);
};

/**
 * SECURITY: Limpar cookies de autenticação (logout)
 */
export const clearAuthCookies = (res: Response): void => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
};

/**
 * SECURITY: Extrair token do cookie ou header (fallback para compatibilidade)
 */
export const extractToken = (req: any): string | null => {
  // Priorizar cookie (mais seguro)
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  // Fallback para Authorization header (compatibilidade com mobile/API)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};
