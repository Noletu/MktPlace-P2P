import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { auditLogService } from '../services/auditLog.service';
import { reputationService } from '../services/reputation.service';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { platformWalletService } from '../services/platformWallet.service';
import { platformTransferService } from '../services/platform-transfer.service';

const prisma = new PrismaClient();

const CreatePlatformWalletSchema = z.object({
  cryptoType: z.string().min(1, 'Tipo de cripto é obrigatório'),
  network: z.string().min(1, 'Rede é obrigatória'),
  address: z.string().min(10, 'Endereço inválido'),
  label: z.string().optional(),
});

const UpdatePlatformWalletSchema = z.object({
  label: z.string().optional(),
  isActive: z.boolean().optional(),
});

const UpdateUserSchema = z.object({
  role: z.enum(['USER', 'GERENTE', 'SUPPORT', 'ADMIN', 'MASTER']).optional(),
});

export class AdminController {
  /**
   * ============================================
   * DASHBOARD
   * ============================================
   */

  async getDashboard(req: Request, res: Response) {
    try {
      const stats = await adminService.getDashboardStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  }

  /**
   * ============================================
   * GESTÃO DE ENDEREÇOS DA PLATAFORMA
   * ============================================
   */

  async getPlatformWallets(req: Request, res: Response) {
    try {
      const { cryptoType, network, isActive } = req.query;

      const wallets = await adminService.getPlatformWallets({
        cryptoType: cryptoType as string,
        network: network as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      res.json({
        success: true,
        data: wallets,
      });
    } catch (error: any) {
      console.error('Erro ao buscar endereços:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar endereços',
      });
    }
  }

  async getPlatformWalletById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const wallet = await adminService.getPlatformWalletById(id);

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      console.error('Erro ao buscar endereço:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Endereço não encontrado',
      });
    }
  }

  async createPlatformWallet(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const validatedData = CreatePlatformWalletSchema.parse(req.body);

      const wallet = await adminService.createPlatformWallet(validatedData, adminId);

      res.status(201).json({
        success: true,
        data: wallet,
        message: 'Endereço da plataforma criado com sucesso',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      console.error('Erro ao criar endereço:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao criar endereço',
      });
    }
  }

  async updatePlatformWallet(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { id } = req.params;
      const validatedData = UpdatePlatformWalletSchema.parse(req.body);

      const wallet = await adminService.updatePlatformWallet(id, validatedData, adminId);

      res.json({
        success: true,
        data: wallet,
        message: 'Endereço atualizado com sucesso',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      console.error('Erro ao atualizar endereço:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao atualizar endereço',
      });
    }
  }

  async deletePlatformWallet(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { id } = req.params;

      await adminService.deletePlatformWallet(id, adminId);

      res.json({
        success: true,
        message: 'Endereço removido com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao remover endereço:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao remover endereço',
      });
    }
  }

  async createAllPlatformWallets(req: Request, res: Response) {
    try {
      console.log('🏦 [ADMIN] Criando todas as carteiras da plataforma...');

      // Chamar service para criar carteiras
      // O service valida internamente se master seed existe via MasterSeedService.getMasterSeed()
      await platformWalletService.createPlatformWallets();

      // Buscar carteiras criadas
      const wallets = await platformWalletService.getAllPlatformWallets();

      // Log de auditoria
      await auditLogService.logFromRequest(
        req,
        'PLATFORM_WALLETS_CREATED',
        'PLATFORM_WALLET',
        'all',
        { count: wallets.length }
      );

      console.log(`✅ [ADMIN] ${wallets.length} carteiras da plataforma criadas com sucesso`);

      return res.json({
        success: true,
        message: `${wallets.length} carteiras da plataforma criadas com sucesso`,
        data: wallets.map(w => ({
          id: w.id,
          cryptoType: w.cryptoType,
          network: w.network,
          address: w.address,
          derivationPath: w.derivationPath,
          balance: w.balance,
          isActive: w.isActive,
        })),
      });
    } catch (error: any) {
      console.error('❌ [ADMIN] Erro ao criar carteiras da plataforma:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar carteiras da plataforma',
      });
    }
  }

  /**
   * ============================================
   * GESTÃO DE USUÁRIOS
   * ============================================
   */

  async getUsers(req: Request, res: Response) {
    try {
      const { role, search } = req.query;

      const users = await adminService.getUsers({
        role: role as string,
        search: search as string,
      });

      res.json({
        success: true,
        data: users,
      });
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar usuários',
      });
    }
  }

  /**
   * GET /api/v1/admin/users/:id/details
   * Buscar detalhes completos de um usuário (GOD MODE)
   * Inclui: info geral, saldos por crypto, transações, audit log
   */
  async getUserDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const details = await adminService.getUserDetails(id);

      res.json({
        success: true,
        data: details,
      });
    } catch (error: any) {
      console.error('Erro ao buscar detalhes do usuário:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar detalhes do usuário',
      });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { id } = req.params;
      const validatedData = UpdateUserSchema.parse(req.body);

      const user = await adminService.updateUser(id, validatedData, adminId);

      res.json({
        success: true,
        data: user,
        message: 'Usuário atualizado com sucesso',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      console.error('Erro ao atualizar usuário:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao atualizar usuário',
      });
    }
  }

  /**
   * FASE 2: Gerar relatório para autoridades
   */
  async generateAuthorityReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const filters: any = {};

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const report = await adminService.generateAuthorityReport(id, filters);

      res.json({
        success: true,
        data: report,
        message: 'Relatório gerado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao gerar relatório',
      });
    }
  }

  /**
   * ============================================
   * GESTÃO DE PEDIDOS
   * ============================================
   */

  async getOrders(req: Request, res: Response) {
    try {
      const { status, type, userId } = req.query;

      const orders = await adminService.getAllOrders({
        status: status as string,
        type: type as string,
        userId: userId as string,
      });

      res.json({
        success: true,
        data: orders,
      });
    } catch (error: any) {
      console.error('Erro ao buscar pedidos:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar pedidos',
      });
    }
  }

  async getOrdersStats(req: Request, res: Response) {
    try {
      // Buscar estatísticas de pedidos
      const totalOrders = await prisma.order.count();
      const pendingOrders = await prisma.order.count({ where: { status: 'PENDING' } });
      const matchedOrders = await prisma.order.count({ where: { status: 'MATCHED' } });
      const completedOrders = await prisma.order.count({ where: { status: 'COMPLETED' } });
      const cancelledOrders = await prisma.order.count({ where: { status: 'CANCELLED' } });

      // Calcular volume total em BRL
      const orders = await prisma.order.findMany({
        where: { status: 'COMPLETED' },
        select: { brlAmount: true },
      });
      const totalVolume = orders.reduce((sum, order) => sum + parseFloat(order.brlAmount || '0'), 0);

      res.json({
        success: true,
        data: {
          total: totalOrders,
          pending: pendingOrders,
          matched: matchedOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
          volume: totalVolume.toFixed(2),
        },
      });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas de pedidos:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas de pedidos',
      });
    }
  }

  async cancelOrder(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Motivo do cancelamento é obrigatório',
        });
      }

      const order = await adminService.cancelOrder(id, adminId, reason);

      res.json({
        success: true,
        data: order,
        message: 'Pedido cancelado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao cancelar pedido:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao cancelar pedido',
      });
    }
  }

  async editOrder(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { id } = req.params;
      const { brlAmount, cryptoAmount, status, notes } = req.body;

      // Validar que pelo menos um campo foi fornecido
      if (!brlAmount && !cryptoAmount && !status && !notes) {
        return res.status(400).json({
          success: false,
          error: 'Pelo menos um campo deve ser fornecido para edição',
        });
      }

      const updates: any = {};
      if (brlAmount) updates.brlAmount = brlAmount;
      if (cryptoAmount) updates.cryptoAmount = cryptoAmount;
      if (status) updates.status = status;
      if (notes) updates.notes = notes;

      const order = await adminService.editOrder(id, adminId, updates);

      res.json({
        success: true,
        data: order,
        message: 'Pedido editado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao editar pedido:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao editar pedido',
      });
    }
  }

  /**
   * ============================================
   * AUDIT LOG
   * ============================================
   */

  async getAuditLog(req: Request, res: Response) {
    try {
      const { adminId, resource, startDate, endDate } = req.query;

      const actions = await adminService.getAdminActions({
        adminId: adminId as string,
        resource: resource as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: actions,
      });
    } catch (error: any) {
      console.error('Erro ao buscar audit log:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar audit log',
      });
    }
  }

  /**
   * ============================================
   * AUDIT LOG COMPLETO (TODOS OS EVENTOS)
   * ============================================
   */

  // SECURITY: Buscar logs de auditoria com filtros avançados
  async getAllAuditLogs(req: Request, res: Response) {
    try {
      const {
        userId,
        action,
        resource,
        ipAddress,
        startDate,
        endDate,
        success,
        limit,
        offset,
      } = req.query;

      const result = await auditLogService.getLogs({
        userId: userId as string,
        action: action as string,
        resource: resource as string,
        ipAddress: ipAddress as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        success: success !== undefined ? success === 'true' : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: {
          logs: result.logs,
          total: result.total,
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
        },
      });
    } catch (error: any) {
      console.error('Erro ao buscar logs de auditoria:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar logs de auditoria',
      });
    }
  }

  // SECURITY: Obter estatísticas de auditoria
  async getAuditStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const stats = await auditLogService.getStats({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas de auditoria:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas de auditoria',
      });
    }
  }

  // SECURITY: Exportar logs de auditoria em formato CSV
  async exportAuditLogs(req: Request, res: Response) {
    try {
      const {
        userId,
        action,
        resource,
        startDate,
        endDate,
        success,
      } = req.query;

      const result = await auditLogService.getLogs({
        userId: userId as string,
        action: action as string,
        resource: resource as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        success: success !== undefined ? success === 'true' : undefined,
        limit: 10000, // Limite alto para exportação
      });

      // Converter para CSV
      const csv = this.logsToCSV(result.logs);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`);
      res.send(csv);
    } catch (error: any) {
      console.error('Erro ao exportar logs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao exportar logs',
      });
    }
  }

  /**
   * ============================================
   * LIMITE PERSONALIZADO + REPUTAÇÃO
   * ============================================
   */

  /**
   * POST /admin/users/:id/custom-limit
   * Define limite diario personalizado para usuario
   */
  async setCustomLimit(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({ success: false, error: 'Não autorizado' });
      }

      const { id } = req.params;

      const schema = z.object({
        customDailyLimit: z.number().min(0).nullable(),
        note: z.string().min(10, 'Nota deve ter no mínimo 10 caracteres'),
      });

      const validated = schema.parse(req.body);

      const user = await adminService.setCustomDailyLimit(id, {
        customDailyLimit: validated.customDailyLimit,
        note: validated.note,
        adminId,
      });

      // Audit log via request
      await auditLogService.logFromRequest(
        req,
        'SET_CUSTOM_LIMIT',
        'USER',
        id,
        {
          customDailyLimit: validated.customDailyLimit,
          note: validated.note,
        }
      );

      res.json({
        success: true,
        data: user,
        message: validated.customDailyLimit !== null
          ? `Limite personalizado de R$ ${validated.customDailyLimit.toLocaleString('pt-BR')} definido`
          : 'Limite resetado para fórmula automática',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
      }
      console.error('Erro ao definir limite personalizado:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao definir limite personalizado',
      });
    }
  }

  /**
   * POST /admin/users/:id/recalculate-reputation
   * Força recálculo da reputação composta
   */
  async recalculateReputation(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({ success: false, error: 'Não autorizado' });
      }

      const { id } = req.params;

      const newScore = await reputationService.recalculateAndSave(id);

      // Audit log
      await auditLogService.logFromRequest(
        req,
        'RECALCULATE_REPUTATION',
        'USER',
        id,
        { newScore }
      );

      res.json({
        success: true,
        data: { reputationScore: newScore },
        message: `Reputação recalculada: ${newScore}/100`,
      });
    } catch (error: any) {
      console.error('Erro ao recalcular reputação:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao recalcular reputação',
      });
    }
  }

  /**
   * GET /admin/users/:id/reputation-breakdown
   * Retorna breakdown detalhado da reputação composta
   */
  async getReputationBreakdown(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const breakdown = await reputationService.calculateCompositeScore(id);

      res.json({
        success: true,
        data: breakdown,
      });
    } catch (error: any) {
      console.error('Erro ao buscar breakdown de reputação:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao buscar breakdown de reputação',
      });
    }
  }

  /**
   * ============================================
   * TRANSFERÊNCIAS DE PLATFORM WALLETS
   * ============================================
   */

  /**
   * GET /admin/platform-wallets/:id/transfers
   * Histórico de transferências de uma platform wallet
   */
  async getPlatformWalletTransfers(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const transfers = await platformTransferService.getTransfers(id);

      res.json({
        success: true,
        data: transfers,
      });
    } catch (error: any) {
      console.error('Erro ao buscar transferências:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar transferências',
      });
    }
  }

  /**
   * GET /admin/platform-wallets/:id/movements
   * Histórico completo de movimentações de uma platform wallet
   */
  async getPlatformWalletMovements(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const movements = await platformWalletService.getMovements(id, limit);

      res.json({
        success: true,
        data: movements,
      });
    } catch (error: any) {
      console.error('Erro ao buscar movimentações:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar movimentações',
      });
    }
  }

  /**
   * GET /admin/platform-wallets/:id/transfer-estimate?amount=X&toAddress=Y
   * Estimativa de fee para transferência
   */
  async getPlatformWalletTransferEstimate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { amount, toAddress } = req.query;

      if (!amount || !toAddress) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros "amount" e "toAddress" são obrigatórios',
        });
      }

      const estimate = await platformTransferService.getTransferEstimate(
        id,
        amount as string,
        toAddress as string
      );

      res.json({
        success: true,
        data: estimate,
      });
    } catch (error: any) {
      console.error('Erro ao estimar transferência:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao estimar transferência',
      });
    }
  }

  /**
   * POST /admin/platform-wallets/:id/transfer
   * Solicitar transferência (requer 2FA)
   */
  async requestPlatformWalletTransfer(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { id } = req.params;
      const { toAddress, amount, twoFactorCode, note } = req.body;

      if (!toAddress || !amount || !twoFactorCode) {
        return res.status(400).json({
          success: false,
          error: 'Campos obrigatórios: toAddress, amount, twoFactorCode',
        });
      }

      const transfer = await platformTransferService.requestTransfer({
        platformWalletId: id,
        toAddress,
        amount,
        adminId,
        twoFactorCode,
        note,
      });

      // Audit log via request (inclui IP e user-agent)
      auditLogService.logFromRequest(
        req,
        'PLATFORM_TRANSFER_REQUESTED',
        'PLATFORM_TRANSFER',
        transfer.id,
        {
          walletId: id,
          amount,
          toAddress,
          status: transfer.status,
          txHash: transfer.txHash,
        }
      );

      res.json({
        success: true,
        data: transfer,
        message: transfer.status === 'COMPLETED'
          ? 'Transferência realizada com sucesso'
          : 'Transferência criada',
      });
    } catch (error: any) {
      console.error('Erro ao solicitar transferência:', error);

      // Audit log de falha
      const adminId = req.user?.userId;
      if (adminId) {
        auditLogService.logFromRequest(
          req,
          'PLATFORM_TRANSFER_REQUESTED',
          'PLATFORM_TRANSFER',
          undefined,
          {
            walletId: req.params.id,
            amount: req.body?.amount,
            toAddress: req.body?.toAddress,
            error: error.message,
          },
          false,
          error.message
        );
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao solicitar transferência',
      });
    }
  }

  /**
   * ============================================
   * ADMIN: RESETAR SENHA DE USUARIO
   * ============================================
   */

  /**
   * POST /admin/users/:id/reset-password
   * Admin reseta a senha de um usuario (gera link de reset + envia email)
   */
  async adminResetUserPassword(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Nao autorizado',
        });
      }

      const { id } = req.params;
      const { disable2FA } = req.body;

      const result = await adminService.adminResetUserPassword(adminId, id, {
        disable2FA: disable2FA === true,
      });

      // Audit log via request (inclui IP e user-agent)
      await auditLogService.logFromRequest(
        req,
        'ADMIN_RESET_PASSWORD',
        'USER',
        id,
        { disable2FA: disable2FA === true }
      );

      res.json({
        success: true,
        data: {
          resetLink: result.resetLink,
          emailSent: true,
        },
        message: 'Link de reset enviado por email ao usuario',
      });
    } catch (error: any) {
      console.error('Erro ao resetar senha do usuario:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao resetar senha do usuario',
      });
    }
  }

  // Helper para converter logs em CSV
  private logsToCSV(logs: any[]): string {
    if (logs.length === 0) return 'No data';

    const headers = ['ID', 'Data/Hora', 'Usuário', 'Email', 'Role', 'Ação', 'Recurso', 'Recurso ID', 'IP', 'Sucesso', 'Erro'];
    const rows = logs.map(log => [
      log.id,
      new Date(log.createdAt).toISOString(),
      log.userId || '',
      log.email || '',
      log.role || '',
      log.action,
      log.resource,
      log.resourceId || '',
      log.ipAddress || '',
      log.success ? 'Sim' : 'Não',
      log.errorMessage || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

}

export const adminController = new AdminController();
