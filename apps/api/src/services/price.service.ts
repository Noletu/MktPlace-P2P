import { PrismaClient } from '@prisma/client';
import { CryptoType, COINGECKO_IDS, PriceQuote } from '../types/crypto.types';

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
      const response = await fetch(
        `${this.COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=brl,usd`
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar cotação');
      }

      const data = await response.json();
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
    const prices = await Promise.all(
      cryptos.map((crypto) => this.getPrice(crypto))
    );
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
