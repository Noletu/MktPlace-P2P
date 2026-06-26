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

/**
 * SER-15 — Allowlist de ações permitidas a uma conta marcada para troca de senha
 * obrigatória (forcePasswordReset). Só pode VER (GETs), trocar a senha e deslogar.
 * Qualquer outra mutação é bloqueada até a troca. Match no caminho COMPLETO
 * (req.originalUrl sem query) com padrões ANCORADOS (fail-secure).
 */
const PASSWORD_RESET_ALLOWED_MUTATIONS: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: 'POST', pattern: /^\/api\/v1\/auth\/change-password\/?$/ },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/logout\/?$/ },
];

export function isPasswordResetActionAllowed(method: string, path: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  return PASSWORD_RESET_ALLOWED_MUTATIONS.some(
    (rule) => rule.method === method && rule.pattern.test(path)
  );
}

/**
 * STAFF TRADING GATE — contas STAFF (qualquer role != USER) não podem operar como
 * cliente: criar/aceitar pedidos, ter carteira pessoal, depositar/sacar, enviar
 * comprovante, confirmar pagamento, avaliar, ativar cupom, marcar presença.
 *
 * Fail-secure por ÁREA: qualquer mutação (POST/PATCH/PUT/DELETE) cujo caminho caia
 * numa área de operação de cliente é BLOQUEADA por padrão — rota nova nasce bloqueada.
 * GETs são sempre permitidos (staff vê tudo). Exceções administrativas explícitas
 * (ex.: validar comprovante) ficam numa allowlist. /admin/* NÃO é área de operação,
 * então funções de staff (inclusive carteira da plataforma) permanecem intactas.
 *
 * Match sobre o caminho COMPLETO (req.originalUrl sem query) com padrões ANCORADOS.
 */
const STAFF_BLOCKED_OPERATION_AREAS: ReadonlyArray<RegExp> = [
  /^\/api\/v1\/orders(\/|$)/,
  /^\/api\/v1\/wallets(\/|$)/,
  /^\/api\/v1\/collateral(\/|$)/,
  /^\/api\/v1\/collateral-balance(\/|$)/,
  /^\/api\/v1\/transactions(\/|$)/,
  /^\/api\/v1\/reviews(\/|$)/,
  /^\/api\/v1\/coupons(\/|$)/,
  /^\/api\/v1\/presence(\/|$)/,
];

/**
 * Exceções: mutações que STAFF PODE fazer mesmo dentro das áreas acima
 * (funções administrativas/de sistema, não operação de cliente).
 */
const STAFF_OPERATION_EXCEPTIONS: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  // Validar comprovante é função admin/system (registra validatedBy)
  { method: 'POST', pattern: /^\/api\/v1\/transactions\/[^/]+\/validate\/?$/ },
  // Cupons: CRUD é função admin (a rota tem adminMiddleware). Só activate/deactivate
  // (uso por cliente) permanecem bloqueados para staff.
  { method: 'POST',   pattern: /^\/api\/v1\/coupons\/?$/ },        // criar cupom (admin)
  { method: 'PUT',    pattern: /^\/api\/v1\/coupons\/[^/]+\/?$/ }, // editar cupom (admin)
  { method: 'DELETE', pattern: /^\/api\/v1\/coupons\/[^/]+\/?$/ }, // deletar cupom (admin)
  // Reviews: moderação é função admin (adminMiddleware). Criar/responder review
  // (ação de cliente) permanecem bloqueados para staff.
  { method: 'POST',   pattern: /^\/api\/v1\/reviews\/[^/]+\/suspicious\/?$/ }, // moderar (admin)
  { method: 'POST',   pattern: /^\/api\/v1\/reviews\/[^/]+\/hide\/?$/ },       // ocultar (admin)
];

/**
 * Retorna true se a requisição deve ser BLOQUEADA para uma conta staff.
 * GET/HEAD/OPTIONS nunca bloqueiam. Só bloqueia mutação em área de operação
 * que não esteja na allowlist de exceções.
 */
export function isStaffOperationBlocked(method: string, path: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return false;
  }
  const inOperationArea = STAFF_BLOCKED_OPERATION_AREAS.some((re) => re.test(path));
  if (!inOperationArea) {
    return false;
  }
  const isException = STAFF_OPERATION_EXCEPTIONS.some(
    (rule) => rule.method === method && rule.pattern.test(path)
  );
  return !isException;
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
        forcePasswordReset: true, // SER-15: troca de senha obrigatória
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

    // SER-15: conta marcada para troca de senha obrigatória — só pode ver (GETs),
    // trocar a senha e deslogar. Qualquer outra mutação é 403 até a troca.
    if (user.forcePasswordReset) {
      const resetRequestPath = req.originalUrl.split('?')[0];
      if (!isPasswordResetActionAllowed(req.method, resetRequestPath)) {
        res.status(403).json({
          success: false,
          error: 'Troca de senha obrigatória',
          message: 'Você precisa definir uma nova senha antes de continuar.',
          forcePasswordReset: true,
        });
        return;
      }
    }

    // STAFF TRADING GATE: contas STAFF (qualquer role != USER) não operam como cliente.
    // Bloqueia mutações em áreas de operação (criar/aceitar pedido, carteira pessoal,
    // depósito/saque, comprovante, review, cupom-uso, presença), preservando funções
    // administrativas e a gestão da carteira da plataforma (/admin/*, fora do gate).
    const isStaff = req.user.role !== 'USER';
    if (isStaff) {
      const staffRequestPath = req.originalUrl.split('?')[0];
      if (isStaffOperationBlocked(req.method, staffRequestPath)) {
        console.log('🚫 Operação de cliente bloqueada para conta staff:', {
          userId: user.id,
          role: req.user.role,
          method: req.method,
          path: staffRequestPath,
        });
        res.status(403).json({
          success: false,
          error: 'Ação não permitida',
          message: 'Contas administrativas não podem operar como cliente (criar pedidos, carteiras pessoais ou movimentar fundos próprios). Esta restrição existe para evitar conflito de interesse.',
          staffOperationBlocked: true,
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
