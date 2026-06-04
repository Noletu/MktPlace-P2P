import crypto from 'crypto';
import { PendingLogin } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * SECURITY (SER-23): Service que encapsula o estado de login em andamento
 * (PendingLogin) — criado após a senha ser validada, enquanto se aguarda o
 * segundo fator (2FA) ou a finalização do login.
 *
 * O token cleartext NUNCA é persistido: o banco guarda apenas o hash SHA-256.
 * O cleartext vive somente no cookie HttpOnly do cliente. Assim, um dump do
 * banco não compromete sessões de login em andamento.
 */

const PENDING_LOGIN_TTL_SECONDS = 120;
const INITIAL_ATTEMPTS = 3;
const INTERMEDIATE_TOKEN_BYTES = 32; // 256 bits, base64url

/**
 * Calcula o hash SHA-256 (hex) de um token cleartext.
 * SECURITY: o resultado é o único representante do token guardado no banco.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class PendingLoginService {
  /**
   * Cria um novo PendingLogin para o user e retorna o token cleartext
   * (destinado ao cookie HttpOnly). O banco guarda apenas o hash SHA-256.
   */
  async createPendingLogin(userId: string): Promise<{ token: string; expiresAt: Date }> {
    // SECURITY: 256 bits de entropia, codificados em base64url (URL-safe, sem padding)
    const token = crypto.randomBytes(INTERMEDIATE_TOKEN_BYTES).toString('base64url');
    const tokenHash = hashToken(token);

    const expiresAt = new Date(Date.now() + PENDING_LOGIN_TTL_SECONDS * 1000);

    await prisma.pendingLogin.create({
      data: {
        userId,
        tokenHash,
        attemptsRemaining: INITIAL_ATTEMPTS,
        expiresAt,
        // usedAt: null (default)
      },
    });

    logger.info('[AUTH] PendingLogin created', { userId, expiresAt });

    return { token, expiresAt };
  }

  /**
   * Valida o token cleartext e retorna o PendingLogin se válido.
   * Retorna null se o token não existe, já foi usado, expirou ou esgotou as
   * tentativas. NÃO altera nenhum contador — apenas consulta.
   */
  async validatePendingLogin(token: string): Promise<PendingLogin | null> {
    const tokenHash = hashToken(token);

    const pendingLogin = await prisma.pendingLogin.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attemptsRemaining: { gt: 0 },
      },
    });

    if (!pendingLogin) {
      // SECURITY: não logar token nem hash — apenas o fato da falha.
      logger.warn('[AUTH] Invalid/expired pendingLogin token attempt');
      return null;
    }

    return pendingLogin;
  }

  /**
   * Marca o PendingLogin como usado (single-use). Após isso,
   * validatePendingLogin retorna null para o token correspondente.
   */
  async consumePendingLogin(id: string): Promise<void> {
    const updated = await prisma.pendingLogin.update({
      where: { id },
      data: { usedAt: new Date() },
    });

    logger.info('[AUTH] PendingLogin consumed', { id, userId: updated.userId });
  }

  /**
   * Decrementa attemptsRemaining em 1. Se atingir 0, marca o registro como
   * usado (usedAt = now) para invalidá-lo imediatamente. Retorna o
   * attemptsRemaining resultante (0 quando o limite é atingido).
   */
  async decrementAttempts(id: string): Promise<number> {
    // Decremento atômico: Postgres garante que o SET attemptsRemaining
    // = attemptsRemaining - 1 opera sobre o valor mais recente,
    // prevenindo lost-update entre transações concorrentes.
    try {
      const updated = await prisma.pendingLogin.update({
        where: { id },
        data: { attemptsRemaining: { decrement: 1 } },
        select: { attemptsRemaining: true, userId: true },
      });

      if (updated.attemptsRemaining <= 0) {
        // Esgotou as tentativas — invalidar imediatamente.
        await prisma.pendingLogin.update({
          where: { id },
          data: { usedAt: new Date() },
        });
        logger.warn('[AUTH] PendingLogin attempts exhausted', {
          id,
          userId: updated.userId,
        });
        return 0;
      }

      return updated.attemptsRemaining;
    } catch (error) {
      // Registro não existe (já consumido/expirado por outro path):
      // tratar como esgotado.
      logger.warn('[AUTH] decrementAttempts on inexistent record', { id });
      return 0;
    }
  }
}

export const pendingLoginService = new PendingLoginService();
