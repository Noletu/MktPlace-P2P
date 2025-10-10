// Serviço de OCR para leitura de código de barras de boleto
// Usando Tesseract.js para OCR local
import Tesseract from 'tesseract.js';
import sharp from 'sharp';

interface BoletoData {
  codigo: string;
  valor?: string;
  vencimento?: string;
  beneficiario?: string;
}

export class BoletoOCRService {
  /**
   * Extrai dados do boleto a partir de imagem
   * @param imageBuffer - Buffer da imagem do boleto
   * @returns Dados extraídos do boleto
   */
  async extractFromImage(imageBuffer: Buffer): Promise<BoletoData> {
    try {
      console.log('📄 Extraindo dados do boleto da imagem usando OCR...');

      // Pré-processar imagem para melhorar qualidade do OCR
      const processedImage = await this.preprocessImage(imageBuffer);

      // Executar OCR
      const { data: { text } } = await Tesseract.recognize(
        processedImage,
        'por', // Português
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR progresso: ${Math.round(m.progress * 100)}%`);
            }
          },
        }
      );

      console.log('📝 Texto extraído do boleto:', text.substring(0, 500));

      // Extrair código de barras do texto
      const codigo = this.extractBarcodeFromText(text);

      if (!codigo) {
        throw new Error('Código de barras não encontrado na imagem');
      }

      console.log('🔢 Código de barras extraído:', codigo);

      // Validar código extraído
      if (!this.validateBarcode(codigo)) {
        throw new Error('Código de barras inválido (falhou na validação de dígitos verificadores)');
      }

      // Extrair informações do código de barras
      const valor = this.extractValue(codigo);
      const codigoLimpo = codigo.replace(/\D/g, '');

      let vencimento: Date | undefined;
      if (codigoLimpo.length === 47) {
        const fatorVencimento = codigoLimpo.substring(33, 37);
        vencimento = this.calculateDueDate(fatorVencimento);
      }

      return {
        codigo: codigoLimpo,
        valor: valor.toFixed(2),
        vencimento: vencimento?.toISOString(),
        beneficiario: undefined, // Beneficiário pode ser extraído do texto se necessário
      };
    } catch (error: any) {
      console.error('❌ Erro ao extrair dados do boleto:', error.message);
      throw new Error(`Falha no OCR: ${error.message}`);
    }
  }

  /**
   * Pré-processa imagem para melhorar qualidade do OCR
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Converter para escala de cinza, aumentar contraste, redimensionar
      const processed = await sharp(imageBuffer)
        .grayscale() // Converter para escala de cinza
        .normalize() // Normalizar contraste
        .sharpen() // Aumentar nitidez
        .threshold(128) // Binarizar (preto e branco)
        .toBuffer();

      console.log('✅ Imagem pré-processada para OCR');
      return processed;
    } catch (error: any) {
      console.warn('⚠️ Erro ao pré-processar imagem, usando original:', error.message);
      return imageBuffer;
    }
  }

  /**
   * Extrai código de barras do texto OCR
   * Procura por sequências de dígitos que correspondam ao padrão de código de barras
   */
  private extractBarcodeFromText(text: string): string | null {
    // Remover espaços e manter apenas dígitos e pontos
    const cleaned = text.replace(/[^0-9.\s]/g, '');

    // Procurar por sequência de 47 ou 48 dígitos (com possíveis espaços/pontos)
    // Padrão: 47 dígitos para boleto bancário ou 48 para convênio
    const patterns = [
      /(\d[\s.]?){47}/g,  // 47 dígitos (boleto bancário)
      /(\d[\s.]?){48}/g,  // 48 dígitos (convênio)
    ];

    for (const pattern of patterns) {
      const matches = cleaned.match(pattern);

      if (matches && matches.length > 0) {
        // Pegar a primeira sequência encontrada
        const codigo = matches[0].replace(/\D/g, ''); // Remover não-dígitos

        // Validar tamanho
        if (codigo.length === 47 || codigo.length === 48) {
          return codigo;
        }
      }
    }

    // Se não encontrou com padrão relaxado, procurar sequência contínua
    const continuousPattern = /\d{47,48}/;
    const match = cleaned.match(continuousPattern);

    if (match) {
      return match[0];
    }

    return null;
  }

  /**
   * Valida código de barras do boleto (47 ou 48 dígitos)
   * @param codigo - Código de barras
   * @returns true se válido
   */
  validateBarcode(codigo: string): boolean {
    // Remove espaços e caracteres não numéricos
    const cleanCode = codigo.replace(/\D/g, '');

    // Boleto bancário: 47 dígitos
    // Convênio/Arrecadação: 48 dígitos
    if (cleanCode.length === 47) {
      return this.validateBoletoCheckDigits(cleanCode);
    } else if (cleanCode.length === 48) {
      return this.validateConvenioCheckDigits(cleanCode);
    }

    return false;
  }

  /**
   * Valida dígitos verificadores do código de barras
   * Algoritmo Módulo 10 e Módulo 11
   */
  private validateBoletoCheckDigits(codigo: string): boolean {
    // Separar campos do código de barras
    // Formato: AAABC.CCCCX DDDDD.DDDDDY EEEEE.EEEEEZ K VVVVVVVVVVVVVV

    const campo1 = codigo.substring(0, 10);
    const campo2 = codigo.substring(10, 21);
    const campo3 = codigo.substring(21, 32);
    const dv = codigo.substring(32, 33);
    const fatorVencimento = codigo.substring(33, 37);
    const valor = codigo.substring(37, 47);

    // Validar cada campo com módulo 10
    if (!this.modulo10(campo1.substring(0, 9), campo1.substring(9, 10))) {
      return false;
    }

    if (!this.modulo10(campo2.substring(0, 10), campo2.substring(10, 11))) {
      return false;
    }

    if (!this.modulo10(campo3.substring(0, 10), campo3.substring(10, 11))) {
      return false;
    }

    // Validar DV geral com módulo 11
    const codigoBarras =
      codigo.substring(0, 4) +
      codigo.substring(33, 47) +
      codigo.substring(4, 9) +
      codigo.substring(10, 20) +
      codigo.substring(21, 31);

    const dvCalculado = this.modulo11(codigoBarras);

    return dvCalculado === dv;
  }

  /**
   * Algoritmo Módulo 10 para validação
   */
  private modulo10(campo: string, dvEsperado: string): boolean {
    let soma = 0;
    let multiplicador = 2;

    for (let i = campo.length - 1; i >= 0; i--) {
      const digito = parseInt(campo[i]);
      const resultado = digito * multiplicador;

      soma += resultado > 9 ? resultado - 9 : resultado;
      multiplicador = multiplicador === 2 ? 1 : 2;
    }

    const resto = soma % 10;
    const dvCalculado = resto === 0 ? 0 : 10 - resto;

    return dvCalculado.toString() === dvEsperado;
  }

  /**
   * Algoritmo Módulo 11 para validação
   */
  private modulo11(codigo: string): string {
    const sequencia = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;

    for (let i = 0; i < codigo.length; i++) {
      soma += parseInt(codigo[i]) * sequencia[i];
    }

    const resto = soma % 11;
    const dv = resto === 0 || resto === 1 || resto === 10 ? 1 : 11 - resto;

    return dv.toString();
  }

  /**
   * Formata código de barras para exibição
   * 00000.00000 00000.000000 00000.000000 0 00000000000000
   */
  formatBarcode(codigo: string): string {
    const clean = codigo.replace(/\D/g, '');

    if (clean.length !== 47) {
      return codigo;
    }

    return `${clean.substring(0, 5)}.${clean.substring(5, 10)} ${clean.substring(10, 15)}.${clean.substring(15, 21)} ${clean.substring(21, 26)}.${clean.substring(26, 32)} ${clean.substring(32, 33)} ${clean.substring(33, 47)}`;
  }

  /**
   * Calcula data de vencimento a partir do fator
   * Fator de vencimento é baseado em dias desde 07/10/1997
   */
  calculateDueDate(fatorVencimento: string): Date {
    const baseDate = new Date('1997-10-07');
    const days = parseInt(fatorVencimento);

    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + days);

    return dueDate;
  }

  /**
   * Valida dígitos verificadores do código de convênio/arrecadação (48 dígitos)
   * Algoritmo Módulo 10
   */
  private validateConvenioCheckDigits(codigo: string): boolean {
    // Formato: 8 4620000000 4 5970006910 0 1013251647 4 78925091926277
    // Posições: Produto(1) + Segmento(1) + Valor(11) + DV(1) + Campo2(11) + DV(1) + Campo3(11) + DV(1) + Campo4(11)

    console.log('🔍 Validando código de convênio/arrecadação:', codigo);

    // Extrair os 4 campos e seus DVs
    const campo1 = codigo.substring(0, 11); // 11 dígitos (produto + segmento + início do valor)
    const dv1 = codigo.substring(11, 12);

    const campo2 = codigo.substring(12, 23); // 11 dígitos
    const dv2 = codigo.substring(23, 24);

    const campo3 = codigo.substring(24, 35); // 11 dígitos
    const dv3 = codigo.substring(35, 36);

    const campo4 = codigo.substring(36, 47); // 11 dígitos
    const dv4 = codigo.substring(47, 48);

    console.log('Campo 1:', campo1, '| DV:', dv1, '| Valid:', this.modulo10(campo1, dv1));
    console.log('Campo 2:', campo2, '| DV:', dv2, '| Valid:', this.modulo10(campo2, dv2));
    console.log('Campo 3:', campo3, '| DV:', dv3, '| Valid:', this.modulo10(campo3, dv3));
    console.log('Campo 4:', campo4, '| DV:', dv4, '| Valid:', this.modulo10(campo4, dv4));

    // Validar cada campo com módulo 10
    const valid = (
      this.modulo10(campo1, dv1) &&
      this.modulo10(campo2, dv2) &&
      this.modulo10(campo3, dv3) &&
      this.modulo10(campo4, dv4)
    );

    console.log('✅ Resultado final da validação:', valid);
    return valid;
  }

  /**
   * Extrai valor do código de barras
   */
  extractValue(codigo: string): number {
    const clean = codigo.replace(/\D/g, '');

    if (clean.length === 47) {
      // Boleto bancário: valor está nas posições 37-47
      const valorString = clean.substring(37, 47);
      const valor = parseInt(valorString) / 100;
      return valor;
    } else if (clean.length === 48) {
      // Convênio: valor está nas posições 4-15 (11 dígitos)
      const valorString = clean.substring(4, 15);
      const valor = parseInt(valorString) / 100;
      return valor;
    }

    return 0;
  }
}

export const boletoOCRService = new BoletoOCRService();
