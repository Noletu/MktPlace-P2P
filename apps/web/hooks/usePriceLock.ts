import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/utils/api';

/**
 * Hook do price-lock (cotação travada) para criação de pedido a preço de mercado.
 *
 * Trava o unitPrice via POST /orders/quote e mantém um cronômetro de validade.
 * Usado SÓ no modo "Preço de mercado" (enabled=true). No modo "Meu preço" (custom),
 * o hook fica inerte (enabled=false) — a referência de mercado do custom vem do
 * prices[crypto] que a própria tela já tem, fora deste hook.
 *
 * Decisões de UX (fechadas com o Lucas):
 * - TTL de 120s (definido pelo backend; aqui derivamos do expiresAt retornado).
 * - Ao expirar: NÃO auto-renova — o usuário clica em "atualizar" (refresh()).
 */

export interface LockedQuote {
  quoteId: string;
  unitPrice: string; // string (Decimal serializado), ex "5.1473"
  expiresAt: number; // epoch ms (Date.now-comparável)
}

export interface UsePriceLockResult {
  quote: LockedQuote | null;
  secondsLeft: number; // 120 → 0
  isExpired: boolean; // true quando secondsLeft chega a 0
  loading: boolean; // buscando quote
  error: string | null; // erro ao buscar (PT-BR)
  refresh: () => void; // re-travar manualmente (botão "atualizar")
}

/** Resposta de POST /orders/quote (E.2c). */
interface QuoteSuccessResponse {
  success: true;
  data: {
    quoteId: string;
    unitPrice: string;
    expiresAt: string; // ISO 8601
  };
}
interface QuoteErrorResponse {
  success: false;
  code?: string;
  error?: string;
}
type QuoteResponse = QuoteSuccessResponse | QuoteErrorResponse;

/** Mapeia código/erro do backend para mensagem amigável em PT-BR. */
function mapQuoteError(code: string | undefined): string {
  switch (code) {
    case 'INVALID_CRYPTO_TYPE':
      return 'Criptomoeda inválida';
    default:
      return 'Erro ao buscar cotação';
  }
}

export function usePriceLock(params: {
  cryptoType: string;
  enabled: boolean;
}): UsePriceLockResult {
  const { cryptoType, enabled } = params;

  const [quote, setQuote] = useState<LockedQuote | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evita setState após desmontar (fetch em voo + StrictMode).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Busca (trava) uma nova cotação. Reinicia cronômetro e limpa isExpired. */
  const fetchQuote = useCallback(async () => {
    if (!enabled || !cryptoType) return;

    setLoading(true);
    setError(null);
    setIsExpired(false);

    try {
      const response = await fetchWithAuth('/orders/quote', {
        method: 'POST',
        body: JSON.stringify({ cryptoType }),
      });

      const data: QuoteResponse = await response.json();

      if (!mountedRef.current) return;

      if (response.ok && data.success) {
        const expiresAtMs = new Date(data.data.expiresAt).getTime();
        setQuote({
          quoteId: data.data.quoteId,
          unitPrice: data.data.unitPrice,
          expiresAt: expiresAtMs,
        });
        // Primeiro valor do cronômetro (o setInterval ajusta a cada segundo).
        const initial = Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000));
        setSecondsLeft(initial);
      } else {
        const code = !data.success ? data.code : undefined;
        setQuote(null);
        setSecondsLeft(0);
        setError(mapQuoteError(code));
      }
    } catch (err) {
      console.error('[usePriceLock] Erro ao buscar cotação:', err);
      if (!mountedRef.current) return;
      setQuote(null);
      setSecondsLeft(0);
      setError('Erro ao buscar cotação');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, cryptoType]);

  /**
   * Auto-fetch: dispara quando enabled vira true ou cryptoType muda (com enabled).
   * Quando enabled vira false (modo custom): reseta tudo — não há quote.
   */
  useEffect(() => {
    if (!enabled) {
      setQuote(null);
      setSecondsLeft(0);
      setIsExpired(false);
      setLoading(false);
      setError(null);
      return;
    }
    fetchQuote();
  }, [enabled, cryptoType, fetchQuote]);

  /**
   * Cronômetro: deriva secondsLeft de (expiresAt - now). Ao chegar a 0, marca
   * isExpired e para (não auto-renova). Cleanup no unmount e ao trocar de quote.
   */
  useEffect(() => {
    if (!enabled || !quote) return;

    const tick = () => {
      const remaining = Math.max(0, Math.round((quote.expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
        clearInterval(interval);
      }
    };

    // Ajuste imediato (não esperar 1s para o primeiro valor correto).
    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [enabled, quote]);

  const refresh = useCallback(() => {
    fetchQuote();
  }, [fetchQuote]);

  return {
    quote,
    secondsLeft,
    isExpired,
    loading,
    error,
    refresh,
  };
}
