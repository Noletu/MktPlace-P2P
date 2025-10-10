import { PrismaClient } from '@prisma/client';
import { KYCLevel, KYCLevel1Data, KYCData, KYC_TRANSACTION_LIMITS } from '../types/kyc.types';

const prisma = new PrismaClient();

export class KYCService {
  async submitLevel1(userId: string, data: KYCLevel1Data): Promise<void> {
    // KYC Level 1: Simplesmente ativa usando dados do registro
    // CPF é obrigatório no registro, telefone é opcional
    // Se telefone não foi fornecido no registro, deve ser fornecido aqui

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        cpf: true,
        phone: true,
        kycLevel: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    if (user.kycLevel !== KYCLevel.NONE) {
      throw new Error(`Você já possui ${user.kycLevel}`);
    }

    if (!user.cpf) {
      throw new Error('CPF não encontrado. Seu cadastro está incompleto. Entre em contato com o suporte.');
    }

    // Determinar telefone final
    const finalPhone = data.phone || user.phone;

    if (!finalPhone) {
      throw new Error('Telefone é obrigatório para KYC Level 1. Por favor, forneça seu telefone.');
    }

    // Ativar KYC Level 1
    await prisma.user.update({
      where: { id: userId },
      data: {
        phone: finalPhone, // Atualizar se foi fornecido
        kycLevel: KYCLevel.LEVEL_1,
        kycData: JSON.stringify({
          cpf: user.cpf,
          phone: finalPhone,
          activatedAt: new Date().toISOString(),
        }),
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
