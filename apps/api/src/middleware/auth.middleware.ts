import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { extractToken } from '../utils/cookies';

// Estender o tipo Request do Express para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // SECURITY: Extrair token de HttpOnly cookie ou Authorization header (fallback)
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    // Verificar token
    const decoded = verifyToken(token);

    // Adicionar usuário ao request
    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }
};

// Middleware para verificar se usuário é admin
export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    return;
  }

  next();
};
