import { createEntityId } from '../../domain/ids.js';
import { assertMoney } from '../../domain/money.js';
import { MandiriDomainError } from '../../domain/validation.js';
import {
  assertProductExactFields,
  normalizeBoolean,
  normalizeEntityVersions,
  normalizeProductText,
  normalizeWorkspaceEntityId,
  normalizeWorkspaceScope,
} from './product-validation.js';

const PRODUCT_FIELDS = Object.freeze([
  'schemaVersion',
  'version',
  'productId',
  'workspaceId',
  'name',
  'sku',
  'categoryId',
  'sellingPriceMinor',
  'purchasePriceMinor',
  'stockTracking',
  'active',
]);
const REQUIRED_PRODUCT_FIELDS = Object.freeze([
  'productId',
  'workspaceId',
  'name',
  'sellingPriceMinor',
  'stockTracking',
  'active',
]);

export function createProductId(cryptoRef = globalThis.crypto) {
  return createEntityId('product', cryptoRef);
}

export function normalizeSku(value, path = 'product.sku') {
  if (value === undefined || value === null) return null;
  return normalizeProductText(value, { path, maxLength: 80 }).toLocaleUpperCase('en-US');
}

function normalizeOptionalCategoryId(value) {
  if (value === undefined || value === null) return null;
  return normalizeWorkspaceEntityId(value, 'category', 'product.categoryId');
}

function normalizeSellingPrice(value) {
  assertMoney(value);
  if (value === 0) {
    throw new MandiriDomainError(
      'non_positive_selling_price',
      'harga jual harus lebih besar dari nol',
      'product.sellingPriceMinor',
    );
  }
  return value;
}

function normalizePurchasePrice(value) {
  if (value === undefined || value === null) return null;
  return assertMoney(value);
}

export function normalizeProduct(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertProductExactFields(input, PRODUCT_FIELDS, {
    requiredFields: REQUIRED_PRODUCT_FIELDS,
    path: 'product',
  });
  const versions = normalizeEntityVersions(input, 'product');
  return Object.freeze({
    schemaVersion: versions.schemaVersion,
    version: versions.version,
    productId: normalizeWorkspaceEntityId(input.productId, 'product', 'product.productId'),
    workspaceId: normalizeWorkspaceScope(
      input.workspaceId,
      expectedWorkspaceId,
      'product.workspaceId',
    ),
    name: normalizeProductText(input.name, { path: 'product.name', maxLength: 160 }),
    sku: normalizeSku(input.sku),
    categoryId: normalizeOptionalCategoryId(input.categoryId),
    sellingPriceMinor: normalizeSellingPrice(input.sellingPriceMinor),
    purchasePriceMinor: normalizePurchasePrice(input.purchasePriceMinor),
    stockTracking: normalizeBoolean(input.stockTracking, 'product.stockTracking'),
    active: normalizeBoolean(input.active, 'product.active'),
  });
}

export function validateProduct(input, expectedScope) {
  normalizeProduct(input, expectedScope);
  return true;
}

export function createProduct(input, expectedScope) {
  return normalizeProduct(input, expectedScope);
}

export function assertUniqueProductSku(candidateInput, existingInputs = []) {
  if (!Array.isArray(existingInputs) || Object.getPrototypeOf(existingInputs) !== Array.prototype) {
    throw new MandiriDomainError('invalid_product_collection', 'products harus berupa array biasa', 'products');
  }
  const candidate = normalizeProduct(candidateInput);
  if (candidate.sku === null) return true;

  for (const existingInput of existingInputs) {
    const existing = normalizeProduct(existingInput);
    if (
      existing.workspaceId === candidate.workspaceId
      && existing.productId !== candidate.productId
      && existing.sku === candidate.sku
    ) {
      throw new MandiriDomainError(
        'duplicate_sku',
        'SKU sudah digunakan pada workspace ini',
        'product.sku',
      );
    }
  }
  return true;
}

export function assertProductCanEnterNewCart(input, expectedScope) {
  const product = normalizeProduct(input, expectedScope);
  if (!product.active) {
    throw new MandiriDomainError(
      'inactive_product',
      'produk inactive tidak dapat masuk cart baru',
      'product.active',
    );
  }
  return product;
}
