import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema } from '@mktplace/shared';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';
import { securityLogger } from '../utils/logger';

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

      res.status(201).json({
        success: true,
        data: result,
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

      // Não expor mensagens de erro internas
      res.status(400).json({
        success: false,
        error: 'Erro ao registrar usuário',
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

      res.status(200).json({
        success: true,
        data: result,
        message: 'Login realizado com sucesso',
      });
    } catch (error: any) {
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
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token não fornecido',
        });
        return;
      }

      // SECURITY: Revogar refresh token
      await authService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso',
      });
    } catch (error: any) {
      console.error('[SECURITY] Logout error:', error);

      res.status(500).json({
        success: false,
        error: 'Erro ao fazer logout',
      });
    }
  }

  // SECURITY: Endpoint para renovar access token
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token não fornecido',
        });
        return;
      }

      const result = await authService.refreshAccessToken(refreshToken);

      if (!result) {
        res.status(401).json({
          success: false,
          error: 'Refresh token inválido ou expirado',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
        message: 'Token renovado com sucesso',
      });
    } catch (error: any) {
      console.error('[SECURITY] Refresh token error:', error);

      res.status(401).json({
        success: false,
        error: 'Erro ao renovar token',
      });
    }
  }
}

export const authController = new AuthController();
