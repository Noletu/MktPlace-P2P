/**
 * Gerador do Kit de Sucessão — Acesso de Emergência
 * Gera um documento Word para ser impresso e guardado em local físico seguro.
 *
 * USO: node scripts/gerar-kit-sucessao.js
 * SAÍDA: KIT-SUCESSAO-MASTER.docx (na raiz do projeto)
 *
 * NÃO conecta ao banco de dados. Os backup codes são preenchidos À MÃO
 * pelo titular após gerar os códigos no painel: Admin → Segurança → Backup Codes.
 */

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak, VerticalAlign,
  convertInchesToTwip,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Cores ──────────────────────────────────────────────────────────────────
const COR_PRIMARIA   = '1E3A5F'; // azul escuro
const COR_SECUNDARIA = '2E86AB'; // azul médio
const COR_VERMELHO   = 'C1121F'; // vermelho
const COR_LARANJA    = 'D4680A'; // laranja escuro
const COR_VERDE      = '1A5C38'; // verde escuro
const COR_AMARELO_BG = 'FFF3CD'; // fundo amarelo (alerta)
const COR_CINZA_BG   = 'F2F4F6'; // fundo cinza claro (tabelas)
const COR_HEADER_TAB = '1E3A5F'; // cabeçalho de tabela

// ── Helpers ────────────────────────────────────────────────────────────────
const br = () => new Paragraph({ text: '' });

const titulo = (text, cor = COR_PRIMARIA) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 64, color: cor, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 160 },
});

const subtitulo = (text, cor = COR_SECUNDARIA) => new Paragraph({
  children: [new TextRun({ text, size: 32, color: cor, font: 'Calibri', italics: true })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
});

const secao = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 30, color: COR_PRIMARIA, font: 'Calibri' })],
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COR_SECUNDARIA } },
});

const paragrafo = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts })],
  spacing: { after: 120 },
  alignment: AlignmentType.JUSTIFIED,
});

const aviso = (text, cor = COR_VERMELHO) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 22, color: cor, font: 'Calibri' })],
  spacing: { after: 120, before: 80 },
  alignment: AlignmentType.LEFT,
});

const bullet = (text, negrito = false) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: 'Calibri', bold: negrito })],
  bullet: { level: 0 },
  spacing: { after: 80 },
});

const numeradoManual = (num, text) => new Paragraph({
  children: [
    new TextRun({ text: `${num}. `, bold: true, size: 22, color: COR_SECUNDARIA, font: 'Calibri' }),
    new TextRun({ text, size: 22, font: 'Calibri' }),
  ],
  spacing: { after: 100 },
  indent: { left: convertInchesToTwip(0.25) },
});

const campoPreenchivel = (label, largura = '___________________________________') => new Paragraph({
  children: [
    new TextRun({ text: `${label}: `, bold: true, size: 22, font: 'Calibri', color: COR_PRIMARIA }),
    new TextRun({ text: largura, size: 22, font: 'Calibri', color: '888888' }),
  ],
  spacing: { after: 160 },
});

const paginaBreak = () => new Paragraph({
  children: [new PageBreak()],
});

// ── Tabela de Backup Codes ──────────────────────────────────────────────────
function tabelaBackupCodes() {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: '#', bold: true, size: 22, color: 'FFFFFF', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        })],
        shading: { fill: COR_HEADER_TAB, type: ShadingType.SOLID },
        width: { size: 8, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: 'Código de Backup (8 caracteres — preencher à mão)', bold: true, size: 22, color: 'FFFFFF', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        })],
        shading: { fill: COR_HEADER_TAB, type: ShadingType.SOLID },
        width: { size: 72, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: 'Usado?', bold: true, size: 22, color: 'FFFFFF', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        })],
        shading: { fill: COR_HEADER_TAB, type: ShadingType.SOLID },
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
      }),
    ],
  });

  const dataRows = Array.from({ length: 10 }, (_, i) => {
    const shade = i % 2 === 0 ? COR_CINZA_BG : 'FFFFFF';
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: String(i + 1), bold: true, size: 22, font: 'Calibri', color: COR_PRIMARIA })],
            alignment: AlignmentType.CENTER,
          })],
          shading: { fill: shade, type: ShadingType.SOLID },
          width: { size: 8, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: '_ _ _ _ _ _ _ _', size: 26, font: 'Courier New', color: 'AAAAAA' })],
            alignment: AlignmentType.CENTER,
          })],
          shading: { fill: shade, type: ShadingType.SOLID },
          width: { size: 72, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: '□ Sim  □ Não', size: 22, font: 'Calibri', color: '555555' })],
            alignment: AlignmentType.CENTER,
          })],
          shading: { fill: shade, type: ShadingType.SOLID },
          width: { size: 20, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
        }),
      ],
    });
  });

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: COR_SECUNDARIA },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COR_SECUNDARIA },
      left:   { style: BorderStyle.SINGLE, size: 4, color: COR_SECUNDARIA },
      right:  { style: BorderStyle.SINGLE, size: 4, color: COR_SECUNDARIA },
      insideH:{ style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideV:{ style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
    },
  });
}

// ── Tabela de Assinatura ────────────────────────────────────────────────────
function tabelaAssinatura() {
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Assinatura do Titular', size: 20, font: 'Calibri', color: '555555' })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 80 },
              }),
              new Paragraph({
                children: [new TextRun({ text: '___________________________', size: 22, font: 'Calibri' })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Data e Local', size: 20, font: 'Calibri', color: '555555' })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 80 },
              }),
              new Paragraph({
                children: [new TextRun({ text: '___________________________', size: 22, font: 'Calibri' })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ── Conteúdo do Documento ──────────────────────────────────────────────────
async function main() {
  const dataGeracao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const sections = [
    // ─────────────────────────────────────────────────────────────────────
    // PÁGINA 1 — CAPA
    // ─────────────────────────────────────────────────────────────────────
    br(), br(), br(), br(),
    titulo('KIT DE SUCESSÃO', COR_VERMELHO),
    titulo('ACESSO DE EMERGÊNCIA', COR_PRIMARIA),
    br(),
    subtitulo('DOCUMENTO CONFIDENCIAL — GUARDAR EM LOCAL SEGURO', COR_VERMELHO),
    br(), br(),

    new Paragraph({
      children: [
        new TextRun({ text: '⚠ ', size: 26, font: 'Calibri' }),
        new TextRun({ text: 'ATENÇÃO: Este documento concede acesso total ao sistema. ', bold: true, size: 24, color: COR_VERMELHO, font: 'Calibri' }),
        new TextRun({ text: 'Destrua cópias antigas com fragmentadora ou corte antes de substituí-las.', size: 24, color: COR_VERMELHO, font: 'Calibri' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      border: {
        top:    { style: BorderStyle.SINGLE, size: 8, color: COR_VERMELHO },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: COR_VERMELHO },
        left:   { style: BorderStyle.SINGLE, size: 8, color: COR_VERMELHO },
        right:  { style: BorderStyle.SINGLE, size: 8, color: COR_VERMELHO },
      },
    }),
    br(), br(),

    campoPreenchivel('Titular (Nome Completo)'),
    campoPreenchivel('E-mail de Acesso'),
    campoPreenchivel('Data de Geração', dataGeracao),
    campoPreenchivel('Próxima Revisão Obrigatória (3 meses após a data acima)'),

    br(), br(), br(), br(), br(),
    paragrafo(`Documento gerado em: ${dataGeracao}`, { color: 'AAAAAA', italics: true }),

    // ─────────────────────────────────────────────────────────────────────
    // PÁGINA 2 — PASSO A PASSO DE ACESSO DE EMERGÊNCIA
    // ─────────────────────────────────────────────────────────────────────
    paginaBreak(),
    secao('Passo a Passo: Acesso de Emergência'),
    paragrafo('Siga os passos abaixo em caso de indisponibilidade do titular para aprovações críticas:'),
    br(),

    numeradoManual(1, 'Acesse o sistema pelo navegador: [URL DO SISTEMA — preencher]'),
    numeradoManual(2, 'Faça login com o e-mail e senha do titular (anotados em local separado).'),
    numeradoManual(3, 'Quando o sistema solicitar o código 2FA, procure a opção "Usar código de backup" ou "Backup Code".'),
    numeradoManual(4, 'Digite um dos códigos da tabela na Página 3 (cada código só funciona UMA VEZ — risque após usar).'),
    numeradoManual(5, 'Acesse o Painel Admin → Delegações → Criar Delegação.'),
    numeradoManual(6, 'Delegue as aprovações a um gestor de confiança (GERENTE ou ADMIN) pelo tempo necessário.'),
    numeradoManual(7, 'Contate o suporte técnico para auxílio adicional: [E-MAIL DE SUPORTE — preencher]'),
    br(),

    aviso('⚠ APÓS O ACESSO: Regenere os backup codes imediatamente (Admin → Segurança → Regenerar Códigos) e atualize a tabela da Página 3.', COR_LARANJA),
    br(),

    secao('Credenciais de Acesso (Preencher à Mão)'),
    aviso('NÃO preencha senhas aqui. Guarde senhas apenas em cofre físico separado.', COR_VERMELHO),
    br(),
    campoPreenchivel('URL do Sistema'),
    campoPreenchivel('E-mail do Titular'),
    campoPreenchivel('Contato do Suporte Técnico'),
    campoPreenchivel('Nome do Gestor Delegado de Confiança'),
    campoPreenchivel('E-mail do Gestor Delegado'),

    // ─────────────────────────────────────────────────────────────────────
    // PÁGINA 3 — TABELA DE BACKUP CODES
    // ─────────────────────────────────────────────────────────────────────
    paginaBreak(),
    secao('Tabela de Backup Codes do 2FA'),
    paragrafo('Preencha esta tabela À MÃO após gerar ou regenerar os códigos de backup no painel:'),
    paragrafo('Painel Admin → Segurança → Backup Codes → "Regenerar Códigos"'),
    br(),
    aviso('⚠ Cada código funciona apenas UMA VEZ. Risque ou marque "Sim" na coluna "Usado?" após utilizar.', COR_VERMELHO),
    br(),

    tabelaBackupCodes(),

    br(),
    paragrafo('Como gerar/ver seus backup codes: Acesse o painel com 2FA normal → Admin → Segurança. Os códigos são exibidos apenas uma vez após serem gerados — copie-os aqui imediatamente.', { color: '555555', italics: true }),

    // ─────────────────────────────────────────────────────────────────────
    // PÁGINA 4 — MODELO DE AUTORIZAÇÃO LEGAL
    // ─────────────────────────────────────────────────────────────────────
    paginaBreak(),
    secao('Modelo de Autorização de Acesso de Emergência'),
    paragrafo('Preencha, imprima e reconheça firma em cartório. Guarde uma cópia com seu notário.'),
    br(),

    new Paragraph({
      children: [new TextRun({ text: 'AUTORIZAÇÃO DE ACESSO DE EMERGÊNCIA', bold: true, size: 28, color: COR_PRIMARIA, font: 'Calibri', underline: {} })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),

    paragrafo('Eu, ______________________________________________________, portador(a) do CPF ___.___.___-__, residente e domiciliado(a) em ________________________, declaro para os devidos fins que:'),
    br(),
    paragrafo('Autorizo ______________________________________________________, portador(a) do CPF ___.___.___-__, a acessar o sistema de gestão da empresa [NOME DA EMPRESA] em meu nome, utilizando as credenciais e códigos de backup contidos neste Kit de Sucessão.'),
    br(),
    paragrafo('Esta autorização aplica-se EXCLUSIVAMENTE nas seguintes situações:'),
    bullet('Falecimento do titular'),
    bullet('Incapacidade física ou mental permanente devidamente comprovada'),
    bullet('Ausência prolongada superior a ___ dias, com impossibilidade de contato'),
    br(),
    paragrafo('O acesso autorizado deverá ser utilizado pelo prazo estritamente necessário para regularização da situação, devendo ser notificado ao suporte técnico do sistema imediatamente.'),
    br(),
    paragrafo('O autorizado deverá:'),
    bullet('Informar ao suporte técnico da plataforma sobre a situação'),
    bullet('Registrar todas as ações tomadas durante o período de acesso emergencial'),
    bullet('Transferir a gestão para o sucessor definitivo tão logo seja possível'),
    br(), br(),
    tabelaAssinatura(),
    br(),
    paragrafo('Reconhecer firma em cartório.', { italics: true, color: '888888' }),

    // ─────────────────────────────────────────────────────────────────────
    // PÁGINA 5 — INSTRUÇÕES DE ARMAZENAMENTO E REVISÃO
    // ─────────────────────────────────────────────────────────────────────
    paginaBreak(),
    secao('Instruções de Armazenamento Seguro'),
    br(),

    new Paragraph({
      children: [new TextRun({ text: 'COPIAS FÍSICAS OBRIGATÓRIAS', bold: true, size: 26, color: COR_PRIMARIA, font: 'Calibri' })],
      spacing: { after: 120 },
    }),
    bullet('Imprima EXATAMENTE 2 cópias deste documento.', true),
    bullet('Cópia 1: Cofre pessoal (bancário ou residencial) de propriedade do titular.'),
    bullet('Cópia 2: Escritório de notário/advogado de confiança, em envelope lacrado e assinado.'),
    br(),

    aviso('🚫 NÃO armazene digitalmente (computador, nuvem, e-mail ou mensagem).'),
    aviso('🚫 NÃO fotografe, NÃO tire print, NÃO envie por WhatsApp ou Signal.'),
    aviso('🚫 NÃO compartilhe com ninguém além do sucessor indicado na autorização.'),
    br(),

    new Paragraph({
      children: [new TextRun({ text: 'REVISÃO TRIMESTRAL OBRIGATÓRIA', bold: true, size: 26, color: COR_PRIMARIA, font: 'Calibri' })],
      spacing: { after: 120 },
    }),
    paragrafo('O sistema enviará um lembrete por e-mail a cada 3 meses. Ao receber o lembrete:'),
    numeradoManual(1, 'Acesse o painel: Admin → Segurança → Backup Codes.'),
    numeradoManual(2, 'Verifique quantos códigos ainda estão disponíveis.'),
    numeradoManual(3, 'Se necessário, regenere os códigos (requer 2FA). Os códigos antigos serão invalidados.'),
    numeradoManual(4, 'Gere um novo Kit de Sucessão: node scripts/gerar-kit-sucessao.js'),
    numeradoManual(5, 'Preencha a nova tabela de backup codes à mão.'),
    numeradoManual(6, 'Destrua as cópias antigas com corte ou fragmentadora de papel.'),
    numeradoManual(7, 'Guarde as 2 novas cópias nos locais indicados acima.'),
    br(),

    new Paragraph({
      children: [new TextRun({ text: 'ATUALIZAÇÃO OBRIGATÓRIA QUANDO:', bold: true, size: 24, color: COR_LARANJA, font: 'Calibri' })],
      spacing: { after: 80 },
    }),
    bullet('Alterar a senha de acesso ao sistema'),
    bullet('Regenerar os backup codes do 2FA'),
    bullet('Trocar o aplicativo autenticador'),
    bullet('Mudar o gestor delegado de confiança'),
    br(), br(),

    new Paragraph({
      children: [
        new TextRun({ text: 'Dúvidas? ', bold: true, size: 22, font: 'Calibri', color: COR_PRIMARIA }),
        new TextRun({ text: 'Contate o suporte técnico da plataforma antes de qualquer acesso emergencial.', size: 22, font: 'Calibri' }),
      ],
      spacing: { after: 120 },
    }),

    br(), br(),
    paragrafo(`Kit gerado em: ${dataGeracao} | Gerado via: scripts/gerar-kit-sucessao.js`, { color: 'BBBBBB', italics: true }),
  ];

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
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.2),
          },
        },
      },
      children: sections,
    }],
  });

  const outPath = path.join(__dirname, '..', 'KIT-SUCESSAO-MASTER.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);

  console.log(`\n✅ Kit de Sucessão gerado com sucesso!`);
  console.log(`📄 Arquivo: ${outPath}`);
  console.log(`\nPRÓXIMOS PASSOS:`);
  console.log(`  1. Abra o arquivo Word e preencha os campos em branco`);
  console.log(`  2. Acesse Admin → Segurança → Backup Codes e copie os códigos na tabela da Página 3`);
  console.log(`  3. Imprima 2 cópias e guarde em local seguro`);
  console.log(`  4. Reconheça firma na autorização legal (Página 4) em cartório`);
  console.log(`  5. Destrua este arquivo após imprimir\n`);
}

main().catch(err => {
  console.error('Erro ao gerar Kit de Sucessão:', err);
  process.exit(1);
});
