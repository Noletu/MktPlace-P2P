import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para operações FINANCEIRAS CRÍTICAS
 * APENAS MASTER tem acesso
 * Bloqueia: ADMIN, GERENTE, SUPPORT, USER
 *
 * Este middleware garante que operações financeiras críticas como:
 * - Transferências internas entre usuários
 * - Ajuste manual de saldos
 * - Movimentação de fundos da plataforma
 *
 * Sejam executadas APENAS por usuários com role MASTER.
 *
 * IMPORTANTE: Operações protegidas por este middleware devem também:
 * - Exigir 2FA (use require2FA middleware)
 * - Ter rate limiting restritivo (use financialOperationsLimiter)
 * - Gerar audit logs detalhados
 */
export const financialOperationsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'MASTER') {
    return res.status(403).json({
      success: false,
      error: 'Operação financeira restrita. Apenas usuários MASTER podem executar esta ação.',
    });
  }

  next();
};
