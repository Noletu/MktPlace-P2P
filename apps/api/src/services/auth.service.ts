import { PrismaClient, User } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/bcrypt';
import { generateToken } from '../utils/jwt';
import { refreshTokenService } from './refreshToken.service';
import { twoFactorService } from './twoFactor.service';

const prisma = new PrismaClient();

export interface RegisterInput {
  email: string;
  cpf: string;
  password: string;
  name?: string;
  phone?: string;
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
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          { cpf: input.cpf },
        ],
      },
    });

    if (existingUser) {
      // SECURITY: Mensagem genérica para prevenir user enumeration
      throw new Error('Não foi possível completar o cadastro. Verifique os dados e tente novamente.');
    }

    // Hash da senha
    const hashedPassword = await hashPassword(input.password);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: input.email,
        cpf: input.cpf,
        password: hashedPassword,
        name: input.name,
        phone: input.phone,
        kycLevel: "NONE",
        role: 'USER',
      },
    });

    // SECURITY: Gerar access token e refresh token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
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
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: input.email },
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

    // SECURITY: Gerar access token e refresh token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
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

  // SECURITY: Renovar access token usando refresh token
  async refreshAccessToken(refreshToken: string): Promise<{ token: string } | null> {
    const userId = await refreshTokenService.validateRefreshToken(refreshToken);

    if (!userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return { token };
  }

  // SECURITY: Logout - revogar refresh token
  async logout(refreshToken: string): Promise<boolean> {
    return await refreshTokenService.revokeRefreshToken(refreshToken);
  }

  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateKYCLevel(userId: string, kycLevel: string, kycData?: any): Promise<User> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycLevel,
        kycData: kycData ? JSON.stringify(kycData) : undefined,
      },
    });

    return user;
  }
}

export const authService = new AuthService();
