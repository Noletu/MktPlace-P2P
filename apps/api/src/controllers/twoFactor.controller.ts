import { Request, Response } from 'express';
import { twoFactorService } from '../services/twoFactor.service';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';

export class TwoFactorController {
  // SECURITY: Gerar secret e QR Code para 2FA
  async generateSecret(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const email = req.user?.email;

      if (!userId || !email) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      const result = await twoFactorService.generateSecret(userId, email);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Secret gerado. Escaneie o QR Code com seu app autenticador.',
      });
    } catch (error: any) {
      console.error('[2FA] Generate secret error:', error);

      res.status(500).json({
        success: false,
        error: 'Erro ao gerar secret',
      });
    }
  }

  // SECURITY: Habilitar 2FA
  async enable(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token não fornecido',
        });
        return;
      }

      const result = await twoFactorService.enableTwoFactor(userId, token);

      // SECURITY: Audit log - 2FA habilitado
      auditLogService.logFromRequest(
        req,
        '2FA_ENABLED',
        'AUTH',
        userId,
        { email: req.user?.email }
      );

      res.status(200).json({
        success: true,
        message: '2FA habilitado com sucesso',
        data: {
          backupCodes: result.backupCodes, // IMPORTANTE: Mostrar apenas UMA VEZ
        },
      });
    } catch (error: any) {
      console.error('[2FA] Enable error:', error);

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao habilitar 2FA',
      });
    }
  }

  // SECURITY: Desabilitar 2FA
  async disable(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token não fornecido',
        });
        return;
      }

      await twoFactorService.disableTwoFactor(userId, token);

      // SECURITY: Audit log - 2FA desabilitado
      auditLogService.logFromRequest(
        req,
        '2FA_DISABLED',
        'AUTH',
        userId,
        { email: req.user?.email }
      );

      res.status(200).json({
        success: true,
        message: '2FA desabilitado com sucesso',
      });
    } catch (error: any) {
      console.error('[2FA] Disable error:', error);

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao desabilitar 2FA',
      });
    }
  }

  // SECURITY: Verificar status do 2FA
  async status(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      const isEnabled = await twoFactorService.isTwoFactorEnabled(userId);
      const backupCodesCount = await twoFactorService.getBackupCodesCount(userId);

      res.status(200).json({
        success: true,
        data: {
          enabled: isEnabled,
          backupCodesCount,
        },
      });
    } catch (error: any) {
      console.error('[2FA] Status error:', error);

      res.status(500).json({
        success: false,
        error: 'Erro ao verificar status',
      });
    }
  }

  // SECURITY: Regenerar backup codes
  async regenerateBackupCodes(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
        return;
      }

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token não fornecido',
        });
        return;
      }

      const result = await twoFactorService.regenerateBackupCodes(userId, token);

      // SECURITY: Audit log - backup codes regenerados
      auditLogService.logFromRequest(
        req,
        '2FA_BACKUP_CODES_REGENERATED',
        'AUTH',
        userId,
        { email: req.user?.email }
      );

      res.status(200).json({
        success: true,
        message: 'Backup codes regenerados com sucesso',
        data: {
          backupCodes: result.backupCodes, // IMPORTANTE: Mostrar apenas UMA VEZ
        },
      });
    } catch (error: any) {
      console.error('[2FA] Regenerate backup codes error:', error);

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao regenerar backup codes',
      });
    }
  }
}

export const twoFactorController = new TwoFactorController();
