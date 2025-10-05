import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import kycRoutes from './routes/kyc.routes';
import priceRoutes from './routes/price.routes';
import walletRoutes from './routes/wallet.routes';
import orderRoutes from './routes/order.routes';
import transactionRoutes from './routes/transaction.routes';
import twoFactorRoutes from './routes/twoFactor.routes';
import { apiLimiter } from './middleware/rateLimiter.middleware';
import { logger } from './utils/logger';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// SECURITY: Forçar HTTPS em produção
if (process.env.NODE_ENV === 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      logger.warn('[SECURITY] HTTP request blocked, redirecting to HTTPS', {
        ip: req.ip,
        path: req.path,
      });
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

// SECURITY: Middleware de segurança com HSTS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // SECURITY: HSTS - Force HTTPS por 1 ano
  hsts: {
    maxAge: 31536000, // 1 ano em segundos
    includeSubDomains: true,
    preload: true,
  },
  // SECURITY: Prevenir clickjacking
  frameguard: { action: 'deny' },
  // SECURITY: Prevenir MIME sniffing
  noSniff: true,
  // SECURITY: Desabilitar X-Powered-By header
  hidePoweredBy: true,
}));

// SECURITY: CORS whitelist estrita
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS?.split(',') || [])
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (ex: Postman, curl)
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      logger.warn('[SECURITY] CORS blocked unauthorized origin', {
        origin,
        allowed: ALLOWED_ORIGINS,
      });
      return callback(new Error('Not allowed by CORS'), false);
    }

    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 horas de cache para preflight
}));

// SECURITY: Rate limiting global
app.use('/api/', apiLimiter);

// SECURITY: Cookie parser para HttpOnly cookies
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

// SECURITY: Limitar tamanho de payload (prevenir DoS)
app.use(express.json({ limit: '10mb' })); // Max 10MB para uploads de imagens
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Mktplace da Liberdade API'
  });
});

// API Routes
app.get('/api/v1', (req: Request, res: Response) => {
  res.json({
    message: 'Mktplace da Liberdade API v1',
    version: '0.1.0',
    endpoints: {
      auth: '/api/v1/auth',
      '2fa': '/api/v1/2fa',
      kyc: '/api/v1/kyc',
      prices: '/api/v1/prices',
      wallets: '/api/v1/wallets',
      orders: '/api/v1/orders',
      transactions: '/api/v1/transactions'
    }
  });
});

// Auth routes
app.use('/api/v1/auth', authRoutes);

// 2FA routes
app.use('/api/v1/2fa', twoFactorRoutes);

// KYC routes
app.use('/api/v1/kyc', kycRoutes);

// Price routes
app.use('/api/v1/prices', priceRoutes);

// Wallet routes
app.use('/api/v1/wallets', walletRoutes);

// Order routes
app.use('/api/v1/orders', orderRoutes);

// Transaction routes
app.use('/api/v1/transactions', transactionRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  // SECURITY: Log erro no servidor (stack trace apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'production') {
    logger.error('Unhandled error', {
      error: err.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.userId,
      // SECURITY: Stack trace NÃO incluído em produção
    });
  } else {
    // Em desenvolvimento, incluir stack trace para debug
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  }

  // SECURITY: Resposta genérica para cliente (nunca expor detalhes internos)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    // SECURITY: Em produção, não expor mensagem de erro
    ...(process.env.NODE_ENV !== 'production' && { message: err.message }),
  });
});

app.listen(port, () => {
  logger.info(`Server started on port ${port}`);
  console.log(`⚡️ [server]: Server is running at http://localhost:${port}`);
  console.log(`🚀 [server]: Mktplace da Liberdade API v0.1.0`);
});
