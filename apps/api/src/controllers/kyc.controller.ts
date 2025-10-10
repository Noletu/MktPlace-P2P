import { Request, Response } from 'express';
import { kycService } from '../services/kyc.service';
import { KYCLevel1SubmitData } from '../types/kyc.types';
import { kycLevel1Schema } from '@mktplace/shared';
import { z } from 'zod';

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
      const verification = await kycService.submitLevel1(
        userId,
        validatedData as KYCLevel1SubmitData
      );

      const transactionLimit = await kycService.getTransactionLimit(userId);

      res.json({
        success: true,
        message: 'KYC Level 1 aprovado com sucesso!',
        kycLevel: 'LEVEL_1',
        transactionLimit,
        verification: {
          id: verification.id,
          status: verification.status,
          level: verification.level,
        },
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

      const status = await kycService.getKYCStatus(userId);

      res.json(status);
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

  async sendPhoneVerification(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const result = await kycService.sendPhoneVerification(userId);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao enviar código',
      });
    }
  }

  async verifyPhone(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { code } = req.body;
      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Código é obrigatório'
        });
      }

      const result = await kycService.verifyPhone(userId, code);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao verificar código',
      });
    }
  }
}

export const kycController = new KYCController();
