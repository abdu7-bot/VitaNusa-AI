import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  createInventoryManagementController,
  createInventoryManagementView,
  filterInventoryItems,
  normalizeMovementForm,
} from '../../../assets/js/mandiri/pos/ui/inventory-management-page.js';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createInventoryService } from '../../../assets/js/mandiri/pos/services/inventory-service.js';
import { seedMemoryWorkspace, ACCOUNT_A, ACCOUNT_B, USER_A, WORKSPACE_A } from '../export/fixtures.mjs';
import { FakeDocument, FakeElement, collectText } from '../learning-reader/fixtures.mjs';

const rootUrl = new URL('../../../', import.meta.url);
const html = await readFile(new URL('mandiri/kasir/inventory.html', rootUrl), 'utf8');
const css = await readFile(new URL('assets/css/nusakasir-inventory.css', rootUrl), 'utf8');
const source = await readFile(new URL('assets/js/mandiri/pos/ui/inventory-management-page.js', rootUrl), 'utf8');
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
  const controller = createInventoryManagementController({
    contract: { enabled: true },
    view,
    subscribeAuth(listener) { authListener = listener; return () => {}; },
    createScopes: async () => ({ accountScope, userScope }),
    openDatabase: async () => { openCalls += 1; return { close() {} }; },
    createContext: () => fixture.memory.repositoryContext,
    createService: ({ repositoryContext }) => createInventoryService({
      repositoryContext,
      digestFactory,
    }),
    cryptoRef: webcrypto,
    now: () => '2026-07-21T04:00:00.000Z',
  });
  authListener({ isAuthenticated: true, user: { uid: 'fixture' } });
  await settle();
  return { ...fixture, controller, view, openCalls };
}

async function seedTrackedProduct(fixture, accountScope = ACCOUNT_A) {
  const PRODUCT_ID = 'product_33333333-3333-4333-8333-333333333333';
  await fixture.memory.productRepository.create(accountScope, WORKSPACE_A, {
    schemaVersion: 1,
    version: 1,
    productId: PRODUCT_ID,
    workspaceId: WORKSPACE_A,
    name: 'Madu Tualang',
    sku: 'MDT-01',
    categoryId: null,
    sellingPriceMinor: 50000,
    purchasePriceMinor: null,
    stockTracking: true,
    active: true,
  });
  return PRODUCT_ID;
}

test('feature flag off tidak subscribe auth atau bind repository', () => {
  let authCalls = 0;
  let openCalls = 0;
  const view = fakeView();
  const controller = createInventoryManagementController({
    contract: { enabled: false }, view,
    subscribeAuth() { authCalls += 1; },
    openDatabase() { openCalls += 1; },
  });
  assert.equal(controller.getState().state, 'disabled');
  assert.equal(authCalls, 0);
  assert.equal(openCalls, 0);
  assert.equal(view.callbacks, null);
});

test('halaman inventori menyediakan navigasi aman ke produk dan kembali ke Mandiri', () => {
  assert.match(html, /aria-label="Navigasi NusaKasir"/u);
  assert.match(html, /href="\.\/products\.html"/u);
  assert.match(html, /href="\.\/inventory\.html" aria-current="page"/u);
  assert.match(html, /href="\.\.\/index\.html"/u);
});

test('signed-out saat user tidak terautentikasi', async () => {
  const fixture = await seedMemoryWorkspace();
  const view = fakeView();
  let authListener;
  const controller = createInventoryManagementController({
    contract: { enabled: true }, view,
    subscribeAuth(listener) { authListener = listener; return () => {}; },
    createScopes: async () => ({ accountScope: ACCOUNT_A, userScope: USER_A }),
    openDatabase: async () => ({ close() {} }),
    createContext: () => fixture.memory.repositoryContext,
    createService: () => createInventoryService({ repositoryContext: fixture.memory.repositoryContext, digestFactory }),
    cryptoRef: webcrypto,
  });
  authListener({ isAuthenticated: false, user: null });
  await settle();
  assert.equal(controller.getState().state, 'signed-out');
  controller.destroy();
});

test('state empty saat belum ada produk ber-stockTracking', async () => {
  const value = await harness();
  assert.equal(value.controller.getState().state, 'empty');
  assert.equal(value.controller.getState().items.length, 0);
  value.controller.destroy();
});

test('mencatat pergerakan stok dan memperbarui state', async () => {
  const value = await harness();
  const productId = await seedTrackedProduct(value);
  await value.controller.reload();
  assert.equal(value.controller.getState().state, 'ready');
  assert.equal(value.controller.getState().items.length, 1);

  await value.controller.selectProduct(productId);
  assert.equal(value.controller.getState().selectedProductId, productId);

  await value.controller.recordMovement(productId, {
    movementType: 'opening_stock',
    quantity: '10',
    reason: '',
  });
  const state = value.controller.getState();
  assert.equal(state.items[0].quantityOnHand, 10);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].movementType, 'opening_stock');
  assert.equal(state.movements[0].quantityDelta, 10);
  value.controller.destroy();
});

test('adjustment wajib reason; quantity nol dan tidak-integer ditolak', () => {
  const base = { workspaceId: WORKSPACE_A, productId: 'product_p', actorScope: 'user_a', actorRole: 'merchant_owner', cryptoRef: webcrypto };
  assert.throws(() => normalizeMovementForm({ movementType: 'adjustment', quantity: '5', reason: '' }, base));
  for (const quantity of ['0', '1.5', 'abc', '']) {
    assert.throws(() => normalizeMovementForm({ movementType: 'opening_stock', quantity, reason: '' }, base));
  }
  assert.throws(() => normalizeMovementForm({ movementType: 'sale', quantity: '5', reason: '' }, base));
});

test('adjustment negatif valid saat reason tersedia', () => {
  const base = { workspaceId: WORKSPACE_A, productId: 'product_p', actorScope: 'user_a', actorRole: 'merchant_owner', cryptoRef: webcrypto };
  const result = normalizeMovementForm({ movementType: 'adjustment', quantity: '-3', reason: 'Rusak' }, base);
  assert.equal(result.quantityDelta, -3);
  assert.equal(result.reason, 'Rusak');
});

test('account lain tidak dapat mengakses workspace', async () => {
  const denied = await harness({ accountScope: ACCOUNT_B, userScope: `user:${'b'.repeat(64)}` });
  assert.equal(denied.controller.getState().state, 'error');
  denied.controller.destroy();
});

test('filterInventoryItems menyaring berdasarkan query, kategori, status, dan saldo', () => {
  const items = [
    { name: 'Madu', sku: 'MDU-1', categoryId: 'cat-a', active: true, quantityOnHand: 10 },
    { name: 'Kurma', sku: null, categoryId: 'cat-b', active: false, quantityOnHand: 0 },
    { name: 'Propolis', sku: 'PRP-2', categoryId: 'cat-a', active: true, quantityOnHand: -5 },
  ];
  assert.equal(filterInventoryItems(items, { query: 'mdu' }).length, 1);
  assert.equal(filterInventoryItems(items, { categoryId: 'cat-b' }).length, 1);
  assert.equal(filterInventoryItems(items, { active: 'inactive' })[0].name, 'Kurma');
  assert.equal(filterInventoryItems(items, { balance: 'zero' }).length, 1);
  assert.equal(filterInventoryItems(items, { balance: 'negative' }).length, 1);
  assert.equal(filterInventoryItems(items, { balance: 'positive' }).length, 1);
});

test('openModal dan closeModal mengubah state modalOpen', async () => {
  const value = await harness();
  assert.equal(value.controller.getState().modalOpen, false);
  value.controller.openModal();
  assert.equal(value.controller.getState().modalOpen, true);
  value.controller.closeModal();
  assert.equal(value.controller.getState().modalOpen, false);
  value.controller.destroy();
});

test('render XSS corpus sebagai textContent tanpa HTML aktif', () => {
  const documentRef = new FakeDocument();
  const status = new FakeElement('div');
  const listContainer = new FakeElement('div');
  const detailContainer = new FakeElement('div');
  const root = {
    ownerDocument: documentRef,
    dataset: {},
    setAttribute() {},
    querySelector(selector) {
      return new Map([
        ['.inventory-status', status],
        ['.inventory-list-container', listContainer],
        ['.inventory-detail-container', detailContainer],
        ['#movement-modal-overlay', null],
        ['#movement-form', null],
        ['#search-input', null],
        ['#category-filter', null],
        ['#status-filter', null],
        ['#balance-filter', null],
      ]).get(selector) || null;
    },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  const corpus = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  createInventoryManagementView(root, documentRef).render({
    state: 'ready',
    message: corpus,
    items: [{ productId: 'product_1', name: corpus, sku: corpus, categoryId: null, categoryName: null, active: true, quantityOnHand: 5, balanceVersion: 1 }],
    visibleItems: [{ productId: 'product_1', name: corpus, sku: corpus, categoryId: null, categoryName: null, active: true, quantityOnHand: 5, balanceVersion: 1 }],
    categories: [],
    movements: [],
    filters: { query: '', categoryId: 'all', active: 'all', balance: 'all' },
    canWrite: false,
    submitting: false,
    modalOpen: false,
    selectedProductId: null,
    focusStatus: false,
  });
  assert.match(collectText(listContainer), /<img/u);
  assert.equal(source.includes('innerHTML'), false);
});

test('markup dan CSS memenuhi a11y, keyboard, motion, forced colors, dan mobile', () => {
  assert.match(html, /aria-live="polite"/u);
  assert.match(html, /type="search"/u);
  assert.match(html, /<label/u);
  assert.match(html, /Produk dan Kategori/u);
  assert.match(html, /Stok dan Riwayat/u);
  assert.match(css, /\.inventory-nav/u);
  assert.match(css, /\.inventory-nav-link\[aria-current="page"\]/u);
  assert.match(css, /min-width:\s*320px/u);
  assert.match(css, /:focus-visible/u);
  assert.match(css, /prefers-reduced-motion/u);
  assert.match(css, /forced-colors: active/u);
  assert.match(css, /max-width: 680px/u);
});

test('UI tidak menyediakan hard delete atau mengekspos innerHTML', () => {
  assert.doesNotMatch(source, /\.delete\s*\(|hardDelete|innerHTML/u);
  assert.doesNotMatch(html, /Hapus stok|Hapus produk/u);
});
