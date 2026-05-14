import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para rotas exclusivas de MASTER
 *
 * SECURITY: Apenas usuários com role MASTER podem acessar
 * Usado para operações críticas como:
 * - Gerenciamento de roles e permissões
 * - Acesso à master seed
 * - Operações financeiras críticas
 */
export const masterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Verificar se usuário está autenticado
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      error: 'Não autenticado',
    });
  }

  // Verificar se é MASTER
  if (req.user.role !== 'MASTER') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas usuários MASTER podem executar esta ação.',
    });
  }

  next();
};
