import { Request, Response } from 'express';
import { MasterDelegationService } from '../services/masterDelegation.service';
import { prisma } from '../utils/prisma';

export class MasterDelegationController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { activeOnly, granteeId, grantorId } = req.query;
      const delegations = await MasterDelegationService.list({
        activeOnly: activeOnly === 'true',
        granteeId:  granteeId ? String(granteeId) : undefined,
        grantorId:  grantorId ? String(grantorId) : undefined,
      });
      res.json({ success: true, data: delegations });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { granteeId, operationScope, reason, expiryHours } = req.body;

      if (!granteeId || !reason || !expiryHours) {
        res.status(400).json({
          success: false,
          error: 'granteeId, reason e expiryHours são obrigatórios.',
        });
        return;
      }

      const delegation = await MasterDelegationService.create({
        grantorId:      req.user!.userId,
        granteeId:      String(granteeId),
        operationScope: Array.isArray(operationScope) ? operationScope.map(String) : [],
        reason:         String(reason),
        expiryHours:    parseInt(String(expiryHours)),
      });
      res.status(201).json({ success: true, data: delegation });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async revoke(req: Request, res: Response): Promise<void> {
    try {
      const { revokeReason } = req.body;
      if (!revokeReason) {
        res.status(400).json({ success: false, error: 'revokeReason é obrigatório.' });
        return;
      }
      const delegation = await MasterDelegationService.revoke({
        delegationId: req.params.id,
        revokedById:  req.user!.userId,
        revokeReason: String(revokeReason),
      });
      res.json({ success: true, data: delegation });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // Permite que um delegado veja sua própria delegação ativa
  async myDelegation(req: Request, res: Response): Promise<void> {
    try {
      const delegations = await MasterDelegationService.list({
        granteeId:  req.user!.userId,
        activeOnly: true,
      });
      res.json({ success: true, data: delegations[0] ?? null });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Lista usuários elegíveis para receber delegação (GERENTE ou ADMIN, nível 60-80)
  async getEligibleGrantees(req: Request, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        where: {
          role: { level: { gte: 60, lt: 100 } },
        },
        select: { id: true, name: true, email: true, role: { select: { slug: true, level: true, name: true } } },
        orderBy: [{ role: { level: 'desc' } }, { name: 'asc' }],
      });
      res.json({ success: true, data: users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export const masterDelegationController = new MasterDelegationController();
