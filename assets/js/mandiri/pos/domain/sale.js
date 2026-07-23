import { createEntityId, isValidEntityId } from '../../domain/ids.js';
import { addMoney, assertMoney, subtractMoney } from '../../domain/money.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from '../../domain/validation.js';
import { normalizeCartLine } from './cart.js';
import { normalizeWorkspaceScope } from './product-validation.js';

const SALE_FIELDS = Object.freeze([
  'schemaVersion', 'saleId', 'workspaceId', 'cartId', 'cartVersion', 'status',
  'currencyCode', 'discountMinor', 'subtotalMinor', 'grandTotalMinor', 'lineCount',
  'paymentId', 'receiptId', 'operationId', 'actorScope', 'actorRole', 'finalizedAtLocal',
]);
const SALE_LINE_FIELDS = Object.freeze([
  'schemaVersion', 'saleId', 'lineNo', 'productId', 'productNameSnapshot', 'skuSnapshot',
  'quantityScaled', 'quantityScale', 'unitPriceMinor', 'lineDiscountMinor',
  'lineGrossMinor', 'lineSubtotalMinor', 'stockTrackingSnapshot',
]);

function id(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  }
  return value;
}

export function createSaleId(cryptoRef = globalThis.crypto) {
  return createEntityId('sale', cryptoRef);
}

export function normalizeSaleLine(input) {
  assertExactFields(input, SALE_LINE_FIELDS, { path: 'saleLine' });
  const cartShape = normalizeCartLine({
    schemaVersion: input.schemaVersion,
    cartId: id(input.saleId, 'sale', 'saleLine.saleId').replace(/^sale_/, 'cart_'),
    lineNo: input.lineNo,
    productId: input.productId,
    productNameSnapshot: input.productNameSnapshot,
    skuSnapshot: input.skuSnapshot,
    quantityScaled: input.quantityScaled,
    quantityScale: input.quantityScale,
    unitPriceMinor: input.unitPriceMinor,
    lineDiscountMinor: input.lineDiscountMinor,
    lineGrossMinor: input.lineGrossMinor,
    lineSubtotalMinor: input.lineSubtotalMinor,
  });
  if (typeof input.stockTrackingSnapshot !== 'boolean') {
    throw new MandiriDomainError('data_invalid', 'snapshot stockTracking wajib boolean', 'saleLine.stockTrackingSnapshot');
  }
  const { cartId: _cartId, ...line } = cartShape;
  return Object.freeze({ ...line, saleId: input.saleId, stockTrackingSnapshot: input.stockTrackingSnapshot });
}

export function normalizeSale(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, SALE_FIELDS, { path: 'sale' });
  if (input.status !== 'final') throw new MandiriDomainError('data_invalid', 'sale harus final', 'sale.status');
  if (input.currencyCode !== 'IDR') throw new MandiriDomainError('invalid_currency', 'currency hanya IDR');
  if (!['merchant_owner', 'cashier'].includes(input.actorRole)) {
    throw new MandiriDomainError('unknown_workspace_role', 'role tidak valid', 'sale.actorRole');
  }
  const subtotalMinor = assertMoney(input.subtotalMinor);
  const discountMinor = assertMoney(input.discountMinor);
  const grandTotalMinor = subtractMoney(subtotalMinor, discountMinor);
  if (input.grandTotalMinor !== grandTotalMinor) {
    throw new MandiriDomainError('data_invalid', 'total sale tidak konsisten', 'sale.grandTotalMinor');
  }
  if (!Number.isSafeInteger(input.lineCount) || input.lineCount < 1) {
    throw new MandiriDomainError('empty_cart', 'sale wajib memiliki line', 'sale.lineCount');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'sale.schemaVersion'),
    saleId: id(input.saleId, 'sale', 'sale.saleId'),
    workspaceId: normalizeWorkspaceScope(input.workspaceId, expectedWorkspaceId, 'sale.workspaceId'),
    cartId: id(input.cartId, 'cart', 'sale.cartId'),
    cartVersion: normalizePositiveVersion(input.cartVersion, 'sale.cartVersion'),
    status: 'final',
    currencyCode: 'IDR',
    discountMinor,
    subtotalMinor,
    grandTotalMinor,
    lineCount: input.lineCount,
    paymentId: id(input.paymentId, 'payment', 'sale.paymentId'),
    receiptId: id(input.receiptId, 'receipt', 'sale.receiptId'),
    operationId: id(input.operationId, 'op', 'sale.operationId'),
    actorScope: normalizeScope(input.actorScope, 'sale.actorScope'),
    actorRole: input.actorRole,
    finalizedAtLocal: normalizeIsoTimestamp(input.finalizedAtLocal, 'sale.finalizedAtLocal'),
  });
}

export function validateFinalSale(saleInput, lineInputs) {
  const sale = normalizeSale(saleInput);
  if (!Array.isArray(lineInputs)) throw new MandiriDomainError('data_invalid', 'saleLines wajib array');
  const lines = Object.freeze([...lineInputs].sort((a, b) => a.lineNo - b.lineNo).map(normalizeSaleLine));
  const subtotal = lines.reduce((sum, line) => addMoney(sum, line.lineSubtotalMinor), 0);
  if (
    lines.length !== sale.lineCount
    || subtotal !== sale.subtotalMinor
    || new Set(lines.map((line) => line.lineNo)).size !== lines.length
    || lines.some((line) => line.saleId !== sale.saleId)
  ) throw new MandiriDomainError('data_invalid', 'sale dan line tidak konsisten');
  return Object.freeze({ sale, lines });
}
