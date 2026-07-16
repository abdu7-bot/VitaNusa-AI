import { MandiriDomainError } from './validation.js';

export const MONEY_ROUNDING_MODES = Object.freeze(['floor', 'ceil', 'half_up']);

function assertSafeInteger(value, path) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new MandiriDomainError('unsafe_integer', 'nilai harus berupa safe integer Number', path);
  }
  return value;
}

function bigintToSafeNumber(value, path) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || BigInt(result) !== value) {
    throw new MandiriDomainError('money_overflow', 'hasil operasi melewati safe integer', path);
  }
  return result;
}

export function assertMoney(value, { allowNegative = false } = {}) {
  assertSafeInteger(value, 'money');
  if (!allowNegative && value < 0) {
    throw new MandiriDomainError('negative_money', 'nilai uang negatif tidak diizinkan', 'money');
  }
  return value;
}

export function addMoney(...values) {
  let total = 0n;
  values.forEach((value, index) => {
    assertMoney(value);
    total += BigInt(value);
    bigintToSafeNumber(total, `values[${index}]`);
  });
  return bigintToSafeNumber(total, 'sum');
}

export function subtractMoney(minuend, subtrahend) {
  assertMoney(minuend);
  assertMoney(subtrahend);
  return bigintToSafeNumber(BigInt(minuend) - BigInt(subtrahend), 'difference');
}

export function multiplyMoney(unitAmount, quantity) {
  assertMoney(unitAmount);
  assertSafeInteger(quantity, 'quantity');
  if (quantity < 0) {
    throw new MandiriDomainError('negative_quantity', 'quantity negatif tidak diizinkan', 'quantity');
  }
  return bigintToSafeNumber(BigInt(unitAmount) * BigInt(quantity), 'product');
}

export function divideAndRoundMoney(amount, divisor, mode) {
  assertMoney(amount);
  assertSafeInteger(divisor, 'divisor');
  if (divisor <= 0) {
    throw new MandiriDomainError('invalid_divisor', 'divisor harus lebih besar dari nol', 'divisor');
  }
  if (!MONEY_ROUNDING_MODES.includes(mode)) {
    throw new MandiriDomainError('unknown_rounding_mode', 'mode pembulatan tidak dikenal', 'mode');
  }

  const amountBigInt = BigInt(amount);
  const divisorBigInt = BigInt(divisor);
  let quotient = amountBigInt / divisorBigInt;
  const remainder = amountBigInt % divisorBigInt;

  if (mode === 'ceil' && remainder > 0n) quotient += 1n;
  if (mode === 'half_up' && remainder * 2n >= divisorBigInt) quotient += 1n;
  return bigintToSafeNumber(quotient, 'quotient');
}

export function formatMoney(amount, locale = 'id-ID') {
  assertMoney(amount, { allowNegative: true });
  if (typeof locale !== 'string' || !locale.trim() || locale.length > 35) {
    throw new MandiriDomainError('invalid_locale', 'locale tidak valid', 'locale');
  }
  let canonicalLocale;
  try {
    [canonicalLocale] = Intl.getCanonicalLocales(locale);
  } catch {
    throw new MandiriDomainError('invalid_locale', 'locale tidak valid', 'locale');
  }
  return new Intl.NumberFormat(canonicalLocale, {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parseControlledMoneyInput(value) {
  if (typeof value === 'number') return assertMoney(value);
  if (typeof value !== 'string') {
    throw new MandiriDomainError('invalid_money_input', 'input uang harus number atau string terkontrol');
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 32) {
    throw new MandiriDomainError('invalid_money_input', 'input uang kosong atau terlalu panjang');
  }
  const withoutPrefix = normalized.replace(/^rp\s*/i, '');
  const plainPattern = /^(?:0|[1-9]\d*)$/;
  const groupedPattern = /^[1-9]\d{0,2}(?:\.\d{3})+$/;
  if (!plainPattern.test(withoutPrefix) && !groupedPattern.test(withoutPrefix)) {
    throw new MandiriDomainError(
      'invalid_money_input',
      'gunakan digit polos atau format Indonesia seperti Rp15.000',
    );
  }

  const digits = withoutPrefix.replace(/\./g, '');
  const parsed = Number(digits);
  return assertMoney(parsed);
}
