import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

const ISSUER = process.env.TWO_FACTOR_ISSUER || 'Mktplace da Liberdade';
const WINDOW = parseInt(process.env.TWO_FACTOR_WINDOW || '1');

export class TwoFactorService {
  // SECURITY: Gerar secret para 2FA
  async generateSecret(userId: string, email: string): Promise<{ secret: string; qrCode: string }> {
    const secret = speakeasy.generateSecret({
      name: `${ISSUER} (${email})`,
      issuer: ISSUER,
      length: 32,
    });

    if (!secret.otpauth_url) {
      throw new Error('Failed to generate OTP auth URL');
    }

    // Gerar QR Code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Salvar secret no banco (temporário até confirmar)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
      },
    });

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  // SECURITY: Habilitar 2FA após confirmar token
  async enableTwoFactor(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new Error('Secret não encontrado');
    }

    // Verificar token
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: WINDOW,
    });

    if (!isValid) {
      throw new Error('Token inválido');
    }

    // Ativar 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
      },
    });

    return true;
  }

  // SECURITY: Desabilitar 2FA
  async disableTwoFactor(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new Error('2FA não está habilitado');
    }

    // Verificar token antes de desabilitar
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: WINDOW,
    });

    if (!isValid) {
      throw new Error('Token inválido');
    }

    // Desativar 2FA e remover secret
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return true;
  }

  // SECURITY: Verificar token 2FA no login
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return false;
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: WINDOW,
    });

    return isValid;
  }

  // SECURITY: Verificar se usuário tem 2FA habilitado
  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
      },
    });

    return user?.twoFactorEnabled || false;
  }

  // SECURITY: Gerar backup codes (códigos de recuperação)
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }

    return codes;
  }
}

export const twoFactorService = new TwoFactorService();
