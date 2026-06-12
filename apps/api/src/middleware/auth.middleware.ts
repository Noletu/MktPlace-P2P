import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { extractToken } from '../utils/cookies';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Estender o tipo Request do Express para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * SER-33 — Allowlist de ações permitidas a uma conta CONGELADA (accountFrozen).
 * Conta congelada só pode VER (GETs), APELAR/se defender em disputa (sem mover
 * fundos), gerir as PRÓPRIAS notificações e encerrar a sessão (logout). Qualquer
 * outra mutação — inclusive privilegiada (resolver disputa, broadcasts admin,
 * freeze/unfreeze etc.) — é bloqueada. Agnóstico a role.
 * Match sobre o caminho COMPLETO (req.originalUrl sem query) com padrões ANCORADOS
 * (fail-secure: rota nova nasce bloqueada; sem falso-positivo de substring).
 */
const FROZEN_ALLOWED_MUTATIONS: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  // Apelação / defesa em disputa (comunicação, não move fundos)
  { method: 'POST', pattern: /^\/api\/v1\/disputes\/?$/ },                  // criar disputa (apelar)
  { method: 'POST', pattern: /^\/api\/v1\/disputes\/[^/]+\/messages\/?$/ }, // mensagem na disputa
  { method: 'POST', pattern: /^\/api\/v1\/disputes\/[^/]+\/respond\/?$/ },  // responder disputa
  // Gerir as próprias notificações
  { method: 'POST',   pattern: /^\/api\/v1\/notifications\/mark-all-read\/?$/ },
  { method: 'POST',   pattern: /^\/api\/v1\/notifications\/[^/]+\/read\/?$/ },
  { method: 'DELETE', pattern: /^\/api\/v1\/notifications\/[^/]+\/?$/ },    // cobre /:id e /delete-all-read
  // Sessão
  { method: 'POST', pattern: /^\/api\/v1\/auth\/logout\/?$/ },
];

/**
 * GET/HEAD/OPTIONS sempre permitidos (leitura); demais métodos só se casarem o allowlist.
 */
export function isFrozenActionAllowed(method: string, path: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  return FROZEN_ALLOWED_MUTATIONS.some(
    (rule) => rule.method === method && rule.pattern.test(path)
  );
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // SECURITY: Extrair token de HttpOnly cookie ou Authorization header (fallback)
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    // Verificar token
    const decoded = verifyToken(token);

    // COMPATIBILIDADE: Mapear 'id' -> 'userId' para tokens antigos
    if (!decoded.userId && (decoded as any).id) {
      decoded.userId = (decoded as any).id;
    }

    // SECURITY (H-2): Verificar blacklist de tokens revogados (logout invalida token imediatamente)
    if (decoded.jti) {
      const revoked = await prisma.revokedToken.findUnique({
        where: { jti: decoded.jti },
        select: { jti: true },
      });
      if (revoked) {
        res.status(401).json({ error: 'Token revogado. Faça login novamente.' });
        return;
      }
    }

    console.log('✅ Token válido:', { userId: decoded.userId, email: decoded.email });

    // IMPORTANTE: Verificar se usuário existe no banco e buscar role atualizado
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        legacyRole: true, // Role temporário durante migração RBAC
        accountFrozen: true, // SECURITY: Verificar se conta está bloqueada
        frozenReason: true,
        frozenUntil: true,
        role: {
          select: {
            slug: true,
            name: true,
            level: true,
          }
        }
      },
    });

    if (!user) {
      console.log('❌ Usuário do token não existe no banco:', decoded.userId);
      res.status(401).json({
        error: 'Sessão inválida. Faça login novamente.',
        details: 'Usuário não encontrado. Seu token pode ser de uma sessão antiga ou outro ambiente.'
      });
      return;
    }

    // Adicionar usuário ao request com role atualizado do banco
    // RBAC: Usar role.slug se disponível, senão usar legacyRole
    const roleToUse = user.role?.slug?.toUpperCase() || user.legacyRole;

    req.user = {
      ...decoded,
      role: roleToUse, // Role sempre vem do banco (não confia no JWT)
      name: user.name ?? undefined,       // Nome do usuário (para audit log)
      accountFrozen: user.accountFrozen,  // Adicionar flag de conta bloqueada
      level: user.role?.level || 0, // Adicionar level para permissões (SUPPORT=40, MANAGER=60, ADMIN=80, MASTER=100)
      frozenReason: user.frozenReason,    // Motivo do bloqueio
      frozenUntil: user.frozenUntil,      // Data de expiração (null = permanente)
    };

    // SER-33: conta congelada — só ações do allowlist (ver/apelar/notificações
    // próprias/logout). Qualquer outra mutação, inclusive privilegiada, é 403.
    if (user.accountFrozen) {
      const requestPath = req.originalUrl.split('?')[0];
      if (!isFrozenActionAllowed(req.method, requestPath)) {
        const message = user.frozenUntil
          ? `Sua conta está suspensa até ${new Date(user.frozenUntil).toLocaleString('pt-BR')}. Motivo: ${user.frozenReason || 'Não especificado'}. Você pode apelar dessa decisão criando uma disputa.`
          : `Sua conta está suspensa. Motivo: ${user.frozenReason || 'Não especificado'}. Você pode apelar dessa decisão criando uma disputa.`;
        console.log('🚫 Ação bloqueada para conta congelada:', {
          userId: user.id,
          method: req.method,
          path: requestPath,
          frozenReason: user.frozenReason,
        });
        res.status(403).json({
          success: false,
          error: 'Ação bloqueada',
          message,
          accountFrozen: true,
          frozenReason: user.frozenReason,
          frozenUntil: user.frozenUntil,
          canAppeal: true,
          appealUrl: '/support/ticket/new?appeal=true',
        });
        return;
      }
    }
    next();
  } catch (error) {
    console.log('❌ Token inválido:', error);
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }
};

// Middleware para verificar se usuário é admin ou master
export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  // MASTER tem todos os privilégios de ADMIN
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MASTER') {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    return;
  }

  next();
};

// Middleware para verificar se usuário é MASTER (nível máximo)
export const masterMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  if (req.user.role !== 'MASTER') {
    res.status(403).json({ error: 'Acesso negado. Apenas usuários MASTER.' });
    return;
  }

  next();
};
