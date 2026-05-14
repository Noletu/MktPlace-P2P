import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware para verificar se usuário é admin
 * Deve ser usado após authMiddleware
 */
export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado',
      });
    }

    // Verificar se usuário é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPPORT' && user.role !== 'MASTER')) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem acessar esta funcionalidade.',
      });
    }

    next();
  } catch (error) {
    console.error('Erro no middleware admin:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar permissões',
    });
  }
};
