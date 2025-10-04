import { PrismaClient } from '@prisma/client';
import { generateTokenId, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';

const prisma = new PrismaClient();

export class RefreshTokenService {
  // SECURITY: Criar refresh token e salvar no DB
  async createRefreshToken(userId: string): Promise<string> {
    const tokenId = generateTokenId();
    const token = generateRefreshToken(userId, tokenId);

    const expiresInDays = parseInt(process.env.JWT_REFRESH_EXPIRES_IN?.replace('d', '') || '30');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }

  // SECURITY: Verificar se refresh token é válido
  async validateRefreshToken(token: string): Promise<string | null> {
    try {
      const decoded = verifyRefreshToken(token);

      const refreshToken = await prisma.refreshToken.findUnique({
        where: { token },
      });

      if (!refreshToken) {
        return null;
      }

      // SECURITY: Verificar se token foi revogado
      if (refreshToken.isRevoked) {
        return null;
      }

      // SECURITY: Verificar se token expirou
      if (refreshToken.expiresAt < new Date()) {
        return null;
      }

      return decoded.userId;
    } catch (error) {
      return null;
    }
  }

  // SECURITY: Revogar refresh token (logout)
  async revokeRefreshToken(token: string): Promise<boolean> {
    try {
      await prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // SECURITY: Revogar todos os refresh tokens de um usuário
  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });
  }

  // SECURITY: Limpar tokens expirados (executar periodicamente)
  async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}

export const refreshTokenService = new RefreshTokenService();
