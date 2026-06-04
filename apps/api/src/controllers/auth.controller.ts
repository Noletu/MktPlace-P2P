import { Request, Response } from 'express';
import { signSocketTicket } from '../utils/jwt';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, completeLoginSchema } from '@mktplace/shared';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';
import { emailService } from '../services/email.service';
import { logger, securityLogger } from '../utils/logger';
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies, setUserRoleCookie, extractToken } from '../utils/cookies';
import { prisma } from '../utils/prisma';
import { notifPrefsService } from '../services/notificationPreferences.service';
import { pendingLoginService } from '../services/pendingLogin.service';
import { twoFactorService } from '../services/twoFactor.service';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      // Validar input
      const validatedData = registerSchema.parse(req.body);

      // Registrar usuário
      const result = await authService.register(validatedData);

      // SECURITY: Audit log - registro bem-sucedido
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.REGISTER,
        AUDIT_RESOURCES.USER,
        result.user.id,
        { email: validatedData.email }
      );

      securityLogger.register(result.user.id, true, req.ip);

      // Enviar email de boas-vindas (não bloquear registro se falhar)
      try {
        await emailService.sendWelcomeEmail(validatedData.email, validatedData.name);
      } catch (emailError) {
        console.error('[AUTH] Error sending welcome email:', emailError);
      }

      // SECURITY: Enviar tokens via HttpOnly cookies (XSS protection)
      setAccessTokenCookie(res, result.token);
      setRefreshTokenCookie(res, result.refreshToken);
      setUserRoleCookie(res, result.user.role || 'USER'); // Lido pelo Next.js middleware

      // SECURITY (SER-23/SER-34): tokens emitidos APENAS via cookies
      // HttpOnly. Body não contém tokens — evita exposição a XSS via
      // localStorage do frontend.
      // SER-37: devolver user "slim" (mesmo shape do finalizeLogin/complete-login).
      // result.user vem do register com include:{role} e contém hdAccountIndex
      // (BigInt) — serializá-lo direto quebra o res.json ("serialize a BigInt").
      // result.user.role já é string uppercased (slug.toUpperCase() || legacyRole).
      const slimUser = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      };

      res.status(201).json({
        success: true,
        data: { user: slimUser },
        message: 'Usuário registrado com sucesso',
      });
    } catch (error: any) {
      // SECURITY: Log apenas no servidor, não expor detalhes ao client
      securityLogger.register('unknown', false, req.ip, { error: error.message });

      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.REGISTER,
        AUDIT_RESOURCES.USER,
        undefined,
        { email: req.body.email },
        false,
        error.message
      );

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.errors, // Zod errors são seguros
        });
        return;
      }

      // DEBUG: Expor erro para desenvolvimento
      console.error('❌ [AUTH] Registration error:', error);
      res.status(400).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao registrar usuário',
      });
    }
  }

  // SECURITY (SER-23): Passo 1 do login. Resposta UNIFORME para qualquer
  // credencial válida (com ou sem 2FA): 200 { nextStep: 'COMPLETE_LOGIN' } +
  // cookie HttpOnly pendingLoginToken. Credencial inválida → 401 genérico.
  // Tokens de acesso só são emitidos no /auth/complete-login (passo 2).
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validar input (apenas email + password; 2FA foi para o complete-login)
      const validatedData = loginSchema.parse(req.body);

      // Passo 1: validar credencial (inclui defesa de timing para email inexistente)
      const credentials = await authService.verifyCredentials(validatedData);

      if (!credentials) {
        // SECURITY (SER-23): resposta uniforme — não distinguir
        // "email não existe" de "senha errada".
        securityLogger.login('unknown', false, req.ip, { email: validatedData.email });

        auditLogService.logFromRequest(
          req,
          AUDIT_ACTIONS.LOGIN_FAILED,
          AUDIT_RESOURCES.USER,
          undefined,
          { email: validatedData.email }, // não indica se o email existe
          false,
          'Credenciais inválidas'
        );

        res.status(401).json({
          success: false,
          error: 'Credenciais inválidas',
        });
        return;
      }

      // Senha correta — criar PendingLogin (sempre, independente de 2FA)
      const { token } = await pendingLoginService.createPendingLogin(credentials.userId);

      // SECURITY (SER-23): intermediate token em cookie HttpOnly assinado,
      // restrito às rotas de auth, com TTL de 120s.
      res.cookie('pendingLoginToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // SECURITY: 'lax' (não 'strict' como o padrão do projeto)
        // — cookie de uso único (120s) que pode ser navegado a partir
        // de links externos (ex: email "Logar pra confirmar"). 'strict'
        // quebraria esse fluxo.
        sameSite: 'lax',
        maxAge: 120 * 1000, // 120s em ms
        signed: true, // assinado com COOKIE_SECRET
        path: '/api/v1/auth', // restringe o cookie às rotas de auth
      });

      // Audit: passo 1 concluído. has2FA indica se o segundo fator será
      // exigido no complete-login (registrado no servidor, não vazado ao client).
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.LOGIN_PENDING,
        AUDIT_RESOURCES.USER,
        credentials.userId,
        { has2FA: credentials.twoFactorEnabled }
      );

      // SECURITY (SER-23): resposta idêntica com ou sem 2FA habilitado.
      res.status(200).json({
        success: true,
        data: { nextStep: 'COMPLETE_LOGIN' },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
        return;
      }

      // SECURITY: erro inesperado (ex: DB indisponível) — distinto de
      // credencial inválida. Logar como ERROR com stack para ops/dev,
      // mas responder o MESMO 401 genérico para não vazar o canal.
      logger.error('[AUTH] Unexpected login error', {
        email: req.body?.email,
        error: error.message,
        stack: error.stack,
      });

      res.status(401).json({
        success: false,
        error: 'Credenciais inválidas',
      });
    }
  }

  // SECURITY (SER-23): Passo 2 do login. Recebe o intermediate token via
  // cookie HttpOnly assinado (emitido no passo 1) e, opcionalmente, o código
  // 2FA. Só quem possui o cookie (logo, passou pela senha) chega aqui.
  async completeLogin(req: Request, res: Response): Promise<void> {
    try {
      // 1. Ler o cookie HttpOnly assinado
      const pendingLoginToken = req.signedCookies?.pendingLoginToken;
      if (!pendingLoginToken) {
        res.status(401).json({
          success: false,
          error: 'Sessão de login inválida ou expirada',
        });
        return;
      }

      // 2. Validar o pendingLogin (inexistente / expirado / usado / sem tentativas)
      const pendingLogin = await pendingLoginService.validatePendingLogin(pendingLoginToken);
      if (!pendingLogin) {
        res.clearCookie('pendingLoginToken', { path: '/api/v1/auth' });
        res.status(401).json({
          success: false,
          error: 'Sessão de login inválida ou expirada',
        });
        return;
      }

      // 3. Carregar o estado de 2FA do usuário (inclui secret p/ checar consistência)
      const user = await prisma.user.findUnique({
        where: { id: pendingLogin.userId },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
      });

      if (!user) {
        // Usuário deletado entre o passo 1 e o passo 2. Invalidar e falhar.
        await pendingLoginService.consumePendingLogin(pendingLogin.id);
        res.clearCookie('pendingLoginToken', { path: '/api/v1/auth' });
        res.status(401).json({
          success: false,
          error: 'Sessão de login inválida ou expirada',
        });
        return;
      }

      if (user.twoFactorEnabled && !user.twoFactorSecret) {
        // Estado corrompido: 2FA habilitado mas sem secret. Não dá pra validar.
        // NÃO decrementar tentativas (usuário não fez nada errado) e NÃO
        // consumir o pendingLogin (deixar expirar naturalmente). Logar como
        // ERROR para ops/dev; resposta genérica para o cliente.
        logger.error('[AUTH] User has twoFactorEnabled=true but twoFactorSecret=null', {
          userId: pendingLogin.userId,
        });
        res.status(401).json({
          success: false,
          error: 'Sessão de login inválida ou expirada',
        });
        return;
      }

      // 4. Validar input (twoFactorToken opcional; TOTP ou backup quando presente)
      const { twoFactorToken } = completeLoginSchema.parse(req.body);

      // 5. Caso A: usuário SEM 2FA → finalizar direto
      if (!user.twoFactorEnabled) {
        await pendingLoginService.consumePendingLogin(pendingLogin.id);
        res.clearCookie('pendingLoginToken', { path: '/api/v1/auth' });

        const result = await authService.finalizeLogin(pendingLogin.userId);
        setAccessTokenCookie(res, result.accessToken);
        setRefreshTokenCookie(res, result.refreshToken);
        setUserRoleCookie(res, result.user.role);

        await auditLogService.log({
          userId: pendingLogin.userId,
          action: AUDIT_ACTIONS.LOGIN,
          resource: AUDIT_RESOURCES.USER,
          success: true,
          ipAddress: req.ip,
          metadata: { has2FA: false },
        });

        res.status(200).json({ success: true, data: { user: result.user } });
        return;
      }

      // 6. Caso B: usuário COM 2FA, código ainda não fornecido
      if (!twoFactorToken) {
        res.status(200).json({
          success: true,
          data: {
            requires2FA: true,
            attemptsRemaining: pendingLogin.attemptsRemaining,
          },
        });
        return;
      }

      // 7. Caso C: usuário COM 2FA, código fornecido — validar.
      // twoFactorService.verifyToken(userId, token) já trata anti-replay
      // (CRIT-07) e backup codes internamente; retorna boolean.
      const totpValid = await twoFactorService.verifyToken(pendingLogin.userId, twoFactorToken);

      if (!totpValid) {
        // Código errado — decrementar tentativas (single-use NÃO disparado aqui)
        const remaining = await pendingLoginService.decrementAttempts(pendingLogin.id);

        await auditLogService.log({
          userId: pendingLogin.userId,
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          resource: AUDIT_RESOURCES.USER,
          success: false,
          ipAddress: req.ip,
          metadata: { reason: 'invalid_2fa', attemptsRemaining: remaining },
        });

        if (remaining === 0) {
          // Esgotou — limpar cookie, forçar refazer o login
          res.clearCookie('pendingLoginToken', { path: '/api/v1/auth' });
          res.status(401).json({
            success: false,
            error: 'Tentativas esgotadas. Faça login novamente.',
          });
          return;
        }

        // Ainda há tentativas — manter cookie, devolver attemptsRemaining
        res.status(401).json({
          success: false,
          error: 'Código 2FA inválido',
          attemptsRemaining: remaining,
        });
        return;
      }

      // 8. Código 2FA correto → consumir pendingLogin e finalizar.
      // (O anti-replay/twoFactorLastUsedStep já foi atualizado dentro do
      // verifyToken — NÃO atualizar aqui.)
      await pendingLoginService.consumePendingLogin(pendingLogin.id);
      res.clearCookie('pendingLoginToken', { path: '/api/v1/auth' });

      const result = await authService.finalizeLogin(pendingLogin.userId);
      setAccessTokenCookie(res, result.accessToken);
      setRefreshTokenCookie(res, result.refreshToken);
      setUserRoleCookie(res, result.user.role);

      await auditLogService.log({
        userId: pendingLogin.userId,
        action: AUDIT_ACTIONS.LOGIN,
        resource: AUDIT_RESOURCES.USER,
        success: true,
        ipAddress: req.ip,
        metadata: { has2FA: true },
      });

      res.status(200).json({ success: true, data: { user: result.user } });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ success: false, error: 'Dados inválidos', details: error.errors });
        return;
      }

      logger.error('[AUTH] Unexpected complete-login error', {
        error: error.message,
        stack: error.stack,
      });
      res.status(401).json({
        success: false,
        error: 'Sessão de login inválida ou expirada',
      });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Não autenticado',
        });
        return;
      }

      // Buscar usuário completo
      const user = await authService.getUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'Usuário não encontrado',
        });
        return;
      }

      // SECURITY (SER-23/SER-29): retornar user "slim". getUserById faz
      // `...userWithoutPassword`, o que arrasta campos BigInt (hdAccountIndex,
      // twoFactorLastUsedStep) que quebram res.json ("Do not know how to
      // serialize a BigInt") — causa raiz do 500 que bloqueava o /auth/me — e
      // expõe segredos (twoFactorSecret, twoFactorBackupCodes) ao frontend.
      // Allowlist apenas com os campos que o frontend consome de /auth/me.
      // NOTA: getUserById já achata `role` para string e calcula `level`/`has2FA`;
      // por isso usamos user.role direto (não user.role?.slug).
      const slimUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        cpf: user.cpf,
        phone: user.phone,
        role: user.role,
        level: user.level,
        has2FA: user.has2FA,
        twoFactorEnabled: user.twoFactorEnabled,
        reputationScore: user.reputationScore,
        totalTransactions: user.totalTransactions,
        successfulTransactions: user.successfulTransactions,
        accountFrozen: user.accountFrozen,
        frozenReason: user.frozenReason,
        frozenAt: user.frozenAt,
        frozenUntil: user.frozenUntil,
        createdAt: user.createdAt,
      };

      res.status(200).json({
        success: true,
        data: slimUser,
      });
    } catch (error: any) {
      console.error('Get me error:', error);

      res.status(500).json({
        success: false,
        error: 'Erro ao buscar usuário',
      });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      // SECURITY: Extrair refresh token do cookie (prioritário) ou body (fallback)
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      // Revogar refresh token se disponível (best-effort — não bloqueia o logout)
      if (refreshToken) {
        try {
          await authService.logout(refreshToken);
        } catch (revokeError) {
          console.error('[AUTH] Failed to revoke refresh token:', revokeError);
        }
      }

      // SECURITY (H-2): Adicionar access token à blacklist (revogar imediatamente)
      try {
        const accessToken = extractToken(req);
        if (accessToken && req.user?.jti) {
          // Calcular expiresAt a partir do JWT_EXPIRES_IN (default 7d)
          const expiresInDays = parseInt(process.env.JWT_EXPIRES_IN?.replace('d', '') || '7');
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiresInDays);
          await prisma.revokedToken.create({
            data: { jti: req.user.jti, expiresAt },
          });
        }
      } catch (revokeError) {
        // Não bloquear logout se blacklist falhar
        console.error('[SECURITY] Failed to add jti to blacklist:', revokeError);
      }

      // SECURITY: Audit log - logout bem-sucedido
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.LOGOUT,
        AUDIT_RESOURCES.USER,
        req.user?.userId,
        { email: req.user?.email }
      );

      // SECURITY: Limpar cookies de autenticação
      clearAuthCookies(res);

      res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso',
      });
    } catch (error: any) {
      console.error('[SECURITY] Logout error:', error);

      // SECURITY: Audit log - logout com erro
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.LOGOUT,
        AUDIT_RESOURCES.USER,
        req.user?.userId,
        { email: req.user?.email },
        false,
        error.message
      );

      // Mesmo em caso de erro, limpar cookies locais
      clearAuthCookies(res);

      res.status(500).json({
        success: false,
        error: 'Erro ao fazer logout',
      });

    }
  }

  // Verificar se email está disponível
  async checkEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Email é obrigatório',
        });
        return;
      }

      const existingUser = await authService.getUserByEmail(email);

      res.json({
        success: true,
        available: !existingUser,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Erro ao verificar email',
      });
    }
  }

  // Verificar se CPF está disponível
  async checkCpf(req: Request, res: Response): Promise<void> {
    try {
      const { cpf } = req.query;

      if (!cpf || typeof cpf !== 'string') {
        res.status(400).json({
          success: false,
          error: 'CPF é obrigatório',
        });
        return;
      }

      const existingUser = await authService.getUserByCpf(cpf);

      res.json({
        success: true,
        available: !existingUser,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Erro ao verificar CPF',
      });
    }
  }

  // SECURITY: Endpoint para renovar access token
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      // SECURITY: Extrair refresh token do cookie (prioritário) ou body (fallback)
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token não fornecido',
        });
        return;
      }

      const result = await authService.refreshAccessToken(refreshToken);

      if (!result) {
        // SECURITY: Limpar cookies inválidos
        clearAuthCookies(res);

        res.status(401).json({
          success: false,
          error: 'Refresh token inválido ou expirado',
        });
        return;
      }

      // SECURITY (H-1): Atualizar access token E refresh token nos cookies (token rotation)
      setAccessTokenCookie(res, result.token);
      setRefreshTokenCookie(res, result.newRefreshToken);

      res.status(200).json({
        success: true,
        data: {},
        message: 'Token renovado com sucesso',
      });
    } catch (error: any) {
      console.error('[SECURITY] Refresh token error:', error);

      // SECURITY: Limpar cookies em caso de erro
      clearAuthCookies(res);

      res.status(401).json({
        success: false,
        error: 'Erro ao renovar token',
      });
    }
  }

  // Atualizar perfil do usuário
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Não autenticado',
        });
        return;
      }

      const { name, email } = req.body;

      // Validar que pelo menos um campo foi enviado
      if (!name && !email) {
        res.status(400).json({
          success: false,
          error: 'Nenhum dado para atualizar',
        });
        return;
      }

      // Atualizar perfil
      const updatedUser = await authService.updateProfile(req.user.userId, {
        name,
        email,
      });

      // SECURITY: Audit log
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.UPDATE,
        AUDIT_RESOURCES.USER,
        req.user.userId,
        { name, email }
      );

      res.status(200).json({
        success: true,
        data: updatedUser,
        message: 'Perfil atualizado com sucesso',
      });
    } catch (error: any) {
      console.error('Update profile error:', error);

      // SECURITY: Audit log do erro
      if (req.user) {
        auditLogService.logFromRequest(
          req,
          AUDIT_ACTIONS.UPDATE,
          AUDIT_RESOURCES.USER,
          req.user.userId,
          { error: error.message },
          false,
          error.message
        );
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao atualizar perfil',
      });
    }
  }

  // Obter perfil público de um usuário (sem dados sensíveis)
  async getPublicProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'ID do usuário é obrigatório',
        });
        return;
      }

      const user = await authService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'Usuário não encontrado',
        });
        return;
      }

      // Retornar apenas dados públicos (sem email, CPF, telefone, etc)
      const publicProfile = {
        id: user.id,
        name: user.name,
        reputationScore: user.reputationScore,
        totalTransactions: user.totalTransactions,
        successfulTransactions: user.successfulTransactions,
        totalCancellations: user.totalCancellations,
        recentCancellations: user.recentCancellations,
        createdAt: user.createdAt,
      };

      res.json({
        success: true,
        data: publicProfile,
      });
    } catch (error: any) {
      console.error('Get public profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar perfil público',
      });
    }
  }
  // PASSWORD RESET: Request password reset email
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);

      const rawToken = await authService.requestPasswordReset(email);

      if (rawToken) {
        try {
          await emailService.sendPasswordResetEmail(email, rawToken);
        } catch (emailError) {
          console.error('[AUTH] Error sending reset email:', emailError);
        }
      }

      // SECURITY: Always return success to prevent user enumeration
      res.status(200).json({
        success: true,
        message: 'Se o email estiver cadastrado, voce recebera um link para redefinir sua senha.',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: 'Dados invalidos',
          details: error.errors,
        });
        return;
      }

      console.error('[AUTH] Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao processar solicitacao',
      });
    }
  }

  // PASSWORD RESET: Reset password with token
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, token, newPassword, twoFactorToken } = resetPasswordSchema.parse(req.body);

      await authService.resetPassword(email, token, newPassword, twoFactorToken);

      res.status(200).json({
        success: true,
        message: 'Senha redefinida com sucesso!',
      });
    } catch (error: any) {
      // SECURITY: Tratamento especial para 2FA requerido no reset
      if (error.message === '2FA_REQUIRED') {
        res.status(200).json({
          success: false,
          requiresTwoFactor: true,
          message: 'Codigo 2FA necessario para redefinir a senha',
        });
        return;
      }

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: 'Dados invalidos',
          details: error.errors,
        });
        return;
      }

      console.error('[AUTH] Reset password error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao redefinir senha',
      });
    }
  }


  async socketTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const ticket = signSocketTicket({ userId: user.userId, email: user.email, role: user.role });
      res.status(200).json({ success: true, ticket });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Erro ao gerar socket ticket' });
    }
  }

  async getNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });
      const prefs = notifPrefsService.getPreferences(user?.notificationPreferences ?? null);
      res.json({ success: true, preferences: prefs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Erro ao buscar preferências de notificação' });
    }
  }

  async updateNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.userId;
      const updates = req.body;

      if (!updates || typeof updates !== 'object') {
        res.status(400).json({ success: false, error: 'Body inválido' });
        return;
      }

      const prefs = await notifPrefsService.updatePreferences(userId, updates);
      res.json({ success: true, preferences: prefs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Erro ao atualizar preferências de notificação' });
    }
  }
}

export const authController = new AuthController();
