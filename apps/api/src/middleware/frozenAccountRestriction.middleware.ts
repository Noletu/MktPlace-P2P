import { Request, Response, NextFunction } from 'express';

/**
 * Middleware que bloqueia ações de ESCRITA para contas bloqueadas/congeladas
 *
 * Permite apenas:
 * - GET (visualização de todas as informações)
 * - Criação/gerenciamento de disputas (para apelar do bloqueio)
 * - Logout e refresh de token
 *
 * Bloqueia:
 * - Criar pedidos (comprar/vender)
 * - Sacar crypto
 * - Depositar crypto
 * - Enviar mensagens de chat
 * - Realizar transações
 * - Todas as demais ações de escrita (POST/PUT/PATCH/DELETE)
 */
export const restrictFrozenAccounts = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  // Se conta não está bloqueada, permitir tudo
  if (!user?.accountFrozen) {
    return next();
  }

  // Permitir todos os GETs (leitura/visualização)
  if (req.method === 'GET') {
    return next();
  }

  // Permitir endpoints de disputa (para apelar da decisão de bloqueio)
  if (req.path.startsWith('/api/v1/disputes')) {
    return next();
  }

  // Permitir logout e refresh de token
  if (req.path === '/api/v1/auth/logout' || req.path === '/api/v1/auth/refresh') {
    return next();
  }

  // Permitir notificações (marcar como lida, etc)
  if (req.path.startsWith('/api/v1/notifications')) {
    return next();
  }

  // Bloquear todo o resto (POST/PUT/PATCH/DELETE)
  const message = user.frozenUntil
    ? `Sua conta está suspensa até ${new Date(user.frozenUntil).toLocaleString('pt-BR')}. Motivo: ${user.frozenReason || 'Não especificado'}. Você pode apelar dessa decisão criando uma disputa.`
    : `Sua conta está suspensa. Motivo: ${user.frozenReason || 'Não especificado'}. Você pode apelar dessa decisão criando uma disputa.`;

  console.log('🚫 Ação bloqueada para conta congelada:', {
    userId: user.userId,
    method: req.method,
    path: req.path,
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
    appealUrl: '/disputes/create?category=ACCOUNT_BLOCK_APPEAL',
  });
};
