import { Request, Response } from 'express';
import encryptionService from '../services/encryption.service';
import { auditLogService } from '../services/auditLog.service';

export class KeysController {
  /**
   * Armazenar chave pública do usuário
   */
  async storePublicKey(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { publicKey } = req.body;

      if (!publicKey || typeof publicKey !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Chave pública inválida',
        });
      }

      const { isNew } = await encryptionService.storePublicKey(userId, publicKey);

      // SECURITY: Audit log — só quando a chave é nova ou alterada
      if (isNew) {
        auditLogService.logFromRequest(
          req,
          'STORE_PUBLIC_KEY',
          'ENCRYPTION',
          userId,
          {}
        );
      }

      res.json({
        success: true,
        message: 'Chave pública armazenada com sucesso',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao armazenar chave pública',
      });
    }
  }

  /**
   * Buscar chave pública de um usuário
   */
  async getPublicKey(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { targetUserId } = req.params;

      const publicKey = await encryptionService.getPublicKey(targetUserId);

      if (!publicKey) {
        return res.status(404).json({
          success: false,
          error: 'Chave pública não encontrada',
        });
      }

      res.json({
        success: true,
        data: { publicKey },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar chave pública',
      });
    }
  }

  /**
   * Buscar chaves públicas de múltiplos usuários
   */
  async getPublicKeys(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Lista de IDs de usuários inválida',
        });
      }

      const keysMap = await encryptionService.getPublicKeys(userIds);

      // Converter Map para objeto
      const keysObject: Record<string, string> = {};
      keysMap.forEach((publicKey, userId) => {
        keysObject[userId] = publicKey;
      });

      res.json({
        success: true,
        data: keysObject,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar chaves públicas',
      });
    }
  }

  /**
   * Verificar se usuário possui chave pública
   */
  async hasPublicKey(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const hasKey = await encryptionService.hasPublicKey(userId);

      res.json({
        success: true,
        data: { hasPublicKey: hasKey },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao verificar chave pública',
      });
    }
  }

  /**
   * Armazenar backup da chave privada criptografada
   */
  async storePrivateKeyBackup(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const { encryptedPrivateKeyBackup } = req.body;

      if (!encryptedPrivateKeyBackup || typeof encryptedPrivateKeyBackup !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Backup de chave privada inválido',
        });
      }

      await encryptionService.storePrivateKeyBackup(userId, encryptedPrivateKeyBackup);

      // SECURITY: Audit log
      auditLogService.logFromRequest(
        req,
        'STORE_PRIVATE_KEY_BACKUP',
        'ENCRYPTION',
        userId,
        {}
      );

      res.json({
        success: true,
        message: 'Backup de chave privada armazenado com sucesso',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao armazenar backup de chave privada',
      });
    }
  }

  /**
   * Recuperar backup da chave privada criptografada
   */
  async getPrivateKeyBackup(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Não autorizado',
        });
      }

      const encryptedPrivateKeyBackup = await encryptionService.getPrivateKeyBackup(userId);

      if (!encryptedPrivateKeyBackup) {
        return res.status(404).json({
          success: false,
          error: 'Backup de chave privada não encontrado',
        });
      }

      res.json({
        success: true,
        data: { encryptedPrivateKeyBackup },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao recuperar backup de chave privada',
      });
    }
  }
}

export const keysController = new KeysController();
