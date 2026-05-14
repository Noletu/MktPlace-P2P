const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak, VerticalAlign, convertInchesToTwip,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Cores ──────────────────────────────────────────────────────────────────
const COR_PRIMARIA      = '1E3A5F'; // azul escuro
const COR_SECUNDARIA    = '2E86AB'; // azul médio
const COR_ACENTO        = 'F18F01'; // laranja
const COR_VERDE         = '2D6A4F'; // verde escuro
const COR_VERMELHO      = 'C1121F'; // vermelho
const COR_AMARELO       = '856404'; // amarelo/âmbar
const COR_FUNDO_HEADER  = '1E3A5F';
const COR_FUNDO_VERDE   = 'D4EDDA';
const COR_FUNDO_AMARELO = 'FFF3CD';
const COR_FUNDO_VERMELHO= 'F8D7DA';
const COR_FUNDO_AZUL    = 'EBF4FB';
const COR_CINZA         = 'F8F9FA';

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

const secao = (num, text) => new Paragraph({
  children: [
    new TextRun({ text: `${num}. `, bold: true, size: 30, color: COR_ACENTO, font: 'Calibri' }),
    new TextRun({ text, bold: true, size: 30, color: COR_PRIMARIA, font: 'Calibri' }),
  ],
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 480, after: 180 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COR_SECUNDARIA } },
});

const subsecao = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 26, color: COR_SECUNDARIA, font: 'Calibri' })],
  spacing: { before: 280, after: 140 },
});

const paragrafo = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts })],
  spacing: { after: 120 },
  alignment: AlignmentType.JUSTIFIED,
});

const bullet = (text, negrito = false, cor = '000000') => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', bold: negrito, color: cor })],
  bullet: { level: 0 },
  spacing: { after: 80 },
});

const bulletSub = (text) => new Paragraph({
  children: [new TextRun({ text, size: 20, font: 'Calibri', color: '444444' })],
  bullet: { level: 1 },
  spacing: { after: 60 },
});

const numerado = (text, num, cor = COR_ACENTO) => new Paragraph({
  children: [
    new TextRun({ text: `${num}. `, bold: true, size: 22, color: cor, font: 'Calibri' }),
    new TextRun({ text, size: 22, font: 'Calibri' }),
  ],
  spacing: { after: 100 },
  indent: { left: 360 },
});

const destaque = (text, corFundo = 'F0FFF4', corBorda = COR_VERDE) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', italics: true, color: COR_VERDE })],
  spacing: { after: 120 },
  indent: { left: 720, right: 720 },
  border: { left: { style: BorderStyle.THICK, size: 12, color: corBorda } },
  shading: { type: ShadingType.CLEAR, fill: corFundo },
});

const alerta = (text) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', bold: true, color: COR_VERMELHO })],
  spacing: { after: 120 },
  indent: { left: 720, right: 720 },
  border: { left: { style: BorderStyle.THICK, size: 12, color: COR_VERMELHO } },
  shading: { type: ShadingType.CLEAR, fill: 'FFF0F0' },
});

const aviso = (text) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', bold: true, color: COR_AMARELO })],
  spacing: { after: 120 },
  indent: { left: 720, right: 720 },
  border: { left: { style: BorderStyle.THICK, size: 12, color: COR_AMARELO } },
  shading: { type: ShadingType.CLEAR, fill: 'FFFBEC' },
});

// ── Célula de tabela ───────────────────────────────────────────────────────
const celula = (text, opts = {}) => new TableCell({
  children: [new Paragraph({
    children: [new TextRun({
      text,
      size: opts.size || 20,
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
  rowSpan: opts.rowSpan || undefined,
});

const celulaHeader = (text, span) => celula(text, {
  bold: true,
  fill: COR_FUNDO_HEADER,
  textColor: 'FFFFFF',
  align: AlignmentType.CENTER,
  span,
});

const celulaHeaderVerde = (text, span) => celula(text, {
  bold: true,
  fill: COR_VERDE,
  textColor: 'FFFFFF',
  align: AlignmentType.CENTER,
  span,
});

const celulaMultilinhas = (linhas, opts = {}) => new TableCell({
  children: linhas.map((linha) => new Paragraph({
    children: [new TextRun({
      text: linha,
      size: opts.size || 20,
      font: 'Calibri',
      bold: opts.bold || false,
      color: opts.textColor || '000000',
    })],
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: 30, after: 30 },
  })),
  shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
  verticalAlign: VerticalAlign.TOP,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
});

// ── Tabela genérica ────────────────────────────────────────────────────────
const tabela = (rows, widths) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: {
    top:           { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    bottom:        { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    left:          { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    right:         { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    insideH:       { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
    insideV:       { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
  },
  rows: rows.map((cols) => new TableRow({
    children: cols.map((cell, i) => {
      if (cell instanceof TableCell) return cell;
      return celula(cell, widths ? { width: widths[i] } : {});
    }),
  })),
});

// ═══════════════════════════════════════════════════════════════════════════
//  DOCUMENTO
// ═══════════════════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22 } },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top:    convertInchesToTwip(1),
          right:  convertInchesToTwip(1.2),
          bottom: convertInchesToTwip(1),
          left:   convertInchesToTwip(1.2),
        },
      },
    },
    children: [

      // ════════════════════════════════════════════════════════════════════
      //  CAPA
      // ════════════════════════════════════════════════════════════════════
      br(), br(), br(),

      new Paragraph({
        children: [new TextRun({ text: 'MktPlace P2P', size: 28, color: COR_SECUNDARIA, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),

      new Paragraph({
        children: [new TextRun({
          text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          size: 20, color: COR_SECUNDARIA, font: 'Calibri',
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),

      titulo('Plano de Contingência'),
      titulo('para o Sistema de'),
      titulo('Aprovação Dupla'),

      br(),

      subtitulo('O que acontece quando um dos sócios não'),
      subtitulo('está disponível para aprovar?'),

      br(), br(),

      new Paragraph({
        children: [new TextRun({ text: 'Documento de avaliação — uso interno', size: 20, color: '888888', font: 'Calibri', italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),

      new Paragraph({
        children: [new TextRun({ text: `Versão 1.0  ·  Abril 2026`, size: 20, color: '888888', font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),

      new Paragraph({
        children: [new TextRun({ text: 'CONFIDENCIAL — somente para os sócios MASTER', size: 20, color: COR_VERMELHO, font: 'Calibri', bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 1 — CONTEXTO
      // ════════════════════════════════════════════════════════════════════
      secao('1', 'Contexto: o que é o sistema de Aprovação Dupla?'),

      paragrafo(
        'Como descrito na proposta anterior, o sistema de Aprovação Dupla (também chamado de ' +
        'Maker-Checker) exige que operações financeiras críticas sejam iniciadas por um sócio ' +
        'e confirmadas por outro antes de serem executadas.'
      ),
      paragrafo(
        'As operações que passarão por esse processo são as de maior impacto financeiro na plataforma:'
      ),

      bullet('Transferências internas entre carteiras'),
      bullet('Ajustes manuais de saldo (correções contábeis)'),
      bullet('Reembolsos pagos pela carteira da plataforma'),
      bullet('Bloqueio manual de fundos de um usuário'),
      bullet('Desbloqueio manual de fundos de um usuário'),

      br(),
      paragrafo(
        'O objetivo é garantir que nenhum dos sócios possa, sozinho, mover recursos significativos ' +
        'da plataforma sem o conhecimento e a concordância do outro. Isso protege ambos contra ' +
        'erros humanos, coerção e acesso indevido.'
      ),

      destaque(
        '"Quatro olhos enxergam mais do que dois" — esse é o princípio básico. ' +
        'Mas precisamos de um plano para os momentos em que apenas um par de olhos está disponível.'
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 2 — OS TRÊS CENÁRIOS
      // ════════════════════════════════════════════════════════════════════
      secao('2', 'Os três cenários de indisponibilidade'),

      paragrafo(
        'Identificamos três situações distintas em que um dos sócios pode estar impossibilitado ' +
        'de aprovar uma operação. Cada uma exige uma resposta diferente.'
      ),
      br(),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          left:   { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          right:  { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          insideH: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
          insideV: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
        },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Cenário', 1),
              celulaHeader('Situação', 1),
              celulaHeader('Duração típica', 1),
              celulaHeader('Solução proposta', 1),
            ],
          }),
          new TableRow({
            children: [
              celula('A — Temporária', { bold: true, fill: COR_FUNDO_AZUL, textColor: COR_PRIMARIA }),
              celula('Viagem, compromisso urgente, fuso horário diferente, sem acesso ao celular'),
              celula('Horas a 3 dias'),
              celula('Override de Emergência com janela de cancelamento', { bold: true }),
            ],
          }),
          new TableRow({
            children: [
              celula('B — Prolongada', { bold: true, fill: COR_FUNDO_AMARELO, textColor: COR_AMARELO }),
              celula('Internação hospitalar, incapacidade temporária, viagem longa sem internet'),
              celula('Dias a semanas'),
              celula('Delegação Temporária a pessoa de confiança', { bold: true }),
            ],
          }),
          new TableRow({
            children: [
              celula('C — Permanente', { bold: true, fill: COR_FUNDO_VERMELHO, textColor: COR_VERMELHO }),
              celula('Falecimento, incapacidade permanente, saída da sociedade'),
              celula('Definitivo'),
              celula('Kit de Sucessão (procedimento legal + acesso emergencial)', { bold: true }),
            ],
          }),
        ],
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 3 — CENÁRIO A
      // ════════════════════════════════════════════════════════════════════
      secao('3', 'Cenário A — Indisponibilidade Temporária'),

      subsecao('Situação'),
      paragrafo(
        'Sócio A iniciou uma operação crítica. Sócio B está em viagem, em reunião, dormindo ' +
        'ou simplesmente sem acesso ao sistema por algumas horas. A operação é genuinamente ' +
        'necessária e não pode esperar 48 horas.'
      ),

      br(),
      subsecao('Solução: Override de Emergência com Janela de Cancelamento'),
      paragrafo(
        'O sistema permite que o sócio que iniciou a operação solicite um "Override de Emergência". ' +
        'Isso não executa a operação na hora — abre uma janela de segurança de 30 minutos durante a ' +
        'qual o outro sócio ainda pode cancelar.'
      ),

      br(),
      new Paragraph({
        children: [new TextRun({ text: 'Passo a passo do processo:', bold: true, size: 22, color: COR_PRIMARIA, font: 'Calibri' })],
        spacing: { after: 120 },
      }),

      numerado('Sócio A inicia uma operação crítica. O sistema cria um pedido de aprovação e notifica o Sócio B por e-mail.', '1'),
      numerado('O Sócio B tem até 48 horas para aprovar. Se B estiver disponível, aprova normalmente — fim do processo.', '2'),
      numerado('Se B não está disponível e a operação é urgente, A pode clicar em "Override de Emergência".', '3'),
      numerado('O sistema exige que A confirme com seu próprio código 2FA e escreva uma justificativa (mínimo 50 caracteres) explicando por que não pode aguardar.', '4'),
      numerado('Imediatamente, o sistema envia um e-mail urgente para o Sócio B com o título: "ATENÇÃO: operação será executada em 30 minutos — clique aqui para cancelar".', '5'),
      numerado('O e-mail contém um link de cancelamento de uso único. B pode clicar nesse link sem precisar fazer login na plataforma.', '6'),
      numerado('Se B não cancelar em 30 minutos, a operação é executada automaticamente e ambos recebem o relatório completo.', '7'),
      numerado('Se B cancelar pelo link, a operação é bloqueada e A recebe notificação do cancelamento com o nome de quem cancelou.', '8'),

      br(),
      destaque(
        'O Override de Emergência não elimina a aprovação dupla — apenas estabelece um prazo para rejeição ao invés de exigir aprovação ativa. ' +
        'O sócio ausente ainda tem 30 minutos para cancelar qualquer operação que não concorde.'
      ),

      br(),
      subsecao('Limites de segurança do Override'),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          left:   { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          right:  { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          insideH: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
          insideV: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
        },
        rows: [
          new TableRow({
            children: [celulaHeader('Regra de segurança', 1), celulaHeader('Detalhe', 1)],
          }),
          new TableRow({
            children: [
              celula('Tempo mínimo de espera', { bold: true }),
              celula('O Override só pode ser solicitado no mínimo 60 minutos após a criação do pedido original'),
            ],
          }),
          new TableRow({
            children: [
              celula('Limite diário', { bold: true }),
              celula('Máximo de 3 Overrides por sócio a cada 24 horas'),
            ],
          }),
          new TableRow({
            children: [
              celula('2FA obrigatório', { bold: true }),
              celula('O sócio que solicita o Override deve confirmar com seu código 2FA no momento da solicitação'),
            ],
          }),
          new TableRow({
            children: [
              celula('Justificativa obrigatória', { bold: true }),
              celula('Mínimo de 50 caracteres explicando o motivo da urgência'),
            ],
          }),
          new TableRow({
            children: [
              celula('Cancelamento sem login', { bold: true }),
              celula('O link de cancelamento enviado por e-mail funciona sem necessidade de login na plataforma'),
            ],
          }),
          new TableRow({
            children: [
              celula('Registro completo', { bold: true }),
              celula('Toda ação (solicitação, cancelamento, execução) fica registrada no log de auditoria com data, hora, IP e usuário'),
            ],
          }),
        ],
      }),

      br(),
      aviso(
        '⚠  Atenção: o Override de Emergência foi projetado para situações genuinamente urgentes. ' +
        'O uso frequente ou injustificado fere o propósito do sistema de controle duplo. ' +
        'Recomendamos revisar periodicamente o histórico de overrides juntos.'
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 4 — CENÁRIO B
      // ════════════════════════════════════════════════════════════════════
      secao('4', 'Cenário B — Indisponibilidade Prolongada'),

      subsecao('Situação'),
      paragrafo(
        'Um dos sócios ficará inacessível por dias ou semanas. A plataforma precisa continuar ' +
        'operando normalmente, mas o Override de Emergência não é adequado para uso contínuo ' +
        'durante períodos longos.'
      ),

      br(),
      subsecao('Solução: Delegação Temporária'),
      paragrafo(
        'O sócio disponível pode criar uma Delegação Temporária: conceder a um funcionário de ' +
        'confiança (gerente ou administrador já cadastrado na plataforma) o direito de aprovar ' +
        'operações críticas em nome do sócio ausente, por um período determinado.'
      ),

      br(),
      new Paragraph({
        children: [new TextRun({ text: 'Como funciona:', bold: true, size: 22, color: COR_PRIMARIA, font: 'Calibri' })],
        spacing: { after: 120 },
      }),

      bullet('O sócio disponível acessa a área de "Delegações" no painel administrativo'),
      bullet('Seleciona o funcionário que receberá a delegação (deve já ter conta de GERENTE ou ADMIN na plataforma)'),
      bullet('Define o escopo: quais tipos de operação o delegado pode aprovar (pode ser todas ou apenas algumas)'),
      bullet('Define o prazo: de 1 a no máximo 30 dias'),
      bullet('Informa o motivo da delegação'),
      bullet('Ambos os sócios recebem notificação por e-mail quando a delegação é criada'),

      br(),
      destaque(
        'O delegado pode apenas APROVAR ou REJEITAR operações pendentes. ' +
        'Ele não pode INICIAR novas operações críticas — isso continua sendo exclusivo dos sócios MASTER. ' +
        'A hierarquia de controle é preservada.'
      ),

      br(),
      subsecao('Características da Delegação'),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          left:   { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          right:  { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          insideH: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
          insideV: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
        },
        rows: [
          new TableRow({ children: [celulaHeader('Característica', 1), celulaHeader('Detalhe', 1)] }),
          new TableRow({ children: [celula('Prazo máximo', { bold: true }), celula('30 dias por delegação (renovável se necessário)')] }),
          new TableRow({ children: [celula('Quem pode ser delegado', { bold: true }), celula('Apenas funcionários já cadastrados com nível GERENTE ou ADMIN — não é possível delegar para pessoas externas')] }),
          new TableRow({ children: [celula('Delegação em cascata', { bold: true }), celula('Proibida — o delegado não pode criar novas delegações')] }),
          new TableRow({ children: [celula('Revogação', { bold: true }), celula('Qualquer sócio MASTER pode revogar a delegação a qualquer momento, com efeito imediato')] }),
          new TableRow({ children: [celula('Notificações', { bold: true }), celula('Ambos os sócios são notificados quando o delegado aprova ou rejeita qualquer operação')] }),
          new TableRow({ children: [celula('Auditoria', { bold: true }), celula('Cada aprovação feita via delegação é registrada com o nome do delegado E da delegação que autorizou')] }),
          new TableRow({ children: [celula('2FA do delegado', { bold: true }), celula('O delegado precisa confirmar com seu próprio 2FA ao aprovar uma operação')] }),
        ],
      }),

      br(),
      aviso(
        '⚠  Recomendação: a delegação deve ser criada ANTES da indisponibilidade, se possível. ' +
        'Em caso de internação de emergência, o sócio que ficou pode criar a delegação por conta própria, ' +
        'pois qualquer sócio MASTER pode criar delegações.'
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 5 — CENÁRIO C
      // ════════════════════════════════════════════════════════════════════
      secao('5', 'Cenário C — Indisponibilidade Permanente'),

      subsecao('Situação'),
      paragrafo(
        'Esta é a situação mais extrema: um dos sócios vem a falecer, torna-se permanentemente ' +
        'incapacitado, ou por qualquer outro motivo não pode mais acessar a plataforma ' +
        'indefinidamente. Nesses casos, não há solução puramente técnica — a resposta ' +
        'necessariamente combina tecnologia e procedimento legal.'
      ),

      br(),
      subsecao('Por que esse cenário é diferente?'),
      paragrafo(
        'Nos cenários A e B, o sócio ausente voltará. A plataforma pode manter o controle ' +
        'compartilhado aguardando seu retorno. No Cenário C, é preciso uma transição permanente ' +
        'de controle, o que envolve questões jurídicas (herança, contrato social, procuração) que ' +
        'vão além do que um sistema de software pode resolver sozinho.'
      ),

      br(),
      subsecao('Solução: Kit de Sucessão'),
      paragrafo(
        'Propomos que ambos os sócios preparem um Kit de Sucessão — um conjunto de documentos e ' +
        'instruções guardadas em local seguro (físico e digital), a ser usado apenas em situações ' +
        'de emergência permanente.'
      ),

      br(),
      new Paragraph({
        children: [new TextRun({ text: 'O que o Kit de Sucessão contém:', bold: true, size: 22, color: COR_PRIMARIA, font: 'Calibri' })],
        spacing: { after: 120 },
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          left:   { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          right:  { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          insideH: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
          insideV: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
        },
        rows: [
          new TableRow({ children: [celulaHeader('Componente', 1), celulaHeader('Descrição', 1), celulaHeader('Onde guardar', 1)] }),
          new TableRow({
            children: [
              celula('Códigos de backup 2FA', { bold: true }),
              celula('Cada conta MASTER possui 10 códigos de recuperação de uso único que permitem acesso mesmo sem o celular'),
              celula('Envelope físico lacrado + cópia digital criptografada'),
            ],
          }),
          new TableRow({
            children: [
              celula('Passo a passo de acesso', { bold: true }),
              celula('Instruções detalhadas de como acessar a plataforma, criar novas delegações e contatar o suporte técnico'),
              celula('Junto ao envelope físico'),
            ],
          }),
          new TableRow({
            children: [
              celula('Modelo de autorização legal', { bold: true }),
              celula('Template de documento jurídico autorizando herdeiro ou representante designado a assumir o acesso à plataforma'),
              celula('Com o advogado da empresa / cartório'),
            ],
          }),
          new TableRow({
            children: [
              celula('Contato do suporte técnico', { bold: true }),
              celula('E-mail e telefone do desenvolvedor responsável pela plataforma para situações de emergência técnica'),
              celula('Junto ao envelope físico'),
            ],
          }),
        ],
      }),

      br(),
      subsecao('Procedimento recomendado para armazenamento'),

      numerado('Ambos os sócios preenchem seu Kit individualmente — cada um sobre sua própria conta.', '1'),
      numerado('Imprimem o kit e anotam manualmente os códigos de backup 2FA (nunca salvar em texto digital não criptografado).', '2'),
      numerado('Colocam em envelope lacrado com assinatura sobre o lacre (para detectar abertura indevida).', '3'),
      numerado('Entregam o envelope ao advogado da empresa ou a um notário, com instrução de quando pode ser aberto.', '4'),
      numerado('Revisam e atualizam o kit a cada 6 meses ou sempre que o 2FA for reconfigurado.', '5'),

      br(),
      alerta(
        '⛔  Importante: os códigos de backup 2FA são como uma "chave mestra" — ' +
        'devem ser tratados com o mesmo nível de sigilo de uma senha de cofre. ' +
        'Nunca fotografar, enviar por WhatsApp ou armazenar em serviços de nuvem sem criptografia forte.'
      ),

      br(),
      destaque(
        'O Kit de Sucessão é preventivo — preparado com calma, antes de qualquer emergência. ' +
        'Assim como uma apólice de seguro, sua existência traz tranquilidade para ambos os sócios ' +
        'e para os familiares, sem comprometer a segurança do dia a dia.'
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 6 — COMPARATIVO
      // ════════════════════════════════════════════════════════════════════
      secao('6', 'Comparativo: os três mecanismos lado a lado'),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          left:   { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          right:  { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          insideH: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
          insideV: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
        },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Critério'),
              celulaHeader('Override de Emergência'),
              celulaHeader('Delegação Temporária'),
              celulaHeader('Kit de Sucessão'),
            ],
          }),
          new TableRow({
            children: [
              celula('Para quando?', { bold: true }),
              celula('Urgência pontual (horas)'),
              celula('Ausência prolongada (dias/semanas)'),
              celula('Impossibilidade permanente'),
            ],
          }),
          new TableRow({
            children: [
              celula('Quem ativa?', { bold: true }),
              celula('O sócio presente, na hora'),
              celula('Qualquer sócio MASTER'),
              celula('O sócio sobrevivente + procedimento legal'),
            ],
          }),
          new TableRow({
            children: [
              celula('Aprovação do ausente?', { bold: true }),
              celula('Opcional — ausente pode cancelar em 30 min'),
              celula('Delegado aprova no lugar do ausente'),
              celula('Não se aplica'),
            ],
          }),
          new TableRow({
            children: [
              celula('Configuração prévia?', { bold: true }),
              celula('Não precisa — disponível sempre'),
              celula('Requer cadastro prévio do delegado'),
              celula('Requer preparação antecipada do kit'),
            ],
          }),
          new TableRow({
            children: [
              celula('Nível de segurança', { bold: true }),
              celula('Alto — com 2FA, justificativa e janela de cancelamento', { textColor: COR_VERDE }),
              celula('Alto — delegado usa próprio 2FA, ambos são notificados', { textColor: COR_VERDE }),
              celula('Depende do rigor no armazenamento do kit', { textColor: COR_AMARELO }),
            ],
          }),
          new TableRow({
            children: [
              celula('Transparência', { bold: true }),
              celula('Ambos recebem e-mail em cada passo'),
              celula('Ambos recebem e-mail em cada aprovação do delegado'),
              celula('Ativado apenas em situação documentada legalmente'),
            ],
          }),
        ],
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 7 — O QUE NÃO RESOLVE
      // ════════════════════════════════════════════════════════════════════
      secao('7', 'O que esses mecanismos NÃO resolvem'),

      paragrafo(
        'É importante ser honesto sobre as limitações. Esses mecanismos foram projetados para ' +
        'garantir continuidade operacional com segurança. Eles não substituem:'
      ),

      bullet('Conflito entre sócios — se um sócio deliberadamente recusa aprovar operações legítimas, isso é uma questão societária, não técnica'),
      bullet('Conta comprometida — se o e-mail ou o celular de um sócio for hackeado, o atacante pode usar o link de cancelamento indevidamente. Recomendamos e-mail com 2FA ativo'),
      bullet('Desacordo sobre quem deve ser o delegado — a escolha do delegado requer consenso entre os sócios; sugerimos decidir isso com antecedência'),
      bullet('Processos de inventário ou disputa judicial — o Kit de Sucessão facilita o acesso técnico, mas não substitui resolução jurídica da sociedade'),

      br(),
      destaque(
        'Recomendamos que ambos os sócios concordem previamente sobre: ' +
        '(1) quem pode ser delegado em caso de emergência, ' +
        '(2) onde os Kits de Sucessão serão guardados, ' +
        'e (3) com que frequência o kit será atualizado. ' +
        'Essa conversa, feita agora, evita impasses quando a urgência real surgir.'
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 8 — PRÓXIMOS PASSOS
      // ════════════════════════════════════════════════════════════════════
      secao('8', 'Próximos Passos'),

      paragrafo('Caso os sócios aprovem este plano, a implementação seguirá esta ordem:'),
      br(),

      numerado(
        'Implementar o núcleo do sistema de Aprovação Dupla (base técnica necessária para tudo mais)',
        '1'
      ),
      bulletSub('Criação das tabelas de "pedidos de aprovação" no banco de dados'),
      bulletSub('Adaptar as 5 rotas críticas para criar pedidos ao invés de executar diretamente'),
      bulletSub('Interface de aprovação/rejeição no painel administrativo'),

      br(),
      numerado('Implementar o Override de Emergência (Cenário A)', '2'),
      bulletSub('Botão de emergência com 2FA e justificativa obrigatória'),
      bulletSub('Envio de e-mail com link de cancelamento de uso único'),
      bulletSub('Job automático que executa a operação após 30 minutos sem cancelamento'),

      br(),
      numerado('Implementar as Delegações Temporárias (Cenário B)', '3'),
      bulletSub('Tela de criação e gestão de delegações'),
      bulletSub('Notificações por e-mail quando delegado age'),

      br(),
      numerado('Preparar os Kits de Sucessão (Cenário C)', '4'),
      bulletSub('Gerar o documento template para cada sócio'),
      bulletSub('Preencher manualmente, imprimir e guardar conforme as instruções'),

      br(),
      numerado('Decisões que precisam ser tomadas pelos sócios AGORA (independente da implementação)', '5'),
      bulletSub('Quem seria o delegado de confiança em caso de ausência prolongada?'),
      bulletSub('Onde guardar fisicamente o Kit de Sucessão?'),
      bulletSub('Com qual advogado ou notário deixar o kit?'),
      bulletSub('Com que frequência revisar e atualizar o kit?'),

      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════════════
      //  SEÇÃO 9 — VALIDAÇÃO
      // ════════════════════════════════════════════════════════════════════
      secao('9', 'Validação dos Sócios'),

      paragrafo(
        'Após a leitura deste documento, pedimos que ambos os sócios registrem sua ' +
        'posição sobre o plano proposto:'
      ),

      br(), br(),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          left:   { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          right:  { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          insideH: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
          insideV: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
        },
        rows: [
          new TableRow({
            children: [
              celulaHeader('Sócio 1', 1),
              celulaHeader('Sócio 2', 1),
            ],
          }),
          new TableRow({
            children: [
              celulaMultilinhas([
                'Nome: ______________________________',
                '',
                '☐  Aprovo o plano conforme descrito',
                '☐  Aprovo com as ressalvas abaixo',
                '☐  Não aprovo — motivos abaixo',
                '',
                'Ressalvas / Motivos:',
                '________________________________',
                '________________________________',
                '________________________________',
                '',
                'Assinatura: ______________________',
                '',
                'Data: _____ / _____ / ___________',
              ], { size: 20 }),
              celulaMultilinhas([
                'Nome: ______________________________',
                '',
                '☐  Aprovo o plano conforme descrito',
                '☐  Aprovo com as ressalvas abaixo',
                '☐  Não aprovo — motivos abaixo',
                '',
                'Ressalvas / Motivos:',
                '________________________________',
                '________________________________',
                '________________________________',
                '',
                'Assinatura: ______________________',
                '',
                'Data: _____ / _____ / ___________',
              ], { size: 20 }),
            ],
          }),
        ],
      }),

      br(), br(),

      new Paragraph({
        children: [new TextRun({
          text: 'Decisões adicionais acordadas nesta reunião:',
          bold: true, size: 22, color: COR_PRIMARIA, font: 'Calibri',
        })],
        spacing: { after: 100 },
      }),

      new Paragraph({
        children: [new TextRun({ text: 'Delegado de confiança acordado: ____________________________________________', size: 22, font: 'Calibri' })],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Local de guarda do Kit de Sucessão: _______________________________________', size: 22, font: 'Calibri' })],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Responsável legal / notário: ________________________________________________', size: 22, font: 'Calibri' })],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Frequência de revisão do Kit: ______________________________________________', size: 22, font: 'Calibri' })],
        spacing: { after: 100 },
      }),

      br(),
      new Paragraph({
        children: [new TextRun({
          text: 'MktPlace P2P — Documento interno confidencial — Versão 1.0 — Abril 2026',
          size: 18, color: '999999', font: 'Calibri', italics: true,
        })],
        alignment: AlignmentType.CENTER,
      }),
    ],
  }],
});

// ── Gerar arquivo ──────────────────────────────────────────────────────────
const outputPath = path.resolve(__dirname, '..', 'CONTINGENCIAS-DUAL-APPROVAL.docx');

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Documento gerado: ${outputPath}`);
}).catch((err) => {
  console.error('❌ Erro ao gerar documento:', err);
  process.exit(1);
});
