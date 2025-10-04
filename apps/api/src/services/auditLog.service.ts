import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

export interface AuditLogInput {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
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
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
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
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    this.log({
      userId,
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
}

export const auditLogService = new AuditLogService();

// SECURITY: Constantes para ações auditadas
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: 'LOGIN',
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
  
  // Transactions
  TRANSACTION_SUBMIT_PROOF: 'TRANSACTION_SUBMIT_PROOF',
  TRANSACTION_VALIDATE: 'TRANSACTION_VALIDATE',
  TRANSACTION_DISPUTE: 'TRANSACTION_DISPUTE',
  
  // Wallets
  WALLET_CREATE: 'WALLET_CREATE',
  WALLET_DEPOSIT: 'WALLET_DEPOSIT',
  WALLET_WITHDRAWAL: 'WALLET_WITHDRAWAL',
  
  // Admin
  ADMIN_ACTION: 'ADMIN_ACTION',
} as const;

export const AUDIT_RESOURCES = {
  USER: 'USER',
  ORDER: 'ORDER',
  TRANSACTION: 'TRANSACTION',
  WALLET: 'WALLET',
  KYC: 'KYC',
} as const;
