import { Request, Response } from 'express';
import { AdminFundsService } from '../services/adminFunds.service';
import { LockCategory } from '../types/adminLock.types';
import { prisma } from '../utils/prisma';

/**
 * Admin Funds Controller
 *
 * Endpoints para controle administrativo total de fundos e carteiras
 */
export class AdminFundsController {
  /**
   * GET /api/v1/admin/funds/dashboard
   * Dashboard completo de fundos em custódia
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const result = await AdminFundsService.getDashboard();
      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getDashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dashboard',
        message: (error as Error).message,
      });
    }
  }

  /**
   * FASE 5/7: GET /api/v1/admin/funds/partners
   * Visão dos Sócios (Platform Wallets - Account 0)
   */
  async getPartnersFunds(req: Request, res: Response): Promise<void> {
    try {
      const result = await AdminFundsService.getPartnersFunds();
      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getPartnersFunds error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar fundos dos sócios',
        message: (error as Error).message,
      });
    }
  }

  /**
   * FASE 5/7: GET /api/v1/admin/funds/users-funds
   * Visão dos Usuários (User Wallets - Account >= 1)
   */
  async getUsersFunds(req: Request, res: Response): Promise<void> {
    try {
      const result = await AdminFundsService.getUsersFunds();
      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getUsersFunds error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar fundos dos usuários',
        message: (error as Error).message,
      });
    }
  }

  /**
   * FASE 5/7: GET /api/v1/admin/funds/total
   * Visão Total (Sócios + Usuários)
   */
  async getTotalFunds(req: Request, res: Response): Promise<void> {
    try {
      const result = await AdminFundsService.getTotalFunds();
      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getTotalFunds error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar fundos totais',
        message: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/admin/funds/users/:userId/wallets
   * Buscar todas as carteiras de um usuário
   */
  async getUserWallets(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // IDOR: verificar se o solicitante tem nível suficiente para ver este usuário
      const requesterLevel = req.user?.level ?? 0;
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: { select: { level: true } } },
      });

      if (!targetUser) {
        res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        return;
      }

      const targetLevel = targetUser.role?.level ?? 0;
      if (requesterLevel <= targetLevel) {
        res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Você não tem permissão para visualizar carteiras deste usuário',
        });
        return;
      }

      const result = await AdminFundsService.getUserWallets(userId);
      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getUserWallets error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar carteiras do usuário',
        message: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/admin/funds/users/search?email=xxx
   * Buscar wallets de um usuário por email
   */
  async searchUserWallets(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ success: false, error: 'email é obrigatório' });
        return;
      }
      const result = await AdminFundsService.searchUserWalletsByEmail(email);
      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] searchUserWallets error:', error);
      res.status(400).json({
        success: false,
        error: 'Erro ao buscar carteiras',
        message: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/admin/funds/wallets/:walletId
   * Buscar detalhes de uma wallet por ID (lookup)
   */
  async getWalletById(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const result = await AdminFundsService.getWalletById(walletId);
      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getWalletById error:', error);
      res.status(400).json({
        success: false,
        error: 'Erro ao buscar carteira',
        message: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v1/admin/funds/freeze
   * Congelar conta de usuário
   *
   * Body: { userId, reason, duration? }
   * duration (opcional): Tempo em horas para freeze temporário (auto-desbloqueio)
   * Se duration não fornecida: freeze permanente (requer desbloqueio manual)
   * Requires: GERENTE, ADMIN or MASTER role
   */
  async freezeAccount(req: Request, res: Response): Promise<void> {
    try {
      const { userId, reason, duration } = req.body;
      const adminUserId = (req as any).user.userId;

      if (!userId || !reason) {
        res.status(400).json({
          success: false,
          error: 'userId e reason são obrigatórios',
        });
        return;
      }

      // Validar duration se fornecida
      if (duration !== undefined) {
        const durationNum = Number(duration);
        if (isNaN(durationNum) || durationNum <= 0) {
          res.status(400).json({
            success: false,
            error: 'duration deve ser um número positivo (horas)',
          });
          return;
        }
      }

      const result = await AdminFundsService.freezeAccount({
        userId,
        reason,
        adminUserId,
        duration: duration ? Number(duration) : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] freezeAccount error:', error);
      res.status(400).json({
        success: false,
        error: 'Erro ao congelar conta',
        message: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v1/admin/funds/unfreeze
   * Descongelar conta de usuário
   *
   * Body: { userId }
   * Requires: MASTER or ADMIN role
   */
  async unfreezeAccount(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;
      const adminUserId = (req as any).user.userId;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId é obrigatório',
        });
        return;
      }

      const result = await AdminFundsService.unfreezeAccount({
        userId,
        adminUserId,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] unfreezeAccount error:', error);
      res.status(400).json({
        success: false,
        error: 'Erro ao descongelar conta',
        message: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v1/admin/funds/internal-transfer
   * Transferir fundos entre carteiras (sem blockchain)
   *
   * Body: { fromWalletId, toWalletId, amount, reason }
   * Requires: MASTER role (operação crítica)
   */
  async internalTransfer(req: Request, res: Response): Promise<void> {
    try {
      const { fromWalletId, toWalletId, amount, reason } = req.body;
      const adminUserId = (req as any).user.userId;

      if (!fromWalletId || !toWalletId || !amount || !reason) {
        res.status(400).json({
          success: false,
          error: 'fromWalletId, toWalletId, amount e reason são obrigatórios',
        });
        return;
      }

      const result = await AdminFundsService.internalTransfer({
        fromWalletId,
        toWalletId,
        amount,
        reason,
        adminUserId,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] internalTransfer error:', error);
      res.status(400).json({
        success: false,
        error: 'Erro ao transferir fundos',
        message: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v1/admin/funds/adjust-balance
   * Ajustar saldo de carteira manualmente
   *
   * Body: { walletId, adjustment, reason }
   * Requires: MASTER role (operação crítica)
   */
  async adjustBalance(req: Request, res: Response): Promise<void> {
    try {
      const { walletId, adjustment, reason } = req.body;
      const adminUserId = (req as any).user.userId;

      if (!walletId || !adjustment || !reason) {
        res.status(400).json({
          success: false,
          error: 'walletId, adjustment e reason são obrigatórios',
        });
        return;
      }

      const result = await AdminFundsService.adjustBalance({
        walletId,
        adjustment,
        reason,
        adminUserId,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] adjustBalance error:', error);
      res.status(400).json({
        success: false,
        error: 'Erro ao ajustar saldo',
        message: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/admin/funds/audit-log
   * Buscar log de auditoria de operações administrativas
   *
   * Query params: startDate, endDate, adminUserId, action, limit, offset
   */
  async getAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        adminUserId,
        action,
        limit,
        offset,
      } = req.query;

      const result = await AdminFundsService.getAdminAuditLog({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        adminUserId: adminUserId as string,
        action: action as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getAuditLog error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar log de auditoria',
        message: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/admin/funds/wallets/:walletId/transactions
   * Buscar histórico de transações de uma carteira
   */
  async getWalletTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { limit } = req.query;

      const result = await AdminFundsService.getWalletTransactionHistory(
        walletId,
        limit ? parseInt(limit as string) : undefined
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getWalletTransactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar transações',
        message: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/admin/funds/locked-balances
   * Listar carteiras com saldo bloqueado
   *
   * Query params: cryptoType, network, userId, minAmount
   * Requires: GERENTE+ role
   */
  async getLockedBalances(req: Request, res: Response): Promise<void> {
    try {
      const { cryptoType, network, userId, minAmount } = req.query;

      const result = await AdminFundsService.getLockedBalances({
        cryptoType: cryptoType as string,
        network: network as string,
        userId: userId as string,
        minAmount: minAmount as string,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] getLockedBalances error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar saldos bloqueados',
        message: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v1/admin/funds/lock-balance
   * Bloquear saldo manualmente
   *
   * Body: { walletId, amount, category, reason }
   * Requires: MASTER role + 2FA
   */
  async lockBalance(req: Request, res: Response): Promise<void> {
    try {
      const { walletId, amount, category, reason } = req.body;
      const adminUserId = (req as any).user.userId;

      // Validar campos obrigatórios
      if (!walletId || !amount || !category || !reason) {
        res.status(400).json({
          success: false,
          error: 'walletId, amount, category e reason são obrigatórios',
        });
        return;
      }

      // Validar category
      if (!Object.values(LockCategory).includes(category)) {
        res.status(400).json({
          success: false,
          error: `Categoria inválida. Valores válidos: ${Object.values(LockCategory).join(', ')}`,
        });
        return;
      }

      const result = await AdminFundsService.adminLockBalance({
        walletId,
        amount,
        category,
        reason,
        adminUserId,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] lockBalance error:', error);
      res.status(400).json({
        success: false,
        error: 'Erro ao bloquear saldo',
        message: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v1/admin/funds/unlock-balance
   * Desbloquear saldo manualmente
   *
   * Body: { walletId, amount, category, reason }
   * Requires: MASTER role + 2FA
   */
  async unlockBalance(req: Request, res: Response): Promise<void> {
    try {
      const { walletId, amount, category, reason } = req.body;
      const adminUserId = (req as any).user.userId;

      // Validar campos obrigatórios
      if (!walletId || !amount || !category || !reason) {
        res.status(400).json({
          success: false,
          error: 'walletId, amount, category e reason são obrigatórios',
        });
        return;
      }

      // Validar category
      if (!Object.values(LockCategory).includes(category)) {
        res.status(400).json({
          success: false,
          error: `Categoria inválida. Valores válidos: ${Object.values(LockCategory).join(', ')}`,
        });
        return;
      }

      const result = await AdminFundsService.adminUnlockBalance({
        walletId,
        amount,
        category,
        reason,
        adminUserId,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] unlockBalance error:', error);
      res.status(400).json({
        success: false,
        error: 'Erro ao desbloquear saldo',
        message: (error as Error).message,
      });
    }
  }
  /**
   * POST /api/v1/admin/funds/platform-refund
   * Reembolsar fundos da PlatformWallet para um UserWallet
   *
   * Body: { cryptoType, network, toWalletId, amount, reason }
   * Requires: MASTER role + 2FA (operação crítica)
   */
  async platformRefund(req: Request, res: Response): Promise<void> {
    try {
      const { cryptoType, network, toWalletId, amount, reason, direction } = req.body;
      const adminUserId = (req as any).user.userId;

      if (!cryptoType || !network || !toWalletId || !amount || !reason) {
        res.status(400).json({
          success: false,
          error: 'cryptoType, network, toWalletId, amount e reason são obrigatórios',
        });
        return;
      }

      // Validar direction se fornecida
      if (direction && direction !== 'TO_USER' && direction !== 'FROM_USER') {
        res.status(400).json({
          success: false,
          error: 'direction deve ser TO_USER ou FROM_USER',
        });
        return;
      }

      const result = await AdminFundsService.platformRefund({
        cryptoType,
        network,
        toWalletId,
        amount,
        reason,
        adminUserId,
        direction,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminFundsController] platformRefund error:', error);
      res.status(400).json({
        success: false,
        error: req.body?.direction === 'FROM_USER' ? 'Erro ao cobrar do usuário' : 'Erro ao reembolsar da plataforma',
        message: (error as Error).message,
      });
    }
  }
}

export const adminFundsController = new AdminFundsController();
