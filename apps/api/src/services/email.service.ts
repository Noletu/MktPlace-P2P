import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '../utils/prisma';
import { notifPrefsService } from './notificationPreferences.service';

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

  // ── DUAL-APPROVAL EMAILS ────────────────────────────────────────────────────

  async sendNewPendingApprovalEmail(
    to: string,
    params: {
      initiatorName: string;
      operationType: string;
      approvalId: string;
      expiresAt: Date;
    },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const approvalUrl = `${frontendUrl}/admin/aprovacoes`;
    const expiresStr = params.expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #1e40af; border-radius: 12px;">
        <h2 style="color: #1e40af; text-align: center;">🔐 Nova Operação Aguardando sua Aprovação</h2>
        <p style="color: #374151; font-size: 16px;"><strong>${params.initiatorName}</strong> iniciou uma operação que requer sua confirmação:</p>
        <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 16px 0;">
          <p style="margin: 0; color: #1e40af; font-weight: bold; font-size: 18px;">${params.operationType}</p>
          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Expira em: ${expiresStr}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${approvalUrl}" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
            Ver e Aprovar Operação
          </a>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center;">Se você não esperava esta operação, acesse o painel e rejeite-a imediatamente.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace Admin" <noreply@mktplace.com>',
      to,
      subject: `[APROVAÇÃO NECESSÁRIA] ${params.operationType} — MktPlace`,
      text: `Nova operação de ${params.operationType} iniciada por ${params.initiatorName} aguarda sua aprovação. Acesse: ${approvalUrl}`,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('[EMAIL] Pending approval preview:', previewUrl);
  }

  async sendEmergencyOverrideEmail(
    to: string,
    params: {
      initiatorName: string;
      operationType: string;
      justification: string;
      executeAfter: Date;
      cancelUrl: string;
    },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const executeStr = params.executeAfter.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 3px solid #dc2626; border-radius: 12px;">
        <h2 style="color: #dc2626; text-align: center;">🚨 ATENÇÃO — Override de Emergência em andamento</h2>
        <p style="color: #374151; font-size: 16px;"><strong>${params.initiatorName}</strong> solicitou um override de emergência para a operação:</p>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin: 16px 0;">
          <p style="margin: 0; color: #dc2626; font-weight: bold; font-size: 18px;">${params.operationType}</p>
          <p style="margin: 8px 0 0; color: #374151; font-size: 14px;"><strong>Justificativa:</strong> ${params.justification}</p>
          <p style="margin: 8px 0 0; color: #dc2626; font-size: 14px; font-weight: bold;">Executa automaticamente em: ${executeStr}</p>
        </div>
        <p style="color: #374151; font-size: 16px; font-weight: bold;">Se você não concorda com esta operação, clique IMEDIATAMENTE no botão abaixo para cancelar:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.cancelUrl}" style="background-color: #dc2626; color: white; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; display: inline-block;">
            ❌ CANCELAR OPERAÇÃO AGORA
          </a>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center;">Este link é de uso único e expira quando a operação for executada.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace Admin" <noreply@mktplace.com>',
      to,
      subject: `🚨 [URGENTE] Override de Emergência — ${params.operationType} — executa em 30 minutos`,
      text: `OVERRIDE DE EMERGÊNCIA\n\n${params.initiatorName} está executando ${params.operationType} em override de emergência.\nJustificativa: ${params.justification}\nExecução automática: ${executeStr}\n\nPara cancelar: ${params.cancelUrl}`,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('[EMAIL] Emergency override preview:', previewUrl);
  }

  async sendOverrideCancelledEmail(
    to: string,
    params: {
      cancelledBy: string;
      operationType: string;
      approvalId: string;
    },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #059669; border-radius: 12px;">
        <h2 style="color: #059669; text-align: center;">✅ Override de Emergência Cancelado</h2>
        <p style="color: #374151; font-size: 16px;">Sua solicitação de override de emergência para a operação <strong>${params.operationType}</strong> foi cancelada por <strong>${params.cancelledBy}</strong>.</p>
        <p style="color: #374151; font-size: 16px;">A operação <strong>não foi executada</strong>. Se necessário, você pode iniciar um novo pedido de aprovação.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${frontendUrl}/admin/aprovacoes" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
            Ver Aprovações
          </a>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace Admin" <noreply@mktplace.com>',
      to,
      subject: `[Override Cancelado] ${params.operationType} — MktPlace`,
      text: `Override cancelado por ${params.cancelledBy} para a operação ${params.operationType}. A operação não foi executada.`,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('[EMAIL] Override cancelled preview:', previewUrl);
  }

  async sendDelegationCreatedEmail(
    to: string,
    params: {
      grantorName: string;
      granteeName: string;
      scope: string[];
      expiresAt: Date;
      reason: string;
    },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const expiresStr = params.expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const scopeStr = params.scope.length === 0 ? 'Todas as operações críticas' : params.scope.join(', ');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #d97706; border-radius: 12px;">
        <h2 style="color: #d97706; text-align: center;">⚠️ Nova Delegação de Aprovação Criada</h2>
        <p style="color: #374151; font-size: 16px;"><strong>${params.grantorName}</strong> criou uma delegação para <strong>${params.granteeName}</strong>.</p>
        <div style="background: #fffbeb; border-left: 4px solid #d97706; padding: 16px; border-radius: 4px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e;"><strong>Escopo:</strong> ${scopeStr}</p>
          <p style="margin: 8px 0 0; color: #92400e;"><strong>Motivo:</strong> ${params.reason}</p>
          <p style="margin: 8px 0 0; color: #92400e;"><strong>Válida até:</strong> ${expiresStr}</p>
        </div>
        <p style="color: #374151; font-size: 14px;">Durante este período, ${params.granteeName} poderá aprovar operações críticas em nome dos sócios MASTER.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${frontendUrl}/admin/delegacoes" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
            Ver Delegações
          </a>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace Admin" <noreply@mktplace.com>',
      to,
      subject: `[Delegação Criada] ${params.granteeName} agora pode aprovar operações — MktPlace`,
      text: `${params.grantorName} criou uma delegação para ${params.granteeName}. Escopo: ${scopeStr}. Válida até: ${expiresStr}. Motivo: ${params.reason}`,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('[EMAIL] Delegation created preview:', previewUrl);
  }

  async sendDelegationUsedEmail(
    to: string,
    params: {
      granteeName: string;
      operationType: string;
      approvalId: string;
    },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #6366f1; border-radius: 12px;">
        <h2 style="color: #6366f1; text-align: center;">ℹ️ Operação Aprovada por Delegado</h2>
        <p style="color: #374151; font-size: 16px;"><strong>${params.granteeName}</strong> aprovou uma operação via delegação:</p>
        <div style="background: #eef2ff; border-left: 4px solid #6366f1; padding: 16px; border-radius: 4px; margin: 16px 0;">
          <p style="margin: 0; color: #4338ca; font-weight: bold;">${params.operationType}</p>
          <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">ID: ${params.approvalId}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${frontendUrl}/admin/aprovacoes" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
            Ver Histórico
          </a>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace Admin" <noreply@mktplace.com>',
      to,
      subject: `[Delegado aprovou] ${params.operationType} — MktPlace`,
      text: `${params.granteeName} aprovou a operação ${params.operationType} (ID: ${params.approvalId}) via delegação.`,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('[EMAIL] Delegation used preview:', previewUrl);
  }

  // ── SUCCESSION KIT EMAILS ──────────────────────────────────────────────────

  async sendSuccessionKitReminderEmail(to: string, params: { name: string }): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #dc2626; border-radius: 12px;">
        <h2 style="color: #dc2626; text-align: center;">⚠️ Lembrete Trimestral — Kit de Sucessão</h2>
        <p style="color: #374151; font-size: 16px;">Olá, <strong>${params.name}</strong>.</p>
        <p style="color: #374151; font-size: 16px;">
          Como MASTER do sistema, você possui um Kit de Sucessão que deve ser revisado
          <strong>trimestralmente</strong> para garantir acesso de emergência ao sistema.
        </p>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #991b1b;">O que verificar agora:</p>
          <ul style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
            <li>✅ Os backup codes ainda são válidos? (verifique quantos restam no painel)</li>
            <li>✅ O documento físico está atualizado com os códigos atuais?</li>
            <li>✅ As 2 cópias físicas estão nos locais seguros (cofre + notário)?</li>
            <li>✅ O sucessor indicado ainda é de confiança e está ciente?</li>
          </ul>
        </div>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #1f2937;">Para atualizar seu Kit de Sucessão:</p>
          <ol style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
            <li>Acesse <a href="${frontendUrl}/admin/security" style="color: #2563eb;">Admin → Segurança</a> e verifique seus backup codes</li>
            <li>Se necessário, regenere os códigos (requer 2FA)</li>
            <li>Execute <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">node scripts/gerar-kit-sucessao.js</code> no projeto</li>
            <li>Preencha a tabela de backup codes à mão e imprima 2 cópias</li>
            <li>Destrua as cópias antigas com corte ou fragmentadora</li>
          </ol>
        </div>
        <p style="color: #6b7280; font-size: 13px; margin-top: 20px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este lembrete é enviado automaticamente a cada 3 meses para todos os usuários MASTER.<br/>
          Se você já revisou seu kit neste trimestre, pode ignorar este e-mail.
        </p>
      </div>
    `;

    const text = `Lembrete Trimestral — Kit de Sucessão\n\nOlá, ${params.name}.\n\nRevise seu Kit de Sucessão:\n1. Acesse Admin → Segurança e verifique seus backup codes\n2. Execute: node scripts/gerar-kit-sucessao.js\n3. Preencha a tabela de backup codes e imprima 2 cópias\n4. Guarde em cofre pessoal e com notário\n\nAcesse o painel: ${frontendUrl}/admin/security`;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace Admin" <noreply@mktplace.com>',
      to,
      subject: '⚠️ Lembrete: Revise seu Kit de Sucessão — MktPlace',
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('[EMAIL] Succession reminder preview:', previewUrl);
  }
  // ── BROADCAST EMAILS ──────────────────────────────────────────────────────

  // ── TRANSACTIONAL EMAILS (Saques, Depósitos, P2P) ─────────────────────────

  private getExplorerUrl(network: string, txHash: string): string {
    const explorers: Record<string, string> = {
      BITCOIN: `https://mempool.space/tx/${txHash}`,
      BASE: `https://basescan.org/tx/${txHash}`,
      SOLANA: `https://solscan.io/tx/${txHash}`,
    };
    return explorers[network] || '#';
  }

  async sendWithdrawalRequestedEmail(
    to: string,
    params: { name: string; amount: string; crypto: string; network: string; toAddress: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fffbeb; border-left: 4px solid #d97706; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #92400e; margin: 0 0 12px 0;">Saque Solicitado</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Um saque foi solicitado na sua conta:
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>${params.amount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Rede:</strong></td><td>${params.network}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Endereço destino:</strong></td><td style="word-break: break-all; font-family: monospace; font-size: 12px;">${params.toAddress}</td></tr>
          </table>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: bold;">
            Se você não reconhece esta operação, congele sua conta imediatamente e entre em contato com o suporte.
          </p>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/wallets" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ver Carteiras
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque um saque foi solicitado na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Saque Solicitado\n\nOlá, ${params.name}. Um saque de ${params.amount} ${params.crypto} foi solicitado para ${params.toAddress} (rede ${params.network}).\n\nSe você não reconhece esta operação, congele sua conta imediatamente.`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Saque Solicitado — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Withdrawal requested preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send withdrawal requested email:', (error as Error).message);
    }
  }

  async sendWithdrawalApprovedEmail(
    to: string,
    params: { name: string; amount: string; crypto: string; network: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px;">
          <h2 style="color: #1e40af; margin: 0 0 12px 0;">Saque Aprovado</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Seu saque foi aprovado e será processado em breve.
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>${params.amount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Rede:</strong></td><td>${params.network}</td></tr>
          </table>
          <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0 0;">
            O processamento pode levar alguns minutos. Você receberá outro email quando a transação for confirmada na blockchain.
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque um saque foi aprovado na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Saque Aprovado\n\nOlá, ${params.name}. Seu saque de ${params.amount} ${params.crypto} (rede ${params.network}) foi aprovado e será processado em breve.`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Saque Aprovado — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Withdrawal approved preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send withdrawal approved email:', (error as Error).message);
    }
  }

  async sendWithdrawalCompletedEmail(
    to: string,
    params: { name: string; amount: string; crypto: string; network: string; toAddress: string; txHash: string; networkFee: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const explorerUrl = this.getExplorerUrl(params.network, params.txHash);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; border-radius: 8px;">
          <h2 style="color: #166534; margin: 0 0 12px 0;">Saque Concluído</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Seu saque foi processado com sucesso!
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>${params.amount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Rede:</strong></td><td>${params.network}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Endereço destino:</strong></td><td style="word-break: break-all; font-family: monospace; font-size: 12px;">${params.toAddress}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Taxa de rede:</strong></td><td>${params.networkFee} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>TX Hash:</strong></td><td style="word-break: break-all;"><a href="${explorerUrl}" style="color: #2563eb; font-family: monospace; font-size: 12px;">${params.txHash}</a></td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${explorerUrl}" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ver no Explorer
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque um saque foi concluído na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Saque Concluído\n\nOlá, ${params.name}. Seu saque de ${params.amount} ${params.crypto} para ${params.toAddress} foi concluído.\nTX Hash: ${params.txHash}\nVer no explorer: ${explorerUrl}`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Saque Concluído — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Withdrawal completed preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send withdrawal completed email:', (error as Error).message);
    }
  }

  async sendWithdrawalRejectedEmail(
    to: string,
    params: { name: string; amount: string; crypto: string; reason: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px;">
          <h2 style="color: #991b1b; margin: 0 0 12px 0;">Saque Rejeitado</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Seu saque foi rejeitado pela equipe de revisão.
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>${params.amount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Motivo:</strong></td><td>${params.reason}</td></tr>
          </table>
          <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">
            O saldo foi desbloqueado e está disponível na sua carteira novamente.
          </p>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/wallets" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ver Carteiras
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque um saque foi rejeitado na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Saque Rejeitado\n\nOlá, ${params.name}. Seu saque de ${params.amount} ${params.crypto} foi rejeitado. Motivo: ${params.reason}. O saldo foi desbloqueado.`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Saque Rejeitado — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Withdrawal rejected preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send withdrawal rejected email:', (error as Error).message);
    }
  }

  async sendDepositConfirmedEmail(
    to: string,
    params: { name: string; amount: string; crypto: string; network: string; txHash: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const explorerUrl = this.getExplorerUrl(params.network, params.txHash);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; border-radius: 8px;">
          <h2 style="color: #166534; margin: 0 0 12px 0;">Depósito Confirmado</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Seu depósito foi creditado com sucesso!
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>${params.amount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Rede:</strong></td><td>${params.network}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>TX Hash:</strong></td><td style="word-break: break-all;"><a href="${explorerUrl}" style="color: #2563eb; font-family: monospace; font-size: 12px;">${params.txHash}</a></td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/wallets" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ver Carteiras
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque um depósito foi creditado na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Depósito Confirmado\n\nOlá, ${params.name}. Seu depósito de ${params.amount} ${params.crypto} (rede ${params.network}) foi creditado.\nTX Hash: ${params.txHash}\nVer no explorer: ${explorerUrl}`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Depósito Confirmado — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Deposit confirmed preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send deposit confirmed email:', (error as Error).message);
    }
  }

  async sendOrderMatchedEmail(
    to: string,
    params: { name: string; orderType: 'compra' | 'venda'; crypto: string; cryptoAmount: string; brlAmount: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px;">
          <h2 style="color: #1e40af; margin: 0 0 12px 0;">Ordem Aceita</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Sua ordem de <strong>${params.orderType}</strong> foi aceita!
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Tipo:</strong></td><td>${params.orderType === 'compra' ? 'Compra' : 'Venda'}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Cripto:</strong></td><td>${params.cryptoAmount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>R$ ${params.brlAmount}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ir para o Chat
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque uma ordem P2P foi aceita na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Ordem Aceita\n\nOlá, ${params.name}. Sua ordem de ${params.orderType} de ${params.cryptoAmount} ${params.crypto} (R$ ${params.brlAmount}) foi aceita. Acesse: ${frontendUrl}/orders`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: `Ordem de ${params.orderType === 'compra' ? 'Compra' : 'Venda'} Aceita — MktPlace`,
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Order matched preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send order matched email:', (error as Error).message);
    }
  }

  async sendTransactionCompletedEmail(
    to: string,
    params: { name: string; orderType: 'compra' | 'venda'; crypto: string; cryptoAmount: string; brlAmount: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; border-radius: 8px;">
          <h2 style="color: #166534; margin: 0 0 12px 0;">Transação Concluída</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Sua transação de <strong>${params.orderType}</strong> foi concluída com sucesso!
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Tipo:</strong></td><td>${params.orderType === 'compra' ? 'Compra' : 'Venda'}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Cripto:</strong></td><td>${params.cryptoAmount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>R$ ${params.brlAmount}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/orders" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Avaliar Negociação
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque uma transação P2P foi concluída na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Transação Concluída\n\nOlá, ${params.name}. Sua transação de ${params.orderType} de ${params.cryptoAmount} ${params.crypto} (R$ ${params.brlAmount}) foi concluída. Acesse: ${frontendUrl}/orders`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: `Transação de ${params.orderType === 'compra' ? 'Compra' : 'Venda'} Concluída — MktPlace`,
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Transaction completed preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send transaction completed email:', (error as Error).message);
    }
  }

  async sendPaymentRejectedEmail(
    to: string,
    params: { name: string; crypto: string; cryptoAmount: string; brlAmount: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px;">
          <h2 style="color: #991b1b; margin: 0 0 12px 0;">Comprovante Rejeitado</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Seu comprovante de pagamento foi rejeitado.
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Cripto:</strong></td><td>${params.cryptoAmount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>R$ ${params.brlAmount}</td></tr>
          </table>
          <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">
            O pedido voltou ao status anterior. Você pode enviar um novo comprovante válido.
          </p>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ver Pedido
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque um comprovante foi rejeitado na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Comprovante Rejeitado\n\nOlá, ${params.name}. Seu comprovante de pagamento para ${params.cryptoAmount} ${params.crypto} (R$ ${params.brlAmount}) foi rejeitado. Envie um novo comprovante.`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Comprovante Rejeitado — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Payment rejected preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send payment rejected email:', (error as Error).message);
    }
  }

  async sendPaymentSentEmail(
    to: string,
    params: { name: string; crypto: string; cryptoAmount: string; brlAmount: string; buyerName: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px;">
          <h2 style="color: #1e40af; margin: 0 0 12px 0;">Comprovante de Pagamento Enviado</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. O comprador <strong>${params.buyerName}</strong> enviou o comprovante de pagamento.
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Cripto:</strong></td><td>${params.cryptoAmount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>R$ ${params.brlAmount}</td></tr>
          </table>
          <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">
            O comprovante está em validação. Acompanhe o status no chat da transação.
          </p>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ver Pedido
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque um comprovante de pagamento foi enviado em um pedido P2P.
        </p>
      </div>
    `;

    const text = `Comprovante Enviado\n\nOlá, ${params.name}. O comprador ${params.buyerName} enviou o comprovante para ${params.cryptoAmount} ${params.crypto} (R$ ${params.brlAmount}). Acesse: ${frontendUrl}/orders`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Comprovante de Pagamento Enviado — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Payment sent preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send payment sent email:', (error as Error).message);
    }
  }

  async sendOrderCancelledEmail(
    to: string,
    params: { name: string; crypto: string; cryptoAmount: string; brlAmount: string; reason: string; isInitiator: boolean },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const title = params.isInitiator ? 'Pedido Cancelado' : 'Pedido Cancelado pela Contraparte';
    const description = params.isInitiator
      ? 'Seu pedido foi cancelado conforme solicitado.'
      : 'A contraparte cancelou o pedido. Se houver colateral bloqueado, ele foi desbloqueado.';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px;">
          <h2 style="color: #991b1b; margin: 0 0 12px 0;">${title}</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. ${description}
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Cripto:</strong></td><td>${params.cryptoAmount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>R$ ${params.brlAmount}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Motivo:</strong></td><td>${params.reason}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ver Pedidos
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque um pedido P2P foi cancelado na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `${title}\n\nOlá, ${params.name}. ${description}\nCripto: ${params.cryptoAmount} ${params.crypto}\nValor: R$ ${params.brlAmount}\nMotivo: ${params.reason}`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: `${title} — MktPlace`,
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Order cancelled preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send order cancelled email:', (error as Error).message);
    }
  }

  async sendDisputeCreatedEmail(
    to: string,
    params: { name: string; disputeTitle: string; crypto: string; cryptoAmount: string; brlAmount: string; creatorName: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px;">
          <h2 style="color: #991b1b; margin: 0 0 12px 0;">Nova Disputa Aberta</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. Uma disputa foi aberta por <strong>${params.creatorName}</strong> em um pedido do qual você participa.
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Título:</strong></td><td>${params.disputeTitle}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Cripto:</strong></td><td>${params.cryptoAmount} ${params.crypto}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Valor:</strong></td><td>R$ ${params.brlAmount}</td></tr>
          </table>
          <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">
            Responda à disputa o mais rápido possível para evitar penalidades automáticas.
          </p>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/disputes" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Responder Disputa
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque uma disputa foi aberta em um pedido P2P da sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Nova Disputa Aberta\n\nOlá, ${params.name}. ${params.creatorName} abriu a disputa "${params.disputeTitle}" em um pedido de ${params.cryptoAmount} ${params.crypto} (R$ ${params.brlAmount}). Responda o quanto antes.`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Nova Disputa Aberta — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Dispute created preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send dispute created email:', (error as Error).message);
    }
  }

  async sendDisputeResolvedEmail(
    to: string,
    params: { name: string; disputeTitle: string; resolution: string; resolutionType: string },
  ): Promise<void> {
    const transporter = await this.getTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const resolutionLabels: Record<string, string> = {
      'RELEASE_TO_BUYER': 'Cripto liberada ao comprador',
      'RETURN_TO_SELLER': 'Cripto devolvida ao vendedor',
      'CANCEL_NO_PENALTY': 'Cancelado sem penalidades',
      'PENALTY_BUYER': 'Cripto devolvida ao vendedor + penalidade ao comprador',
      'PENALTY_SELLER': 'Cripto liberada ao comprador + penalidade ao vendedor',
    };
    const resolutionLabel = resolutionLabels[params.resolutionType] || params.resolutionType;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; border-radius: 8px;">
          <h2 style="color: #166534; margin: 0 0 12px 0;">Disputa Resolvida</h2>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
            Olá, <strong>${params.name}</strong>. A disputa foi resolvida pela equipe de mediação.
          </p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>Disputa:</strong></td><td>${params.disputeTitle}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Decisão:</strong></td><td>${resolutionLabel}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Justificativa:</strong></td><td>${params.resolution}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/disputes" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
            Ver Disputas
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Você recebeu este email porque uma disputa foi resolvida na sua conta MktPlace.
        </p>
      </div>
    `;

    const text = `Disputa Resolvida\n\nOlá, ${params.name}. A disputa "${params.disputeTitle}" foi resolvida.\nDecisão: ${resolutionLabel}\nJustificativa: ${params.resolution}`;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
        to,
        subject: 'Disputa Resolvida — MktPlace',
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[EMAIL] Dispute resolved preview:', previewUrl);
    } catch (error) {
      console.warn('[EMAIL] Failed to send dispute resolved email:', (error as Error).message);
    }
  }

  async sendBroadcastEmail(
    to: string,
    params: {
      title: string;
      message: string;
      priority: string;
      actionUrl?: string;
      actionLabel?: string;
    },
  ): Promise<void> {
    const transporter = await this.getTransporter();

    const priorityColors: Record<string, { bg: string; border: string; text: string }> = {
      LOW: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
      NORMAL: { bg: '#eff6ff', border: '#2563eb', text: '#1e40af' },
      HIGH: { bg: '#fffbeb', border: '#d97706', text: '#92400e' },
      URGENT: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
    };

    const colors = priorityColors[params.priority] || priorityColors.NORMAL;

    const ctaButton = params.actionUrl
      ? `<div style="text-align: center; margin: 28px 0;">
           <a href="${params.actionUrl}" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
             ${params.actionLabel || 'Ver Detalhes'}
           </a>
         </div>`
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: ${colors.text}; margin: 0 0 12px 0;">${params.title}</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-line;">${params.message}</p>
        </div>
        ${ctaButton}
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Voce recebeu este email porque esta cadastrado no MktPlace da Liberdade.
        </p>
      </div>
    `;

    const text = `${params.title}\n\n${params.message}${params.actionUrl ? `\n\nAcesse: ${params.actionUrl}` : ''}`;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MktPlace" <noreply@mktplace.com>',
      to,
      subject: `${params.priority === 'URGENT' ? '[URGENTE] ' : ''}${params.title} — MktPlace`,
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('[EMAIL] Broadcast preview:', previewUrl);
  }
  /**
   * Wrapper: só envia email se a preferência do usuário permitir.
   * Categorias SECURITY/ADMIN são forçadas (sempre envia).
   */
  async sendIfAllowed(userId: string, prefCategory: string, emailFn: () => Promise<void>): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    if (!notifPrefsService.shouldEmail(user?.notificationPreferences ?? null, prefCategory)) {
      console.log(`[EMAIL] Skipped (user preference): userId=${userId}, category=${prefCategory}`);
      return;
    }
    await emailFn();
  }
}

export const emailService = new EmailService();
