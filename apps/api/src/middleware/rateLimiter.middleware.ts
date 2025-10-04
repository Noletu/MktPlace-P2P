import rateLimit from 'express-rate-limit';

// SECURITY: Rate limiter para rotas de autenticação (prevenir brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Limite de 5 tentativas por IP
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  // SECURITY: Usar IP real mesmo atrás de proxy
  skipSuccessfulRequests: false,
});

// SECURITY: Rate limiter para criação de contas
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: process.env.NODE_ENV === 'production' ? 3 : 100, // Dev: 100, Prod: 3
  message: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limiter geral para API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
  message: 'Muitas requisições. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limiter para criação de pedidos (prevenir spam)
export const orderCreationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 pedidos por minuto
  message: 'Muitos pedidos criados. Aguarde 1 minuto.',
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limiter para upload de comprovantes
export const proofUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 uploads a cada 5 minutos
  message: 'Muitos uploads. Aguarde alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});
