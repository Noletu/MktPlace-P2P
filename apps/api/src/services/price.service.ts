import { PrismaClient } from '@prisma/client';
import { CryptoType, COINGECKO_IDS, PriceQuote } from '../types/crypto.types';
import { ExchangeRateService } from './exchange-rate.service';

const prisma = new PrismaClient();

export class PriceService {
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  private readonly CACHE_DURATION = 60 * 1000; // 60 segundos
  private priceCache: Map<CryptoType, { price: PriceQuote; timestamp: number }> = new Map();

  async getPrice(crypto: CryptoType): Promise<PriceQuote> {
    // Verificar cache
    const cached = this.priceCache.get(crypto);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    try {
      const coinId = COINGECKO_IDS[crypto];

      // Para USDC e USDT, usar ExchangeRateService (stablecoins = 1 USD)
      if (crypto === CryptoType.USDC || crypto === CryptoType.USDT) {
        const exchangeRate = await ExchangeRateService.getUsdBrlRate();

        const quote: PriceQuote = {
          crypto,
          brlPrice: exchangeRate.rate.toString(),
          usdPrice: '1.00', // Stablecoin sempre = 1 USD
          timestamp: exchangeRate.timestamp,
        };

        // Atualizar cache
        this.priceCache.set(crypto, {price: quote, timestamp: Date.now()});

        // Salvar no banco
        await prisma.priceQuote.create({
          data: {
            cryptoType: crypto,
            brlPrice: quote.brlPrice,
            source: exchangeRate.source, // awesomeapi, banco_central, etc
          },
        });

        console.log(
          `💰 [PriceService] ${crypto} price: 1 ${crypto} = R$ ${exchangeRate.rate.toFixed(4)} (fonte: ${exchangeRate.source})`
        );

        return quote;
      }

      // Para outras criptos (BTC, etc), continuar usando CoinGecko normalmente
      const response = await fetch(
        `${this.COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=brl,usd`
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar cotação');
      }

      const data = await response.json() as Record<string, { brl?: number; usd?: number }>;
      const brlPrice = data[coinId]?.brl;
      const usdPrice = data[coinId]?.usd;

      if (!brlPrice || !usdPrice) {
        throw new Error('Cotação não disponível');
      }

      const quote: PriceQuote = {
        crypto,
        brlPrice: brlPrice.toString(),
        usdPrice: usdPrice.toString(),
        timestamp: new Date(),
      };

      // Atualizar cache
      this.priceCache.set(crypto, { price: quote, timestamp: Date.now() });

      // Salvar no banco
      await prisma.priceQuote.create({
        data: {
          cryptoType: crypto,
          brlPrice: quote.brlPrice,
          source: 'coingecko',
        },
      });

      return quote;
    } catch (error) {
      console.error('Error fetching price:', error);

      // Tentar buscar última cotação do banco
      const lastQuote = await prisma.priceQuote.findFirst({
        where: { cryptoType: crypto },
        orderBy: { createdAt: 'desc' },
      });

      if (lastQuote) {
        return {
          crypto,
          brlPrice: lastQuote.brlPrice,
          usdPrice: '0', // Não temos USD no banco
          timestamp: lastQuote.createdAt,
        };
      }

      throw new Error('Cotação não disponível');
    }
  }

  async getAllPrices(): Promise<PriceQuote[]> {
    const cryptos = Object.values(CryptoType);

    // Use Promise.allSettled to handle individual failures gracefully
    const results = await Promise.allSettled(
      cryptos.map((crypto) => this.getPrice(crypto))
    );

    // Filter successful results and log failures
    const prices: PriceQuote[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        prices.push(result.value);
      } else {
        console.error(`Failed to fetch price for ${cryptos[index]}:`, result.reason?.message || result.reason);
      }
    });

    // If no prices were successfully fetched, throw error
    if (prices.length === 0) {
      throw new Error('Não foi possível obter nenhuma cotação');
    }

    return prices;
  }

  async convertBRLtoCrypto(brlAmount: number, crypto: CryptoType): Promise<string> {
    const price = await this.getPrice(crypto);
    const brlPrice = parseFloat(price.brlPrice);
    const cryptoAmount = brlAmount / brlPrice;
    return cryptoAmount.toFixed(8);
  }

  async convertCryptoToBRL(cryptoAmount: number, crypto: CryptoType): Promise<string> {
    const price = await this.getPrice(crypto);
    const brlPrice = parseFloat(price.brlPrice);
    const brlAmount = cryptoAmount * brlPrice;
    return brlAmount.toFixed(2);
  }
}

export const priceService = new PriceService();
