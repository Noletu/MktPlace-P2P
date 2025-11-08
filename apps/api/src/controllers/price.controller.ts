import { Request, Response } from 'express';
import { priceService } from '../services/price.service';
import { CryptoType } from '../types/crypto.types';
import { z } from 'zod';

const ConvertSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  crypto: z.nativeEnum(CryptoType),
  direction: z.enum(['brl_to_crypto', 'crypto_to_brl']),
});

export class PriceController {
  async getPrice(req: Request, res: Response) {
    try {
      const { crypto } = req.params;

      if (!Object.values(CryptoType).includes(crypto as CryptoType)) {
        return res.status(400).json({ error: 'Criptomoeda inválida' });
      }

      const price = await priceService.getPrice(crypto as CryptoType);

      res.json({
        success: true,
        data: price,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar cotação',
      });
    }
  }

  async getAllPrices(req: Request, res: Response) {
    try {
      const prices = await priceService.getAllPrices();

      res.json({
        success: true,
        data: prices,
        // Indicate if some prices failed to load
        partial: prices.length < Object.values(CryptoType).length,
      });
    } catch (error: any) {
      console.error('❌ [PRICES] Error fetching all prices:', error);
      console.error('Stack trace:', error.stack);

      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar cotações',
      });
    }
  }

  async convert(req: Request, res: Response) {
    try {
      const validatedData = ConvertSchema.parse(req.body);
      const { amount, crypto, direction } = validatedData;

      let result: string;

      if (direction === 'brl_to_crypto') {
        result = await priceService.convertBRLtoCrypto(amount, crypto);
      } else {
        result = await priceService.convertCryptoToBRL(amount, crypto);
      }

      res.json({
        success: true,
        data: {
          from: direction === 'brl_to_crypto' ? 'BRL' : crypto,
          to: direction === 'brl_to_crypto' ? crypto : 'BRL',
          inputAmount: amount,
          outputAmount: result,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      res.status(500).json({
        error: error.message || 'Erro ao converter',
      });
    }
  }
}

export const priceController = new PriceController();
