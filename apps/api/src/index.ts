import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
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

// SECURITY: Middleware de segurança
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
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// SECURITY: Rate limiting global
app.use('/api/', apiLimiter);

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
  // SECURITY: Log erro no servidor
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  logger.info(`Server started on port ${port}`);
  console.log(`⚡️ [server]: Server is running at http://localhost:${port}`);
  console.log(`🚀 [server]: Mktplace da Liberdade API v0.1.0`);
});
