import { prisma } from '../utils/prisma';

/**
 * SECURITY (SER-39): Service que encapsula a lógica de account
 * lockout automático para falhas de código 2FA (defesa contra
 * brute-force após atacante ter senha correta).
 *
 * Conceitos:
 * - failed2FAAttempts: contador de falhas consecutivas de 2FA
 * - twoFactorLockedUntil: timestamp de quando o lockout 2FA
 *   expira (null = livre)
 * - twoFactorLockoutCount: quantas vezes foi bloqueado por 2FA
 *   (define backoff)
 * - last2FAFailAt: usado para detectar janelas de "esfriar"
 *
 * NÃO TEM RELAÇÃO com SER-22 (lockout de senha). Vetores
 * ortogonais — campos separados, contadores separados,
 * lockouts separados. Duplicação estrutural com
 * accountLockout.service.ts é INTENCIONAL: isolamento total e
 * zero risco no código de senha já em produção (decisão Sessão 8).
 *
 * NÃO TEM RELAÇÃO com accountFrozen (manual/admin/compliance).
 */

const TWO_FA_LOCKOUT_THRESHOLD = 5; // falhas de 2FA p/ disparar lockout (mais permissivo que senha=3; UX de TOTP/backup merece tolerância)
const TWO_FA_COOLDOWN_WINDOW_MS = 30 * 60 * 1000; // 30 min para resetar failed2FAAttempts
const TWO_FA_COUNT_RESET_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h para resetar twoFactorLockoutCount
const TWO_FA_LOCKOUT_COUNT_CAP = 4; // não escalar backoff acima disso

// Backoff exponencial em ms, indexado por (twoFactorLockoutCount - 1), cap em 4.
const TWO_FA_BACKOFF_DURATIONS = [
  5 * 60 * 1000, // count=1: 5 min
  30 * 60 * 1000, // count=2: 30 min
  2 * 60 * 60 * 1000, // count=3: 2 h
  24 * 60 * 60 * 1000, // count=4+: 24 h
];

export interface TwoFALockStatus {
  locked: boolean;
  lockedUntil?: Date;
}

export interface Failed2FAResult {
  lockoutTriggered: boolean;
  lockedUntil?: Date;
  durationMin?: number;
}

export class TwoFactorLockoutService {
  /**
   * Lê o estado de lockout 2FA do usuário SEM modificar o registro (pure read).
   *
   * - twoFactorLockedUntil no futuro → { locked: true, lockedUntil }
   * - twoFactorLockedUntil null ou já expirado → { locked: false }
   *
   * Quando twoFactorLockedUntil está setado mas já passou, NÃO limpamos aqui
   * (este método é read-only). O cleanup lazy acontece no próximo
   * recordFailed2FA (Passo 2, via WHERE atômico) ou em recordSuccessful2FA.
   */
  async isLockedFor2FA(userId: string): Promise<TwoFALockStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorLockedUntil: true },
    });

    if (!user || !user.twoFactorLockedUntil) {
      return { locked: false };
    }

    if (user.twoFactorLockedUntil.getTime() > Date.now()) {
      return { locked: true, lockedUntil: user.twoFactorLockedUntil };
    }

    return { locked: false };
  }

  /**
   * Reseta os contadores de falha após um 2FA bem-sucedido (Caso C do
   * complete-login).
   *
   * - failed2FAAttempts → 0
   * - twoFactorLockedUntil → null
   * - twoFactorLockoutCount NÃO é resetado aqui (só reseta pela janela de 24h
   *   em recordFailed2FA) — escalonar o backoff depende dessa memória.
   * - last2FAFailAt mantém o valor (inofensivo; reavaliado na próxima falha).
   *
   * Usa updateMany com guarda no WHERE para evitar uma escrita inútil a cada
   * login (o caso comum é o 2FA passar sem nenhuma falha pendente).
   */
  async recordSuccessful2FA(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ failed2FAAttempts: { gt: 0 } }, { twoFactorLockedUntil: { not: null } }],
      },
      data: { failed2FAAttempts: 0, twoFactorLockedUntil: null },
    });
  }

  /**
   * Registra uma falha de 2FA e, se atingir o threshold, dispara o lockout
   * com backoff exponencial.
   *
   * PREMISSA: o caller (completeLogin no controller, Fase 2) DEVE chamar
   * isLockedFor2FA() antes de prosseguir para verifyToken e recordFailed2FA.
   * Se uma conta em lockout chegar a este método, ele incrementa o contador e
   * pode escalar o backoff prematuramente. O enforcement no Caso C garante
   * essa ordem; mas vale documentar para evitar regressão futura.
   *
   * ATOMICIDADE: decomposto em operações atômicas de DB (não há read-modify-
   * write do contador em memória), evitando lost-update sob concorrência
   * (atacante com botnet → N requests simultâneos). Lição do SER-23:
   * $transaction interativo NÃO previne lost-update — por isso usamos
   * increment atômico e updateMany condicionais (WHERE avaliado pelo banco).
   *
   * Passo 1 — reset atômico de twoFactorLockoutCount se passou a janela de 24h.
   * Passo 2 — reset atômico de failed2FAAttempts (e limpeza de
   *           twoFactorLockedUntil) se a janela de cooldown (30min) expirou OU
   *           se um lockout anterior já passou (nova janela de contagem).
   * Passo 3 — increment atômico + leitura do valor pós-incremento.
   * Passo 4 — se atingiu o threshold, escala twoFactorLockoutCount (cap 4) e
   *           seta twoFactorLockedUntil.
   *
   * Sob burst concorrente o pior caso é benigno: a conta é bloqueada e o
   * backoff escala no máximo +1 (não há bypass — failed2FAAttempts nunca fica
   * abaixo do real por lost-update, pois increment serializa no banco).
   */
  async recordFailed2FA(userId: string): Promise<Failed2FAResult> {
    const now = new Date();

    // Passo 1: twoFactorLockoutCount esfria após 24h sem nenhuma falha.
    await prisma.user.updateMany({
      where: { id: userId, last2FAFailAt: { lt: new Date(now.getTime() - TWO_FA_COUNT_RESET_WINDOW_MS) } },
      data: { twoFactorLockoutCount: 0 },
    });

    // Passo 2: failed2FAAttempts esfria após 30min, ou após um lockout expirar.
    // (twoFactorLockedUntil null não casa `lte` — comparação SQL com NULL é unknown.)
    await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { last2FAFailAt: { lt: new Date(now.getTime() - TWO_FA_COOLDOWN_WINDOW_MS) } },
          { twoFactorLockedUntil: { lte: now } },
        ],
      },
      data: { failed2FAAttempts: 0, twoFactorLockedUntil: null },
    });

    // Passo 3: increment atômico + leitura pós-incremento.
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { failed2FAAttempts: { increment: 1 }, last2FAFailAt: now },
      select: { failed2FAAttempts: true, twoFactorLockoutCount: true },
    });

    if (updated.failed2FAAttempts < TWO_FA_LOCKOUT_THRESHOLD) {
      return { lockoutTriggered: false };
    }

    if (updated.failed2FAAttempts > TWO_FA_LOCKOUT_THRESHOLD) {
      // Outra thread em rajada concorrente já cruzou o threshold e
      // disparou trigger2FALockout. Não escalar twoFactorLockoutCount de
      // novo — o increment atômico do Passo 3 garante que apenas uma thread
      // lê failed2FAAttempts === TWO_FA_LOCKOUT_THRESHOLD exato.
      return { lockoutTriggered: false };
    }

    // Passo 4: failed2FAAttempts === TWO_FA_LOCKOUT_THRESHOLD exato → trigger.
    return this.trigger2FALockout(userId, updated.twoFactorLockoutCount, now);
  }

  /**
   * Aplica o lockout 2FA: incrementa twoFactorLockoutCount (cap em 4), calcula
   * a duração via backoff exponencial e seta twoFactorLockedUntil = now + duração.
   */
  private async trigger2FALockout(
    userId: string,
    currentLockoutCount: number,
    now: Date
  ): Promise<Failed2FAResult> {
    const newLockoutCount = Math.min(currentLockoutCount + 1, TWO_FA_LOCKOUT_COUNT_CAP);
    const durationMs =
      TWO_FA_BACKOFF_DURATIONS[Math.min(newLockoutCount - 1, TWO_FA_BACKOFF_DURATIONS.length - 1)];
    const lockedUntil = new Date(now.getTime() + durationMs);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorLockoutCount: newLockoutCount, twoFactorLockedUntil: lockedUntil },
    });

    return {
      lockoutTriggered: true,
      lockedUntil,
      durationMin: durationMs / (60 * 1000),
    };
  }
}

export const twoFactorLockoutService = new TwoFactorLockoutService();
