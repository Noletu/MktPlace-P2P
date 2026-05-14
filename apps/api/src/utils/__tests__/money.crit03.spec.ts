// CRIT-03b: o setup.ts global mocka @prisma/client. Aqui precisamos do Prisma.Decimal real
// para validar que toBN aceita instâncias retornadas pelo Prisma após a migração.
jest.unmock('@prisma/client');

import fc from 'fast-check';
import BigNumber from 'bignumber.js';
import { Prisma } from '@prisma/client';
import {
  toBN,
  addBN,
  subBN,
  mulBN,
  sumBN,
  gtBN,
  ltBN,
  gteBN,
  lteBN,
  eqBN,
  toFixed,
  toIntegerDown,
} from '../money';

describe('CRIT-03: aritmética monetária segura (utils/money)', () => {
  // ============================================
  // toBN — validação de entrada
  // ============================================
  describe('toBN', () => {
    it('rejeita NaN / undefined / null / string vazia / lixo', () => {
      expect(() => toBN('abc')).toThrow(/Invalid monetary value/);
      expect(() => toBN('')).toThrow(/Invalid monetary value/);
      expect(() => toBN(null as any)).toThrow();
      expect(() => toBN(undefined as any)).toThrow();
    });

    it('rejeita number em runtime (defesa contra precisão IEEE-754)', () => {
      expect(() => toBN(0.1 as any)).toThrow(/does not accept number/);
      expect(() => toBN(1.5 as any)).toThrow(/does not accept number/);
    });

    it('aceita string, BigNumber e instâncias com toString()', () => {
      expect(toBN('1.5').toFixed(1)).toBe('1.5');
      expect(toBN(new BigNumber('2.5')).toFixed(1)).toBe('2.5');
    });

    // CRIT-03b: campos Decimal vindos do Prisma devem ser aceitos sem .toString() prévio
    it('aceita Prisma.Decimal preservando precisão de 18 casas', () => {
      const dec = new Prisma.Decimal('1.234567890123456789');
      expect(toBN(dec).toFixed(18)).toBe('1.234567890123456789');
      // soma de dois Decimals
      const a = new Prisma.Decimal('100.5');
      const b = new Prisma.Decimal('0.000001');
      expect(addBN(a, b)).toBe('100.500001000000000000');
    });
  });

  // ============================================
  // Sanidade IEEE-754 — o problema que o helper resolve
  // ============================================
  describe('IEEE-754 sanity', () => {
    it('0.1 + 0.2 retorna 0.3 exato (não 0.30000000000000004)', () => {
      expect(addBN('0.1', '0.2')).toBe('0.300000000000000000');
      expect(eqBN(addBN('0.1', '0.2'), '0.3')).toBe(true);
    });

    it('preserva 18 casas decimais em soma de wei-scale', () => {
      const result = addBN('1.000000000000000001', '0.000000000000000001');
      expect(result).toBe('1.000000000000000002');
    });

    it('soma de centavos não perde precisão em milhares de iterações', () => {
      let total = '0';
      for (let i = 0; i < 1000; i++) total = addBN(total, '0.01');
      expect(eqBN(total, '10')).toBe(true);
    });
  });

  // ============================================
  // Property-based tests (fast-check)
  // ============================================
  describe('property-based (fast-check)', () => {
    const bigIntStr = () =>
      fc.bigInt({ min: 0n, max: 10n ** 18n }).map(b => b.toString());

    it('plus é associativo para valores até 1e18', () => {
      fc.assert(
        fc.property(bigIntStr(), bigIntStr(), bigIntStr(), (a, b, c) => {
          const left = addBN(addBN(a, b), c);
          const right = addBN(a, addBN(b, c));
          return eqBN(left, right);
        }),
        { numRuns: 200 },
      );
    });

    it('plus é comutativo', () => {
      fc.assert(
        fc.property(bigIntStr(), bigIntStr(), (a, b) => eqBN(addBN(a, b), addBN(b, a))),
        { numRuns: 200 },
      );
    });

    it('a + b - b === a (identidade aditiva)', () => {
      fc.assert(
        fc.property(bigIntStr(), bigIntStr(), (a, b) => eqBN(subBN(addBN(a, b), b), a)),
        { numRuns: 200 },
      );
    });

    it('sumBN equivale a redução iterativa de addBN', () => {
      fc.assert(
        fc.property(fc.array(bigIntStr(), { minLength: 0, maxLength: 50 }), values => {
          const viaSum = sumBN(values);
          const viaReduce = values.reduce((acc, v) => addBN(acc, v), '0');
          return eqBN(viaSum, viaReduce);
        }),
        { numRuns: 100 },
      );
    });

    it('gtBN/ltBN/eqBN são totalmente ordenados e mutuamente exclusivos', () => {
      fc.assert(
        fc.property(bigIntStr(), bigIntStr(), (a, b) => {
          const gt = gtBN(a, b);
          const lt = ltBN(a, b);
          const eq = eqBN(a, b);
          // exatamente uma comparação é verdadeira
          return [gt, lt, eq].filter(Boolean).length === 1;
        }),
        { numRuns: 200 },
      );
    });

    it('gteBN(a,a) === true; lteBN(a,a) === true (reflexividade)', () => {
      fc.assert(
        fc.property(bigIntStr(), a => gteBN(a, a) && lteBN(a, a)),
        { numRuns: 100 },
      );
    });
  });

  // ============================================
  // mulBN / toIntegerDown — conversão de unidade
  // ============================================
  describe('mulBN & toIntegerDown', () => {
    it('mulBN aceita number como segundo operando (multiplicador constante)', () => {
      expect(mulBN('1.5', 2)).toBe('3.000000000000000000');
      expect(mulBN('0.000001', 1e6)).toBe('1.000000000000000000');
    });

    it('toIntegerDown trunca para baixo (nunca arredonda para cima)', () => {
      // 1.999999 → 1 (não 2)
      expect(toIntegerDown('1.999999', 1).toFixed(0)).toBe('1');
      // 0.5 → 0 (truncamento)
      expect(toIntegerDown('0.5', 1).toFixed(0)).toBe('0');
      // 0.000001 SOL → 1000 lamports
      expect(toIntegerDown('0.000001', 1e9).toFixed(0)).toBe('1000');
    });

    it('toIntegerDown impede plataforma creditar mais lamports do que o usuário possui', () => {
      // Usuário possui 0.123456789 SOL (9 decimais), tenta enviar
      // 1e9 multiplicação dá 123456789.000... mas se houvesse arredondamento up
      // seria 123456790 → plataforma perderia 1 lamport
      const lamports = toIntegerDown('0.123456789', 1e9).toFixed(0);
      expect(lamports).toBe('123456789');
    });
  });

  // ============================================
  // toFixed — saída canônica
  // ============================================
  describe('toFixed', () => {
    it('formata com 8 decimais por padrão', () => {
      expect(toFixed('1.5')).toBe('1.50000000');
    });

    it('aceita override de casas decimais', () => {
      expect(toFixed('1.123456789012345678', 18)).toBe('1.123456789012345678');
      expect(toFixed('1.123456789012345678', 2)).toBe('1.12');
    });
  });
});
