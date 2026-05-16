import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { hashPassword, comparePassword } from '../utils/bcrypt';
import { securityLogger } from '../utils/logger';

// CRIT-07: TOTP step duration em segundos. RFC 6238 default = 30s.
// O step absoluto que um token assinado corresponde é floor(unix_epoch / 30).
const TOTP_STEP_SECONDS = 30;

// Calcula o step absoluto atual (em UTC). Helper isolado pra facilitar mock
// em testes (mockando Date.now ou injetando custom "now").
function currentAbsoluteStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

// CRIT-06: comprimento bruto dos backup codes (em bytes). 5 bytes = 10 hex chars
// = 40 bits de entropia, ~1.1e12 possibilidades. Para 10 códigos/usuário, é
// muito além de qualquer ataque por adivinhação.
const BACKUP_CODE_BYTES = 5;

// Formato exibido: XXXX-XXXX-XX (10 hex chars com dois hifens) — só UX, não
// participa do hash. A normalização (strip non-hex, uppercase) acontece antes
// da comparação bcrypt em useBackupCode.
function formatBackupCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
}

// Normaliza entrada do usuário: aceita com/sem hífen, com qualquer caso.
// Retorna a forma canônica hex maiúscula (10 chars). Se o input não tiver
// 10 chars hex após normalização, retorna a string vazia (compare falhará).
function normalizeBackupCode(input: string): string {
  const stripped = input.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return stripped.length === 10 ? stripped : '';
}

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

    // Gerar backup codes — raw para hash, formatado para exibição
    const rawCodes = this.generateBackupCodes(10);

    // Hashear códigos raw (sem hífen) — o usuário pode digitar com ou sem
    // hífen na verificação, normalizeBackupCode reconcilia.
    const hashedCodes = await Promise.all(
      rawCodes.map((code) => hashPassword(code))
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
      backupCodes: rawCodes.map(formatBackupCode), // exibe XXXX-XXXX-XX
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

    // Desativar 2FA e remover secret, backup codes e step usado.
    // CRIT-07: zerar twoFactorLastUsedStep evita que um secret antigo
    // re-habilitado venha com restrição irrelevante.
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorLastUsedStep: null,
      },
    });

    return true;
  }

  // SECURITY: Verificar token 2FA no login (aceita TOTP ou backup code)
  //
  // CRIT-07 — Replay protection:
  // RFC 6238 §5.2 obriga implementações a rejeitar reuso do MESMO token TOTP
  // dentro da janela de validade (até ~90s com WINDOW=1). Sem isso, atacante
  // que vê o código uma vez (shoulder-surf, screen-share, extensão maliciosa,
  // MITM em conexão inicial) consegue reusar até o timestep avançar.
  //
  // Implementação:
  // 1. verifyDelta retorna { delta } se válido (delta = offset de step
  //    relativo ao "agora"; -1/0/+1 com WINDOW=1). Se inválido, undefined.
  // 2. Calculamos o step absoluto que o token assinou (currentStep) e
  //    comparamos com twoFactorLastUsedStep. Se <= último usado, é replay.
  // 3. Update do twoFactorLastUsedStep via updateMany com guard atômico
  //    (WHERE OR [null, lt: currentStep]) — duas requests com o mesmo token
  //    em paralelo: apenas a primeira faz count=1, a segunda recebe count=0
  //    e cai como replay (anti-race no nível de banco).
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return false;
    }

    // verifyDelta: retorna { delta: number } se válido, undefined se não.
    const result = speakeasy.totp.verifyDelta({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: WINDOW,
    });

    if (result) {
      // Step absoluto exato que este token assinou.
      const currentStep = currentAbsoluteStep() + result.delta;
      const lastUsedStep = user.twoFactorLastUsedStep;

      // CRIT-07 replay check: se já consumimos este step (ou um futuro,
      // teoricamente impossível mas defensivo).
      if (lastUsedStep !== null && BigInt(currentStep) <= lastUsedStep) {
        securityLogger.totpReplay(userId, {
          currentStep,
          lastUsed: lastUsedStep.toString(),
          reason: 'step_already_consumed',
        });
        // Não cai para backup code: TOTP de 6 dígitos não normaliza pra
        // backup code (precisa de 10 hex chars). Mas mesmo se normalizasse,
        // o replay é forte sinal — fail explícito.
        return false;
      }

      // Update atômico anti-race. Só atualiza se a coluna ainda for null OU
      // estritamente menor que currentStep. Concorrência: duas requests com
      // o mesmo token e mesmo lastUsedStep (ex.: null) — a primeira faz a
      // condição evaporar (vira currentStep), a segunda encontra
      // lastUsedStep == currentStep e recebe count=0.
      const updated = await prisma.user.updateMany({
        where: {
          id: userId,
          OR: [
            { twoFactorLastUsedStep: null },
            { twoFactorLastUsedStep: { lt: BigInt(currentStep) } },
          ],
        },
        data: { twoFactorLastUsedStep: BigInt(currentStep) },
      });

      if (updated.count === 0) {
        // Race detectada: outro request paralelo marcou esse step entre
        // nosso findUnique e nosso updateMany. Tratamos como replay.
        securityLogger.totpReplay(userId, {
          currentStep,
          lastUsed: 'race_lost',
          reason: 'concurrent_update',
        });
        return false;
      }

      return true;
    }

    // Token TOTP não válido — tentar como backup code (CRIT-06 intacto).
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

    // Normaliza ANTES do compare — aceita XXXX-XXXX-XX, xxxxxxxxxx, etc.
    const normalized = normalizeBackupCode(code);
    if (!normalized) return false;

    try {
      const backupCodes = JSON.parse(user.twoFactorBackupCodes) as string[];

      // Verificar se algum código hashado corresponde
      for (let i = 0; i < backupCodes.length; i++) {
        const isMatch = await comparePassword(normalized, backupCodes[i]);

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

  // SECURITY: Gerar backup codes (códigos de recuperação).
  //
  // CRIT-06: ANTES usava Math.random(), que em V8 é xorshift128+ —
  // previsível a partir de ~5 amostras consecutivas. Atacante que viu um
  // código por screenshot, log, ou rota de regeneração reaberta conseguia
  // prever os demais.
  //
  // Agora: crypto.randomBytes(5) → 40 bits de entropia (CSPRNG). Retorna
  // strings RAW (10 hex chars uppercase). Caller deve aplicar
  // formatBackupCode() antes de exibir ao usuário e armazenar o hash do raw.
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(BACKUP_CODE_BYTES).toString('hex').toUpperCase();
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

    // Gerar novos backup codes — raw para hash, formatado para exibição
    const rawCodes = this.generateBackupCodes(10);

    // Hashear códigos raw (mesma convenção de enableTwoFactor)
    const hashedCodes = await Promise.all(
      rawCodes.map((code) => hashPassword(code))
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
      backupCodes: rawCodes.map(formatBackupCode), // exibe XXXX-XXXX-XX
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
