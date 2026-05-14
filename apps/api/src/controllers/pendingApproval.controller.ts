import { Request, Response } from 'express';
import { PendingApprovalService } from '../services/pendingApproval.service';

export class PendingApprovalController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status, operationType, tab, page, pageSize } = req.query;
      const userId = req.user!.userId;

      let filters: Parameters<typeof PendingApprovalService.list>[0] = {
        page:     page     ? parseInt(String(page))     : 1,
        pageSize: pageSize ? parseInt(String(pageSize)) : 20,
      };

      // tab=mine: operações que eu iniciei
      // tab=pending: operações aguardando MINHA aprovação (não fui eu que iniciei)
      // tab=history: tudo exceto PENDING_APPROVAL e OVERRIDE_PENDING
      if (tab === 'mine') {
        filters.initiatorId = userId;
      } else if (tab === 'pending') {
        filters.status = ['PENDING_APPROVAL', 'OVERRIDE_PENDING'];
        filters.excludeInitiatorId = userId;
      } else if (tab === 'history') {
        filters.status = ['APPROVED', 'REJECTED', 'EXPIRED', 'OVERRIDE_EXECUTED', 'OVERRIDE_CANCELLED', 'EXECUTION_FAILED'];
      }

      if (status) filters.status = String(status);
      if (operationType) filters.operationType = String(operationType);

      const result = await PendingApprovalService.list(filters);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getOne(req: Request, res: Response): Promise<void> {
    try {
      const approval = await PendingApprovalService.getById(req.params.id);
      if (!approval) {
        res.status(404).json({ success: false, error: 'Aprovação não encontrada.' });
        return;
      }
      res.json({ success: true, data: approval });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async approve(req: Request, res: Response): Promise<void> {
    try {
      const { approverNote } = req.body;
      const result = await PendingApprovalService.approve({
        approvalId:   req.params.id,
        approverId:   req.user!.userId,
        approverNote: approverNote ?? undefined,
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  async reject(req: Request, res: Response): Promise<void> {
    try {
      const { approverNote } = req.body;
      const approval = await PendingApprovalService.reject({
        approvalId:   req.params.id,
        approverId:   req.user!.userId,
        approverNote: approverNote ?? undefined,
      });
      res.json({ success: true, data: approval });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  async requestEmergencyOverride(req: Request, res: Response): Promise<void> {
    try {
      const { justification, twoFactorCode } = req.body;
      if (!justification || !twoFactorCode) {
        res.status(400).json({ success: false, error: 'Justificativa e código 2FA são obrigatórios.' });
        return;
      }
      const approval = await PendingApprovalService.requestEmergencyOverride({
        approvalId:    req.params.id,
        initiatorId:   req.user!.userId,
        justification: String(justification),
        twoFactorCode: String(twoFactorCode),
      });
      res.json({ success: true, data: approval });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  async cancelViaUI(req: Request, res: Response): Promise<void> {
    try {
      const approval = await PendingApprovalService.cancelEmergencyOverride({
        approvalId:    req.params.id,
        cancelledById: req.user!.userId,
      });
      res.json({ success: true, data: approval });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  async cancelByInitiator(req: Request, res: Response): Promise<void> {
    try {
      const approval = await PendingApprovalService.cancelByInitiator({
        approvalId:  req.params.id,
        initiatorId: req.user!.userId,
      });
      res.json({ success: true, data: approval });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  // Endpoint PÚBLICO — não requer autenticação, usa token do query string
  async cancelViaToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        res.status(400).json({ success: false, error: 'Token de cancelamento inválido.' });
        return;
      }
      const approval = await PendingApprovalService.cancelEmergencyOverride({
        cancelToken: token,
      });
      res.json({ success: true, message: 'Override cancelado com sucesso.', data: { status: approval.status } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // Retorna contagem de aprovações aguardando o usuário logado
  async getPendingCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await PendingApprovalService.list({
        status: ['PENDING_APPROVAL', 'OVERRIDE_PENDING'],
        excludeInitiatorId: userId,
        pageSize: 1,
      });
      res.json({ success: true, data: { count: result.total } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export const pendingApprovalController = new PendingApprovalController();
