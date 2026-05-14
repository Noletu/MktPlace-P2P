import BigNumber from 'bignumber.js';

BigNumber.config({ EXPONENTIAL_AT: 1e9, DECIMAL_PLACES: 18 });

export function toBN(value: string | number | BigNumber): BigNumber {
  const bn = new BigNumber(value);
  if (bn.isNaN()) throw new Error(`Invalid monetary value: ${String(value)}`);
  return bn;
}

export function addBN(a: string, b: string): string {
  return toBN(a).plus(toBN(b)).toFixed(18);
}

export function subBN(a: string, b: string): string {
  return toBN(a).minus(toBN(b)).toFixed(18);
}

export function mulBN(a: string, b: string | number): string {
  return toBN(a).multipliedBy(toBN(b)).toFixed(18);
}

export function divBN(a: string, b: string | number): string {
  return toBN(a).dividedBy(toBN(b)).toFixed(18);
}

export function gtBN(a: string, b: string): boolean {
  return toBN(a).isGreaterThan(toBN(b));
}

export function ltBN(a: string, b: string): boolean {
  return toBN(a).isLessThan(toBN(b));
}

export function gteBN(a: string, b: string): boolean {
  return toBN(a).isGreaterThanOrEqualTo(toBN(b));
}

export function lteBN(a: string, b: string): boolean {
  return toBN(a).isLessThanOrEqualTo(toBN(b));
}

export function eqBN(a: string, b: string): boolean {
  return toBN(a).isEqualTo(toBN(b));
}

export function toFixed(value: string | number | BigNumber, decimals = 8): string {
  return toBN(value).toFixed(decimals);
}

export function sumBN(values: (string | number)[]): string {
  return values.reduce<BigNumber>(
    (acc, v) => acc.plus(toBN(v)),
    new BigNumber(0),
  ).toFixed(18);
}

export function isNegativeBN(value: string): boolean {
  return toBN(value).isNegative();
}

export function isZeroBN(value: string): boolean {
  return toBN(value).isZero();
}

export function maxBN(a: string, b: string): string {
  return toBN(a).isGreaterThan(toBN(b)) ? a : b;
}

export function minBN(a: string, b: string): string {
  return toBN(a).isLessThan(toBN(b)) ? a : b;
}
