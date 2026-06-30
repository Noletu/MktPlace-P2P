import { Request, Response, NextFunction } from 'express';

/**
 * Middleware admin: exige role ADMIN, SUPPORT ou MASTER.
 *
 * FIX: anteriormente buscava o objeto Role no banco (select: { role: true })
 * e o comparava com strings ('ADMIN' etc.) — comparacao objeto-vs-string que
 * sempre falhava, bloqueando todos (403). Agora le req.user.role, a STRING ja
 * resolvida e injetada pelo authMiddleware (role.slug.toUpperCase() ou legacyRole),
 * consistente com o adminMiddleware de auth.middleware.ts.
 *
 * Pre-requisito: authMiddleware deve rodar ANTES (popula req.user).
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Não autenticado' });
    return;
  }

  const role = req.user.role;
  if (role !== 'ADMIN' && role !== 'SUPPORT' && role !== 'MASTER') {
    res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas administradores podem acessar esta funcionalidade.',
    });
    return;
  }

  next();
};
