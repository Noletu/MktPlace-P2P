import { validateCNPJ, documentSchema, isValidPixKey } from '@mktplace/shared';

describe('SER-27 — validação de documento e pixKey', () => {
  describe('validateCNPJ', () => {
    it('aceita CNPJ com dígitos verificadores válidos', () => {
      expect(validateCNPJ('11222333000181')).toBe(true);
    });
    it('rejeita CNPJ com DV inválido', () => {
      expect(validateCNPJ('11222333000180')).toBe(false);
    });
    it('rejeita CNPJ com todos os dígitos iguais', () => {
      expect(validateCNPJ('11111111111111')).toBe(false);
    });
    it('rejeita string com tamanho errado', () => {
      expect(validateCNPJ('123')).toBe(false);
    });
  });

  describe('documentSchema (CPF ou CNPJ)', () => {
    it('aceita CPF válido', () => {
      expect(documentSchema.safeParse('11144477735').success).toBe(true);
    });
    it('aceita CNPJ válido', () => {
      expect(documentSchema.safeParse('11222333000181').success).toBe(true);
    });
    it('rejeita CPF com DV inválido', () => {
      expect(documentSchema.safeParse('12345678901').success).toBe(false);
    });
    it('rejeita CPF com todos os dígitos iguais', () => {
      expect(documentSchema.safeParse('11111111111').success).toBe(false);
    });
    it('rejeita string que não é CPF nem CNPJ', () => {
      expect(documentSchema.safeParse('123').success).toBe(false);
    });
  });

  describe('isValidPixKey', () => {
    it('CPF válido', () => { expect(isValidPixKey('11144477735', 'CPF')).toBe(true); });
    it('CPF inválido', () => { expect(isValidPixKey('11111111111', 'CPF')).toBe(false); });
    it('CNPJ válido', () => { expect(isValidPixKey('11222333000181', 'CNPJ')).toBe(true); });
    it('EMAIL válido', () => { expect(isValidPixKey('user@example.com', 'EMAIL')).toBe(true); });
    it('EMAIL inválido', () => { expect(isValidPixKey('not-an-email', 'EMAIL')).toBe(false); });
    it('PHONE E.164 BR válido', () => { expect(isValidPixKey('+5511999999999', 'PHONE')).toBe(true); });
    it('PHONE sem +55 inválido', () => { expect(isValidPixKey('11999999999', 'PHONE')).toBe(false); });
    it('RANDOM (UUID v4) válido', () => { expect(isValidPixKey('123e4567-e89b-42d3-a456-426614174000', 'RANDOM')).toBe(true); });
    it('RANDOM inválido', () => { expect(isValidPixKey('not-a-uuid', 'RANDOM')).toBe(false); });
    it('tipo desconhecido → false', () => { expect(isValidPixKey('qualquer', 'FOO')).toBe(false); });
  });
});
