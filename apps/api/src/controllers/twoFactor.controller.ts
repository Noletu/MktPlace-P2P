import { Request, Response } from 'express';
import { twoFactorService } from '../services/twoFactor.service';

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

      await twoFactorService.enableTwoFactor(userId, token);

      res.status(200).json({
        success: true,
        message: '2FA habilitado com sucesso',
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

      res.status(200).json({
        success: true,
        data: {
          enabled: isEnabled,
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
}

export const twoFactorController = new TwoFactorController();
