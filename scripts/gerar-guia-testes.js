/**
 * Gerador do Guia de Testes — Sistema Dual-Approval + Plano de Contingência
 * USO: node scripts/gerar-guia-testes.js
 * SAÍDA: GUIA-TESTES-DUAL-APPROVAL.docx (na raiz do projeto)
 */

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak, VerticalAlign, convertInchesToTwip,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Cores ──────────────────────────────────────────────────────────────────
const COR_AZUL      = '1E3A5F';
const COR_AZUL_MED  = '2E86AB';
const COR_VERDE     = '1A5C38';
const COR_VERDE_BG  = 'E8F5E9';
const COR_VERMELHO  = 'C1121F';
const COR_VERM_BG   = 'FFEBEE';
const COR_LARANJA   = 'D4680A';
const COR_LAR_BG    = 'FFF3E0';
const COR_CINZA_BG  = 'F5F5F5';
const COR_HEADER    = '1E3A5F';
const COR_ROXO      = '4A148C';
const COR_ROXO_BG   = 'F3E5F5';

// ── Helpers ────────────────────────────────────────────────────────────────
const br = () => new Paragraph({ text: '' });

const titulo = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 56, color: COR_AZUL, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 160 },
});

const subtitulo = (text) => new Paragraph({
  children: [new TextRun({ text, size: 28, color: COR_AZUL_MED, font: 'Calibri', italics: true })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
});

const secao = (num, text) => new Paragraph({
  children: [new TextRun({ text: `${num}. ${text}`, bold: true, size: 32, color: COR_AZUL, font: 'Calibri' })],
  spacing: { before: 400, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COR_AZUL_MED } },
});

const subsecao = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 24, color: COR_AZUL_MED, font: 'Calibri' })],
  spacing: { before: 240, after: 100 },
});

const para = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts })],
  spacing: { after: 100 },
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
});

const bullet = (text, negrito = false) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', bold: negrito })],
  bullet: { level: 0 },
  spacing: { after: 80 },
});

const subbullet = (text) => new Paragraph({
  children: [new TextRun({ text, size: 20, font: 'Calibri', color: '444444' })],
  bullet: { level: 1 },
  spacing: { after: 60 },
});

const passo = (num, text) => new Paragraph({
  children: [
    new TextRun({ text: `${num}. `, bold: true, size: 22, color: COR_AZUL_MED, font: 'Calibri' }),
    new TextRun({ text, size: 22, font: 'Calibri' }),
  ],
  spacing: { after: 100 },
  indent: { left: convertInchesToTwip(0.25) },
});

const blocoVerde = (text) => new Paragraph({
  children: [new TextRun({ text: `✅ ${text}`, size: 22, font: 'Calibri', color: COR_VERDE, bold: true })],
  shading: { type: ShadingType.CLEAR, fill: COR_VERDE_BG },
  border: { left: { style: BorderStyle.THICK, size: 12, color: COR_VERDE } },
  spacing: { after: 100, before: 80 },
  indent: { left: 240, right: 240 },
});

const blocoVermelho = (text) => new Paragraph({
  children: [new TextRun({ text: `❌ ${text}`, size: 22, font: 'Calibri', color: COR_VERMELHO, bold: true })],
  shading: { type: ShadingType.CLEAR, fill: COR_VERM_BG },
  border: { left: { style: BorderStyle.THICK, size: 12, color: COR_VERMELHO } },
  spacing: { after: 100, before: 80 },
  indent: { left: 240, right: 240 },
});

const blocoLaranja = (text) => new Paragraph({
  children: [new TextRun({ text: `⚠ ${text}`, size: 22, font: 'Calibri', color: COR_LARANJA, bold: true })],
  shading: { type: ShadingType.CLEAR, fill: COR_LAR_BG },
  border: { left: { style: BorderStyle.THICK, size: 12, color: COR_LARANJA } },
  spacing: { after: 100, before: 80 },
  indent: { left: 240, right: 240 },
});

const blocoInfo = (text) => new Paragraph({
  children: [new TextRun({ text: `ℹ ${text}`, size: 22, font: 'Calibri', color: COR_AZUL, italics: true })],
  shading: { type: ShadingType.CLEAR, fill: COR_CINZA_BG },
  border: { left: { style: BorderStyle.THICK, size: 12, color: COR_AZUL_MED } },
  spacing: { after: 100, before: 80 },
  indent: { left: 240, right: 240 },
});

const blocoRoxo = (text) => new Paragraph({
  children: [new TextRun({ text: `🔐 ${text}`, size: 22, font: 'Calibri', color: COR_ROXO, bold: true })],
  shading: { type: ShadingType.CLEAR, fill: COR_ROXO_BG },
  border: { left: { style: BorderStyle.THICK, size: 12, color: COR_ROXO } },
  spacing: { after: 100, before: 80 },
  indent: { left: 240, right: 240 },
});

const codigo = (text) => new Paragraph({
  children: [new TextRun({ text, size: 20, font: 'Courier New', color: '333333' })],
  shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' },
  spacing: { after: 80, before: 80 },
  indent: { left: 360, right: 360 },
});

const paginaBreak = () => new Paragraph({ children: [new PageBreak()] });

// ── Tabela de Casos de Teste ────────────────────────────────────────────────
function tabelaTestes(linhas) {
  const header = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, size: 20, color: 'FFFFFF', font: 'Calibri' })], alignment: AlignmentType.CENTER })],
        shading: { fill: COR_HEADER, type: ShadingType.SOLID },
        width: { size: 6, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Caso de Teste', bold: true, size: 20, color: 'FFFFFF', font: 'Calibri' })] })],
        shading: { fill: COR_HEADER, type: ShadingType.SOLID },
        width: { size: 36, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Resultado Esperado', bold: true, size: 20, color: 'FFFFFF', font: 'Calibri' })] })],
        shading: { fill: COR_HEADER, type: ShadingType.SOLID },
        width: { size: 36, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true, size: 20, color: 'FFFFFF', font: 'Calibri' })], alignment: AlignmentType.CENTER })],
        shading: { fill: COR_HEADER, type: ShadingType.SOLID },
        width: { size: 22, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
      }),
    ],
  });

  const rows = linhas.map((l, i) => {
    const shade = i % 2 === 0 ? 'FFFFFF' : 'F5F7FA';
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(l[0]), bold: true, size: 20, font: 'Calibri', color: COR_AZUL_MED })], alignment: AlignmentType.CENTER })],
          shading: { fill: shade, type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: l[1], size: 20, font: 'Calibri' })], spacing: { before: 60, after: 60 } })],
          shading: { fill: shade, type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 120, right: 80 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: l[2], size: 20, font: 'Calibri', color: COR_VERDE })], spacing: { before: 60, after: 60 } })],
          shading: { fill: shade, type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 120, right: 80 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: '□ OK    □ FALHA', size: 18, font: 'Calibri', color: '555555' })], alignment: AlignmentType.CENTER })],
          shading: { fill: shade, type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
        }),
      ],
    });
  });

  return new Table({
    rows: [header, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED },
      left:   { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED },
      right:  { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED },
      insideH:{ style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideV:{ style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
    },
  });
}

// ── Tabela de Pré-requisitos ────────────────────────────────────────────────
function tabelaPreRequisitos(linhas) {
  const header = new TableRow({
    tableHeader: true,
    children: ['Usuário / Recurso', 'Configuração Necessária', 'OK?'].map(h =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF', font: 'Calibri' })] })],
        shading: { fill: COR_HEADER, type: ShadingType.SOLID },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
      })
    ),
  });

  const rows = linhas.map((l, i) => {
    const shade = i % 2 === 0 ? 'FFFFFF' : 'F5F7FA';
    return new TableRow({
      children: l.map(cell => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, font: 'Calibri' })], spacing: { before: 60, after: 60 } })],
        shading: { fill: shade, type: ShadingType.SOLID },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
      })),
    });
  });

  return new Table({
    rows: [header, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED },
      left:   { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED },
      right:  { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED },
      insideH:{ style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideV:{ style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOCUMENTO
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.2),
          },
        },
      },
      children: [

        // ══════════════════════════════════════════════════════════════════
        // CAPA
        // ══════════════════════════════════════════════════════════════════
        br(), br(), br(),
        titulo('GUIA DE TESTES'),
        titulo('Sistema Dual-Approval + Plano de Contingência'),
        br(),
        subtitulo('Roteiro de validação funcional e de segurança'),
        br(),
        para(`Data: ${dataGeracao}   |   Versão: 1.0`, { color: '888888', center: true }),
        br(), br(),

        new Paragraph({
          children: [new TextRun({ text: 'ESCOPO DESTE GUIA', bold: true, size: 24, color: COR_AZUL, font: 'Calibri' })],
          spacing: { after: 120, before: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COR_AZUL_MED } },
        }),
        bullet('Sistema de Aprovação Dupla (Maker-Checker) para 5 operações críticas'),
        bullet('Override de Emergência com janela de cancelamento de 30 minutos'),
        bullet('Delegação Temporária de aprovação (GERENTE/ADMIN)'),
        bullet('Script de geração do Kit de Sucessão (Cenário C)'),
        bullet('Job de lembrete trimestral por e-mail'),
        bullet('Página de segurança do usuário (/settings/security)'),
        bullet('Banner de alerta de backup codes zerados'),
        br(),
        blocoLaranja('Execute todos os testes com o servidor rodando em modo desenvolvimento (npm run dev).'),
        blocoLaranja('Use dois usuários MASTER distintos em navegadores diferentes (ex: Chrome e Firefox) para simular os dois sócios.'),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 1 — PRÉ-REQUISITOS
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(1, 'Pré-Requisitos para os Testes'),
        br(),

        subsecao('1.1 Usuários Necessários'),
        tabelaPreRequisitos([
          ['MASTER A (Sócio 1)', 'Role MASTER, 2FA ativado, backup codes gerados', '□'],
          ['MASTER B (Sócio 2)', 'Role MASTER, 2FA ativado (conta separada)', '□'],
          ['GERENTE', 'Role GERENTE (level 60), conta ativa', '□'],
          ['ADMIN', 'Role ADMIN (level 80), conta ativa', '□'],
          ['Usuário comum', 'Role USER, conta ativa', '□'],
        ]),
        br(),

        subsecao('1.2 Ambiente'),
        tabelaPreRequisitos([
          ['API', 'Rodando em http://localhost:3001', '□'],
          ['Frontend', 'Rodando em http://localhost:3000', '□'],
          ['Banco de dados', 'SQLite inicializado (prisma db push executado)', '□'],
          ['2FA — MASTER A', 'Ativado via Admin → Segurança', '□'],
          ['2FA — MASTER B', 'Ativado via Admin → Segurança', '□'],
          ['E-mail (Ethereal)', 'Verificar logs do servidor para URL de preview do e-mail', '□'],
        ]),
        br(),

        subsecao('1.3 Como ativar o 2FA para testes'),
        passo(1, 'Faça login como MASTER A em http://localhost:3000'),
        passo(2, 'Acesse: Admin → Segurança'),
        passo(3, 'Clique em "Configurar 2FA" e escaneie o QR code com Google Authenticator ou Authy'),
        passo(4, 'Digite o código de 6 dígitos para confirmar a ativação'),
        passo(5, 'Gere os backup codes e anote-os (necessários para o teste do Kit de Sucessão)'),
        passo(6, 'Repita o processo para MASTER B em outro navegador/aba privada'),
        br(),
        blocoInfo('Nos logs da API (console), o Ethereal captura os e-mails. Copie a URL de preview para ver o conteúdo do e-mail sem SMTP real.'),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 2 — FLUXO PRINCIPAL: APROVAÇÃO DUPLA
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(2, 'Fluxo Principal: Aprovação Dupla (Maker-Checker)'),
        br(),
        blocoRoxo('Pré-condição: MASTER A logado no Chrome. MASTER B logado no Firefox. Ambos com 2FA ativado.'),
        br(),

        subsecao('2.1 Criar Operação Pendente (Iniciador = MASTER A)'),
        passo(1, 'MASTER A: Acesse Admin → Fundos → Transferência Interna'),
        passo(2, 'Preencha: carteira origem, destino e valor'),
        passo(3, 'Digite sua nota/justificativa no campo "Nota do Iniciador"'),
        passo(4, 'Clique em Confirmar e insira o código 2FA quando solicitado'),
        passo(5, 'Verifique: a API responde com HTTP 202 (não 200)'),
        passo(6, 'Verifique: mensagem "Operação enviada para aprovação dupla" aparece na tela'),
        passo(7, 'Nos logs da API: verifique o e-mail Ethereal enviado ao MASTER B'),
        br(),

        tabelaTestes([
          ['T-01', 'MASTER A cria transferência interna com 2FA válido', 'HTTP 202, registro criado no banco com status PENDING_APPROVAL, e-mail enviado ao MASTER B'],
          ['T-02', 'MASTER A tenta criar sem 2FA (remova o header temporariamente)', 'HTTP 401 ou 403 — operação bloqueada'],
          ['T-03', 'GERENTE tenta acessar /admin/funds/internal-transfer', 'HTTP 403 — apenas MASTER pode iniciar'],
          ['T-04', 'Usuário comum tenta acessar qualquer rota /admin/funds/', 'HTTP 403 — sem acesso'],
        ]),
        br(),

        subsecao('2.2 Aprovar a Operação (Aprovador = MASTER B)'),
        passo(1, 'MASTER B: Acesse Admin → Aprovações → aba "Aguardando Minha Aprovação"'),
        passo(2, 'Localize a operação iniciada pelo MASTER A'),
        passo(3, 'Clique em "Aprovar" — será solicitado o código 2FA do MASTER B'),
        passo(4, 'Digite o código e confirme'),
        passo(5, 'Verifique: status muda para APPROVED e a operação é executada'),
        passo(6, 'Verifique o saldo das carteiras — deve refletir a transferência'),
        br(),

        tabelaTestes([
          ['T-05', 'MASTER B aprova operação com 2FA válido', 'Status → APPROVED, operação executada, saldos atualizados'],
          ['T-06', 'MASTER A tenta aprovar sua própria operação', 'HTTP 403 — "Você não pode aprovar sua própria operação"'],
          ['T-07', 'MASTER B aprova com 2FA errado', 'HTTP 400/403 — aprovação bloqueada'],
          ['T-08', 'MASTER B tenta aprovar operação já aprovada', 'HTTP 400 — "Operação não está aguardando aprovação"'],
          ['T-09', 'GERENTE sem delegação tenta aprovar', 'HTTP 403 — sem permissão'],
        ]),
        br(),

        subsecao('2.3 Rejeitar a Operação'),
        passo(1, 'MASTER A: Crie uma nova operação pendente (ex: Ajuste de Saldo)'),
        passo(2, 'MASTER B: Acesse Admin → Aprovações → localize a operação'),
        passo(3, 'Clique em "Rejeitar" e insira uma nota de rejeição'),
        passo(4, 'Verifique: status muda para REJECTED, operação NÃO é executada'),
        br(),

        tabelaTestes([
          ['T-10', 'MASTER B rejeita a operação com nota', 'Status → REJECTED, saldos inalterados, nota registrada'],
          ['T-11', 'MASTER A tenta rejeitar sua própria operação', 'HTTP 403 — "Você não pode rejeitar sua própria operação"'],
        ]),
        br(),

        subsecao('2.4 Testar Todas as 5 Operações Críticas'),
        blocoInfo('Cada operação abaixo deve ser testada criando uma pendência e aprovando. Todas requerem 2FA do iniciador.'),
        br(),

        tabelaTestes([
          ['T-12', 'Transferência Interna (INTERNAL_TRANSFER)', 'HTTP 202, aprovação necessária, executa após aprovação'],
          ['T-13', 'Ajuste de Saldo (ADJUST_BALANCE)', 'HTTP 202, aprovação necessária, executa após aprovação'],
          ['T-14', 'Reembolso de Plataforma (PLATFORM_REFUND)', 'HTTP 202, aprovação necessária, executa após aprovação'],
          ['T-15', 'Bloqueio de Saldo (LOCK_BALANCE) — requer 2FA', 'HTTP 202, aprovação necessária, executa após aprovação'],
          ['T-16', 'Desbloqueio de Saldo (UNLOCK_BALANCE) — requer 2FA', 'HTTP 202, aprovação necessária, executa após aprovação'],
        ]),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 3 — OVERRIDE DE EMERGÊNCIA
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(3, 'Override de Emergência (Cenário A)'),
        br(),
        blocoRoxo('Simula: MASTER B está indisponível por horas. MASTER A precisa executar a operação.'),
        blocoLaranja('ATENÇÃO: O sistema exige que a operação fique pendente por no mínimo 60 minutos antes de solicitar override. Para testes, defina DUAL_APPROVAL_OVERRIDE_MIN_WAIT_MINUTES=1 no .env da API.'),
        br(),

        subsecao('3.1 Configurar Ambiente de Teste'),
        passo(1, 'No arquivo apps/api/.env, adicione ou altere:'),
        codigo('DUAL_APPROVAL_OVERRIDE_MIN_WAIT_MINUTES=1'),
        passo(2, 'Reinicie a API (Ctrl+C e npm run dev novamente)'),
        passo(3, 'Crie uma nova operação pendente como MASTER A'),
        passo(4, 'Aguarde 1 minuto (o tempo mínimo configurado)'),
        br(),

        subsecao('3.2 Solicitar o Override'),
        passo(1, 'MASTER A: Acesse Admin → Aprovações → aba "Minhas Solicitações"'),
        passo(2, 'Localize a operação pendente e clique em "Override de Emergência"'),
        passo(3, 'Preencha a justificativa (mínimo 50 caracteres)'),
        passo(4, 'Digite o código 2FA do MASTER A'),
        passo(5, 'Confirme — a operação entra no status OVERRIDE_PENDING'),
        passo(6, 'Verifique nos logs: e-mail enviado ao MASTER B com link de cancelamento'),
        passo(7, 'O override será executado automaticamente após 30 minutos pelo job cron'),
        br(),

        tabelaTestes([
          ['T-17', 'MASTER A solicita override antes de 1 min de espera', 'HTTP 429 — "Aguarde X minuto(s) antes de solicitar o override"'],
          ['T-18', 'MASTER A solicita override com justificativa < 50 chars', 'HTTP 400 — "A justificativa deve ter no mínimo 50 caracteres"'],
          ['T-19', 'MASTER A solicita override com 2FA inválido', 'HTTP 400 — "Código 2FA inválido"'],
          ['T-20', 'MASTER A solicita override válido (após espera + 2FA ok)', 'Status → OVERRIDE_PENDING, e-mail com link enviado ao MASTER B'],
          ['T-21', 'MASTER A tenta 4º override no mesmo dia', 'HTTP 429 — "Limite de overrides atingido (máx 3 por 24h)"'],
          ['T-22', 'MASTER B tenta solicitar override (não é o iniciador)', 'HTTP 403 — "Apenas o iniciador pode solicitar"'],
        ]),
        br(),

        subsecao('3.3 Cancelar o Override via Link de E-mail'),
        passo(1, 'Nos logs da API, copie a URL de preview do Ethereal para o e-mail do MASTER B'),
        passo(2, 'Abra o e-mail e clique no link "Cancelar Override"'),
        passo(3, 'O link abre a página /cancel-override (sem login)'),
        passo(4, 'Verifique: mensagem de confirmação na tela'),
        passo(5, 'No banco: status muda para OVERRIDE_CANCELLED'),
        passo(6, 'MASTER A recebe e-mail notificando que o override foi cancelado'),
        br(),

        tabelaTestes([
          ['T-23', 'MASTER B cancela override via link do e-mail (sem login)', 'Página /cancel-override mostra "Override Cancelado com sucesso", status → OVERRIDE_CANCELLED'],
          ['T-24', 'MASTER B tenta usar o mesmo link uma segunda vez', 'Mensagem de erro — token já foi invalidado (null no banco)'],
          ['T-25', 'MASTER A cancela override via UI autenticada (Admin → Aprovações)', 'Status → OVERRIDE_CANCELLED via interface'],
          ['T-26', 'Link de cancelamento após o override ter sido executado', 'Mensagem: "O override já foi executado automaticamente"'],
        ]),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 4 — DELEGAÇÃO TEMPORÁRIA
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(4, 'Delegação Temporária (Cenário B)'),
        br(),
        blocoRoxo('Simula: MASTER B viajará por 2 semanas. Delega aprovações ao GERENTE de confiança.'),
        br(),

        subsecao('4.1 Criar Delegação'),
        passo(1, 'MASTER B: Acesse Admin → Delegações'),
        passo(2, 'Clique em "Nova Delegação"'),
        passo(3, 'Selecione o GERENTE na lista de "delegatários elegíveis"'),
        passo(4, 'Defina o escopo de operações (pode ser "Todas" ou operações específicas)'),
        passo(5, 'Defina a validade em dias (ex: 14 dias)'),
        passo(6, 'Adicione uma justificativa/motivo'),
        passo(7, 'Salve — verifique e-mail enviado ao GERENTE'),
        br(),

        tabelaTestes([
          ['T-27', 'MASTER B cria delegação para GERENTE com escopo de todas as operações', 'Delegação criada, GERENTE recebe e-mail de notificação'],
          ['T-28', 'MASTER B cria delegação com escopo limitado (apenas LOCK_BALANCE)', 'Delegação criada com operationScope = ["LOCK_BALANCE"]'],
          ['T-29', 'MASTER A tenta criar delegação para MASTER B (MASTER não é elegível)', 'HTTP 400 — apenas GERENTE/ADMIN são delegatários válidos'],
          ['T-30', 'MASTER B cria segunda delegação ativa para o mesmo GERENTE', 'HTTP 400 — já existe delegação ativa para este usuário'],
        ]),
        br(),

        subsecao('4.2 GERENTE Aprovar com Delegação Ativa'),
        passo(1, 'MASTER A: Crie uma operação pendente (ex: Ajuste de Saldo)'),
        passo(2, 'GERENTE: Acesse Admin → Aprovações → aba "Aguardando Minha Aprovação"'),
        passo(3, 'A operação deve aparecer na lista do GERENTE (via delegação)'),
        passo(4, 'GERENTE clica em "Aprovar" e insere código 2FA'),
        passo(5, 'Verifique: operação aprovada, e-mail enviado ao MASTER B informando que delegado aprovou'),
        passo(6, 'No banco: campo delegationId preenchido no registro'),
        br(),

        tabelaTestes([
          ['T-31', 'GERENTE aprova operação dentro do escopo da delegação', 'Operação aprovada e executada, delegationId preenchido, e-mail de notificação enviado'],
          ['T-32', 'GERENTE tenta aprovar operação fora do escopo da delegação', 'HTTP 403 — "Sem delegação ativa para este tipo de operação"'],
          ['T-33', 'GERENTE aprova operação iniciada pelo MASTER A (auto-aprovação do iniciador é bloqueada)', 'HTTP 403 se GERENTE for o iniciador; OK se for outro usuário iniciador'],
          ['T-34', 'Delegação expirada: GERENTE tenta aprovar após a data de validade', 'HTTP 403 — delegação não mais ativa'],
        ]),
        br(),

        subsecao('4.3 Revogar Delegação'),
        passo(1, 'MASTER B: Acesse Admin → Delegações'),
        passo(2, 'Localize a delegação ativa e clique em "Revogar"'),
        passo(3, 'Verifique: delegação marcada como REVOKED no banco'),
        passo(4, 'GERENTE: Tente aprovar uma operação — deve receber 403'),
        br(),

        tabelaTestes([
          ['T-35', 'MASTER B revoga delegação ativa', 'Delegação → status REVOKED, GERENTE perde acesso imediatamente'],
          ['T-36', 'Usuário comum tenta acessar Admin → Delegações', 'HTTP 403 — acesso negado'],
        ]),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 5 — KIT DE SUCESSÃO
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(5, 'Kit de Sucessão — Script e Documento (Cenário C)'),
        br(),
        blocoRoxo('Não requer servidor rodando. Apenas Node.js e o pacote docx instalado.'),
        br(),

        subsecao('5.1 Gerar o Documento Word'),
        passo(1, 'Abra um terminal na raiz do projeto (C:\\Projects\\mktplace-p2p)'),
        passo(2, 'Execute:'),
        codigo('node scripts/gerar-kit-sucessao.js'),
        passo(3, 'Verifique no terminal: mensagem de sucesso e caminho do arquivo'),
        passo(4, 'Abra o arquivo KIT-SUCESSAO-MASTER.docx gerado na raiz'),
        passo(5, 'Verifique a estrutura do documento'),
        br(),

        tabelaTestes([
          ['T-37', 'Script executa sem erros', 'Mensagem "✅ Kit de Sucessão gerado com sucesso!" e arquivo .docx criado'],
          ['T-38', 'Documento contém 5 páginas', 'Capa, Passo a Passo, Tabela de Backup Codes, Autorização Legal, Instruções de Armazenamento'],
          ['T-39', 'Tabela de backup codes tem 10 linhas', '10 linhas com coluna "#", "Código (8 chars)" e "Usado?"'],
          ['T-40', 'Campos da capa estão em branco (para preencher à mão)', 'Titular, E-mail de Acesso, Próxima Revisão aparecem como linhas em branco'],
          ['T-41', 'Modelo de autorização legal contém campos preenchíveis', 'Espaços para Nome, CPF, Assinatura, Data'],
          ['T-42', 'Script não conecta ao banco de dados', 'Sem erro de conexão mesmo com a API desligada'],
        ]),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 6 — JOB DE LEMBRETE TRIMESTRAL
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(6, 'Job de Lembrete Trimestral do Kit de Sucessão'),
        br(),
        blocoInfo('O job roda automaticamente às 9h do dia 1º de jan/abr/jul/out. Para testar manualmente, chame o emailService direto.'),
        br(),

        subsecao('6.1 Verificar Registro do Job no Startup'),
        passo(1, 'Inicie a API com npm run dev'),
        passo(2, 'Verifique nos logs iniciais da API'),
        br(),
        blocoVerde('Log esperado: "[SuccessionReminder Job] Iniciado — 9h no dia 1º de jan/abr/jul/out"'),
        br(),

        subsecao('6.2 Testar Envio Manual do E-mail'),
        passo(1, 'Crie um arquivo temporário apps/api/src/test-reminder.ts:'),
        codigo("import { emailService } from './services/email.service';"),
        codigo("emailService.sendSuccessionKitReminderEmail('teste@email.com', { name: 'Sócio Teste' })"),
        codigo("  .then(() => console.log('E-mail enviado — verifique os logs para a URL do Ethereal'))"),
        codigo("  .catch(console.error);"),
        passo(2, 'Execute: npx tsx apps/api/src/test-reminder.ts'),
        passo(3, 'Copie a URL de preview do Ethereal nos logs e abra no navegador'),
        br(),

        tabelaTestes([
          ['T-43', 'Job registrado ao iniciar a API', 'Log "[SuccessionReminder Job] Iniciado" aparece no console'],
          ['T-44', 'E-mail de lembrete contém checklist de revisão', 'Checklist com 4 itens, link para Admin → Segurança, instrução do script'],
          ['T-45', 'E-mail de lembrete contém instrução do script', 'Texto "node scripts/gerar-kit-sucessao.js" visível no e-mail'],
          ['T-46', 'Job só envia para MASTERs não congelados (accountFrozen=false)', 'Usuário com accountFrozen=true não recebe lembrete'],
        ]),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 7 — PÁGINA DE SEGURANÇA DO USUÁRIO
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(7, 'Página de Segurança do Usuário (/settings/security)'),
        br(),

        subsecao('7.1 Comportamento para MASTER'),
        passo(1, 'Faça login como MASTER A'),
        passo(2, 'Acesse http://localhost:3000/settings/security'),
        passo(3, 'A página deve redirecionar automaticamente para /admin/security'),
        br(),
        tabelaTestes([
          ['T-47', 'MASTER acessa /settings/security', 'Redirecionamento imediato para /admin/security'],
          ['T-48', 'MASTER chega em /admin/security', 'Página completa de 2FA com backup codes, QR code etc.'],
        ]),
        br(),

        subsecao('7.2 Comportamento para Usuário Comum'),
        passo(1, 'Faça login como usuário comum (role USER)'),
        passo(2, 'Acesse http://localhost:3000/settings/security'),
        passo(3, 'A página deve exibir o status do 2FA e um botão para o painel admin'),
        br(),
        tabelaTestes([
          ['T-49', 'Usuário comum vê status "2FA Ativado" quando 2FA está habilitado', 'Card verde com "2FA Ativado"'],
          ['T-50', 'Usuário comum vê aviso quando 2FA não está ativado', 'Card amarelo com "2FA não ativado"'],
          ['T-51', 'Usuário comum clica "Gerenciar 2FA no Painel Admin"', 'Navega para /admin/security'],
          ['T-52', 'Página não exibe null nem tela em branco (era um stub)', 'Conteúdo visível após carregamento'],
        ]),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 8 — BANNER DE ALERTA DE BACKUP CODES
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(8, 'Banner de Alerta — Backup Codes Zerados'),
        br(),
        blocoLaranja('Para testar este banner é necessário zerar os backup codes. Faça isso via banco de dados ou regenerando e descartando os códigos.'),
        br(),

        subsecao('8.1 Simular Backup Codes Zerados'),
        passo(1, 'Como MASTER A, acesse Admin → Segurança'),
        passo(2, 'Use todos os 10 backup codes (ou apague-os diretamente no banco via Prisma Studio)'),
        codigo('npx prisma studio  (na pasta apps/api)'),
        passo(3, 'No Prisma Studio, tabela TwoFactorAuth, zere o campo backupCodes do MASTER A'),
        passo(4, 'Recarregue a página Admin → Segurança'),
        br(),

        tabelaTestes([
          ['T-53', 'MASTER A acessa Admin → Segurança com 0 backup codes', 'Banner vermelho "🚨 Kit de Sucessão desatualizado" aparece no topo'],
          ['T-54', 'Banner mostra instrução do script', 'Texto "node scripts/gerar-kit-sucessao.js" visível no banner'],
          ['T-55', 'MASTER A com backup codes disponíveis', 'Banner NÃO aparece (backupCodesCount > 0)'],
          ['T-56', 'MASTER A regenera backup codes', 'Banner desaparece após recarregar a página'],
        ]),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 9 — TESTES DE SEGURANÇA
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(9, 'Testes de Segurança (Tentativas de Bypass)'),
        br(),
        blocoVermelho('Estes testes verificam que as proteções estão ativas. O resultado esperado é SEMPRE uma recusa.'),
        br(),

        subsecao('9.1 Bypass de Autenticação'),
        tabelaTestes([
          ['S-01', 'Acessar /api/v1/admin/funds/internal-transfer sem token JWT', 'HTTP 401 — Unauthorized'],
          ['S-02', 'Acessar /api/v1/admin/funds/pending-approvals sem token JWT', 'HTTP 401 — Unauthorized'],
          ['S-03', 'Acessar /api/v1/admin/delegations sem token JWT', 'HTTP 401 — Unauthorized'],
          ['S-04', 'GET /api/v1/admin/funds/cancel-override?token=invalido (sem login)', 'HTTP 400 — "Token de cancelamento inválido ou já utilizado"'],
          ['S-05', 'GET /api/v1/admin/funds/cancel-override?token= (token em branco)', 'HTTP 400 — "Token de cancelamento inválido"'],
        ]),
        br(),

        subsecao('9.2 Escalada de Privilégio'),
        tabelaTestes([
          ['S-06', 'GERENTE sem delegação tenta aprovar via POST /approve', 'HTTP 403 — sem permissão'],
          ['S-07', 'GERENTE com delegação de LOCK_BALANCE tenta aprovar INTERNAL_TRANSFER', 'HTTP 403 — operação fora do escopo da delegação'],
          ['S-08', 'ADMIN tenta criar operação em /admin/funds/internal-transfer', 'HTTP 403 — apenas MASTER pode iniciar'],
          ['S-09', 'Usuário comum tenta listar aprovações em /admin/funds/pending-approvals', 'HTTP 403 — sem acesso'],
        ]),
        br(),

        subsecao('9.3 Auto-aprovação e Rejeição Própria'),
        tabelaTestes([
          ['S-10', 'MASTER A aprova sua própria operação pendente', 'HTTP 403 — "Você não pode aprovar sua própria operação"'],
          ['S-11', 'MASTER A rejeita sua própria operação pendente', 'HTTP 403 — "Você não pode rejeitar sua própria operação"'],
          ['S-12', 'MASTER B tenta solicitar override de uma operação que não iniciou', 'HTTP 403 — "Apenas o iniciador pode solicitar"'],
        ]),
        br(),

        subsecao('9.4 Operações Críticas Sem 2FA do Iniciador'),
        blocoInfo('Teste via curl ou Postman: envie o body sem o header de 2FA ou com código errado.'),
        tabelaTestes([
          ['S-13', 'POST /internal-transfer sem 2FA do iniciador', 'HTTP 401/403 — 2FA obrigatório'],
          ['S-14', 'POST /adjust-balance sem 2FA do iniciador', 'HTTP 401/403 — 2FA obrigatório'],
          ['S-15', 'POST /lock-balance sem 2FA do iniciador', 'HTTP 401/403 — 2FA obrigatório (bug corrigido nesta versão)'],
          ['S-16', 'POST /unlock-balance sem 2FA do iniciador', 'HTTP 401/403 — 2FA obrigatório (bug corrigido nesta versão)'],
          ['S-17', 'POST /platform-refund sem 2FA do iniciador', 'HTTP 401/403 — 2FA obrigatório'],
        ]),

        // ══════════════════════════════════════════════════════════════════
        // SEÇÃO 10 — CHECKLIST FINAL
        // ══════════════════════════════════════════════════════════════════
        paginaBreak(),
        secao(10, 'Checklist Final de Homologação'),
        br(),
        blocoInfo('Marque todos os itens abaixo antes de considerar o sistema homologado para produção.'),
        br(),

        subsecao('Sistema Dual-Approval'),
        bullet('□  Todas as 5 operações críticas retornam 202 e criam PendingApproval'),
        bullet('□  Aprovação por segundo MASTER executa a operação corretamente'),
        bullet('□  Rejeição cancela sem executar'),
        bullet('□  Auto-aprovação é bloqueada em todas as operações'),
        bullet('□  E-mails de notificação chegam corretamente (via Ethereal em dev)'),
        br(),

        subsecao('Override de Emergência'),
        bullet('□  Tempo mínimo de espera é respeitado'),
        bullet('□  Justificativa mínima de 50 chars é obrigatória'),
        bullet('□  2FA do iniciador é verificado antes do override'),
        bullet('□  Limite de 3 overrides por 24h é respeitado'),
        bullet('□  Link de cancelamento via e-mail funciona sem login'),
        bullet('□  Token de cancelamento é invalidado após o uso'),
        br(),

        subsecao('Delegação Temporária'),
        bullet('□  MASTER pode delegar para GERENTE ou ADMIN'),
        bullet('□  GERENTE delegado aprova dentro do escopo autorizado'),
        bullet('□  GERENTE delegado é bloqueado fora do escopo'),
        bullet('□  Revogação bloqueia acesso imediatamente'),
        bullet('□  Delegação expira automaticamente na data configurada'),
        br(),

        subsecao('Kit de Sucessão e Lembrete'),
        bullet('□  Script gerar-kit-sucessao.js executa sem erros'),
        bullet('□  Documento tem 5 páginas completas e bem formatadas'),
        bullet('□  Log do job aparece ao iniciar a API'),
        bullet('□  E-mail de lembrete contém todas as instruções necessárias'),
        br(),

        subsecao('Interface do Usuário'),
        bullet('□  Página /settings/security redireciona MASTER para /admin/security'),
        bullet('□  Página /settings/security exibe status do 2FA para usuários comuns'),
        bullet('□  Banner vermelho aparece em /admin/security quando backup codes = 0'),
        bullet('□  Banner NÃO aparece quando backup codes > 0'),
        br(),

        subsecao('Segurança'),
        bullet('□  Todas as rotas críticas exigem 2FA do iniciador (incluindo lock/unlock — bug corrigido)'),
        bullet('□  Tentativas de bypass retornam 401/403 corretamente'),
        bullet('□  Usuários sem privilégio não acessam nenhuma rota admin'),
        br(), br(),

        para(`Guia gerado em: ${dataGeracao}   |   MktPlace P2P — v0.3.10`, { color: 'AAAAAA', center: true }),
      ],
    }],
  });

  const outPath = path.join(__dirname, '..', 'GUIA-TESTES-DUAL-APPROVAL.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);

  console.log(`\n✅ Guia de Testes gerado com sucesso!`);
  console.log(`📄 Arquivo: ${outPath}`);
  console.log(`\nEstrutura:`);
  console.log(`  1. Pré-requisitos`);
  console.log(`  2. Fluxo Principal: Aprovação Dupla (T-01 a T-16)`);
  console.log(`  3. Override de Emergência (T-17 a T-26)`);
  console.log(`  4. Delegação Temporária (T-27 a T-36)`);
  console.log(`  5. Kit de Sucessão (T-37 a T-42)`);
  console.log(`  6. Job de Lembrete Trimestral (T-43 a T-46)`);
  console.log(`  7. Página de Segurança (T-47 a T-52)`);
  console.log(`  8. Banner de Alerta (T-53 a T-56)`);
  console.log(`  9. Testes de Segurança — Bypass (S-01 a S-17)`);
  console.log(`  10. Checklist Final de Homologação\n`);
}

main().catch(err => {
  console.error('Erro ao gerar Guia de Testes:', err);
  process.exit(1);
});
