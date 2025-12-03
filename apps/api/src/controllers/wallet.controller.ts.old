import { Request, Response } from 'express';
import { walletService } from '../services/wallet.service';
import { CryptoType, Network } from '../types/crypto.types';
import { z } from 'zod';

const CreateWalletSchema = z.object({
  crypto: z.nativeEnum(CryptoType),
  network: z.nativeEnum(Network),
  address: z.string().min(10, 'Endereço de carteira inválido'),
});

export class WalletController {
  async createWallet(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const validatedData = CreateWalletSchema.parse(req.body);

      const wallet = await walletService.createWallet({
        userId,
        crypto: validatedData.crypto,
        network: validatedData.network,
        address: validatedData.address,
      });

      res.status(201).json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      res.status(400).json({
        error: error.message || 'Erro ao criar carteira',
      });
    }
  }

  async getUserWallets(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const wallets = await walletService.getUserWallets(userId);

      res.json({
        success: true,
        data: wallets,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar carteiras',
      });
    }
  }

  async getWallet(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { walletId } = req.params;

      const wallet = await walletService.getWalletById(walletId, userId);

      if (!wallet) {
        return res.status(404).json({ error: 'Carteira não encontrada' });
      }

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao buscar carteira',
      });
    }
  }

  async deactivateWallet(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { walletId } = req.params;

      await walletService.deactivateWallet(walletId, userId);

      res.json({
        success: true,
        message: 'Carteira desativada com sucesso',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao desativar carteira',
      });
    }
  }

  async deleteWallet(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { walletId } = req.params;

      await walletService.deleteWallet(walletId, userId);

      res.json({
        success: true,
        message: 'Carteira deletada permanentemente com sucesso',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Erro ao deletar carteira',
      });
    }
  }
}

export const walletController = new WalletController();
