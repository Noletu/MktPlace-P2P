export enum ExchangeRateSource {
  AWESOME_API = 'awesomeapi',
  BANCO_CENTRAL = 'banco_central',
  COINGECKO_BRZ = 'coingecko_brz',
  CACHE = 'cache',
  FALLBACK_FIXED = 'fallback_fixed',
}

export interface ExchangeRateResult {
  rate: number;
  source: ExchangeRateSource;
  timestamp: Date;
  responseTime: number; // em ms
  isStale: boolean; // se veio de cache antigo
}

export interface ExchangeRateHealth {
  source: ExchangeRateSource;
  successCount: number;
  failureCount: number;
  lastSuccess?: Date;
  lastFailure?: Date;
  averageResponseTime: number;
  uptime: number; // porcentagem
}
