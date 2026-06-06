import { prisma } from '../utils/prisma';

/**
 * SECURITY (SER-22): Service que encapsula a lógica de account
 * lockout automático (defesa anti-brute-force).
 *
 * Conceitos:
 * - failedLoginAttempts: contador de falhas consecutivas
 * - lockedUntil: timestamp de quando o lockout expira (null = livre)
 * - lockoutCount: quantas vezes a conta foi bloqueada (define backoff)
 * - lastFailedLoginAt: usado para detectar janelas de "esfriar"
 *
 * NÃO TEM RELAÇÃO com accountFrozen (manual/admin/compliance).
 * Lockout e freeze são ortogonais — coexistem sem se interferir.
 */

const LOCKOUT_THRESHOLD = 3; // falhas consecutivas para disparar lockout
const COOLDOWN_WINDOW_MS = 30 * 60 * 1000; // 30 min para resetar failedLoginAttempts
const COUNT_RESET_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h para resetar lockoutCount
const LOCKOUT_COUNT_CAP = 4; // não escalar backoff acima disso

// Backoff exponencial em ms, indexado por (lockoutCount - 1), cap em 4.
const BACKOFF_DURATIONS = [
  5 * 60 * 1000, // lockoutCount=1: 5 min
  30 * 60 * 1000, // lockoutCount=2: 30 min
  2 * 60 * 60 * 1000, // lockoutCount=3: 2 h
  24 * 60 * 60 * 1000, // lockoutCount=4+: 24 h
];

export interface LockStatus {
  locked: boolean;
  lockedUntil?: Date;
}

export interface FailedLoginResult {
  lockoutTriggered: boolean;
  lockedUntil?: Date;
  durationMin?: number;
}

export class AccountLockoutService {
  /**
   * Lê o estado de lockout do usuário SEM modificar o registro (pure read).
   *
   * - lockedUntil no futuro → { locked: true, lockedUntil }
   * - lockedUntil null ou já expirado → { locked: false }
   *
   * Quando lockedUntil está setado mas já passou, NÃO limpamos aqui (este
   * método é read-only). O cleanup lazy acontece no próximo recordFailedLogin
   * (Passo 2, via WHERE atômico) ou em recordSuccessfulLogin.
   */
  async isLocked(userId: string): Promise<LockStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lockedUntil: true },
    });

    if (!user || !user.lockedUntil) {
      return { locked: false };
    }

    if (user.lockedUntil.getTime() > Date.now()) {
      return { locked: true, lockedUntil: user.lockedUntil };
    }

    return { locked: false };
  }

  /**
   * Reseta os contadores de falha após um login bem-sucedido.
   *
   * - failedLoginAttempts → 0
   * - lockedUntil → null
   * - lockoutCount NÃO é resetado aqui (só reseta pela janela de 24h em
   *   recordFailedLogin) — escalonar o backoff depende dessa memória.
   * - lastFailedLoginAt mantém o valor (inofensivo; reavaliado na próxima falha).
   *
   * Usa updateMany com guarda no WHERE para evitar uma escrita inútil a cada
   * login (o caso comum é o usuário logar sem nenhuma falha pendente).
   */
  async recordSuccessfulLogin(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ failedLoginAttempts: { gt: 0 } }, { lockedUntil: { not: null } }],
      },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  /**
   * Registra uma falha de login e, se atingir o threshold, dispara o lockout
   * com backoff exponencial.
   *
   * PREMISSA: o caller (verifyCredentials no controller, Fase 2) DEVE chamar
   * isLocked() antes de prosseguir para bcrypt e recordFailedLogin. Se uma
   * conta em lockout chegar a este método, ele incrementa o contador e pode
   * escalar o backoff prematuramente. Caminho Z do SER-22 garante essa ordem;
   * mas vale documentar para evitar regressão futura.
   *
   * ATOMICIDADE: decomposto em operações atômicas de DB (não há read-modify-
   * write do contador em memória), evitando lost-update sob concorrência
   * (atacante com botnet → N requests simultâneos). Lição do SER-23:
   * $transaction interativo NÃO previne lost-update — por isso usamos
   * increment atômico e updateMany condicionais (WHERE avaliado pelo banco).
   *
   * Passo 1 — reset atômico de lockoutCount se passou a janela de 24h.
   * Passo 2 — reset atômico de failedLoginAttempts (e limpeza de lockedUntil)
   *           se a janela de cooldown (30min) expirou OU se um lockout anterior
   *           já passou (início de uma nova janela de contagem).
   * Passo 3 — increment atômico + leitura do valor pós-incremento.
   * Passo 4 — se atingiu o threshold, escala lockoutCount (cap 4) e seta
   *           lockedUntil.
   *
   * Sob burst concorrente o pior caso é benigno: a conta é bloqueada e o
   * backoff escala no máximo +1 (não há bypass — failedLoginAttempts nunca
   * fica abaixo do real por lost-update, pois increment serializa no banco).
   */
  async recordFailedLogin(userId: string): Promise<FailedLoginResult> {
    const now = new Date();

    // Passo 1: lockoutCount esfria após 24h sem nenhuma falha.
    await prisma.user.updateMany({
      where: { id: userId, lastFailedLoginAt: { lt: new Date(now.getTime() - COUNT_RESET_WINDOW_MS) } },
      data: { lockoutCount: 0 },
    });

    // Passo 2: failedLoginAttempts esfria após 30min, ou após um lockout expirar.
    // (lockedUntil null não casa `lte` — comparação SQL com NULL é unknown.)
    await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lastFailedLoginAt: { lt: new Date(now.getTime() - COOLDOWN_WINDOW_MS) } },
          { lockedUntil: { lte: now } },
        ],
      },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    // Passo 3: increment atômico + leitura pós-incremento.
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 }, lastFailedLoginAt: now },
      select: { failedLoginAttempts: true, lockoutCount: true },
    });

    if (updated.failedLoginAttempts < LOCKOUT_THRESHOLD) {
      return { lockoutTriggered: false };
    }

    if (updated.failedLoginAttempts > LOCKOUT_THRESHOLD) {
      // Outra thread em rajada concorrente já cruzou o threshold e
      // disparou triggerLockout. Não escalar lockoutCount de novo —
      // o increment atômico do Passo 3 garante que apenas uma thread
      // lê failedLoginAttempts === LOCKOUT_THRESHOLD exato.
      return { lockoutTriggered: false };
    }

    // Passo 4: failedLoginAttempts === LOCKOUT_THRESHOLD exato → trigger.
    return this.triggerLockout(userId, updated.lockoutCount, now);
  }

  /**
   * Aplica o lockout: incrementa lockoutCount (cap em 4), calcula a duração via
   * backoff exponencial e seta lockedUntil = now + duração.
   */
  private async triggerLockout(
    userId: string,
    currentLockoutCount: number,
    now: Date
  ): Promise<FailedLoginResult> {
    const newLockoutCount = Math.min(currentLockoutCount + 1, LOCKOUT_COUNT_CAP);
    const durationMs = BACKOFF_DURATIONS[Math.min(newLockoutCount - 1, BACKOFF_DURATIONS.length - 1)];
    const lockedUntil = new Date(now.getTime() + durationMs);

    await prisma.user.update({
      where: { id: userId },
      data: { lockoutCount: newLockoutCount, lockedUntil },
    });

    return {
      lockoutTriggered: true,
      lockedUntil,
      durationMin: durationMs / (60 * 1000),
    };
  }
}

export const accountLockoutService = new AccountLockoutService();
