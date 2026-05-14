import { Request, Response } from 'express';
import { couponService } from '../services/coupon.service';
import { CreateCouponSchema, UpdateCouponSchema, ActivateCouponSchema } from '../validators/coupon.validator';
import { auditLogService } from '../services/auditLog.service';

export class CouponController {
  /**
   * ADMIN: Criar cupom
   */
  async createCoupon(req: Request, res: Response) {
    try {
      const validation = CreateCouponSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
      }

      const userId = req.user?.userId;

      const coupon = await couponService.createCoupon({
        ...validation.data,
        createdBy: userId!,
      });

      // Audit log
      auditLogService.logFromRequest(req, 'CREATE_COUPON', 'COUPON', coupon.id, {
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
      });

      res.status(201).json({
        success: true,
        data: coupon,
      });
    } catch (error: any) {
      console.error('Erro ao criar cupom:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao criar cupom',
      });
    }
  }

  /**
   * ADMIN: Listar cupons
   */
  async listCoupons(req: Request, res: Response) {
    try {
      const { isActive, isPublic, search } = req.query;

      const filters = {
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
        search: search as string,
      };

      const coupons = await couponService.listCoupons(filters);

      res.json({
        success: true,
        data: coupons,
      });
    } catch (error: any) {
      console.error('Erro ao listar cupons:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar cupons',
      });
    }
  }

  /**
   * ADMIN: Obter cupom por ID
   */
  async getCouponById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const coupon = await couponService.getCouponById(id);

      res.json({
        success: true,
        data: coupon,
      });
    } catch (error: any) {
      console.error('Erro ao obter cupom:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Cupom não encontrado',
      });
    }
  }

  /**
   * ADMIN: Atualizar cupom
   */
  async updateCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const validation = UpdateCouponSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
      }

      const coupon = await couponService.updateCoupon(id, validation.data);

      // Audit log
      await auditLogService.log({
        userId: userId!,
        action: 'UPDATE_COUPON',
        resource: 'COUPON',
        resourceId: coupon.id,
        description: `Atualizou cupom ${coupon.code}`,
        metadata: JSON.stringify(validation.data),
      });

      res.json({
        success: true,
        data: coupon,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar cupom:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao atualizar cupom',
      });
    }
  }

  /**
   * ADMIN: Deletar cupom
   */
  async deleteCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await couponService.deleteCoupon(id);

      // Audit log
      auditLogService.logFromRequest(req, 'DELETE_COUPON', 'COUPON', id);

      res.json({
        success: true,
        message: 'Cupom deletado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao deletar cupom:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao deletar cupom',
      });
    }
  }

  /**
   * ADMIN: Estatísticas de cupons
   */
  async getCouponStats(req: Request, res: Response) {
    try {
      const stats = await couponService.getCouponStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Erro ao obter estatísticas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter estatísticas',
      });
    }
  }

  /**
   * USER: Listar cupons públicos
   */
  async getPublicCoupons(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      const coupons = await couponService.getPublicCoupons(userId!);

      res.json({
        success: true,
        data: coupons,
      });
    } catch (error: any) {
      console.error('Erro ao obter cupons públicos:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter cupons públicos',
      });
    }
  }

  /**
   * USER: Ativar cupom
   */
  async activateCoupon(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      const validation = ActivateCouponSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
      }

      const activated = await couponService.activateCoupon(userId!, validation.data.code);

      res.json({
        success: true,
        data: activated,
        message: `Cupom ${activated.coupon.code} ativado com sucesso!`,
      });
    } catch (error: any) {
      console.error('Erro ao ativar cupom:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao ativar cupom',
      });
    }
  }

  /**
   * USER: Desativar cupom ativo
   */
  async deactivateCoupon(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      await couponService.deactivateCoupon(userId!);

      res.json({
        success: true,
        message: 'Cupom desativado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao desativar cupom:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao desativar cupom',
      });
    }
  }

  /**
   * USER: Obter cupom ativo
   */
  async getActiveCoupon(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      const activeCoupon = await couponService.getActiveCoupon(userId!);

      res.json({
        success: true,
        data: activeCoupon,
      });
    } catch (error: any) {
      console.error('Erro ao obter cupom ativo:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter cupom ativo',
      });
    }
  }
}

export const couponController = new CouponController();
