import {
  ExchangeRateSource,
  ExchangeRateResult,
  ExchangeRateHealth,
} from '../types/exchange-rate.types';
import {prisma} from '../utils/prisma';

/**
 * Serviço robusto de taxa de câmbio USD/BRL com múltiplas fontes e fallback
 */
export class ExchangeRateService {
  private static healthMetrics: Map<ExchangeRateSource, ExchangeRateHealth> = new Map();
  private static rateCache: ExchangeRateResult | null = null;
  private static readonly CACHE_DURATION_MS = 60 * 1000; // 60 segundos
  private static readonly MAX_CACHE_AGE_MS = 5 * 60 * 1000; // 5 minutos
  private static readonly MAX_DIVERGENCE_PERCENT = 5.0; // 5%
  private static readonly TIMEOUT_MS = 5000; // 5 segundos

  /**
   * Busca taxa USD/BRL com sistema de fallback em cascata
   */
  static async getUsdBrlRate(): Promise<ExchangeRateResult> {
    console.log('\n📊 [ExchangeRateService] Buscando taxa USD/BRL...');

    // Verificar cache primeiro
    if (this.isCacheValid()) {
      console.log('✅ [ExchangeRateService] Usando cache válido');
      return this.rateCache!;
    }

    // Tentar fontes em ordem de prioridade
    const sources = [
      () => this.fetchFromAwesomeAPI(),
      () => this.fetchFromBancoCentral(),
      () => this.fetchFromCoinGeckoBRZ(),
    ];

    for (const fetchFunction of sources) {
      try {
        const result = await fetchFunction();

        // Validar resultado
        if (this.isValidRate(result.rate)) {
          this.rateCache = result;
          await this.saveToDatabase(result);
          console.log(
            `✅ [ExchangeRateService] Taxa obtida: ${result.rate.toFixed(4)} (fonte: ${result.source})`
          );
          return result;
        }
      } catch (error) {
        console.error(
          `❌ [ExchangeRateService] Erro em ${fetchFunction.name}:`,
          error
        );
        continue;
      }
    }

    // Se todas falharam, tentar cache antigo
    console.warn(
      '⚠️ [ExchangeRateService] Todas fontes falharam, tentando cache antigo...'
    );
    const cachedRate = await this.fetchFromCache();
    if (cachedRate) {
      console.log(
        `⚠️ [ExchangeRateService] Usando cache antigo: ${cachedRate.rate.toFixed(4)} (idade: ${this.getCacheAge(cachedRate)} min)`
      );
      return cachedRate;
    }

    // Último recurso: valor fixo
    console.error(
      '🚨 [ExchangeRateService] ALERTA: Usando valor fixo de emergência!'
    );
    return {
      rate: 5.5,
      source: ExchangeRateSource.FALLBACK_FIXED,
      timestamp: new Date(),
      responseTime: 0,
      isStale: true,
    };
  }

  /**
   * FONTE 1: AwesomeAPI (Primária)
   */
  private static async fetchFromAwesomeAPI(): Promise<ExchangeRateResult> {
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(
        'https://economia.awesomeapi.com.br/json/last/USD-BRL',
        {
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const rate = Number(data.USDBRL.bid); // bid = preço de compra

      if (isNaN(rate) || rate <= 0) {
        throw new Error('Taxa inválida');
      }

      const responseTime = Date.now() - startTime;
      this.recordSuccess(ExchangeRateSource.AWESOME_API, responseTime);

      return {
        rate,
        source: ExchangeRateSource.AWESOME_API,
        timestamp: new Date(),
        responseTime,
        isStale: false,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.recordFailure(ExchangeRateSource.AWESOME_API);
      throw error;
    }
  }

  /**
   * FONTE 2: Banco Central do Brasil (Oficial)
   */
  private static async fetchFromBancoCentral(): Promise<ExchangeRateResult> {
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      // Buscar PTAX do dia atual
      const today = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${today}'&$format=json`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.value || data.value.length === 0) {
        throw new Error('Nenhuma cotação disponível para hoje');
      }

      const rate = Number(data.value[0].cotacaoCompra); // Cotação de compra

      if (isNaN(rate) || rate <= 0) {
        throw new Error('Taxa inválida');
      }

      const responseTime = Date.now() - startTime;
      this.recordSuccess(ExchangeRateSource.BANCO_CENTRAL, responseTime);

      return {
        rate,
        source: ExchangeRateSource.BANCO_CENTRAL,
        timestamp: new Date(),
        responseTime,
        isStale: false,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.recordFailure(ExchangeRateSource.BANCO_CENTRAL);
      throw error;
    }
  }

  /**
   * FONTE 3: CoinGecko BRZ (Crypto)
   */
  private static async fetchFromCoinGeckoBRZ(): Promise<ExchangeRateResult> {
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=brz&vs_currencies=usd',
        {signal: controller.signal}
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const brzPrice = data.brz?.usd;

      if (!brzPrice || brzPrice <= 0) {
        throw new Error('Preço BRZ inválido');
      }

      const rate = 1 / brzPrice; // Inverter: BRZ = $0.18 → USD = 5.56 BRL

      const responseTime = Date.now() - startTime;
      this.recordSuccess(ExchangeRateSource.COINGECKO_BRZ, responseTime);

      return {
        rate,
        source: ExchangeRateSource.COINGECKO_BRZ,
        timestamp: new Date(),
        responseTime,
        isStale: false,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.recordFailure(ExchangeRateSource.COINGECKO_BRZ);
      throw error;
    }
  }

  /**
   * FONTE 4: Cache Local (Banco de Dados)
   */
  private static async fetchFromCache(): Promise<ExchangeRateResult | null> {
    try {
      const lastRate = await prisma.exchangeRate.findFirst({
        orderBy: {timestamp: 'desc'},
        where: {
          source: {
            in: [
              ExchangeRateSource.AWESOME_API,
              ExchangeRateSource.BANCO_CENTRAL,
              ExchangeRateSource.COINGECKO_BRZ,
            ],
          },
        },
      });

      if (!lastRate) {
        return null;
      }

      const age = Date.now() - lastRate.timestamp.getTime();

      // Rejeitar cache > 5 minutos
      if (age > this.MAX_CACHE_AGE_MS) {
        console.warn(
          `⚠️ [ExchangeRateService] Cache muito antigo (${(age / 60000).toFixed(1)} min), rejeitando`
        );
        return null;
      }

      return {
        rate: Number(lastRate.rate),
        source: lastRate.source as ExchangeRateSource,
        timestamp: lastRate.timestamp,
        responseTime: 0,
        isStale: true,
      };
    } catch (error) {
      console.error('❌ [ExchangeRateService] Erro ao buscar cache:', error);
      return null;
    }
  }

  /**
   * Salvar taxa no banco de dados para cache e auditoria
   */
  private static async saveToDatabase(result: ExchangeRateResult): Promise<void> {
    try {
      await prisma.exchangeRate.create({
        data: {
          rate: result.rate.toString(),
          source: result.source,
          responseTime: result.responseTime,
          timestamp: result.timestamp,
        },
      });
    } catch (error) {
      console.error('❌ [ExchangeRateService] Erro ao salvar no banco:', error);
    }
  }

  /**
   * Validar se taxa está dentro de limites razoáveis
   */
  private static isValidRate(rate: number): boolean {
    // USD/BRL normalmente está entre 4.50 e 6.50
    return rate >= 4.0 && rate <= 7.0;
  }

  /**
   * Verificar se cache em memória é válido
   */
  private static isCacheValid(): boolean {
    if (!this.rateCache) {
      return false;
    }

    const age = Date.now() - this.rateCache.timestamp.getTime();
    return age < this.CACHE_DURATION_MS;
  }

  /**
   * Calcular idade do cache em minutos
   */
  private static getCacheAge(result: ExchangeRateResult): number {
    return (Date.now() - result.timestamp.getTime()) / 60000;
  }

  /**
   * Registrar sucesso de uma fonte
   */
  private static recordSuccess(
    source: ExchangeRateSource,
    responseTime: number
  ): void {
    const health = this.healthMetrics.get(source) || {
      source,
      successCount: 0,
      failureCount: 0,
      averageResponseTime: 0,
      uptime: 100,
    };

    health.successCount++;
    health.lastSuccess = new Date();
    health.averageResponseTime =
      (health.averageResponseTime * (health.successCount - 1) + responseTime) /
      health.successCount;
    health.uptime =
      (health.successCount / (health.successCount + health.failureCount)) * 100;

    this.healthMetrics.set(source, health);
  }

  /**
   * Registrar falha de uma fonte
   */
  private static recordFailure(source: ExchangeRateSource): void {
    const health = this.healthMetrics.get(source) || {
      source,
      successCount: 0,
      failureCount: 0,
      averageResponseTime: 0,
      uptime: 0,
    };

    health.failureCount++;
    health.lastFailure = new Date();
    health.uptime =
      (health.successCount / (health.successCount + health.failureCount)) * 100;

    this.healthMetrics.set(source, health);
  }

  /**
   * Obter métricas de saúde de todas as fontes
   */
  static getHealthMetrics(): ExchangeRateHealth[] {
    return Array.from(this.healthMetrics.values());
  }

  /**
   * Comparar taxas de múltiplas fontes para validação
   */
  static async validateRateConsistency(): Promise<{
    isConsistent: boolean;
    rates: {source: string; rate: number}[];
    maxDivergence: number;
  }> {
    const results: {source: string; rate: number}[] = [];

    // Buscar de todas as fontes em paralelo
    const sources = [
      {name: 'AwesomeAPI', fn: () => this.fetchFromAwesomeAPI()},
      {name: 'BancoCentral', fn: () => this.fetchFromBancoCentral()},
      {name: 'CoinGeckoBRZ', fn: () => this.fetchFromCoinGeckoBRZ()},
    ];

    await Promise.all(
      sources.map(async ({name, fn}) => {
        try {
          const result = await fn();
          results.push({source: name, rate: result.rate});
        } catch (error) {
          console.error(`Erro em ${name}:`, error);
        }
      })
    );

    if (results.length < 2) {
      return {
        isConsistent: false,
        rates: results,
        maxDivergence: 100,
      };
    }

    // Calcular divergência máxima
    const rates = results.map(r => r.rate);
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const maxDivergence = ((maxRate - minRate) / minRate) * 100;

    return {
      isConsistent: maxDivergence <= this.MAX_DIVERGENCE_PERCENT,
      rates: results,
      maxDivergence,
    };
  }
}
