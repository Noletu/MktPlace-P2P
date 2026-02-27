import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

class EmailService {
  private transporter: Transporter | null = null;

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;

    if (process.env.SMTP_HOST) {
      // Production: use configured SMTP
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Development: use Ethereal (fake SMTP that captures emails)
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('[EMAIL] Ethereal account created:', testAccount.user);
    }

    return this.transporter;
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    const transporter = await this.getTransporter();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(to)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af; text-align: center;">Redefinir Senha</h2>
        <p style="color: #374151; font-size: 16px;">
          Voce solicitou a redefinicao da sua senha. Clique no botao abaixo para criar uma nova senha:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}"
             style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
            Redefinir Senha
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Este link expira em <strong>1 hora</strong>. Se voce nao solicitou esta redefinicao, ignore este email.
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
          Se o botao nao funcionar, copie e cole este link no navegador:<br/>
          <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
        </p>
      </div>
    `;

    const text = `Redefinir Senha\n\nVoce solicitou a redefinicao da sua senha.\n\nClique no link abaixo (expira em 1 hora):\n${resetLink}\n\nSe voce nao solicitou, ignore este email.`;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
      to,
      subject: 'Redefinir sua senha - MktPlace',
      text,
      html,
    });

    // In dev with Ethereal, log the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[EMAIL] Preview URL:', previewUrl);
    }
  }
  async sendWelcomeEmail(to: string, name?: string): Promise<void> {
    const transporter = await this.getTransporter();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const displayName = name || 'Novo Usuário';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af; text-align: center;">Bem-vindo ao MktPlace da Liberdade!</h2>
        <p style="color: #374151; font-size: 16px;">
          Ola, <strong>${displayName}</strong>! Sua conta foi criada com sucesso.
        </p>
        <p style="color: #374151; font-size: 16px;">
          Aqui estao seus proximos passos para comecar:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <ul style="color: #374151; font-size: 14px; line-height: 2;">
            <li><strong>Limite inicial:</strong> R$ 1.000/dia (aumenta com reputacao)</li>
            <li><strong>Complete seu perfil:</strong> Adicione nome e informacoes de contato</li>
            <li><strong>Ative o 2FA:</strong> Proteja sua conta com autenticacao em duas etapas</li>
            <li><strong>Crie sua carteira:</strong> Deposite cripto para comecar a negociar</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${frontendUrl}/dashboard"
             style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
            Acessar Dashboard
          </a>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
          Duvidas? Entre em contato com nosso suporte.
        </p>
      </div>
    `;

    const text = `Bem-vindo ao MktPlace da Liberdade!\n\nOla, ${displayName}! Sua conta foi criada com sucesso.\n\nProximos passos:\n- Limite inicial: R$ 1.000/dia\n- Complete seu perfil\n- Ative o 2FA\n- Crie sua carteira\n\nAcesse: ${frontendUrl}/dashboard`;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
      to,
      subject: 'Bem-vindo ao MktPlace da Liberdade!',
      text,
      html,
    });

    // In dev with Ethereal, log the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[EMAIL] Welcome email preview URL:', previewUrl);
    }
  }
}

export const emailService = new EmailService();
