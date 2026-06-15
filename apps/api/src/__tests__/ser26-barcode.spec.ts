// Mock das dependências de OCR: sharp (binário nativo) e tesseract.js não são
// usados por validateBarcode (apenas pela leitura de imagem). Mockados para o
// import do serviço não carregar binários nativos no Jest.
jest.mock('sharp', () => ({}));
jest.mock('tesseract.js', () => ({}));

import { boletoOCRService } from '../services/boleto-ocr.service';

// Linha digitável de 47 dígitos com DVs válidos (gerada pelo algoritmo módulo 10/11 do projeto)
const LINHA_VALIDA_47 = '23790128060000010000833802601006600010000055000';
// Mesma linha com um dígito adulterado (DV não confere)
const LINHA_INVALIDA_47 = '23790928060000010000833802601006600010000055000';
// Código de barras puro de 44 dígitos (NÃO é linha digitável) — deve ser rejeitado
const CODIGO_44 = '23790128800000100003380260100018851030026303';

describe('SER-26 — validação de checksum de boleto (validateBarcode)', () => {
  it('aceita linha digitável de 47 dígitos com dígitos verificadores válidos', () => {
    expect(boletoOCRService.validateBarcode(LINHA_VALIDA_47)).toBe(true);
  });

  it('aceita a mesma linha com pontuação/espaços (não-dígitos são ignorados)', () => {
    const comPontuacao =
      LINHA_VALIDA_47.slice(0, 5) + '.' + LINHA_VALIDA_47.slice(5, 10) + ' ' + LINHA_VALIDA_47.slice(10);
    expect(comPontuacao.replace(/\D/g, '')).toBe(LINHA_VALIDA_47);
    expect(boletoOCRService.validateBarcode(comPontuacao)).toBe(true);
  });

  it('rejeita linha de 47 dígitos com um dígito adulterado', () => {
    expect(boletoOCRService.validateBarcode(LINHA_INVALIDA_47)).toBe(false);
  });

  it('rejeita código de barras puro de 44 dígitos (não é linha digitável)', () => {
    expect(boletoOCRService.validateBarcode(CODIGO_44)).toBe(false);
  });

  it('rejeita comprimentos inválidos (43, 45, 46 dígitos)', () => {
    expect(boletoOCRService.validateBarcode('2'.repeat(43))).toBe(false);
    expect(boletoOCRService.validateBarcode('2'.repeat(45))).toBe(false);
    expect(boletoOCRService.validateBarcode('2'.repeat(46))).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(boletoOCRService.validateBarcode('')).toBe(false);
  });
});
