/**
 * Formata valores em BRL (Real Brasileiro)
 * Converte 10000 para R$ 10.000,00
 */
export function formatBRL(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';

  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formata valores numéricos com separadores brasileiros
 * Converte 10000.50 para 10.000,50
 */
export function formatNumber(value: string | number, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0,00';

  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formata valores de criptomoeda
 * BTC: 8 casas decimais
 * USDC/USDT: 2 casas decimais
 */
export function formatCrypto(value: string | number, crypto: string): string {
  const decimals = (crypto === 'USDC' || crypto === 'USDT') ? 2 : 8;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';

  return num.toFixed(decimals);
}
