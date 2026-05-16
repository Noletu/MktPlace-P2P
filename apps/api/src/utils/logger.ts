import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || 'logs';

// SECURITY: Formato de log estruturado
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// SECURITY: Transporte para logs de erro (rotação diária)
const errorFileRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d', // Manter logs por 30 dias
  format: logFormat,
});

// SECURITY: Transporte para todos os logs (rotação diária)
const combinedFileRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d', // Manter logs por 14 dias
  format: logFormat,
});

// SECURITY: Transporte para logs de segurança (rotação diária)
const securityFileRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d', // Manter logs de segurança por 90 dias
  format: logFormat,
  level: 'warn', // Apenas warnings e erros
});

// SECURITY: Logger principal
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'mktplace-api' },
  transports: [
    errorFileRotateTransport,
    combinedFileRotateTransport,
    securityFileRotateTransport,
  ],
});

// SECURITY: Console transport apenas em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// SECURITY: Logger específico para segurança
export const securityLogger = {
  login: (userId: string, success: boolean, ip?: string, metadata?: any) => {
    logger.warn('LOGIN_ATTEMPT', {
      userId,
      success,
      ip,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  register: (userId: string, success: boolean, ip?: string, metadata?: any) => {
    logger.warn('REGISTER_ATTEMPT', {
      userId,
      success,
      ip,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  unauthorized: (path: string, ip?: string, metadata?: any) => {
    logger.warn('UNAUTHORIZED_ACCESS', {
      path,
      ip,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  rateLimit: (path: string, ip?: string, metadata?: any) => {
    logger.warn('RATE_LIMIT_EXCEEDED', {
      path,
      ip,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  suspiciousActivity: (userId: string, action: string, metadata?: any) => {
    logger.error('SUSPICIOUS_ACTIVITY', {
      userId,
      action,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  twoFactor: (userId: string, success: boolean, metadata?: any) => {
    logger.warn('TWO_FACTOR_ATTEMPT', {
      userId,
      success,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  // CRIT-07: token TOTP recebido foi assinado pelo secret correto mas seu
  // timestep já está marcado como consumido em twoFactorLastUsedStep. Pode
  // ser comportamento do próprio usuário (botão "voltar" do navegador, duplo
  // clique) ou ataque (shoulder-surfing, screen-share, MITM). Logado em
  // arquivo separado de segurança (rotação 90d) para correlação posterior.
  totpReplay: (userId: string, metadata: { currentStep: number | string; lastUsed: number | string; reason?: string }) => {
    logger.warn('TOTP_REPLAY_DETECTED', {
      userId,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },
};

// SECURITY: Logger para operações críticas
export const auditLogger = {
  orderCreated: (userId: string, orderId: string, metadata?: any) => {
    logger.info('ORDER_CREATED', {
      userId,
      orderId,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  orderMatched: (orderId: string, payerId: string, metadata?: any) => {
    logger.info('ORDER_MATCHED', {
      orderId,
      payerId,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  transactionCompleted: (transactionId: string, metadata?: any) => {
    logger.info('TRANSACTION_COMPLETED', {
      transactionId,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  kycUpdated: (userId: string, newLevel: string, metadata?: any) => {
    logger.info('KYC_UPDATED', {
      userId,
      newLevel,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  withdrawal: (userId: string, amount: string, crypto: string, metadata?: any) => {
    logger.warn('WITHDRAWAL', {
      userId,
      amount,
      crypto,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },
};

export default logger;
