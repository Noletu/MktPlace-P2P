import { Request, Response, NextFunction } from 'express';
import { roleService } from '../services/role.service';

/**
 * Middleware dinâmico de permissões (RBAC)
 *
 * IMPORTANTE:
 * - Requer authMiddleware antes para ter req.user disponível
 * - Verifica se o usuário tem a permissão específica
 * - Cache de permissões para performance (evita query no DB a cada request)
 *
 * Uso:
 * router.get('/users', authMiddleware, requirePermission('users.view'), controller.listUsers);
 * router.post('/users/:id', authMiddleware, requirePermission('users.edit'), controller.updateUser);
 */

// Cache de permissões por usuário (TTL: 5 minutos)
interface PermissionCacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

const permissionCache = new Map<string, PermissionCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Limpar cache expirado periodicamente (a cada 10 minutos)
 */
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of permissionCache.entries()) {
    if (entry.expiresAt < now) {
      permissionCache.delete(userId);
    }
  }
}, 10 * 60 * 1000);

/**
 * Obter permissões do usuário (com cache)
 */
async function getUserPermissions(userId: string): Promise<Set<string>> {
  // Verificar cache
  const cached = permissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  // Buscar permissões no banco (via roleService)
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();

    if (user && user.role) {
      for (const rp of user.role.rolePermissions) {
        permissions.add(rp.permission.name);
      }
    }

    // Armazenar no cache
    permissionCache.set(userId, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return permissions;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Limpar cache de permissões de um usuário específico
 * Útil quando o role do usuário é alterado
 */
export function clearUserPermissionCache(userId: string) {
  permissionCache.delete(userId);
}

/**
 * Limpar todo o cache de permissões
 * Útil quando roles/permissões são modificados globalmente
 */
export function clearAllPermissionCache() {
  permissionCache.clear();
}

/**
 * Middleware: Verificar se usuário tem permissão específica
 *
 * @param permissionName - Nome da permissão (ex: 'users.view', 'finance.transfer')
 * @returns Express middleware
 */
export function requirePermission(permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar se usuário está autenticado
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autenticado',
        });
      }

      const userId = req.user.userId;

      // Obter permissões do usuário (com cache)
      const userPermissions = await getUserPermissions(userId);

      // Verificar se tem a permissão
      if (!userPermissions.has(permissionName)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: `Você não tem permissão para executar esta ação (necessário: ${permissionName})`,
        });
      }

      // Usuário tem permissão, continuar
      next();
    } catch (error: any) {
      console.error('[Permission Middleware] Erro ao verificar permissão:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao verificar permissões',
      });
    }
  };
}

/**
 * Middleware: Verificar se usuário tem QUALQUER UMA das permissões listadas
 *
 * @param permissionNames - Array de permissões (ex: ['users.view', 'users.edit'])
 * @returns Express middleware
 */
export function requireAnyPermission(...permissionNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar se usuário está autenticado
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autenticado',
        });
      }

      const userId = req.user.userId;

      // Obter permissões do usuário (com cache)
      const userPermissions = await getUserPermissions(userId);

      // Verificar se tem QUALQUER uma das permissões
      const hasAnyPermission = permissionNames.some((permission) => userPermissions.has(permission));

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: `Você não tem permissão para executar esta ação (necessário uma de: ${permissionNames.join(', ')})`,
        });
      }

      // Usuário tem permissão, continuar
      next();
    } catch (error: any) {
      console.error('[Permission Middleware] Erro ao verificar permissões:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao verificar permissões',
      });
    }
  };
}

/**
 * Middleware: Verificar se usuário tem TODAS as permissões listadas
 *
 * @param permissionNames - Array de permissões (ex: ['users.view', 'users.edit'])
 * @returns Express middleware
 */
export function requireAllPermissions(...permissionNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar se usuário está autenticado
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autenticado',
        });
      }

      const userId = req.user.userId;

      // Obter permissões do usuário (com cache)
      const userPermissions = await getUserPermissions(userId);

      // Verificar se tem TODAS as permissões
      const hasAllPermissions = permissionNames.every((permission) => userPermissions.has(permission));

      if (!hasAllPermissions) {
        const missingPermissions = permissionNames.filter((permission) => !userPermissions.has(permission));

        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: `Você não tem todas as permissões necessárias (faltando: ${missingPermissions.join(', ')})`,
        });
      }

      // Usuário tem todas as permissões, continuar
      next();
    } catch (error: any) {
      console.error('[Permission Middleware] Erro ao verificar permissões:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao verificar permissões',
      });
    }
  };
}
