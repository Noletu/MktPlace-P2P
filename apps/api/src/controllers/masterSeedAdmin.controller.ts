import { Request, Response } from 'express';
import { masterSeedAdminService } from '../services/masterSeedAdmin.service';
import { twoFactorService } from '../services/twoFactor.service';
import { auditLogService } from '../services/auditLog.service';

export class MasterSeedAdminController {
  /**
   * GET /admin/master-seed/status
   * Retorna status atual da master seed (sem dados sensíveis)
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await masterSeedAdminService.getStatus();

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      console.error('[MASTER SEED] Get status error:', error);

      res.status(500).json({
        success: false,
        error: 'Erro ao buscar status',
      });
    }
  }

  /**
   * POST /admin/master-seed/generate
   * Gera nova master seed (2FA validado pelo middleware)
   */
  async generateMasterSeed(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      // 2FA já foi validado pelo require2FAMiddleware
      const result = await masterSeedAdminService.generateNewSeed();

      // SECURITY: Audit log - Master seed gerada
      auditLogService.logFromRequest(
        req,
        'MASTER_SEED_CREATED',
        'MASTER_SEED',
        userId,
        { timestamp: new Date().toISOString() }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[MASTER SEED] Generate error:', error);

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao gerar master seed',
      });
    }
  }

  /**
   * POST /admin/master-seed/recover
   * Recupera seed a partir de mnemonic (2FA validado pelo middleware)
   */
  async recoverFromMnemonic(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { mnemonic } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      if (!mnemonic) {
        res.status(400).json({
          success: false,
          error: 'Mnemonic não fornecido',
        });
        return;
      }

      // 2FA já foi validado pelo require2FAMiddleware
      const result = await masterSeedAdminService.recoverFromMnemonic(mnemonic);

      // SECURITY: Audit log - Master seed recuperada
      auditLogService.logFromRequest(
        req,
        'MASTER_SEED_RECOVERED',
        'MASTER_SEED',
        userId,
        {
          walletsMatched: result.stats.walletsMatched,
          usersAffected: result.stats.usersAffected,
        }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[MASTER SEED] Recover error:', error);

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao recuperar master seed',
      });
    }
  }

  /**
   * POST /admin/master-seed/test-derivation
   * Testa derivação sem modificar nada
   */
  async testDerivation(req: Request, res: Response): Promise<void> {
    try {
      const { mnemonic } = req.body;

      const result = await masterSeedAdminService.testDerivation(mnemonic);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[MASTER SEED] Test derivation error:', error);

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao testar derivação',
      });
    }
  }

  /**
   * GET /admin/master-seed/audit-log
   * Retorna audit trail de operações com master seed (2FA validado pelo middleware)
   */
  async getAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      // 2FA já foi validado pelo require2FAMiddleware
      const logs = await masterSeedAdminService.getAuditLog();

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      console.error('[MASTER SEED] Get audit log error:', error);

      res.status(500).json({
        success: false,
        error: 'Erro ao buscar audit log',
      });
    }
  }

  /**
   * POST /admin/master-seed/rotate-key
   * Rotaciona a encryption key da master seed (2FA validado pelo middleware)
   */
  async rotateEncryptionKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      // 2FA já foi validado pelo require2FAMiddleware
      const result = await masterSeedAdminService.rotateEncryptionKey();

      // SECURITY: Audit log - Encryption key rotacionada
      auditLogService.logFromRequest(
        req,
        'MASTER_SEED_KEY_ROTATED',
        'MASTER_SEED',
        userId,
        { timestamp: new Date().toISOString() }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[MASTER SEED] Rotate encryption key error:', error);

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao rotacionar encryption key',
      });
    }
  }
}

export const masterSeedAdminController = new MasterSeedAdminController();
