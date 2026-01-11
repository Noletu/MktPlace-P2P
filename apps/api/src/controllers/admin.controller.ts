import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { auditLogService } from '../services/auditLog.service';
import { kycService } from '../services/kyc.service';
import { KYCLevel } from '../types/kyc.types';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { platformWalletService } from '../services/platformWallet.service';

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
  kycLevel: z.string().optional(),
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
      const { kycLevel, role, search } = req.query;

      const users = await adminService.getUsers({
        kycLevel: kycLevel as string,
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
      const { amount, cryptoAmount, status, expiresAt, notes } = req.body;

      // Validar que pelo menos um campo foi fornecido
      if (!amount && !cryptoAmount && !status && !expiresAt && !notes) {
        return res.status(400).json({
          success: false,
          error: 'Pelo menos um campo deve ser fornecido para edição',
        });
      }

      const updates: any = {};
      if (amount) updates.amount = amount;
      if (cryptoAmount) updates.cryptoAmount = cryptoAmount;
      if (status) updates.status = status;
      if (expiresAt) updates.expiresAt = new Date(expiresAt);
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

  /**
   * ============================================
   * GESTÃO DE KYC
   * ============================================
   */

  async listPendingKYC(req: Request, res: Response) {
    try {
      const { level, status } = req.query;

      const filters: any = {};
      if (level) filters.level = level as string;
      if (status) filters.status = status as string;
      else filters.status = 'PENDING'; // Default: apenas pendentes

      const verifications = await prisma.kYCVerification.findMany({
        where: filters,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: verifications,
        count: verifications.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar verificações KYC',
      });
    }
  }

  async getKYCVerification(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const verification = await prisma.kYCVerification.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              kycLevel: true,
              createdAt: true,
              reputationScore: true,
              totalTransactions: true,
            },
          },
        },
      });

      if (!verification) {
        return res.status(404).json({
          success: false,
          error: 'Verificação KYC não encontrada',
        });
      }

      res.json({
        success: true,
        data: verification,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar verificação KYC',
      });
    }
  }

  async approveKYC(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { userId } = req.params;
      const { level } = req.body;

      if (!level || !Object.values(KYCLevel).includes(level)) {
        return res.status(400).json({
          success: false,
          error: 'Nível de KYC inválido',
        });
      }

      await kycService.approveKYC(userId, level as KYCLevel, adminId);

      // Registrar ação no audit log
      await prisma.adminAction.create({
        data: {
          adminId,
          action: 'APPROVE',
          resource: 'KYC',
          resourceId: userId,
          metadata: JSON.stringify({ level }),
        },
      });

      res.json({
        success: true,
        message: `KYC ${level} aprovado com sucesso`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao aprovar KYC',
      });
    }
  }

  async rejectKYC(req: Request, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { userId } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Motivo da rejeição deve ter no mínimo 10 caracteres',
        });
      }

      await kycService.rejectKYC(userId, reason, adminId);

      // Registrar ação no audit log
      await prisma.adminAction.create({
        data: {
          adminId,
          action: 'REJECT',
          resource: 'KYC',
          resourceId: userId,
          metadata: JSON.stringify({ reason }),
        },
      });

      res.json({
        success: true,
        message: 'KYC rejeitado com sucesso',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao rejeitar KYC',
      });
    }
  }

  async getKYCStats(req: Request, res: Response) {
    try {
      const [pending, approved, rejected, byLevel] = await Promise.all([
        prisma.kYCVerification.count({ where: { status: 'PENDING' } }),
        prisma.kYCVerification.count({ where: { status: 'APPROVED' } }),
        prisma.kYCVerification.count({ where: { status: 'REJECTED' } }),
        prisma.kYCVerification.groupBy({
          by: ['level', 'status'],
          _count: true,
        }),
      ]);

      res.json({
        success: true,
        data: {
          total: pending + approved + rejected,
          pending,
          approved,
          rejected,
          byLevel,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  }
}

export const adminController = new AdminController();
