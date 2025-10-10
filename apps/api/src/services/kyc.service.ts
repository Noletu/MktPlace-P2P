import { PrismaClient } from '@prisma/client';
import {
  KYCLevel,
  KYCStatus,
  KYCLevel1SubmitData,
  KYCVerificationData,
  KYC_TRANSACTION_LIMITS,
} from '../types/kyc.types';
import { smsService } from './sms.service';

const prisma = new PrismaClient();

export class KYCService {
  /**
   * Submete KYC Level 1: Nome Completo + CPF + Telefone
   * Status inicial: PENDING
   * Após aprovação manual/automática, usuário terá kycLevel = LEVEL_1
   */
  async submitLevel1(userId: string, data: KYCLevel1SubmitData): Promise<KYCVerificationData> {
    // Verificar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycLevel: true,
        kycVerification: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar se já tem KYC aprovado
    if (user.kycLevel !== KYCLevel.NONE) {
      throw new Error(`Você já possui KYC ${user.kycLevel} ativo`);
    }

    // Verificar se já tem submissão pendente
    if (user.kycVerification) {
      if (user.kycVerification.status === KYCStatus.PENDING) {
        throw new Error('Você já possui uma verificação KYC pendente de aprovação');
      }
      if (user.kycVerification.status === KYCStatus.APPROVED) {
        throw new Error('Seu KYC já foi aprovado');
      }
    }

    // Verificar se CPF já está em uso por outro usuário
    const existingCPF = await prisma.kYCVerification.findUnique({
      where: { cpf: data.cpf },
    });

    if (existingCPF && existingCPF.userId !== userId) {
      throw new Error('CPF já está cadastrado em outra conta');
    }

    // Criar ou atualizar KYC Verification
    const kycVerification = await prisma.kYCVerification.upsert({
      where: { userId },
      create: {
        userId,
        level: KYCLevel.LEVEL_1,
        status: KYCStatus.PENDING,
        fullName: data.fullName,
        cpf: data.cpf,
        phone: data.phone,
        phoneVerified: false, // TODO: Implementar verificação via SMS
      },
      update: {
        level: KYCLevel.LEVEL_1,
        status: KYCStatus.PENDING,
        fullName: data.fullName,
        cpf: data.cpf,
        phone: data.phone,
        submittedAt: new Date(),
        rejectionReason: null, // Limpar rejeição anterior se houver
      },
    });

    // Auto-aprovar por enquanto (em produção, isso seria manual ou com validação automatizada)
    // TODO: Implementar aprovação manual por admin ou validação automatizada
    await this.approveKYC(userId, KYCLevel.LEVEL_1);

    return kycVerification as KYCVerificationData;
  }

  /**
   * Aprovar KYC (chamado por admin ou processo automatizado)
   */
  async approveKYC(userId: string, level: KYCLevel, adminId?: string): Promise<void> {
    const verification = await prisma.kYCVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      throw new Error('Nenhuma verificação KYC encontrada para este usuário');
    }

    // Atualizar verificação
    await prisma.kYCVerification.update({
      where: { userId },
      data: {
        status: KYCStatus.APPROVED,
        approvedAt: new Date(),
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    // Atualizar nível de KYC do usuário
    await prisma.user.update({
      where: { id: userId },
      data: {
        kycLevel: level,
      },
    });
  }

  /**
   * Rejeitar KYC (chamado por admin)
   */
  async rejectKYC(userId: string, reason: string, adminId: string): Promise<void> {
    await prisma.kYCVerification.update({
      where: { userId },
      data: {
        status: KYCStatus.REJECTED,
        rejectionReason: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Obter dados de verificação KYC do usuário
   */
  async getKYCVerification(userId: string): Promise<KYCVerificationData | null> {
    const verification = await prisma.kYCVerification.findUnique({
      where: { userId },
    });

    return verification as KYCVerificationData | null;
  }

  /**
   * Obter nível KYC atual do usuário
   */
  async getKYCLevel(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycLevel: true },
    });

    return user?.kycLevel || KYCLevel.NONE;
  }

  /**
   * Obter limite de transação baseado no nível KYC
   */
  async getTransactionLimit(userId: string): Promise<number> {
    const kycLevel = await this.getKYCLevel(userId);
    return KYC_TRANSACTION_LIMITS[kycLevel as KYCLevel] || 0;
  }

  /**
   * Verificar se usuário pode realizar transação de determinado valor
   */
  async canUserTransact(userId: string, amount: number): Promise<boolean> {
    const limit = await this.getTransactionLimit(userId);
    return amount <= limit;
  }

  /**
   * Obter status completo de KYC (para dashboard)
   */
  async getKYCStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycLevel: true,
        kycVerification: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const transactionLimit = KYC_TRANSACTION_LIMITS[user.kycLevel as KYCLevel] || 0;

    return {
      kycLevel: user.kycLevel,
      verification: user.kycVerification,
      transactionLimit,
    };
  }

  /**
   * Enviar código de verificação por SMS
   */
  async sendPhoneVerification(userId: string): Promise<{ success: boolean; message: string }> {
    // Buscar KYC verification do usuário
    const verification = await prisma.kYCVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      throw new Error('Nenhuma verificação KYC encontrada. Submeta o KYC Level 1 primeiro.');
    }

    if (!verification.phone) {
      throw new Error('Nenhum telefone cadastrado.');
    }

    if (verification.phoneVerified) {
      return {
        success: false,
        message: 'Telefone já verificado.',
      };
    }

    // Enviar código via SMS
    return await smsService.sendVerificationCode(verification.phone);
  }

  /**
   * Verificar código de telefone
   */
  async verifyPhone(userId: string, code: string): Promise<{ success: boolean; message: string }> {
    // Buscar KYC verification do usuário
    const verification = await prisma.kYCVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      throw new Error('Nenhuma verificação KYC encontrada.');
    }

    if (!verification.phone) {
      throw new Error('Nenhum telefone cadastrado.');
    }

    if (verification.phoneVerified) {
      return {
        success: false,
        message: 'Telefone já verificado.',
      };
    }

    // Verificar código
    const result = await smsService.verifyCode(verification.phone, code);

    if (result.success) {
      // Atualizar verificação
      await prisma.kYCVerification.update({
        where: { userId },
        data: {
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
        },
      });
    }

    return result;
  }
}

export const kycService = new KYCService();
