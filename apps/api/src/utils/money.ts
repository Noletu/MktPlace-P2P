import BigNumber from 'bignumber.js';
import { Prisma } from '@prisma/client';

BigNumber.config({ EXPONENTIAL_AT: 1e9, DECIMAL_PLACES: 18 });

// Aceita string (canônico), BigNumber, ou Prisma.Decimal (vindo do banco após CRIT-03b).
// Number é REJEITADO em runtime: impede silencioso erro de precisão IEEE-754 quando
// alguém faz `addBN(saldo, Number(valor))`.
export type MoneyValue = string | BigNumber | Prisma.Decimal;

// Alias canônico — código novo deve usar `Money` em assinaturas.
export type Money = MoneyValue;

function isPrismaDecimal(v: unknown): v is Prisma.Decimal {
  return typeof v === 'object' && v !== null && 'toFixed' in v && 'd' in (v as any);
}

export function toBN(value: MoneyValue): BigNumber {
  if (typeof value === 'number') {
    // Defensa runtime — TypeScript já rejeita, mas usuário pode chamar de JS puro
    throw new Error(`toBN does not accept number (use string to preserve precision): ${value}`);
  }
  if (value == null) {
    throw new Error(`Invalid monetary value: ${String(value)}`);
  }
  const bn = value instanceof BigNumber
    ? value
    : new BigNumber(isPrismaDecimal(value) ? value.toString() : value);
  if (bn.isNaN()) throw new Error(`Invalid monetary value: ${String(value)}`);
  return bn;
}

export function addBN(a: MoneyValue, b: MoneyValue): string {
  return toBN(a).plus(toBN(b)).toFixed(18);
}

export function subBN(a: MoneyValue, b: MoneyValue): string {
  return toBN(a).minus(toBN(b)).toFixed(18);
}

// mulBN/divBN aceitam number como SEGUNDO operando (multiplicador/divisor por constantes
// como 1e6, 1e9, 1e18 para conversão de unidades on-chain). Primeiro operando continua restrito.
export function mulBN(a: MoneyValue, b: MoneyValue | number): string {
  const bbn = typeof b === 'number' ? new BigNumber(b) : toBN(b);
  return toBN(a).multipliedBy(bbn).toFixed(18);
}

export function divBN(a: MoneyValue, b: MoneyValue | number): string {
  const bbn = typeof b === 'number' ? new BigNumber(b) : toBN(b);
  return toBN(a).dividedBy(bbn).toFixed(18);
}

export function gtBN(a: MoneyValue, b: MoneyValue): boolean {
  return toBN(a).isGreaterThan(toBN(b));
}

export function ltBN(a: MoneyValue, b: MoneyValue): boolean {
  return toBN(a).isLessThan(toBN(b));
}

export function gteBN(a: MoneyValue, b: MoneyValue): boolean {
  return toBN(a).isGreaterThanOrEqualTo(toBN(b));
}

export function lteBN(a: MoneyValue, b: MoneyValue): boolean {
  return toBN(a).isLessThanOrEqualTo(toBN(b));
}

export function eqBN(a: MoneyValue, b: MoneyValue): boolean {
  return toBN(a).isEqualTo(toBN(b));
}

export function toFixed(value: MoneyValue, decimals = 8): string {
  return toBN(value).toFixed(decimals);
}

export function sumBN(values: MoneyValue[]): string {
  return values.reduce<BigNumber>((acc, v) => acc.plus(toBN(v)), new BigNumber(0)).toFixed(18);
}

export function isNegativeBN(value: MoneyValue): boolean {
  return toBN(value).isNegative();
}

export function isZeroBN(value: MoneyValue): boolean {
  return toBN(value).isZero();
}

export function maxBN(a: MoneyValue, b: MoneyValue): string {
  return toBN(a).isGreaterThan(toBN(b)) ? toBN(a).toFixed(18) : toBN(b).toFixed(18);
}

export function minBN(a: MoneyValue, b: MoneyValue): string {
  return toBN(a).isLessThan(toBN(b)) ? toBN(a).toFixed(18) : toBN(b).toFixed(18);
}

// Conversão para inteiro com ROUND_DOWN explícito: nunca arredonda para cima
// (impede a plataforma de creditar mais lamports/wei do que o usuário possui).
export function toIntegerDown(value: MoneyValue, multiplier: number): BigNumber {
  return toBN(value).multipliedBy(multiplier).integerValue(BigNumber.ROUND_DOWN);
}
