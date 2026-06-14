import { PrismaClient, User } from '@prisma/client';
import crypto from 'crypto';
import { hashPassword, comparePassword, needsRehash } from '../utils/bcrypt';
import { generateToken } from '../utils/jwt';
import { refreshTokenService } from './refreshToken.service';
import { twoFactorService } from './twoFactor.service';
import { accountLockoutService } from './accountLockout.service';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from './auditLog.service';
import { emailService } from './email.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// SECURITY (SER-23 Achado C): hash dummy para equalizar timing
// entre "email não existe" e "email existe + senha errada".
// Gerado com bcrypt cost 12 (alinhado com as contas mais visadas
// do sistema — seed e admin). ATENÇÃO: senhas cost-10 (novas via
// app) ainda têm leak residual de timing — ver SER-38 para fix
// definitivo.
const TIMING_DUMMY_HASH = '$2a$12$nxdTFDgQB8OJN773LSlbSe5tVLFGXdozBi6mu07/THohvuO3VGify';

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'> & { role?: string };
  token: string;
  refreshToken: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    // SECURITY: Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      // SECURITY: Mensagem genérica para prevenir user enumeration
      throw new Error('Não foi possível completar o cadastro. Verifique os dados e tente novamente.');
    }

    // Hash da senha
    const hashedPassword = await hashPassword(input.password);

    // Buscar role USER para novo cadastro
    const userRole = await prisma.role.findUnique({
      where: { slug: 'user' },
    });

    if (!userRole) {
      throw new Error('Role USER não encontrado. Execute o seed RBAC primeiro.');
    }

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        name: input.name,
        roleId: userRole.id,
        legacyRole: 'USER',
      },
      include: {
        role: true,
      },
    });

    // SECURITY: Gerar access token e refresh token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role?.slug || user.legacyRole || 'USER',
    });

    const refreshToken = await refreshTokenService.createRefreshToken(user.id);

    // Remover senha e role object do retorno; adicionar role como string
    const { password, role: roleObject, ...userWithoutPassword } = user;

    return {
      user: {
        ...userWithoutPassword,
        role: roleObject?.slug?.toUpperCase() || user.legacyRole || 'USER',
      },
      token,
      refreshToken,
    };
  }

  /**
   * SECURITY (SER-23): Passo 1 do login — valida APENAS a credencial
   * (email + senha) e devolve o id do usuário e se ele tem 2FA habilitado.
   * NÃO gera tokens nem verifica o segundo fator (isso acontece no
   * complete-login). Retorna null para qualquer credencial inválida,
   * sem distinguir "email não existe" de "senha errada".
   */
  async verifyCredentials(
    input: LoginInput
  ): Promise<{ userId: string; twoFactorEnabled: boolean } | null> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        password: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      // SECURITY (SER-23 Achado C): rodar bcrypt mesmo sem usuário para
      // equalizar o tempo de resposta com o caso "email existe + senha errada".
      // O resultado é descartado — só importa o custo computacional.
      await comparePassword(input.password, TIMING_DUMMY_HASH);
      return null;
    }

    // SECURITY (SER-22 Caminho Z): se a conta está em lockout, NÃO rodar bcrypt
    // real. Roda bcrypt dummy para manter o timing uniforme com os cenários em
    // que o bcrypt real seria executado (senha correta ou errada). Retorno null
    // genérico — o caller não distingue lockout de credencial inválida (SER-23).
    const lockStatus = await accountLockoutService.isLocked(user.id);
    if (lockStatus.locked) {
      await comparePassword(input.password, TIMING_DUMMY_HASH);
      return null;
    }

    const isPasswordValid = await comparePassword(input.password, user.password);

    if (!isPasswordValid) {
      // SECURITY (SER-22): senha errada — incrementar o contador de falhas.
      // recordFailedLogin pode disparar o lockout se o threshold for atingido.
      const result = await accountLockoutService.recordFailedLogin(user.id);

      if (result.lockoutTriggered && result.lockedUntil && result.durationMin !== undefined) {
        // SECURITY (SER-22): lockout disparado — auditar (observabilidade
        // ops/compliance) e notificar o dono da conta por e-mail. Busca extra
        // de email/name/contadores (fora do select original por economia);
        // só roda quando o lockout efetivamente dispara.
        await this.notifyLockout(user.id, result.lockedUntil, result.durationMin);
      }

      // Retorno null uniforme, sem expor ao caller falha de senha vs. lockout.
      return null;
    }

    // SECURITY (SER-22): senha correta — limpar failedLoginAttempts e
    // lockedUntil. NÃO reseta lockoutCount (esse só esfria pela janela de 24h
    // dentro de recordFailedLogin).
    await accountLockoutService.recordSuccessfulLogin(user.id);

    // SER-38: rehash transparente. A senha já foi confirmada correta acima; se o
    // hash armazenado ainda usa cost abaixo do padrão atual, re-hasheia em cost-12
    // e persiste. Best-effort: uma falha aqui não pode negar um login válido.
    if (needsRehash(user.password)) {
      try {
        const rehashed = await hashPassword(input.password);
        await prisma.user.update({
          where: { id: user.id },
          data: { password: rehashed },
        });
      } catch (rehashError) {
        logger.error('[AUTH] Failed to rehash password (SER-38)', {
          userId: user.id,
          error: (rehashError as Error).message,
        });
        // NÃO re-throw — rehash é best-effort; o login segue válido.
      }
    }

    return { userId: user.id, twoFactorEnabled: user.twoFactorEnabled };
  }

  /**
   * SECURITY (SER-22): efeitos colaterais de um lockout disparado — audit log
   * (sempre) + e-mail de aviso ao usuário (best-effort). O audit registra
   * contadores (lockoutCount, failedLoginAttempts) para análise de padrões de
   * ataque. O e-mail é envolvido em try/catch: se o SMTP cair, o lockout em si
   * já funcionou e não pode ser revertido por falha de notificação.
   */
  private async notifyLockout(userId: string, lockedUntil: Date, durationMin: number): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, lockoutCount: true, failedLoginAttempts: true },
    });

    if (!user) {
      return;
    }

    await auditLogService.log({
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_LOGIN_LOCKED,
      resource: AUDIT_RESOURCES.USER,
      success: true, // o ATO de bloquear teve sucesso — não confundir com login
      metadata: {
        durationMin,
        lockoutCount: user.lockoutCount,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: lockedUntil.toISOString(),
      },
    });

    try {
      await emailService.sendAccountLockoutEmail(user.email, user.name || 'Usuário', {
        lockedUntil,
        durationMin,
      });
    } catch (emailError) {
      logger.error('[AUTH] Failed to send account lockout email', {
        userId,
        error: (emailError as Error).message,
      });
      // NÃO re-throw — lockout funcionou; e-mail é best-effort.
    }
  }

  /**
   * SECURITY (SER-23): Passo 2 do login — emite os tokens definitivos para um
   * usuário cuja senha já foi validada (passo 1) e cujo 2FA, se habilitado, já
   * foi verificado pelo controller. NÃO seta cookies (o controller faz isso) e
   * NÃO valida 2FA. Reintroduz a geração de token/refresh do antigo login().
   */
  async finalizeLogin(userId: string): Promise<{
    user: { id: string; email: string; name: string | null; role: string };
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        legacyRole: true,
        role: { select: { slug: true } },
      },
    });

    if (!user) {
      // Usuário deletado entre o passo 1 e o passo 2 (extremamente raro).
      throw new Error('User not found');
    }

    // RBAC: role em UPPERCASE para casar com o cookie userRole / middleware
    // do frontend, que compara contra 'ADMIN'/'MASTER'.
    const role = user.role?.slug?.toUpperCase() || user.legacyRole || 'USER';

    const accessToken = generateToken({ userId: user.id, email: user.email, role });
    const refreshToken = await refreshTokenService.createRefreshToken(user.id);

    return {
      user: { id: user.id, email: user.email, name: user.name, role },
      accessToken,
      refreshToken,
    };
  }

  // SECURITY (H-1): Renovar access token com rotação de refresh token
  // Retorna novo access token + novo refresh token (token rotation)
  async refreshAccessToken(refreshToken: string): Promise<{ token: string; newRefreshToken: string; role: string } | null> {
    const result = await refreshTokenService.validateAndRotateRefreshToken(refreshToken);

    if (!result) {
      return null;
    }

    const { userId, newRefreshToken } = result;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          select: {
            slug: true,
          }
        }
      }
    });

    if (!user) {
      return null;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role?.slug || user.legacyRole || 'USER',
    });

    // SER-30: role atual do DB em MAIÚSCULO (formato que o cookie userRole exige —
    // o Next middleware compara 'ADMIN'/'MASTER') para ressincronizar no refresh.
    const role = user.role?.slug?.toUpperCase() || user.legacyRole || 'USER';
    return { token, newRefreshToken, role };
  }

  // SECURITY: Logout - revogar refresh token
  async logout(refreshToken: string): Promise<boolean> {
    return await refreshTokenService.revokeRefreshToken(refreshToken);
  }

  async getUserById(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          select: {
            slug: true,
            name: true,
            level: true,
          }
        },
      },
    });

    if (!user) {
      return null;
    }

    // RBAC: Determinar role para resposta (usar slug do RBAC ou legacyRole)
    const userRole = user.role?.slug?.toUpperCase() || user.legacyRole;

    const { password, role: roleObject, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      role: userRole, // Role como string (MASTER, ADMIN, etc)
      level: user.role?.level || 0, // Level do role (SUPPORT=40, GERENTE=60, ADMIN=80, MASTER=100)
      has2FA: user.twoFactorEnabled, // Mapear para compatibilidade com SecurityBanner
      // ADMIN CONTROLS: Bloqueio (incluir para frontend exibir banner)
      accountFrozen: user.accountFrozen,
      frozenReason: user.frozenReason,
      frozenAt: user.frozenAt,
      frozenUntil: user.frozenUntil,
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  async getUserByCpf(cpf: string): Promise<User | null> {
    return await prisma.user.findFirst({
      where: { cpf },
    });
  }

  // PASSWORD RESET: Generate token and store hash in DB
  async requestPasswordReset(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null; // Anti-enumeration: controller always returns success
    }

    // Generate raw token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Store SHA-256 hash of token (if DB leaks, tokens are not exposed)
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Set expiration: 1 hour from now
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
      },
    });

    return rawToken; // Raw token goes in the email
  }

  // PASSWORD RESET: Validate token and set new password
  async resetPassword(email: string, token: string, newPassword: string, twoFactorToken?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      throw new Error('Token invalido ou expirado');
    }

    // Compare SHA-256 hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    if (hashedToken !== user.passwordResetToken) {
      throw new Error('Token invalido ou expirado');
    }

    // Check expiration
    if (new Date() > user.passwordResetExpires) {
      throw new Error('Token invalido ou expirado');
    }

    // SECURITY: Se usuario tem 2FA ativado, exigir codigo
    if (user.twoFactorEnabled) {
      if (!twoFactorToken) {
        throw new Error('2FA_REQUIRED');
      }

      const is2FAValid = await twoFactorService.verifyToken(user.id, twoFactorToken);
      if (!is2FAValid) {
        throw new Error('Codigo 2FA invalido');
      }
    }

    // Hash new password with bcrypt
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset fields (single-use token)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        forcePasswordReset: false, // SER-15: troca via link de reset também libera a conta
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      throw new Error('CURRENT_PASSWORD_INVALID');
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        forcePasswordReset: false, // SER-15: troca concluída, libera a conta
      },
    });
  }

  async updateProfile(userId: string, data: {
    name?: string;
    email?: string;
  }): Promise<any> {
    // Verificar se email já está em uso por outro usuário
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new Error('Email já está em uso');
      }
    }

    // Atualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;

    return {
      ...userWithoutPassword,
    };
  }
}

export const authService = new AuthService();
