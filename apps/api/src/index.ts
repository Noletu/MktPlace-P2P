import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
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
import boletoRoutes from './routes/boleto.routes';
import collateralRoutes from './routes/collateral.routes';
import collateralBalanceRoutes from './routes/collateral-balance.routes';
import adminRoutes from './routes/admin.routes';
import adminBalanceRoutes from './routes/admin-balance.routes';
import refundRoutes from './routes/refund.routes';
import disputeRoutes from './routes/dispute.routes';
import reviewRoutes from './routes/review.routes';
import notificationRoutes from './routes/notification.routes';
import chatRoutes from './routes/chat.routes';
import keysRoutes from './routes/keys.routes';
import presenceRoutes from './routes/presence.routes';
import workersRoutes from './routes/workers.routes';
import masterSeedAdminRoutes from './routes/masterSeedAdmin.routes';
import adminFundsRoutes from './routes/adminFunds.routes';
import exchangeRateRoutes from './routes/exchange-rate.routes';
import roleRoutes from './routes/role.routes';
import supportRoutes from './routes/support.routes';
import couponRoutes from './routes/coupon.routes';
// import negotiationRoutes from './routes/negotiation.routes'; // DESABILITADO: Chat disponível apenas após aceitar pedido
// import statsRoutes from './routes/stats.routes';
import { apiLimiter } from './middleware/rateLimiter.middleware';
import { logger } from './utils/logger';
import { DepositMonitorWorker } from './workers/deposit-monitor.worker';
import { BalanceSyncWorker } from './workers/balance-sync.worker';
import { WorkerStateService } from './services/workerState.service';
import { orderExpirationWorker } from './workers/order-expiration.worker';
// import { negotiationTimeoutWorker } from './workers/negotiation-timeout.worker'; // DESABILITADO: Chat disponível apenas após aceitar pedido
import { presenceMonitorWorker } from './workers/presence-monitor.worker';
import { collateralReleaseWorker } from './workers/collateral-release.worker';
import { chatArchiveWorker } from './workers/chat-archive.worker';
import { initializeSocketServer } from './socket/socket.server';
import { initializeChatSocket } from './socket/chat.socket';
import { initializeNotificationSocket } from './socket/notification.socket';
import { MasterSeedService } from './services/hd-wallet/master-seed.service';
import { KeyManagementService } from './services/hd-wallet/key-management.service';
import { startAutoUnfreezeJob } from './jobs/autoUnfreeze.job';

dotenv.config();

// Inicializar serviços HD Wallet
try {
  MasterSeedService.initialize();
  KeyManagementService.initialize();
  logger.info('[HD WALLET] Services initialized successfully');
} catch (error) {
  logger.error('[HD WALLET] Failed to initialize services:', error);
  logger.error('[HD WALLET] Ensure MASTER_SEED_ENCRYPTION_KEY and WALLET_ENCRYPTION_KEY are set in .env');
  process.exit(1);
}

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
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

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
      transactions: '/api/v1/transactions',
      notifications: '/api/v1/notifications',
      disputes: '/api/v1/disputes',
      reviews: '/api/v1/reviews',
      support: '/api/v1/support',
      chat: '/api/v1/chat',
      keys: '/api/v1/keys'
    }
  });
});

// Auth routes
app.use('/api/v1/auth', authRoutes);

// SECURITY: Middleware de restrição para contas bloqueadas movido para auth.middleware.ts
// A verificação agora é feita durante a autenticação (após req.user ser definido)

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

// Boleto routes
app.use('/api/v1/boleto', boletoRoutes);

// Collateral routes
app.use('/api/v1/collateral', collateralRoutes);

// Collateral Balance routes (NEW: Internal Balance Management)
app.use('/api/v1/collateral-balance', collateralBalanceRoutes);

// Admin routes
app.use('/api/v1/admin', adminRoutes);

// Admin Balance Audit routes (NEW: v3.0.7 - Balance validation and fixing)
app.use('/api/v1/admin/balance', adminBalanceRoutes);

// Admin Funds routes (Control TOTAL de fundos - freeze, transfers, adjustments)
app.use('/api/v1/admin/funds', adminFundsRoutes);

// Refund routes
app.use('/api/v1/refund', refundRoutes);

// Dispute routes
app.use('/api/v1/disputes', disputeRoutes);

// Review routes
app.use('/api/v1/reviews', reviewRoutes);

// Support routes (tickets de suporte para usuários)
app.use('/api/v1/support', supportRoutes);

// Notification routes
app.use('/api/v1/notifications', notificationRoutes);

// Chat routes
app.use('/api/v1/chat', chatRoutes);

// Keys routes (encryption)
app.use('/api/v1/keys', keysRoutes);

// Presence routes (online/offline status)
app.use('/api/v1/presence', presenceRoutes);

// Workers routes (monitoring and management)
app.use('/api/v1/workers', workersRoutes);

// Master Seed Admin routes (HD Wallet seed management)
app.use('/api/v1/admin/master-seed', masterSeedAdminRoutes);

// Exchange Rate routes (multi-source USD/BRL rate with fallback)
app.use('/api/v1/exchange-rate', exchangeRateRoutes);

// Role routes (RBAC - Role-Based Access Control) - MASTER only
app.use('/api/v1/roles', roleRoutes);

// Coupon routes (discount coupons system)
app.use('/api/v1/coupons', couponRoutes);

// Negotiation routes (pre-match negotiation) - DESABILITADO: Chat disponível apenas após aceitar pedido
// app.use('/api/v1/negotiation', negotiationRoutes);

// Stats routes (user activity statistics)
// app.use('/api/v1/stats', statsRoutes);

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

// Criar servidor HTTP (necessário para Socket.io)
const httpServer = createServer(app);

// Inicializar Socket.io centralizado (único servidor para todos os namespaces)
const io = initializeSocketServer(httpServer);

// Inicializar namespaces de chat e notificações
const chatSocket = initializeChatSocket(io);
const notificationSocket = initializeNotificationSocket(io);

httpServer.listen(port, async () => {
  logger.info(`Server started on port ${port}`);
  console.log(`⚡️ [server]: Server is running at http://localhost:${port}`);
  console.log(`🚀 [server]: Mktplace da Liberdade API v0.1.0`);
  console.log(`💬 [socket]: Chat WebSocket enabled at ws://localhost:${port}/chat`);
  console.log(`🔔 [socket]: Notification WebSocket enabled at ws://localhost:${port}/notifications`);

  // Iniciar workers
  DepositMonitorWorker.start(); // HD Wallet deposit monitor
  orderExpirationWorker.start();
  // negotiationTimeoutWorker.start(); // DESABILITADO: Chat disponível apenas após aceitar pedido
  presenceMonitorWorker.start();
  chatArchiveWorker.start();
  // collateralReleaseWorker.start(); // DESABILITADO: processamento agora é feito direto no transaction.service.ts

  // Restaurar estado do BalanceSyncWorker do banco de dados
  try {
    const isEnabled = await WorkerStateService.getState('BalanceSyncWorker');
    if (isEnabled) {
      await BalanceSyncWorker.start();
      logger.info('✅ [workers]: BalanceSyncWorker restaurado (estava habilitado)');
    } else {
      logger.info('⏸️  [workers]: BalanceSyncWorker mantido parado (estava desabilitado)');
    }
  } catch (error) {
    logger.error('❌ [workers]: Erro ao restaurar estado do BalanceSyncWorker:', error);
  }

  // Iniciar job de auto-desbloqueio de contas (freeze temporário)
  startAutoUnfreezeJob();

  console.log('⚙️  [workers]: Background workers started (HD wallet monitoring, order expiration, presence, chat archive, auto-unfreeze)');
});

// Exportar para uso em outros módulos
export { chatSocket, notificationSocket };
