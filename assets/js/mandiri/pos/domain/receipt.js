import { createEntityId, isValidEntityId } from '../../domain/ids.js';
import { assertExactFields, MandiriDomainError, normalizeIsoTimestamp, normalizePositiveVersion } from '../../domain/validation.js';
import { addMoney, assertMoney, subtractMoney } from '../../domain/money.js';
import { normalizeWorkspaceScope } from './product-validation.js';
import { normalizeSaleLine } from './sale.js';

const FIELDS = Object.freeze([
  'schemaVersion', 'receiptId', 'workspaceId', 'saleId', 'paymentId', 'currencyCode',
  'subtotalMinor', 'discountMinor', 'grandTotalMinor', 'amountTenderedMinor',
  'changeMinor', 'paymentMethod', 'lineCount', 'lines', 'finalizedAtLocal',
]);

function id(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  return value;
}

export function createReceiptId(cryptoRef = globalThis.crypto) {
  return createEntityId('receipt', cryptoRef);
}

export function normalizeReceipt(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, FIELDS, { path: 'receipt' });
  if (input.currencyCode !== 'IDR' || input.paymentMethod !== 'cash' || !Array.isArray(input.lines)) {
    throw new MandiriDomainError('data_invalid', 'receipt tidak valid', 'receipt');
  }
  const lines = Object.freeze(input.lines.map(normalizeSaleLine));
  if (lines.length !== input.lineCount || lines.length < 1) {
    throw new MandiriDomainError('data_invalid', 'line receipt tidak konsisten', 'receipt.lines');
  }
  const subtotalMinor = assertMoney(input.subtotalMinor);
  const discountMinor = assertMoney(input.discountMinor);
  const grandTotalMinor = subtractMoney(subtotalMinor, discountMinor);
  const amountTenderedMinor = assertMoney(input.amountTenderedMinor);
  if (
    input.grandTotalMinor !== grandTotalMinor
    || input.changeMinor !== subtractMoney(amountTenderedMinor, grandTotalMinor)
    || lines.reduce((sum, line) => addMoney(sum, line.lineSubtotalMinor), 0) !== subtotalMinor
  ) throw new MandiriDomainError('data_invalid', 'total receipt tidak konsisten', 'receipt');
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'receipt.schemaVersion'),
    receiptId: id(input.receiptId, 'receipt', 'receipt.receiptId'),
    workspaceId: normalizeWorkspaceScope(input.workspaceId, expectedWorkspaceId, 'receipt.workspaceId'),
    saleId: id(input.saleId, 'sale', 'receipt.saleId'),
    paymentId: id(input.paymentId, 'payment', 'receipt.paymentId'),
    currencyCode: 'IDR',
    subtotalMinor,
    discountMinor,
    grandTotalMinor,
    amountTenderedMinor,
    changeMinor: input.changeMinor,
    paymentMethod: 'cash',
    lineCount: lines.length,
    lines,
    finalizedAtLocal: normalizeIsoTimestamp(input.finalizedAtLocal, 'receipt.finalizedAtLocal'),
  });
}
