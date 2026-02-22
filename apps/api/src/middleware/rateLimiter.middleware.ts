import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// SECURITY: Handler customizado para mensagens de rate limit
const rateLimitHandler = (req: Request, res: Response) => {
  const retryAfter = res.getHeader('Retry-After');
  const limit = res.getHeader('X-RateLimit-Limit');

  res.status(429).json({
    success: false,
    error: 'Too Many Requests',
    message: 'Você excedeu o limite de requisições. Por favor, aguarde alguns minutos.',
    retryAfter: retryAfter ? `${retryAfter} segundos` : 'em breve',
    limit: limit,
    timestamp: new Date().toISOString(),
  });
};

// SECURITY: Rate limiter para rotas de autenticação (prevenir brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Limite de 5 tentativas por IP
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true, // Retorna headers `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  // SECURITY: Contar apenas tentativas falhadas (sucesso não conta)
  skipSuccessfulRequests: true, // ✅ Login bem-sucedido não conta no limite
  skipFailedRequests: false,
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para criação de contas
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: process.env.NODE_ENV === 'production' ? 3 : 100, // Dev: 100, Prod: 3
  message: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter geral para API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Dev: 1000, Prod: 100
  message: 'Muitas requisições. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  // SECURITY: Validar IP real mesmo atrás de proxy/load balancer
  validate: {
    trustProxy: process.env.NODE_ENV === 'production',
    xForwardedForHeader: false, // Não confiar em X-Forwarded-For (pode ser falsificado)
  },
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para criação de pedidos (prevenir spam)
export const orderCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: process.env.NODE_ENV === 'production' ? 10 : 1000, // Dev: 1000, Prod: 10 pedidos por hora
  message: 'Muitos pedidos criados. Aguarde 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para upload de comprovantes
export const proofUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 uploads a cada 5 minutos
  message: 'Muitos uploads. Aguarde alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para submissão de KYC
export const kycSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: process.env.NODE_ENV === 'production' ? 3 : 1000, // Dev: 1000, Prod: 3 tentativas
  message: 'Muitas tentativas de KYC. Aguarde 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para criação de disputas
export const disputeLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 5, // 5 disputas por dia
  message: 'Muitas disputas criadas. Aguarde 24 horas.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para ações de admin (prevenir automação maliciosa)
export const adminActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 ações por minuto
  message: 'Muitas ações administrativas. Aguarde 1 minuto.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para verificação de códigos 2FA (prevenir brute force)
export const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por 15 minutos
  message: 'Muitas tentativas de código 2FA. Aguarde 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não contar tentativas bem-sucedidas
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para redefinição de senha (prevenir abuso)
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3, // 3 tentativas por 15 minutos
  message: 'Muitas tentativas de redefinicao de senha. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// SECURITY: Rate limiter para operações financeiras críticas (MASTER only)
// Mais restritivo que adminActionLimiter devido à natureza crítica das operações
export const financialOperationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // Apenas 5 operações financeiras por hora
  message: 'Muitas operações financeiras. Tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
