import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para rotas operacionais que GERENTE pode acessar
 * Permite: GERENTE, ADMIN, MASTER
 * Bloqueia: USER, SUPPORT
 *
 * Use este middleware para operações do dia-a-dia:
 * - Gerenciar usuários (freeze/unfreeze, visualização)
 * - Gerenciar pedidos (cancelar, editar)
 * - Resolver disputas
 * - Visualizar estatísticas e audit logs
 *
 * NÃO use para operações financeiras (use financialOperationsMiddleware)
 * NÃO use para mudança de roles (use adminMiddleware)
 */
export const managerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const allowedRoles = ['GERENTE', 'ADMIN', 'MASTER'];

  if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas gerentes e administradores podem acessar este recurso.',
    });
  }

  next();
};
