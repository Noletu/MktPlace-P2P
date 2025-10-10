import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SMSService {
  /**
   * Gera um código de 6 dígitos
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Envia código de verificação por SMS
   * Em desenvolvimento: loga no console
   * Em produção: integrar com Twilio, AWS SNS, etc
   */
  async sendVerificationCode(phone: string): Promise<{ success: boolean; message: string }> {
    try {
      // Limpar códigos expirados anteriores
      await prisma.phoneVerificationCode.deleteMany({
        where: {
          phone,
          expiresAt: { lt: new Date() },
        },
      });

      // Verificar se já existe código pendente recente (não expirado)
      const existingCode = await prisma.phoneVerificationCode.findFirst({
        where: {
          phone,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingCode) {
        const minutesLeft = Math.ceil((existingCode.expiresAt.getTime() - Date.now()) / 60000);
        return {
          success: false,
          message: `Código já enviado. Aguarde ${minutesLeft} minuto(s) para solicitar novo código.`,
        };
      }

      // Gerar novo código
      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      // Salvar no banco
      await prisma.phoneVerificationCode.create({
        data: {
          phone,
          code,
          expiresAt,
        },
      });

      // DESENVOLVIMENTO: Logar código no console
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n📱 ========================================');
        console.log(`📱 CÓDIGO DE VERIFICAÇÃO SMS (DEV MODE)`);
        console.log(`📱 Telefone: ${phone}`);
        console.log(`📱 Código: ${code}`);
        console.log(`📱 Expira em: ${expiresAt.toLocaleString('pt-BR')}`);
        console.log('📱 ========================================\n');

        return {
          success: true,
          message: `Código enviado! (DEV: verifique o console do servidor)`,
        };
      }

      // PRODUÇÃO: Integrar com serviço de SMS real
      // Exemplo com Twilio:
      /*
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      await client.messages.create({
        body: `Seu código de verificação é: ${code}. Válido por 10 minutos.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      */

      return {
        success: true,
        message: 'Código enviado com sucesso!',
      };
    } catch (error: any) {
      console.error('Erro ao enviar SMS:', error);
      return {
        success: false,
        message: 'Erro ao enviar código. Tente novamente.',
      };
    }
  }

  /**
   * Verifica código de verificação
   */
  async verifyCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      // Buscar código
      const verification = await prisma.phoneVerificationCode.findFirst({
        where: {
          phone,
          code,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!verification) {
        return {
          success: false,
          message: 'Código inválido ou já utilizado.',
        };
      }

      // Verificar se expirou
      if (verification.expiresAt < new Date()) {
        await prisma.phoneVerificationCode.update({
          where: { id: verification.id },
          data: { status: 'EXPIRED' },
        });

        return {
          success: false,
          message: 'Código expirado. Solicite um novo código.',
        };
      }

      // Incrementar tentativas
      const updatedVerification = await prisma.phoneVerificationCode.update({
        where: { id: verification.id },
        data: {
          attempts: { increment: 1 },
        },
      });

      // Limitar tentativas (máximo 5)
      if (updatedVerification.attempts > 5) {
        await prisma.phoneVerificationCode.update({
          where: { id: verification.id },
          data: { status: 'EXPIRED' },
        });

        return {
          success: false,
          message: 'Muitas tentativas inválidas. Solicite um novo código.',
        };
      }

      // Marcar como verificado
      await prisma.phoneVerificationCode.update({
        where: { id: verification.id },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Telefone verificado com sucesso!',
      };
    } catch (error: any) {
      console.error('Erro ao verificar código:', error);
      return {
        success: false,
        message: 'Erro ao verificar código. Tente novamente.',
      };
    }
  }

  /**
   * Limpar códigos expirados (cronjob)
   */
  async cleanupExpiredCodes(): Promise<number> {
    const result = await prisma.phoneVerificationCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { status: 'VERIFIED' },
          { status: 'EXPIRED' },
        ],
      },
    });

    return result.count;
  }
}

export const smsService = new SMSService();
