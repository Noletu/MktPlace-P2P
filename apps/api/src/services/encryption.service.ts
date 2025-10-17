import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class EncryptionService {
  /**
   * Armazena a chave pública de um usuário
   */
  async storePublicKey(userId: string, publicKey: string): Promise<void> {
    await prisma.userKeys.upsert({
      where: { userId },
      update: { publicKey },
      create: {
        userId,
        publicKey,
      },
    });
  }

  /**
   * Busca a chave pública de um usuário
   */
  async getPublicKey(userId: string): Promise<string | null> {
    const userKeys = await prisma.userKeys.findUnique({
      where: { userId },
      select: { publicKey: true },
    });

    return userKeys?.publicKey || null;
  }

  /**
   * Busca chaves públicas de múltiplos usuários
   */
  async getPublicKeys(userIds: string[]): Promise<Map<string, string>> {
    const userKeys = await prisma.userKeys.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        userId: true,
        publicKey: true,
      },
    });

    const keysMap = new Map<string, string>();
    userKeys.forEach((key) => {
      keysMap.set(key.userId, key.publicKey);
    });

    return keysMap;
  }

  /**
   * Verifica se um usuário possui chave pública registrada
   */
  async hasPublicKey(userId: string): Promise<boolean> {
    const userKeys = await prisma.userKeys.findUnique({
      where: { userId },
      select: { id: true },
    });

    return !!userKeys;
  }

  /**
   * Armazena backup da chave privada criptografada
   * (criptografada com senha do usuário no frontend)
   */
  async storePrivateKeyBackup(
    userId: string,
    encryptedPrivateKeyBackup: string
  ): Promise<void> {
    await prisma.userKeys.update({
      where: { userId },
      data: { encryptedPrivateKeyBackup },
    });
  }

  /**
   * Recupera backup da chave privada criptografada
   */
  async getPrivateKeyBackup(userId: string): Promise<string | null> {
    const userKeys = await prisma.userKeys.findUnique({
      where: { userId },
      select: { encryptedPrivateKeyBackup: true },
    });

    return userKeys?.encryptedPrivateKeyBackup || null;
  }

  /**
   * Remove todas as chaves de um usuário
   * (útil para reset de segurança)
   */
  async deleteUserKeys(userId: string): Promise<void> {
    await prisma.userKeys.delete({
      where: { userId },
    });
  }
}

export default new EncryptionService();
