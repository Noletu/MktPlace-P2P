import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '@mktplace/shared';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';
import { emailService } from '../services/email.service';
import { securityLogger } from '../utils/logger';
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies, setUserRoleCookie, extractToken } from '../utils/cookies';
import { prisma } from '../utils/prisma';
import { notifPrefsService } from '../services/notificationPreferences.service';

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

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          // Tokens enviados via cookies E no JSON (para desenvolvimento/compatibilidade)
          accessToken: result.token,
          refreshToken: result.refreshToken,
        },
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

  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validar input
      const validatedData = loginSchema.parse(req.body);

      // Fazer login
      const result = await authService.login(validatedData);

      // SECURITY: Audit log - login bem-sucedido
      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.LOGIN,
        AUDIT_RESOURCES.USER,
        result.user.id,
        { email: validatedData.email }
      );

      securityLogger.login(result.user.id, true, req.ip);

      // SECURITY: Enviar tokens via HttpOnly cookies (XSS protection)
      setAccessTokenCookie(res, result.token);
      setRefreshTokenCookie(res, result.refreshToken);
      setUserRoleCookie(res, result.user.role || 'USER'); // Lido pelo Next.js middleware

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          // Tokens enviados via cookies E no JSON (para desenvolvimento/compatibilidade)
          accessToken: result.token,
          refreshToken: result.refreshToken,
        },
        message: 'Login realizado com sucesso',
      });
    } catch (error: any) {
      // SECURITY: Tratamento especial para 2FA requerido
      if (error.message === '2FA_REQUIRED') {
        res.status(200).json({
          success: false,
          requiresTwoFactor: true,
          message: 'Código 2FA necessário',
        });
        return;
      }

      // SECURITY: Log login falho
      securityLogger.login('unknown', false, req.ip, {
        email: req.body.email,
        error: error.message
      });

      auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.LOGIN,
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
          details: error.errors,
        });
        return;
      }

      // SECURITY: Mensagem genérica para não vazar informações
      res.status(401).json({
        success: false,
        error: 'Email ou senha inválidos',
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

      res.status(200).json({
        success: true,
        data: user,
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
      const jti = crypto.randomUUID();
      const ticket = jwt.sign(
        { userId: user.userId, email: user.email, role: user.role, jti },
        process.env.JWT_SECRET!,
        { expiresIn: '60s' }
      );
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
