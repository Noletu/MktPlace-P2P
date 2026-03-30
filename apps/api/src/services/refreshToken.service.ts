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

  // SECURITY (H-1): Verificar refresh token COM rotação automática
  // Retorna { userId, newRefreshToken } para que o caller atualize o cookie
  // Detecção de reutilização: token já revogado → revogar TODA a família (sinal de roubo)
  async validateAndRotateRefreshToken(token: string): Promise<{ userId: string; newRefreshToken: string } | null> {
    try {
      verifyRefreshToken(token); // Valida assinatura e expiração JWT

      const refreshToken = await prisma.refreshToken.findUnique({
        where: { token },
      });

      if (!refreshToken) {
        return null;
      }

      // SECURITY: Detectar reutilização de token já revogado (possível roubo)
      if (refreshToken.isRevoked) {
        console.error(`[SECURITY] Refresh token reuse detected for userId=${refreshToken.userId} — revoking all tokens`);
        await this.revokeAllUserTokens(refreshToken.userId);
        return null;
      }

      // SECURITY: Verificar se token expirou
      if (refreshToken.expiresAt < new Date()) {
        return null;
      }

      // SECURITY: Rotação — revogar token antigo e emitir novo
      await prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true },
      });

      const newRefreshToken = await this.createRefreshToken(refreshToken.userId);
      return { userId: refreshToken.userId, newRefreshToken };
    } catch (error) {
      return null;
    }
  }

  // Manter o método legado para compatibilidade (usado internamente no logout)
  async validateRefreshToken(token: string): Promise<string | null> {
    try {
      verifyRefreshToken(token);

      const refreshToken = await prisma.refreshToken.findUnique({
        where: { token },
      });

      if (!refreshToken || refreshToken.isRevoked || refreshToken.expiresAt < new Date()) {
        return null;
      }

      return refreshToken.userId;
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
