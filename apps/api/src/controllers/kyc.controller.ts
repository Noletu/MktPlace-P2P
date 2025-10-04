import { Request, Response } from 'express';
import { kycService } from '../services/kyc.service';
import { KYCLevel1Data } from '../types/kyc.types';
import { z } from 'zod';

const Level1Schema = z.object({
  fullName: z.string().min(3, 'Nome completo deve ter no mínimo 3 caracteres'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida (use formato YYYY-MM-DD)'),
  address: z.object({
    street: z.string().min(3, 'Rua é obrigatória'),
    number: z.string().min(1, 'Número é obrigatório'),
    complement: z.string().optional(),
    neighborhood: z.string().min(2, 'Bairro é obrigatório'),
    city: z.string().min(2, 'Cidade é obrigatória'),
    state: z.string().length(2, 'Estado deve ter 2 caracteres (ex: SP)'),
    zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  }),
});

export class KYCController {
  async submitLevel1(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      // Validar dados
      const validatedData = Level1Schema.parse(req.body);

      // Submeter KYC Level 1
      await kycService.submitLevel1(userId, validatedData as KYCLevel1Data);

      res.json({
        success: true,
        message: 'KYC Level 1 enviado com sucesso',
        kycLevel: 'LEVEL_1',
        transactionLimit: 500,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Erro ao processar KYC',
      });
    }
  }

  async getKYCStatus(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const kycLevel = await kycService.getKYCLevel(userId);
      const kycData = await kycService.getKYCData(userId);
      const transactionLimit = await kycService.getTransactionLimit(userId);

      res.json({
        kycLevel,
        kycData,
        transactionLimit,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar status KYC',
      });
    }
  }

  async checkTransactionLimit(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { amount } = req.body;
      if (!amount || isNaN(amount)) {
        return res.status(400).json({ error: 'Valor inválido' });
      }

      const canTransact = await kycService.canUserTransact(userId, parseFloat(amount));
      const limit = await kycService.getTransactionLimit(userId);

      res.json({
        canTransact,
        limit,
        requestedAmount: parseFloat(amount),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao verificar limite',
      });
    }
  }
}

export const kycController = new KYCController();
