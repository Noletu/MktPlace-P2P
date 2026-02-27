import { PrismaClient, User } from '@prisma/client';
import crypto from 'crypto';
import { hashPassword, comparePassword } from '../utils/bcrypt';
import { generateToken } from '../utils/jwt';
import { refreshTokenService } from './refreshToken.service';
import { twoFactorService } from './twoFactor.service';

const prisma = new PrismaClient();

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  twoFactorToken?: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
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

    // Remover senha do retorno
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    // Buscar usuário com role RBAC
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      // SECURITY: Incluir campos de bloqueio para validação
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        accountFrozen: true,
        frozenReason: true,
        frozenUntil: true,
        legacyRole: true,
        role: {
          select: {
            slug: true,
            name: true,
          }
        }
      }
    });

    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    // Verificar senha
    const isPasswordValid = await comparePassword(input.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Credenciais inválidas');
    }

    // SECURITY: Verificar 2FA se habilitado
    if (user.twoFactorEnabled) {
      if (!input.twoFactorToken) {
        throw new Error('2FA_REQUIRED');
      }

      const is2FAValid = await twoFactorService.verifyToken(user.id, input.twoFactorToken);

      if (!is2FAValid) {
        throw new Error('Token 2FA inválido');
      }
    }

    // RBAC: Determinar role para JWT (usar slug do RBAC ou legacyRole)
    const userRole = user.role?.slug?.toUpperCase() || user.legacyRole;

    // SECURITY: Gerar access token e refresh token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: userRole,
    });

    const refreshToken = await refreshTokenService.createRefreshToken(user.id);

    // Remover senha do retorno e adicionar role como string para compatibilidade frontend
    const { password, role: roleObject, ...userWithoutPassword } = user;

    return {
      user: {
        ...userWithoutPassword,
        role: userRole, // Role como string (MASTER, ADMIN, etc)
      } as any,
      token,
      refreshToken,
    };
  }

  // SECURITY: Renovar access token usando refresh token
  async refreshAccessToken(refreshToken: string): Promise<{ token: string } | null> {
    const userId = await refreshTokenService.validateRefreshToken(refreshToken);

    if (!userId) {
      return null;
    }

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

    return { token };
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
