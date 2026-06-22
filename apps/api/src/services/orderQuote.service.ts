import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { priceService } from './price.service';
import { CryptoType } from '../types/crypto.types';

/**
 * Service do price-lock (cotação travada) para criação de pedido a preço de mercado.
 *
 * Fluxo: o cliente trava o unitPrice de uma cripto via POST /orders/quote e recebe
 * { quoteId, unitPrice, expiresAt }. No submit de um pedido a mercado, envia o quoteId;
 * o backend valida/consome a quote e usa o preço travado — eliminando a divergência
 * entre o preço exibido e o gravado. Não se aplica ao modo de preço personalizado (custom).
 *
 * Decisões (fechadas com o Lucas):
 * - TTL de 120s.
 * - Single-use: usedAt é marcado SÓ no sucesso da criação do pedido (E.2d), idealmente
 *   na MESMA transação — por isso consumeOrderQuote/markQuoteUsed aceitam um tx opcional.
 * - Erros de negócio são sinalizados via `throw new Error('CODE')` (mesmo padrão de
 *   auth.service: '2FA_REQUIRED', 'CURRENT_PASSWORD_INVALID'); o controller (E.2c) mapeia
 *   o code para o HTTP apropriado. Códigos: QUOTE_NOT_FOUND, QUOTE_FORBIDDEN,
 *   QUOTE_ALREADY_USED, QUOTE_EXPIRED, INVALID_CRYPTO_TYPE.
 */
const QUOTE_TTL_MS = 120 * 1000; // 120s (decisão Lucas)

class OrderQuoteService {
  /**
   * Cria uma cotação travada para o usuário, com validade de 120s.
   */
  async createOrderQuote(
    userId: string,
    cryptoType: string
  ): Promise<{ quoteId: string; unitPrice: string; expiresAt: Date }> {
    // Validar cryptoType contra o enum (mesma checagem do price.controller).
    // A feature usa BTC/USDC/USDT, mas o backend valida contra CryptoType em geral —
    // a restrição às 3 é da UI.
    if (!Object.values(CryptoType).includes(cryptoType as CryptoType)) {
      throw new Error('INVALID_CRYPTO_TYPE');
    }

    // Buscar a cotação atual (mesma fonte do cálculo de pedido a mercado).
    const quote = await priceService.getPrice(cryptoType as CryptoType);

    // O PriceQuote retornado não expõe a origem; derivamos coerente com o que o
    // price.service persiste: stablecoins via exchange, demais via coingecko.
    const source =
      cryptoType === CryptoType.USDC || cryptoType === CryptoType.USDT
        ? 'exchange'
        : 'coingecko';

    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);

    const created = await prisma.orderQuote.create({
      data: {
        userId,
        cryptoType,
        unitPrice: quote.brlPrice,
        source,
        expiresAt,
      },
    });

    return { quoteId: created.id, unitPrice: quote.brlPrice, expiresAt };
  }

  /**
   * Valida uma quote e retorna o unitPrice travado. NÃO marca usedAt aqui —
   * a marcação ocorre no sucesso da criação do pedido (markQuoteUsed), idealmente
   * na mesma transação. Passe `tx` para ler dentro da transação do pedido.
   *
   * Lança Error com code: QUOTE_NOT_FOUND | QUOTE_FORBIDDEN | QUOTE_ALREADY_USED | QUOTE_EXPIRED.
   */
  async consumeOrderQuote(
    quoteId: string,
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const db = tx ?? prisma;

    const quote = await db.orderQuote.findUnique({ where: { id: quoteId } });

    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    // Não pertence ao usuário: logar a tentativa, mas tratar como not found do ponto
    // de vista do cliente (não vazar que a quote existe para outro usuário).
    if (quote.userId !== userId) {
      console.warn(
        `[OrderQuote] Tentativa de uso de quote de outro usuário: quoteId=${quoteId}, dono=${quote.userId}, tentativa=${userId}`
      );
      throw new Error('QUOTE_FORBIDDEN');
    }

    if (quote.usedAt != null) {
      throw new Error('QUOTE_ALREADY_USED');
    }

    if (quote.expiresAt.getTime() <= Date.now()) {
      throw new Error('QUOTE_EXPIRED');
    }

    return quote.unitPrice.toString();
  }

  /**
   * Marca a quote como usada (single-use) e vincula o pedido que a consumiu.
   * Deve ser chamado no sucesso da criação do pedido (E.2d), na MESMA transação.
   *
   * Atômico contra corrida de duplo-uso: só marca se ainda estiver não-usada
   * (updateMany WHERE usedAt IS NULL); se outra transação já marcou, lança
   * QUOTE_ALREADY_USED.
   */
  async markQuoteUsed(
    quoteId: string,
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const db = tx ?? prisma;

    const result = await db.orderQuote.updateMany({
      where: { id: quoteId, usedAt: null },
      data: { usedAt: new Date(), orderId },
    });

    if (result.count === 0) {
      throw new Error('QUOTE_ALREADY_USED');
    }
  }
}

export const orderQuoteService = new OrderQuoteService();
