const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak, VerticalAlign, UnderlineType, NumberFormat, LevelFormat,
  convertInchesToTwip, Header, Footer, PageNumber,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Cores ──────────────────────────────────────────────────────────────────
const COR_PRIMARIA   = '1E3A5F'; // azul escuro
const COR_SECUNDARIA = '2E86AB'; // azul médio
const COR_ACENTO     = 'F18F01'; // laranja
const COR_VERDE      = '2D6A4F'; // verde escuro
const COR_VERMELHO   = 'C1121F'; // vermelho
const COR_FUNDO_TABELA = 'EBF4FB'; // azul claríssimo
const COR_FUNDO_HEADER = '1E3A5F'; // cabeçalho de tabela
const COR_CINZA      = 'F8F9FA'; // cinza claro para zebra

// ── Helpers ────────────────────────────────────────────────────────────────
const br = () => new Paragraph({ text: '' });

const titulo = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 52, color: COR_PRIMARIA, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
});

const subtitulo = (text) => new Paragraph({
  children: [new TextRun({ text, size: 32, color: COR_SECUNDARIA, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
});

const secao = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 30, color: COR_PRIMARIA, font: 'Calibri' })],
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COR_SECUNDARIA } },
});

const subsecao = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 24, color: COR_SECUNDARIA, font: 'Calibri' })],
  spacing: { before: 240, after: 120 },
});

const paragrafo = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts })],
  spacing: { after: 120 },
  alignment: AlignmentType.JUSTIFIED,
});

const bullet = (text, negrito = false) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', bold: negrito })],
  bullet: { level: 0 },
  spacing: { after: 80 },
});

const numerado = (text, num) => new Paragraph({
  children: [
    new TextRun({ text: `${num}. `, bold: true, size: 22, color: COR_ACENTO, font: 'Calibri' }),
    new TextRun({ text, size: 22, font: 'Calibri' }),
  ],
  spacing: { after: 100 },
  indent: { left: 360 },
});

const destaque = (text) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', italics: true, color: COR_VERDE })],
  spacing: { after: 120 },
  indent: { left: 720, right: 720 },
  border: {
    left: { style: BorderStyle.THICK, size: 12, color: COR_VERDE },
  },
  shading: { type: ShadingType.CLEAR, fill: 'F0FFF4' },
});

const alerta = (text) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', bold: true, color: COR_VERMELHO })],
  spacing: { after: 120 },
  indent: { left: 720, right: 720 },
  border: {
    left: { style: BorderStyle.THICK, size: 12, color: COR_VERMELHO },
  },
  shading: { type: ShadingType.CLEAR, fill: 'FFF0F0' },
});

// ── Célula de tabela ───────────────────────────────────────────────────────
const celula = (text, opts = {}) => new TableCell({
  children: [new Paragraph({
    children: [new TextRun({
      text,
      size: 20,
      font: 'Calibri',
      bold: opts.bold || false,
      color: opts.textColor || '000000',
    })],
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: 60, after: 60 },
  })],
  shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  columnSpan: opts.span || undefined,
});

const celulaHeader = (text, span) => celula(text, {
  bold: true,
  fill: COR_FUNDO_HEADER,
  textColor: 'FFFFFF',
  align: AlignmentType.CENTER,
  span,
});

// ═══════════════════════════════════════════════════════════════════════════
//  DOCUMENTO
// ═══════════════════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22 },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          right: convertInchesToTwip(1.2),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1.2),
        },
      },
    },
    children: [

      // ════════════════════════════════════════════
      // CAPA
      // ════════════════════════════════════════════
      br(), br(), br(),

      new Paragraph({
        children: [new TextRun({ text: '🔐', size: 96 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),

      titulo('PROPOSTA TÉCNICA'),
      titulo('Sistema de Controle Duplo'),
      subtitulo('Autenticação de Dois Sócios para Operações Críticas'),

      br(),

      new Paragraph({
        children: [
          new TextRun({ text: 'Versão: ', bold: true, size: 22, color: COR_CINZA }),
          new TextRun({ text: '1.0   ', size: 22, color: '666666' }),
          new TextRun({ text: 'Data: ', bold: true, size: 22, color: '666666' }),
          new TextRun({ text: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), size: 22, color: '666666' }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),

      new Paragraph({
        children: [new TextRun({ text: 'Confidencial — uso interno', size: 20, italics: true, color: '999999' })],
        alignment: AlignmentType.CENTER,
      }),

      br(), br(),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════
      // 1. RESUMO EXECUTIVO
      // ════════════════════════════════════════════
      secao('1. Resumo Executivo'),

      paragrafo(
        'Este documento apresenta uma proposta para implementar autenticação de controle duplo na plataforma Mktplace P2P. O objetivo é garantir que operações críticas — como saques de fundos, acesso à master seed e alterações de configuração — só possam ser executadas quando ambos os sócios confirmam a ação.'
      ),

      destaque(
        '💡 Em vez de um único código 2FA compartilhado (o que é inseguro), cada sócio mantém seu próprio autenticador. Para ações críticas, o sistema exige que os DOIS confirmem — um inicia, o outro aprova.'
      ),

      paragrafo(
        'A solução proposta é conhecida como Maker-Checker (ou "regra dos quatro olhos") e é o padrão adotado por bancos digitais, fintechs e custodians de criptomoedas ao redor do mundo.'
      ),

      br(),

      // ════════════════════════════════════════════
      // 2. O PROBLEMA
      // ════════════════════════════════════════════
      secao('2. O Problema'),

      subsecao('2.1 Por que o 2FA tradicional não é suficiente?'),

      paragrafo(
        'O 2FA tradicional (Google Authenticator, SMS) é vinculado a uma única pessoa e a um único dispositivo. Isso cria dois problemas sérios para uma sociedade com dois controladores:'
      ),

      bullet('Qualquer um dos dois pode executar qualquer ação sozinho, sem o conhecimento do outro', true),
      bullet('Se um dos dispositivos for comprometido (roubo, malware, SIM swap), o atacante tem acesso total à plataforma'),
      bullet('Não existe rastro de "quem aprovou o quê" — apenas "quem fez o quê"'),

      br(),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Situação', 1),
              celulaHeader('2FA Individual (atual)', 1),
              celulaHeader('Controle Duplo (proposto)', 1),
            ],
          }),
          new TableRow({
            children: [
              celula('Saque de R$ 50.000 da plataforma', { fill: COR_CINZA }),
              celula('❌ Qualquer sócio sozinho pode fazer', { fill: COR_CINZA }),
              celula('✅ Sócio A pede → Sócio B confirma', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('Dispositivo de um sócio roubado', { fill: 'FFFFFF' }),
              celula('❌ Atacante acessa tudo sozinho', { fill: 'FFFFFF' }),
              celula('✅ Atacante não consegue sem o segundo sócio', { fill: 'FFFFFF' }),
            ],
          }),
          new TableRow({
            children: [
              celula('Auditoria: "quem autorizou o saque?"', { fill: COR_CINZA }),
              celula('❌ Impossível distinguir', { fill: COR_CINZA }),
              celula('✅ Log registra solicitante + aprovador', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('Operações do dia a dia (login, ordens)', { fill: 'FFFFFF' }),
              celula('✅ Funciona normalmente', { fill: 'FFFFFF' }),
              celula('✅ Funciona normalmente (sem mudança)', { fill: 'FFFFFF' }),
            ],
          }),
        ],
      }),

      br(),

      subsecao('2.2 O que NÃO funciona como solução'),

      paragrafo('Antes de apresentar a proposta, é importante explicar por que alternativas populares foram descartadas:'),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Alternativa', 1),
              celulaHeader('Por que não funciona', 2),
            ],
          }),
          new TableRow({
            children: [
              celula('Mesmo QR Code nos dois celulares', { fill: COR_CINZA }),
              celula('Gera códigos idênticos nos dois aparelhos. Qualquer um age sozinho. É apenas backup, não controle duplo.', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('SMS para dois números', { fill: 'FFFFFF' }),
              celula('SMS é vulnerável a SIM swap. Além disso, operadoras não permitem facilmente o mesmo código em dois números.', { fill: 'FFFFFF' }),
            ],
          }),
          new TableRow({
            children: [
              celula('Shamir\'s Secret Sharing (divisão criptográfica do seed)', { fill: COR_CINZA }),
              celula('Matematicamente elegante, mas exige os dois sócios online simultaneamente para gerar qualquer código. Sem recuperação de emergência fácil. Sem pacotes estáveis em produção.', { fill: COR_CINZA }),
            ],
          }),
        ],
      }),

      br(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════
      // 3. SOLUÇÃO PROPOSTA
      // ════════════════════════════════════════════
      secao('3. Solução Proposta: Sistema Maker-Checker'),

      paragrafo(
        'O sistema Maker-Checker — também chamado de "regra dos quatro olhos" — é o padrão ouro em segurança financeira. Funciona assim:'
      ),

      destaque('🏦 É o mesmo sistema que bancos como Nubank, Inter e BTG usam para aprovar transferências internas, alterações de limites e outras operações sensíveis.'),

      br(),
      subsecao('3.1 Princípio de Funcionamento'),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Papel', 1),
              celulaHeader('O que faz', 2),
            ],
          }),
          new TableRow({
            children: [
              celula('🔵  Maker (Solicitante)', { fill: COR_FUNDO_TABELA, bold: true }),
              celula('Inicia a operação crítica. Pode ser qualquer um dos dois sócios.', { fill: COR_FUNDO_TABELA }),
            ],
          }),
          new TableRow({
            children: [
              celula('🟠  Checker (Aprovador)', { fill: 'FFF8F0', bold: true }),
              celula('Recebe notificação, revisa os detalhes e confirma com seu próprio 2FA. DEVE ser o outro sócio (o sistema impede auto-aprovação).', { fill: 'FFF8F0' }),
            ],
          }),
        ],
      }),

      br(),
      subsecao('3.2 Fluxo Detalhado — Operação Crítica'),

      paragrafo('Exemplo: Sócio A quer sacar R$ 10.000 dos fundos da plataforma.'),
      br(),

      numerado('Sócio A faz login normalmente com email + senha + código 2FA pessoal.', 1),
      numerado('Sócio A acessa "Fundos da Plataforma" e clica em "Solicitar Saque".', 2),
      numerado('O sistema registra o pedido com todos os detalhes (valor, destino, horário) e status "Aguardando Aprovação".', 3),
      numerado('Sócio B recebe uma notificação instantânea no painel e por e-mail: "Sócio A solicitou um saque de R$ 10.000. Clique para revisar."', 4),
      numerado('Sócio B abre o painel de aprovações, vê todos os detalhes da solicitação (que não podem ser alterados).', 5),
      numerado('Sócio B digita seu próprio código 2FA para confirmar a aprovação.', 6),
      numerado('O sistema verifica: solicitante ≠ aprovador ✓, ambos são Master ✓, código 2FA válido ✓.', 7),
      numerado('Saque executado. Registro completo no audit log: quem pediu, quem aprovou, horário exato.', 8),

      br(),
      destaque('⏱️ Se o Sócio B não aprovar em 30 minutos, a solicitação expira automaticamente. O Sócio A precisaria refazê-la.'),

      br(),
      subsecao('3.3 Fluxo Simplificado — Operação Normal'),
      paragrafo('Para ações do dia a dia (fazer login, ver relatórios, gerenciar usuários comuns), NADA muda. O 2FA individual continua funcionando exatamente como hoje.'),

      br(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════
      // 4. OPERAÇÕES QUE EXIGEM APROVAÇÃO DUPLA
      // ════════════════════════════════════════════
      secao('4. Quais Operações Exigirão Aprovação Dupla?'),

      paragrafo('A proposta é aplicar o controle duplo apenas a ações de alto impacto. Abaixo, a lista sugerida — que pode ser ajustada conforme a decisão dos sócios:'),

      br(),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Operação', 1),
              celulaHeader('Motivo do Controle Duplo', 1),
              celulaHeader('Risco se feita por um só', 1),
            ],
          }),
          new TableRow({
            children: [
              celula('💰  Saque de fundos da plataforma', { fill: COR_CINZA }),
              celula('Impacto financeiro direto e imediato', { fill: COR_CINZA }),
              celula('Alto — perda de capital irrecuperável', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('🔑  Acesso / uso da Master Seed', { fill: 'FFFFFF' }),
              celula('Controla todas as carteiras do sistema', { fill: 'FFFFFF' }),
              celula('Crítico — comprometimento total das carteiras', { fill: 'FFFFFF' }),
            ],
          }),
          new TableRow({
            children: [
              celula('👑  Criar ou promover novo usuário MASTER', { fill: COR_CINZA }),
              celula('Escalada de privilégio — acesso total', { fill: COR_CINZA }),
              celula('Alto — terceiro com poderes de sócio', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('⚙️  Alterar taxas da plataforma', { fill: 'FFFFFF' }),
              celula('Impacto em todas as transações dos usuários', { fill: 'FFFFFF' }),
              celula('Médio — prejuízo a usuários ou à plataforma', { fill: 'FFFFFF' }),
            ],
          }),
          new TableRow({
            children: [
              celula('🚫  Congelamento permanente de conta', { fill: COR_CINZA }),
              celula('Risco legal e reputacional', { fill: COR_CINZA }),
              celula('Médio — ação contestável juridicamente', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('📦  Exportação em massa de dados de usuários', { fill: 'FFFFFF' }),
              celula('Conformidade com LGPD', { fill: 'FFFFFF' }),
              celula('Médio — violação de privacidade', { fill: 'FFFFFF' }),
            ],
          }),
          new TableRow({
            children: [
              celula('🔄  Reembolso manual acima de R$ 5.000', { fill: COR_CINZA }),
              celula('Impacto financeiro relevante', { fill: COR_CINZA }),
              celula('Médio — saída de caixa sem controle', { fill: COR_CINZA }),
            ],
          }),
        ],
      }),

      br(),
      paragrafo('Nota: A lista acima é uma sugestão inicial. Os limiares (ex: valor mínimo para saque) podem ser configurados conforme a necessidade do negócio.'),

      br(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════
      // 5. GARANTIAS DE SEGURANÇA
      // ════════════════════════════════════════════
      secao('5. O que o Sistema Garante'),

      subsecao('5.1 Proteções implementadas'),

      bullet('🔒  Nenhum sócio age sozinho em operações críticas — validado no servidor, não apenas no visual', true),
      bullet('🔒  Auto-aprovação impossível — o sistema recusa se solicitante e aprovador forem a mesma pessoa'),
      bullet('🔒  Código 2FA obrigatório no momento da aprovação — o aprovador não pode "clicar OK" sem confirmar identidade'),
      bullet('🔒  Payload imutável — o que foi solicitado não pode ser alterado após criação'),
      bullet('🔒  Auditoria completa — registro permanente de quem pediu, quem aprovou, horário, IP'),
      bullet('🔒  Expiração automática — pedidos não aprovados em 30 min são cancelados'),
      bullet('🔒  Notificação em tempo real — o sócio aprovador é avisado imediatamente por painel e e-mail'),

      br(),
      subsecao('5.2 Limitações conhecidas (transparência)'),

      alerta('⚠️  Se os dois sócios combinarem para executar algo prejudicial, o sistema não impede — esse é um risco de negócio, não técnico.'),
      alerta('⚠️  Se ambos os sócios perderem acesso ao 2FA simultaneamente, será necessário um processo de recuperação manual via suporte técnico.'),
      alerta('⚠️  O sistema não protege contra ataques físicos (ex: coerção presencial de ambos os sócios).'),

      br(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════
      // 6. COMPARAÇÃO COM O MERCADO
      // ════════════════════════════════════════════
      secao('6. Referências do Mercado'),

      paragrafo('O modelo Maker-Checker é amplamente adotado na indústria financeira e de criptoativos:'),
      br(),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Empresa / Produto', 1),
              celulaHeader('Como usa Maker-Checker', 2),
            ],
          }),
          new TableRow({
            children: [
              celula('Fireblocks (custódia cripto)', { fill: COR_CINZA, bold: true }),
              celula('Toda movimentação acima de threshold requer N aprovadores da equipe. Padrão para exchanges e fundos.', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('BitGo (custódia cripto)', { fill: 'FFFFFF', bold: true }),
              celula('Multi-signature + aprovação humana para saques. Política de N-de-M aprovadores configurável.', { fill: 'FFFFFF' }),
            ],
          }),
          new TableRow({
            children: [
              celula('Nubank / bancos digitais', { fill: COR_CINZA, bold: true }),
              celula('Operações internas (saques, ajustes de limite, reembolsos manuais) exigem aprovação de segundo operador.', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('HashiCorp Vault (Enterprise)', { fill: 'FFFFFF', bold: true }),
              celula('Control Groups: acesso a segredos críticos bloqueado até M aprovadores confirmarem.', { fill: 'FFFFFF' }),
            ],
          }),
          new TableRow({
            children: [
              celula('AWS CloudHSM', { fill: COR_CINZA, bold: true }),
              celula('Quorum Authentication: operações no HSM requerem M de N usuários autorizados simultaneamente.', { fill: COR_CINZA }),
            ],
          }),
        ],
      }),

      br(),

      // ════════════════════════════════════════════
      // 7. IMPLEMENTAÇÃO TÉCNICA (RESUMO)
      // ════════════════════════════════════════════
      secao('7. Como Seria Implementado (Visão Técnica Resumida)'),

      paragrafo('Para os sócios que queiram entender o aspecto técnico da solução:'),
      br(),

      subsecao('7.1 Novos componentes no sistema'),

      bullet('Tabela ApprovalRequest no banco de dados — armazena cada solicitação pendente com status, dados imutáveis da ação e timestamps'),
      bullet('Middleware de Controle Duplo — intercepta rotas críticas automaticamente, sem necessidade de alterar cada tela individualmente'),
      bullet('Painel de Aprovações (/admin/approvals) — lista de pedidos pendentes, com botão de aprovar/rejeitar e confirmação por 2FA'),
      bullet('Notificações automáticas — WebSocket (tempo real) + e-mail para o aprovador'),
      bullet('Job de expiração — processo automático que cancela pedidos não respondidos'),

      br(),
      subsecao('7.2 O que NÃO muda para os usuários comuns'),

      paragrafo('Nenhuma alteração na experiência dos usuários finais da plataforma. O controle duplo é restrito ao painel administrativo, visível apenas para usuários com role MASTER.'),

      br(),
      subsecao('7.3 Estimativa de desenvolvimento'),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Fase', 1),
              celulaHeader('O que inclui', 1),
              celulaHeader('Estimativa', 1),
            ],
          }),
          new TableRow({
            children: [
              celula('Fase 1 — Estrutura base', { fill: COR_CINZA }),
              celula('Banco de dados, middleware, API de aprovação', { fill: COR_CINZA }),
              celula('3 a 5 dias', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('Fase 2 — Interface', { fill: 'FFFFFF' }),
              celula('Painel de aprovações, notificações em tempo real', { fill: 'FFFFFF' }),
              celula('2 a 3 dias', { fill: 'FFFFFF' }),
            ],
          }),
          new TableRow({
            children: [
              celula('Fase 3 — Integração', { fill: COR_CINZA }),
              celula('Aplicar nas rotas críticas identificadas, testes', { fill: COR_CINZA }),
              celula('2 a 3 dias', { fill: COR_CINZA }),
            ],
          }),
          new TableRow({
            children: [
              celula('Total estimado', { fill: COR_FUNDO_HEADER, bold: true }),
              celula('', { fill: COR_FUNDO_HEADER }),
              celula('7 a 11 dias úteis', { fill: COR_FUNDO_HEADER, bold: true }),
            ],
          }),
        ],
      }),

      br(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════
      // 8. PRÓXIMOS PASSOS
      // ════════════════════════════════════════════
      secao('8. Próximos Passos'),

      paragrafo('Para avançar com esta proposta, são necessárias as seguintes decisões:'),
      br(),

      numerado('Validar a lista de operações críticas (Seção 4) — adicionar, remover ou ajustar conforme o modelo de negócio.', 1),
      numerado('Definir o timeout de aprovação (sugestão: 30 minutos) — pode ser maior para operações que precisam de coordenação prévia.', 2),
      numerado('Definir se haverá um limiar de valor para saques (ex: apenas saques acima de R$ 1.000 exigem aprovação dupla).', 3),
      numerado('Aprovar esta proposta — assinatura de ambos os sócios na seção abaixo.', 4),
      numerado('Iniciar implementação — estimativa de 7 a 11 dias úteis.', 5),

      br(), br(),

      // ════════════════════════════════════════════
      // 9. VALIDAÇÃO
      // ════════════════════════════════════════════
      secao('9. Validação e Aprovação'),

      paragrafo('Ao assinar abaixo, os sócios confirmam que compreenderam a proposta e autorizam o início da implementação.'),
      br(), br(),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Sócio 1', 1),
              celulaHeader('Sócio 2', 1),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ text: 'Nome: ___________________________', spacing: { after: 400 } }),
                  new Paragraph({ text: 'Data: ___________________________', spacing: { after: 400 } }),
                  new Paragraph({ text: 'Assinatura:', spacing: { after: 600 } }),
                  new Paragraph({ text: '________________________________', spacing: { after: 100 } }),
                ],
                margins: { top: 200, bottom: 200, left: 200, right: 200 },
              }),
              new TableCell({
                children: [
                  new Paragraph({ text: 'Nome: ___________________________', spacing: { after: 400 } }),
                  new Paragraph({ text: 'Data: ___________________________', spacing: { after: 400 } }),
                  new Paragraph({ text: 'Assinatura:', spacing: { after: 600 } }),
                  new Paragraph({ text: '________________________________', spacing: { after: 100 } }),
                ],
                margins: { top: 200, bottom: 200, left: 200, right: 200 },
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: '⬜ Aprovado    ⬜ Aprovado com ressalvas    ⬜ Reprovado', size: 20 })],
                  spacing: { before: 120, after: 120 },
                })],
                columnSpan: 1,
                margins: { left: 200 },
              }),
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: '⬜ Aprovado    ⬜ Aprovado com ressalvas    ⬜ Reprovado', size: 20 })],
                  spacing: { before: 120, after: 120 },
                })],
                columnSpan: 1,
                margins: { left: 200 },
              }),
            ],
          }),
        ],
      }),

      br(), br(),

      new Paragraph({
        children: [new TextRun({
          text: 'Observações / ressalvas:',
          bold: true, size: 22, font: 'Calibri',
        })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: '_'.repeat(90), size: 22, color: 'CCCCCC' })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: '_'.repeat(90), size: 22, color: 'CCCCCC' })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: '_'.repeat(90), size: 22, color: 'CCCCCC' })],
      }),

      br(), br(),

      new Paragraph({
        children: [new TextRun({
          text: 'Documento gerado automaticamente pelo sistema Mktplace P2P • Confidencial',
          size: 16, italics: true, color: 'AAAAAA',
        })],
        alignment: AlignmentType.CENTER,
      }),
    ],
  }],
});

// ── Gerar arquivo ──────────────────────────────────────────────────────────
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = path.join(__dirname, '..', 'PROPOSTA-CONTROLE-DUPLO.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ Documento gerado:', outputPath);
}).catch((err) => {
  console.error('❌ Erro ao gerar documento:', err);
  process.exit(1);
});
