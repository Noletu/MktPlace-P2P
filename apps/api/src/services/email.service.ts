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
}

export const emailService = new EmailService();
