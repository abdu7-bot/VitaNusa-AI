import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMoney,
  assertMoney,
  divideAndRoundMoney,
  formatMoney,
  multiplyMoney,
  parseControlledMoneyInput,
  subtractMoney,
} from '../../../assets/js/mandiri/domain/money.js';

test('nol adalah nilai uang valid', () => {
  assert.equal(assertMoney(0), 0);
});

test('integer positif adalah nilai uang valid', () => {
  assert.equal(assertMoney(15000), 15000);
});

test('float ditolak', () => {
  assert.throws(() => assertMoney(1.5), { code: 'unsafe_integer' });
});

test('NaN ditolak', () => {
  assert.throws(() => assertMoney(Number.NaN), { code: 'unsafe_integer' });
});

test('Infinity ditolak', () => {
  assert.throws(() => assertMoney(Number.POSITIVE_INFINITY), { code: 'unsafe_integer' });
});

test('unsafe integer ditolak', () => {
  assert.throws(() => assertMoney(Number.MAX_SAFE_INTEGER + 1), { code: 'unsafe_integer' });
});

test('penjumlahan uang benar', () => {
  assert.equal(addMoney(1000, 2500, 0), 3500);
});

test('overflow penjumlahan ditolak', () => {
  assert.throws(() => addMoney(Number.MAX_SAFE_INTEGER, 1), { code: 'money_overflow' });
});

test('pengurangan benar dan secara eksplisit dapat menghasilkan negatif', () => {
  assert.equal(subtractMoney(1500, 500), 1000);
  assert.equal(subtractMoney(500, 1500), -1000);
  assert.throws(() => assertMoney(-1), { code: 'negative_money' });
});

test('perkalian uang benar', () => {
  assert.equal(multiplyMoney(2500, 4), 10000);
});

test('overflow perkalian ditolak', () => {
  assert.throws(() => multiplyMoney(Number.MAX_SAFE_INTEGER, 2), { code: 'money_overflow' });
});

test('pembagian mode floor', () => {
  assert.equal(divideAndRoundMoney(5, 2, 'floor'), 2);
});

test('pembagian mode ceil', () => {
  assert.equal(divideAndRoundMoney(5, 2, 'ceil'), 3);
});

test('pembagian mode half_up', () => {
  assert.equal(divideAndRoundMoney(5, 2, 'half_up'), 3);
  assert.equal(divideAndRoundMoney(4, 3, 'half_up'), 1);
});

test('divisor nol ditolak', () => {
  assert.throws(() => divideAndRoundMoney(100, 0, 'floor'), { code: 'invalid_divisor' });
});

test('mode pembulatan tidak dikenal ditolak', () => {
  assert.throws(() => divideAndRoundMoney(100, 3, 'bankers'), {
    code: 'unknown_rounding_mode',
  });
});

test('format rupiah menggunakan Intl hanya untuk tampilan', () => {
  const displayed = formatMoney(15000, 'id-ID').replace(/[\s\u00a0]/g, '');
  assert.equal(displayed, 'Rp15.000');
});

test('parser menerima input terkontrol', () => {
  assert.equal(parseControlledMoneyInput(15000), 15000);
  assert.equal(parseControlledMoneyInput('15000'), 15000);
  assert.equal(parseControlledMoneyInput('Rp15.000'), 15000);
  assert.equal(parseControlledMoneyInput('Rp 15.000'), 15000);
});

test('parser menolak format ambigu dan kalkulasi tidak melakukan implicit coercion', () => {
  assert.throws(() => parseControlledMoneyInput('15,000'));
  assert.throws(() => parseControlledMoneyInput('15000.00'));
  assert.throws(() => parseControlledMoneyInput('-15000'));
  assert.throws(() => addMoney('15000', 1000), { code: 'unsafe_integer' });
  assert.throws(() => multiplyMoney(1000, '2'), { code: 'unsafe_integer' });
});
