import { Request, Response } from 'express';
import { boletoOCRService } from '../services/boleto-ocr.service';

export class BoletoController {
  /**
   * Valida código de barras de boleto
   */
  async validateBarcode(req: Request, res: Response) {
    try {
      const { codigo } = req.body;

      if (!codigo) {
        return res.status(400).json({
          success: false,
          error: 'Código de barras obrigatório',
        });
      }

      const isValid = boletoOCRService.validateBarcode(codigo);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Código de barras inválido',
        });
      }

      // Extrair dados do código
      const clean = codigo.replace(/\D/g, '');
      const valor = boletoOCRService.extractValue(codigo);
      const codigoFormatado = boletoOCRService.formatBarcode(codigo);

      let vencimento = null;
      let tipoBoleto = 'BANCO';

      // Calcular vencimento (apenas para boletos bancários de 47 dígitos)
      if (clean.length === 47) {
        const fatorVencimento = clean.substring(33, 37);
        vencimento = boletoOCRService.calculateDueDate(fatorVencimento);
        tipoBoleto = 'BANCO';
      } else if (clean.length === 48) {
        tipoBoleto = 'CONVENIO';
        // Para convênios, vencimento não está no código de barras
        // Geralmente precisa ser informado manualmente
      }

      res.json({
        success: true,
        data: {
          codigo: codigoFormatado,
          codigoLimpo: clean,
          valor: valor > 0 ? valor.toFixed(2) : null,
          vencimento: vencimento ? vencimento.toISOString() : null,
          tipoBoleto,
          valido: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao validar código de barras',
      });
    }
  }

  /**
   * Extrai dados de boleto via OCR de imagem
   */
  async extractFromImage(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Imagem do boleto obrigatória',
        });
      }

      // Extrair dados via OCR
      const boletoData = await boletoOCRService.extractFromImage(req.file.buffer);

      // Validar código extraído
      const isValid = boletoOCRService.validateBarcode(boletoData.codigo);

      res.json({
        success: true,
        data: {
          ...boletoData,
          valido: isValid,
          codigoFormatado: boletoOCRService.formatBarcode(boletoData.codigo),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao processar imagem do boleto',
      });
    }
  }
}

export const boletoController = new BoletoController();
