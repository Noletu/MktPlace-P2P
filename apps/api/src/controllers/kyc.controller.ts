import { Request, Response } from 'express';
import { z } from 'zod';
import { kycService } from '../services/kyc.service';
import { KYCLevel1Data } from '../types/kyc.types';
import { kycLevel1Schema } from '@mktplace/shared';

export class KYCController {
  async submitLevel1(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      // Validar dados
      const validatedData = kycLevel1Schema.parse(req.body);

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
