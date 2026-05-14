import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para rotas que requerem nível SUPPORT ou superior
 * Permite: SUPPORT (40), GERENTE (60), ADMIN (80), MASTER (100)
 */
export const supportMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const userLevel = (req as any).user?.level || 0;

  if (userLevel < 40) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Você precisa de permissões de suporte ou superiores.',
      requiredLevel: 40,
      yourLevel: userLevel,
    });
  }

  next();
};
