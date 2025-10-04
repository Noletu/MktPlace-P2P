import { PrismaClient } from '@prisma/client';
import { KYCLevel, KYCLevel1Data, KYCData, KYC_TRANSACTION_LIMITS } from '../types/kyc.types';

const prisma = new PrismaClient();

export class KYCService {
  async submitLevel1(userId: string, data: KYCLevel1Data): Promise<void> {
    // Validar idade mínima (18 anos)
    const birthDate = new Date(data.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (age < 18 || (age === 18 && monthDiff < 0)) {
      throw new Error('Usuário deve ter no mínimo 18 anos');
    }

    // Validar CEP
    if (!/^\d{5}-?\d{3}$/.test(data.address.zipCode)) {
      throw new Error('CEP inválido');
    }

    // Atualizar usuário
    await prisma.user.update({
      where: { id: userId },
      data: {
        kycLevel: KYCLevel.LEVEL_1,
        kycData: JSON.stringify(data),
      },
    });
  }

  async getKYCData(userId: string): Promise<KYCData | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycData: true },
    });

    if (!user?.kycData) {
      return null;
    }

    return JSON.parse(user.kycData);
  }

  async getKYCLevel(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycLevel: true },
    });

    return user?.kycLevel || KYCLevel.NONE;
  }

  async getTransactionLimit(userId: string): Promise<number> {
    const kycLevel = await this.getKYCLevel(userId);
    return KYC_TRANSACTION_LIMITS[kycLevel as KYCLevel] || 0;
  }

  async canUserTransact(userId: string, amount: number): Promise<boolean> {
    const limit = await this.getTransactionLimit(userId);
    return amount <= limit;
  }
}

export const kycService = new KYCService();
