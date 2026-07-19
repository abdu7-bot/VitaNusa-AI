import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProductCanEnterNewCart,
  assertUniqueProductSku,
  createProduct,
  createProductId,
  normalizeSku,
  validateProduct,
} from '../../../assets/js/mandiri/pos/domain/product.js';

const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const PRODUCT_A = 'product_55555555-5555-4555-8555-555555555555';
const PRODUCT_B = 'product_66666666-6666-4666-8666-666666666666';
const CATEGORY_ID = 'category_33333333-3333-4333-8333-333333333333';

function validProduct(overrides = {}) {
  return {
    productId: PRODUCT_A,
    workspaceId: WORKSPACE_A,
    name: 'Teh Melati',
    sku: ' teh-001 ',
    categoryId: CATEGORY_ID,
    sellingPriceMinor: 5000,
    purchasePriceMinor: 3000,
    stockTracking: true,
    active: true,
    ...overrides,
  };
}

test('product valid memakai integer rupiah, output immutable, dan input tidak dimutasi', () => {
  const input = validProduct({ name: '  Teh   Melati ' });
  const before = structuredClone(input);
  const product = createProduct(input, { workspaceId: WORKSPACE_A });
  assert.deepEqual(input, before);
  assert.equal(product.name, 'Teh Melati');
  assert.equal(product.sku, 'TEH-001');
  assert.equal(product.sellingPriceMinor, 5000);
  assert.equal(product.purchasePriceMinor, 3000);
  assert.equal(Object.isFrozen(product), true);
  assert.equal(validateProduct(input), true);
});

test('product menolak unknown field, dangerous key, serta nama kosong atau panjang', () => {
  assert.throws(() => createProduct(validProduct({ benefit: 'menyembuhkan' })), { code: 'unknown_field' });
  const dangerous = Object.create(null);
  Object.assign(dangerous, validProduct());
  Object.defineProperty(dangerous, '__proto__', { value: 'unsafe', enumerable: true });
  assert.throws(() => createProduct(dangerous), { code: 'dangerous_key' });
  assert.throws(() => createProduct(validProduct({ name: '' })), { code: 'string_too_short' });
  assert.throws(() => createProduct(validProduct({ name: 'x'.repeat(161) })), { code: 'string_too_long' });
  assert.throws(() => createProduct(validProduct({ name: '<script>alert(1)</script>' })), {
    code: 'plain_text_required',
  });
});

test('SKU opsional dinormalisasi dan unik case-insensitive per workspace', () => {
  assert.equal(normalizeSku('  abc  123 '), 'ABC 123');
  assert.equal(createProduct(validProduct({ sku: null })).sku, null);
  assert.equal(createProduct(validProduct({ sku: undefined })).sku, null);

  const existing = validProduct({ productId: PRODUCT_B, sku: 'TEH-001' });
  assert.throws(() => assertUniqueProductSku(validProduct(), [existing]), { code: 'duplicate_sku' });
  assert.equal(assertUniqueProductSku(validProduct(), [validProduct()]), true);
  const sameSkuOtherWorkspace = validProduct({
    productId: PRODUCT_B,
    workspaceId: WORKSPACE_B,
    sku: 'teh-001',
  });
  assert.equal(assertUniqueProductSku(validProduct(), [sameSkuOtherWorkspace]), true);
});

test('harga jual menolak nol, negatif, desimal, dan unsafe integer', () => {
  assert.throws(() => createProduct(validProduct({ sellingPriceMinor: 0 })), {
    code: 'non_positive_selling_price',
  });
  assert.throws(() => createProduct(validProduct({ sellingPriceMinor: -1 })), {
    code: 'negative_money',
  });
  assert.throws(() => createProduct(validProduct({ sellingPriceMinor: 10.5 })), {
    code: 'unsafe_integer',
  });
  assert.throws(
    () => createProduct(validProduct({ sellingPriceMinor: Number.MAX_SAFE_INTEGER + 1 })),
    { code: 'unsafe_integer' },
  );
});

test('purchase price dan category bersifat opsional', () => {
  const product = createProduct(validProduct({ purchasePriceMinor: null, categoryId: null }));
  assert.equal(product.purchasePriceMinor, null);
  assert.equal(product.categoryId, null);
  const omitted = validProduct();
  delete omitted.purchasePriceMinor;
  delete omitted.categoryId;
  assert.equal(createProduct(omitted).purchasePriceMinor, null);
  assert.equal(createProduct(omitted).categoryId, null);
  assert.throws(() => createProduct(validProduct({ purchasePriceMinor: -1 })), {
    code: 'negative_money',
  });
});

test('active dan stockTracking wajib boolean; inactive ditolak untuk cart baru', () => {
  const inactive = validProduct({ active: false, stockTracking: false });
  assert.equal(createProduct(inactive).active, false);
  assert.equal(createProduct(inactive).stockTracking, false);
  assert.throws(() => assertProductCanEnterNewCart(inactive), { code: 'inactive_product' });
  assert.equal(assertProductCanEnterNewCart(validProduct()).productId, PRODUCT_A);
  assert.throws(() => createProduct(validProduct({ active: 'true' })), { code: 'invalid_boolean' });
  assert.throws(() => createProduct(validProduct({ stockTracking: 1 })), { code: 'invalid_boolean' });
});

test('product menegakkan workspace isolation dan ID stabil', () => {
  assert.throws(
    () => createProduct(validProduct(), { workspaceId: WORKSPACE_B }),
    { code: 'cross_workspace_scope' },
  );
  assert.throws(
    () => assertProductCanEnterNewCart(validProduct(), { workspaceId: WORKSPACE_B }),
    { code: 'cross_workspace_scope' },
  );
  assert.equal(
    createProductId({ randomUUID: () => '77777777-7777-4777-8777-777777777777' }),
    'product_77777777-7777-4777-8777-777777777777',
  );
});
