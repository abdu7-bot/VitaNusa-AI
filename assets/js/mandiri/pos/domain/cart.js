import { createEntityId, isValidEntityId } from '../../domain/ids.js';
import {
  addMoney,
  assertMoney,
  divideAndRoundMoney,
  multiplyMoney,
  subtractMoney,
} from '../../domain/money.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeTrimmedString,
} from '../../domain/validation.js';
import { normalizeProductText, normalizeWorkspaceEntityId } from './product-validation.js';
import { normalizeSku } from './product.js';

const CART_DRAFT_STATUSES = Object.freeze(['draft', 'cancelled', 'finalized']);

const CART_DRAFT_FIELDS = Object.freeze([
  'schemaVersion',
  'version',
  'cartId',
  'workspaceId',
  'status',
  'currencyCode',
  'discountMinor',
  'subtotalMinor',
  'grandTotalMinor',
  'lineCount',
  'createdAtLocal',
  'updatedAtLocal',
]);

const CART_LINE_FIELDS = Object.freeze([
  'schemaVersion',
  'cartId',
  'lineNo',
  'productId',
  'productNameSnapshot',
  'skuSnapshot',
  'quantityScaled',
  'quantityScale',
  'unitPriceMinor',
  'lineDiscountMinor',
  'lineGrossMinor',
  'lineSubtotalMinor',
]);

function assertCartId(value) {
  if (!isValidEntityId(value, 'cart')) {
    throw new MandiriDomainError('invalid_entity_id', 'cartId tidak valid', 'cart.cartId');
  }
  return value;
}

function assertSafeCount(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MandiriDomainError('invalid_quantity', 'nilai harus safe integer non-negatif', path);
  }
  return value;
}

function assertPositiveCount(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MandiriDomainError('invalid_quantity', 'nilai harus safe integer positif', path);
  }
  return value;
}

function normalizeStatus(value) {
  if (!CART_DRAFT_STATUSES.includes(value)) {
    throw new MandiriDomainError('unknown_cart_status', 'status cart tidak dikenal', 'cart.status');
  }
  return value;
}

function normalizeCurrencyCode(value) {
  if (typeof value !== 'string' || value !== 'IDR') {
    throw new MandiriDomainError('invalid_currency', 'currency hanya mendukung IDR', 'cart.currencyCode');
  }
  return value;
}

function normalizeSnapshotText(value, path, maxLength) {
  return normalizeProductText(value, { path, maxLength });
}

function normalizeQuantityScale(value) {
  return assertPositiveCount(value, 'cartLine.quantityScale');
}

function normalizeLineSubtotal(lineGrossMinor, lineDiscountMinor) {
  if (lineDiscountMinor > lineGrossMinor) {
    throw new MandiriDomainError(
      'discount_exceeds_subtotal',
      'diskon line tidak boleh melebihi subtotal line',
      'cartLine.lineDiscountMinor',
    );
  }
  return subtractMoney(lineGrossMinor, lineDiscountMinor);
}

export function createCartId(cryptoRef = globalThis.crypto) {
  return createEntityId('cart', cryptoRef);
}

export function normalizeCartLine(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, CART_LINE_FIELDS, {
    requiredFields: CART_LINE_FIELDS,
    path: 'cartLine',
  });
  const quantityScale = normalizeQuantityScale(input.quantityScale);
  const quantityScaled = assertPositiveCount(input.quantityScaled, 'cartLine.quantityScaled');
  const unitPriceMinor = assertMoney(input.unitPriceMinor);
  const lineDiscountMinor = assertMoney(input.lineDiscountMinor);
  const lineGrossMinor = multiplyMoney(unitPriceMinor, quantityScaled);
  if (lineGrossMinor % quantityScale !== 0) {
    throw new MandiriDomainError('unsafe_integer', 'subtotal line tidak presisi', 'cartLine.lineGrossMinor');
  }
  const exactGrossMinor = divideAndRoundMoney(lineGrossMinor, quantityScale, 'floor');
  const lineSubtotalMinor = normalizeLineSubtotal(exactGrossMinor, lineDiscountMinor);
  if (input.lineGrossMinor !== exactGrossMinor || input.lineSubtotalMinor !== lineSubtotalMinor) {
    throw new MandiriDomainError('data_invalid', 'snapshot line tidak konsisten', 'cartLine');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'cartLine.schemaVersion'),
    cartId: assertCartId(input.cartId),
    lineNo: assertPositiveCount(input.lineNo, 'cartLine.lineNo'),
    productId: normalizeWorkspaceEntityId(input.productId, 'product', 'cartLine.productId'),
    productNameSnapshot: normalizeSnapshotText(input.productNameSnapshot, 'cartLine.productNameSnapshot', 160),
    skuSnapshot: input.skuSnapshot === null ? null : normalizeSku(input.skuSnapshot, 'cartLine.skuSnapshot'),
    quantityScaled,
    quantityScale,
    unitPriceMinor,
    lineDiscountMinor,
    lineGrossMinor: exactGrossMinor,
    lineSubtotalMinor,
  });
}

export function normalizeCartDraft(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, CART_DRAFT_FIELDS, {
    requiredFields: CART_DRAFT_FIELDS,
    path: 'cartDraft',
  });
  const subtotalMinor = assertMoney(input.subtotalMinor);
  const discountMinor = assertMoney(input.discountMinor);
  if (discountMinor > subtotalMinor) {
    throw new MandiriDomainError('discount_exceeds_subtotal', 'diskon cart melebihi subtotal', 'cartDraft.discountMinor');
  }
  const grandTotalMinor = subtractMoney(subtotalMinor, discountMinor);
  if (input.grandTotalMinor !== grandTotalMinor) {
    throw new MandiriDomainError('data_invalid', 'snapshot cart tidak konsisten', 'cartDraft.grandTotalMinor');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'cartDraft.schemaVersion'),
    version: normalizePositiveVersion(input.version, 'cartDraft.version'),
    cartId: assertCartId(input.cartId),
    workspaceId: normalizeWorkspaceEntityId(input.workspaceId, 'workspace', 'cartDraft.workspaceId'),
    status: normalizeStatus(input.status),
    currencyCode: normalizeCurrencyCode(input.currencyCode),
    discountMinor,
    subtotalMinor,
    grandTotalMinor,
    lineCount: assertSafeCount(input.lineCount, 'cartDraft.lineCount'),
    createdAtLocal: normalizeIsoTimestamp(input.createdAtLocal, 'cartDraft.createdAtLocal'),
    updatedAtLocal: normalizeIsoTimestamp(input.updatedAtLocal, 'cartDraft.updatedAtLocal'),
  });
}

export function previewCartDraft(cartDraft, cartLines = []) {
  const { lines: _lines, ...draftInput } = cartDraft ?? {};
  const draft = normalizeCartDraft(draftInput);
  if (!Array.isArray(cartLines)) {
    throw new MandiriDomainError('data_invalid', 'line cart harus array', 'cartLines');
  }
  const lines = Object.freeze(
    [...cartLines]
      .sort((left, right) => left.lineNo - right.lineNo)
      .map((line) => normalizeCartLine(line, { workspaceId: draft.workspaceId })),
  );
  if (
    new Set(lines.map((line) => line.lineNo)).size !== lines.length
    || lines.some((line) => line.cartId !== draft.cartId)
  ) {
    throw new MandiriDomainError('data_invalid', 'line cart tidak konsisten', 'cartLines');
  }
  const subtotalMinor = lines.reduce((total, line) => addMoney(total, line.lineSubtotalMinor), 0);
  const grandTotalMinor = subtractMoney(subtotalMinor, draft.discountMinor);
  if (grandTotalMinor < 0) {
    throw new MandiriDomainError(
      'discount_exceeds_subtotal',
      'diskon cart tidak boleh melebihi subtotal cart',
      'cartDraft.discountMinor',
    );
  }
  if (
    draft.lineCount !== lines.length
    || draft.subtotalMinor !== subtotalMinor
    || draft.grandTotalMinor !== grandTotalMinor
  ) {
    throw new MandiriDomainError('data_invalid', 'total cart tidak konsisten', 'cartDraft');
  }
  return Object.freeze({
    cartId: draft.cartId,
    workspaceId: draft.workspaceId,
    version: draft.version,
    status: draft.status,
    currencyCode: draft.currencyCode,
    discountMinor: draft.discountMinor,
    subtotalMinor,
    grandTotalMinor,
    lineCount: lines.length,
    lines,
  });
}
