import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

export interface AuditLogInput {
  userId?: string;
  email?: string;
  role?: string;
  name?: string;
  action: string;
  resource: string;
  resourceId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
}

export class AuditLogService {
  // SECURITY: Registrar ação no audit log
  async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          email: input.email,
          role: input.role,
          name: input.name,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          description: input.description,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
          success: input.success ?? true,
          errorMessage: input.errorMessage,
        },
      });
    } catch (error) {
      // SECURITY: Não falhar a operação se audit log falhar
      console.error('[AUDIT LOG ERROR]', error);
    }
  }

  // SECURITY: Helper para extrair IP e User-Agent do request
  logFromRequest(
    req: Request,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, any>,
    success: boolean = true,
    errorMessage?: string
  ): void {
    const userId = (req as any).user?.userId;
    const email = (req as any).user?.email;
    const role = (req as any).user?.role;
    const name = (req as any).user?.name;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    this.log({
      userId,
      email,
      role,
      name,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      metadata,
      success,
      errorMessage,
    });
  }

  // SECURITY: Buscar logs de um usuário
  async getUserLogs(userId: string, limit: number = 100) {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // SECURITY: Buscar logs de uma ação específica
  async getActionLogs(action: string, limit: number = 100) {
    return await prisma.auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // SECURITY: Buscar logs de um recurso específico
  async getResourceLogs(resource: string, resourceId: string, limit: number = 100) {
    return await prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // SECURITY: Limpar logs antigos (executar periodicamente)
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  // SECURITY: Buscar logs com filtros avançados (para admin)
  async getLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.ipAddress) where.ipAddress = filters.ipAddress;
    if (filters.success !== undefined) where.success = filters.success;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  // Buscar ações distintas para popular filtro dinâmico
  async getDistinctActions(): Promise<string[]> {
    const result = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return result.map(r => r.action);
  }

  // SECURITY: Obter estatísticas de auditoria
  async getStats(filters?: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [total, successCount, failedCount, byAction, byResource] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: { ...where, success: true } }),
      prisma.auditLog.count({ where: { ...where, success: false } }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: true,
        orderBy: { _count: { resource: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      total,
      successCount,
      failedCount,
      successRate: total > 0 ? (successCount / total) * 100 : 0,
      byAction,
      byResource,
    };
  }
}

export const auditLogService = new AuditLogService();

// SECURITY: Constantes para ações auditadas
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: 'LOGIN', // SER-23: login definitivo (emitido no complete-login)
  LOGIN_PENDING: 'LOGIN_PENDING', // SER-23: senha validada (passo 1), aguardando finalização
  LOGIN_FAILED: 'LOGIN_FAILED', // SER-23: credencial inválida (não distingue email/senha)
  ACCOUNT_LOGIN_LOCKED: 'ACCOUNT_LOGIN_LOCKED', // SER-22: lockout automático por brute-force (conta + senha; distinto de accountFrozen que é manual/admin)
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  REFRESH_TOKEN: 'REFRESH_TOKEN',

  // KYC
  KYC_SUBMIT: 'KYC_SUBMIT',
  KYC_APPROVE: 'KYC_APPROVE',
  KYC_REJECT: 'KYC_REJECT',

  // Orders
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_MATCH: 'ORDER_MATCH',
  ORDER_CANCEL: 'ORDER_CANCEL',

  // Presence
  PRESENCE_ONLINE: 'PRESENCE_ONLINE',
  PRESENCE_OFFLINE: 'PRESENCE_OFFLINE',

  // Negotiation
  NEGOTIATION_STARTED: 'NEGOTIATION_STARTED',
  NEGOTIATION_CANCELLED: 'NEGOTIATION_CANCELLED',

  // Transactions
  TRANSACTION_SUBMIT_PROOF: 'TRANSACTION_SUBMIT_PROOF',
  TRANSACTION_VALIDATE: 'TRANSACTION_VALIDATE',
  TRANSACTION_DISPUTE: 'TRANSACTION_DISPUTE',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  CRYPTO_TRANSFER: 'CRYPTO_TRANSFER',

  // Wallets
  WALLET_CREATE: 'WALLET_CREATE',
  WALLET_DEPOSIT: 'WALLET_DEPOSIT',
  WALLET_WITHDRAWAL: 'WALLET_WITHDRAWAL',

  // CRUD Generic
  UPDATE: 'UPDATE',

  // Admin
  ADMIN_ACTION: 'ADMIN_ACTION',

  // User Management
  USER_ROLE_CHANGE: 'USER_ROLE_CHANGE',

  // Role Management
  ROLE_CREATE: 'ROLE_CREATE',
  ROLE_UPDATE: 'ROLE_UPDATE',
  ROLE_DELETE: 'ROLE_DELETE',
  ROLE_PERMISSION_ASSIGN: 'ROLE_PERMISSION_ASSIGN',
  ROLE_PERMISSION_REMOVE: 'ROLE_PERMISSION_REMOVE',
  ROLE_PERMISSION_UPDATE: 'ROLE_PERMISSION_UPDATE',

  // Support Tickets
  SUPPORT_TICKET_CREATE: 'SUPPORT_TICKET_CREATE',
  SUPPORT_TICKET_REPLY: 'SUPPORT_TICKET_REPLY',
  SUPPORT_TICKET_RESOLVE: 'SUPPORT_TICKET_RESOLVE',
  SUPPORT_TICKET_CLOSE: 'SUPPORT_TICKET_CLOSE',
} as const;

export const AUDIT_RESOURCES = {
  USER: 'USER',
  ORDER: 'ORDER',
  TRANSACTION: 'TRANSACTION',
  WALLET: 'WALLET',
  KYC: 'KYC',
  ROLE: 'ROLE',
  PERMISSION: 'PERMISSION',
  SUPPORT_TICKET: 'SUPPORT_TICKET',
} as const;
