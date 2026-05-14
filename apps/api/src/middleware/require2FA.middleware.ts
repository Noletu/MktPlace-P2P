import { Request, Response, NextFunction } from 'express';
import { twoFactorService } from '../services/twoFactor.service';

/**
 * Middleware que EXIGE 2FA para operações críticas
 *
 * SECURITY: Este middleware verifica se:
 * 1. Usuário está autenticado (req.user existe)
 * 2. 2FA está habilitado para o usuário
 * 3. twoFactorCode foi fornecido no body
 * 4. twoFactorCode é válido
 *
 * Se qualquer verificação falhar, bloqueia a requisição.
 */
export const require2FAMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { twoFactorCode } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
      return;
    }

    // DEV BYPASS: SKIP_2FA=true no .env desativa 2FA em ambiente não-produção
    if (process.env.SKIP_2FA === 'true' && process.env.NODE_ENV !== 'production') {
      console.warn('[2FA Middleware] ⚠️  SKIP_2FA ativo — bypass de 2FA em DEV');
      next();
      return;
    }

    // Verificar se 2FA está habilitado
    const is2FAEnabled = await twoFactorService.isTwoFactorEnabled(userId);

    if (!is2FAEnabled) {
      res.status(403).json({
        success: false,
        error: '2FA_NOT_ENABLED',
        message: '2FA não está configurado. Configure 2FA antes de executar esta operação.',
        redirectTo: '/2fa/setup',
      });
      return;
    }

    // Verificar se código 2FA foi fornecido
    if (!twoFactorCode) {
      res.status(400).json({
        success: false,
        error: '2FA_CODE_REQUIRED',
        message: 'Código 2FA é obrigatório para esta operação',
      });
      return;
    }

    // Validar código 2FA
    const isValid = await twoFactorService.verifyToken(userId, twoFactorCode);

    if (!isValid) {
      res.status(400).json({
        success: false,
        error: '2FA_CODE_INVALID',
        message: 'Código 2FA inválido',
      });
      return;
    }

    // 2FA validado com sucesso
    next();
  } catch (error: any) {
    console.error('[2FA Middleware] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao validar 2FA',
    });
    return;
  }
};
