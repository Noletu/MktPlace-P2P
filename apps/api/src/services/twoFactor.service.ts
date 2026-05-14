import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { hashPassword, comparePassword } from '../utils/bcrypt';

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
  async enableTwoFactor(userId: string, token: string): Promise<{ success: boolean; backupCodes: string[] }> {
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

    // Gerar backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Hashear backup codes para armazenamento seguro
    const hashedCodes = await Promise.all(
      backupCodes.map((code) => hashPassword(code))
    );

    // Ativar 2FA e salvar backup codes
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      },
    });

    return {
      success: true,
      backupCodes, // Retornar códigos em plain text apenas UMA VEZ
    };
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

    // Desativar 2FA e remover secret e backup codes
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    });

    return true;
  }

  // SECURITY: Verificar token 2FA no login (aceita TOTP ou backup code)
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return false;
    }

    // Primeiro tentar como TOTP (código do app)
    const isTOTPValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: WINDOW,
    });

    if (isTOTPValid) {
      return true;
    }

    // Se TOTP falhou, tentar como backup code
    return await this.useBackupCode(userId, token);
  }

  // SECURITY: Usar backup code (one-time use)
  async useBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorBackupCodes) {
      return false;
    }

    try {
      const backupCodes = JSON.parse(user.twoFactorBackupCodes) as string[];

      // Verificar se algum código hashado corresponde
      for (let i = 0; i < backupCodes.length; i++) {
        const isMatch = await comparePassword(code.toUpperCase(), backupCodes[i]);

        if (isMatch) {
          // Remover o código usado (one-time use)
          backupCodes.splice(i, 1);

          await prisma.user.update({
            where: { id: userId },
            data: {
              twoFactorBackupCodes: JSON.stringify(backupCodes),
            },
          });

          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[2FA] Error verifying backup code:', error);
      return false;
    }
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

  // SECURITY: Regenerar backup codes (requer token 2FA)
  async regenerateBackupCodes(userId: string, token: string): Promise<{ success: boolean; backupCodes: string[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      throw new Error('2FA não está habilitado');
    }

    // Verificar token antes de regenerar
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: WINDOW,
    });

    if (!isValid) {
      throw new Error('Token inválido');
    }

    // Gerar novos backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Hashear backup codes para armazenamento seguro
    const hashedCodes = await Promise.all(
      backupCodes.map((code) => hashPassword(code))
    );

    // Atualizar backup codes no banco
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      },
    });

    return {
      success: true,
      backupCodes, // Retornar códigos em plain text apenas UMA VEZ
    };
  }

  // SECURITY: Contar quantos backup codes ainda estão disponíveis
  async getBackupCodesCount(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorBackupCodes: true,
      },
    });

    if (!user || !user.twoFactorBackupCodes) {
      return 0;
    }

    try {
      const backupCodes = JSON.parse(user.twoFactorBackupCodes) as string[];
      return backupCodes.length;
    } catch (error) {
      return 0;
    }
  }
}

export const twoFactorService = new TwoFactorService();
