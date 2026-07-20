import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  createProductManagementController,
  createProductManagementView,
  filterProductRecords,
  normalizeProductForm,
} from '../../../assets/js/mandiri/pos/ui/product-management-page.js';
import { createProductPersistenceService } from '../../../assets/js/mandiri/pos/services/product-persistence-service.js';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { seedMemoryWorkspace, ACCOUNT_A, ACCOUNT_B, USER_A, WORKSPACE_A } from '../export/fixtures.mjs';
import { FakeDocument, FakeElement, collectText } from '../learning-reader/fixtures.mjs';

const rootUrl = new URL('../../../', import.meta.url);
const html = await readFile(new URL('mandiri/kasir/products.html', rootUrl), 'utf8');
const css = await readFile(new URL('assets/css/nusakasir-products.css', rootUrl), 'utf8');
const source = await readFile(new URL('assets/js/mandiri/pos/ui/product-management-page.js', rootUrl), 'utf8');
const digestFactory = (value) => createPayloadDigest(value, webcrypto);

function fakeView() {
  const models = [];
  let callbacks = null;
  return {
    models,
    get callbacks() { return callbacks; },
    bind(value) { callbacks = value; },
    render(model) { models.push(model); },
    destroy() {},
  };
}

async function settle() {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function harness({ accountScope = ACCOUNT_A, userScope = USER_A } = {}) {
  const fixture = await seedMemoryWorkspace();
  const view = fakeView();
  let authListener;
  let openCalls = 0;
  const controller = createProductManagementController({
    contract: { enabled: true },
    view,
    subscribeAuth(listener) { authListener = listener; return () => {}; },
    createScopes: async () => ({ accountScope, userScope }),
    openDatabase: async () => { openCalls += 1; return { close() {} }; },
    createContext: () => fixture.memory.repositoryContext,
    createPersistence: ({ repositoryContext }) => createProductPersistenceService({
      repositoryContext,
      digestFactory,
    }),
    cryptoRef: webcrypto,
    now: () => '2026-07-20T02:00:00.000Z',
  });
  authListener({ isAuthenticated: true, user: { uid: 'fixture' } });
  await settle();
  return { ...fixture, controller, view, openCalls };
}

const categoryInput = { name: 'Minuman', active: true };
const productInput = {
  name: 'Teh', sku: '', categoryId: 'none', sellingPrice: 'Rp15.000',
  purchasePrice: '', stockTracking: false, active: true,
};

test('feature flag off tidak subscribe auth, membuka IndexedDB, atau bind repository', () => {
  let authCalls = 0;
  let openCalls = 0;
  const view = fakeView();
  const controller = createProductManagementController({
    contract: { enabled: false }, view,
    subscribeAuth() { authCalls += 1; },
    openDatabase() { openCalls += 1; },
  });
  assert.equal(controller.getState().state, 'disabled');
  assert.equal(authCalls, 0);
  assert.equal(openCalls, 0);
  assert.equal(view.callbacks, null);
});

test('owner membuat dan mengedit kategori serta produk dengan harga integer rupiah', async () => {
  const value = await harness();
  assert.equal(value.controller.getState().state, 'empty');
  await value.controller.submit('category', categoryInput);
  const category = value.controller.getState().categories[0];
  await value.controller.submit('product', { ...productInput, categoryId: category.categoryId });
  let product = value.controller.getState().products[0];
  assert.equal(product.sellingPriceMinor, 15000);
  assert.equal(product.purchasePriceMinor, null);
  assert.equal(product.sku, null);
  value.controller.edit('category', category.categoryId);
  await value.controller.submit('category', { name: 'Minuman Hangat', active: false });
  value.controller.edit('product', product.productId);
  await value.controller.submit('product', {
    ...productInput, name: 'Teh Baru', sku: ' teh-1 ', sellingPrice: '20000', active: false,
  });
  product = value.controller.getState().products[0];
  assert.equal(product.name, 'Teh Baru');
  assert.equal(product.sku, 'TEH-1');
  assert.equal(product.active, false);
  assert.equal(value.controller.getState().categories[0].active, false);
});

test('SKU duplicate case-insensitive aman dan category reference invalid ditolak', async () => {
  const value = await harness();
  await value.controller.submit('product', { ...productInput, sku: 'ABC' });
  await assert.rejects(value.controller.submit('product', { ...productInput, name: 'Dua', sku: 'abc' }), {
    code: 'duplicate_sku',
  });
  assert.match(value.controller.getState().message, /SKU sudah digunakan/u);
  await assert.rejects(value.controller.submit('product', {
    ...productInput,
    name: 'Referensi',
    categoryId: 'category_99999999-9999-4999-8999-999999999999',
  }), { code: 'invalid_reference' });
});

test('optimistic conflict memuat ulang data dan double submit memakai satu operasi', async () => {
  const value = await harness();
  const firstPromise = value.controller.submit('category', categoryInput);
  const secondPromise = value.controller.submit('category', categoryInput);
  assert.equal(secondPromise, firstPromise);
  await firstPromise;
  const stale = value.controller.getState().categories[0];
  value.controller.edit('category', stale.categoryId);
  await value.memory.categoryRepository.update(
    ACCOUNT_A, WORKSPACE_A, { ...stale, version: 2, name: 'Perubahan tab lain' }, 1,
  );
  await assert.rejects(value.controller.submit('category', { name: 'Edit stale', active: true }), {
    code: 'version_conflict',
  });
  assert.match(value.controller.getState().message, /Data telah berubah/u);
  assert.equal(value.controller.getState().categories[0].name, 'Perubahan tab lain');
});

test('account lain tidak dapat melihat workspace dan reload browser mempertahankan data', async () => {
  const denied = await harness({ accountScope: ACCOUNT_B, userScope: `user:${'b'.repeat(64)}` });
  assert.equal(denied.controller.getState().state, 'error');
  assert.deepEqual(denied.controller.getState().products, []);

  const value = await harness();
  await value.controller.submit('product', productInput);
  value.controller.destroy();
  const view = fakeView();
  let listener;
  const second = createProductManagementController({
    contract: { enabled: true }, view,
    subscribeAuth(callback) { listener = callback; return () => {}; },
    createScopes: async () => ({ accountScope: ACCOUNT_A, userScope: USER_A }),
    openDatabase: async () => ({ close() {} }),
    createContext: () => value.memory.repositoryContext,
    createPersistence: ({ repositoryContext }) => createProductPersistenceService({ repositoryContext, digestFactory }),
    cryptoRef: webcrypto,
  });
  listener({ isAuthenticated: true, user: { uid: 'fixture' } });
  await settle();
  assert.equal(second.getState().products.length, 1);
});

test('filter lokal mencari nama/SKU serta memfilter kategori dan status', () => {
  const values = [
    { name: 'Teh', sku: 'A-1', categoryId: 'cat-a', active: true },
    { name: 'Kopi', sku: null, categoryId: 'cat-b', active: false },
  ];
  assert.equal(filterProductRecords(values, { query: 'a-1' }).length, 1);
  assert.equal(filterProductRecords(values, { categoryId: 'cat-b' }).length, 1);
  assert.equal(filterProductRecords(values, { active: 'inactive' })[0].name, 'Kopi');
});

test('input harga menolak desimal dan unsafe integer', () => {
  for (const sellingPrice of ['1,5', '9007199254740992']) {
    assert.throws(() => normalizeProductForm({ ...productInput, sellingPrice }, {
      workspaceId: WORKSPACE_A, cryptoRef: webcrypto,
    }));
  }
});

test('render XSS corpus sebagai textContent tanpa HTML aktif', () => {
  const documentRef = new FakeDocument();
  const status = new FakeElement('p');
  const categories = new FakeElement('ul');
  const products = new FakeElement('ul');
  const root = {
    ownerDocument: documentRef,
    dataset: {},
    setAttribute() {},
    querySelector(selector) {
      return new Map([
        ['[data-pos-status]', status],
        ['[data-pos-category-list]', categories],
        ['[data-pos-product-list]', products],
      ]).get(selector) || null;
    },
    querySelectorAll() { return []; },
  };
  const corpus = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  createProductManagementView(root, documentRef).render({
    state: 'ready', message: 'Siap', categories: [{ categoryId: 'category_1', name: corpus, active: true }],
    products: [{ productId: 'product_1', name: corpus, sku: null, categoryId: null, sellingPriceMinor: 1, active: false }],
    visibleProducts: [{ productId: 'product_1', name: corpus, sku: null, categoryId: null, sellingPriceMinor: 1, active: false }],
    filters: { categoryId: 'all' }, canWrite: false, submitting: false,
  });
  assert.match(collectText(categories), /<script>/u);
  assert.match(collectText(products), /<img/u);
  assert.equal(source.includes('innerHTML'), false);
});

test('markup dan CSS memenuhi loading, empty/error status, keyboard, motion, forced colors, dan mobile', () => {
  assert.match(html, /aria-live="polite"/u);
  assert.match(html, /tabindex="-1"/u);
  assert.match(html, /data-pos-loading/u);
  assert.match(html, /type="search"/u);
  assert.match(html, /<label/u);
  assert.match(html, /viewport-fit=cover/u);
  assert.match(css, /:focus-visible/u);
  assert.match(css, /prefers-reduced-motion/u);
  assert.match(css, /forced-colors: active/u);
  assert.match(css, /max-width: 680px/u);
});

test('UI tidak menyediakan perubahan schema atau hard delete', async () => {
  const schema = await readFile(new URL('assets/js/mandiri/storage/schema.js', rootUrl), 'utf8');
  assert.match(schema, /MANDIRI_DATABASE_VERSION = 4/u);
  assert.doesNotMatch(source, /\.delete\s*\(|hardDelete|listAll|getAll/u);
  assert.doesNotMatch(html, /Hapus produk|Hapus kategori/u);
});
