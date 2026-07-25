import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  CASH_PAGE_STATES,
  createCashManagementController,
  normalizeCashInput,
} from '../../../assets/js/mandiri/pos/ui/cash-management-page.js';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createCashSessionService } from '../../../assets/js/mandiri/pos/services/cash-session-service.js';
import { seedMemoryWorkspace, ACCOUNT_A, USER_A, WORKSPACE_A } from '../export/fixtures.mjs';

const rootUrl = new URL('../../../', import.meta.url);
const html = await readFile(new URL('mandiri/kasir/cash.html', rootUrl), 'utf8');
const css = await readFile(new URL('assets/css/nusakasir-cash.css', rootUrl), 'utf8');
const source = await readFile(new URL('assets/js/mandiri/pos/ui/cash-management-page.js', rootUrl), 'utf8');
const productHtml = await readFile(new URL('mandiri/kasir/products.html', rootUrl), 'utf8');
const inventoryHtml = await readFile(new URL('mandiri/kasir/inventory.html', rootUrl), 'utf8');
const viteConfig = await readFile(new URL('vite.config.js', rootUrl), 'utf8');
const digestFactory = (value) => createPayloadDigest(value, webcrypto);

function fakeView() {
  let callbacks = null;
  return {
    get callbacks() { return callbacks; },
    bind(value) { callbacks = value; },
    render() {},
    destroy() {},
  };
}

async function settle() {
  for (let index = 0; index < 7; index += 1) await new Promise((resolve) => setImmediate(resolve));
}

async function harness() {
  const fixture = await seedMemoryWorkspace();
  const view = fakeView();
  let authListener;
  let closeCalls = 0;
  const controller = createCashManagementController({
    contract: { enabled: true },
    view,
    subscribeAuth(listener) { authListener = listener; return () => {}; },
    createScopes: async () => ({ accountScope: ACCOUNT_A, userScope: USER_A }),
    openDatabase: async () => ({ close() { closeCalls += 1; } }),
    createContext: () => fixture.memory.repositoryContext,
    createService: ({ repositoryContext }) => createCashSessionService({
      repositoryContext, digestFactory,
    }),
    now: () => '2026-07-25T04:00:00.000Z',
    cryptoRef: webcrypto,
  });
  authListener({ isAuthenticated: true, user: { uid: 'fixture' } });
  await settle();
  return { ...fixture, controller, view, authListener, get closeCalls() { return closeCalls; } };
}

test('state eksplisit PR 9 tersedia', () => {
  assert.deepEqual(CASH_PAGE_STATES, [
    'disabled', 'auth-loading', 'signed-out', 'loading', 'no-open-session',
    'open-session', 'closed-session', 'permission-denied', 'submitting',
    'version-conflict', 'error',
  ]);
});

test('feature flag off tidak subscribe auth, membuka database, atau bind callback', () => {
  let authCalls = 0;
  let openCalls = 0;
  const view = fakeView();
  const controller = createCashManagementController({
    contract: { enabled: false },
    view,
    subscribeAuth() { authCalls += 1; },
    openDatabase() { openCalls += 1; },
  });
  assert.equal(controller.getState().state, 'disabled');
  assert.equal(authCalls, 0);
  assert.equal(openCalls, 0);
  assert.equal(view.callbacks, null);
});

test('owner membuka sesi, mencatat expense, dan menutup sesi dari data reload', async () => {
  const value = await harness();
  assert.equal(value.controller.getState().state, 'no-open-session');
  await value.controller.submit('open', { openingCash: 'Rp100.000' });
  assert.equal(value.controller.getState().state, 'open-session');
  assert.equal(value.controller.getState().session.openingCashMinor, 100000);
  await value.controller.submit('expense', {
    category: 'operational', amount: '25.000', note: 'Air minum',
  });
  assert.equal(value.controller.getState().expenses.length, 1);
  assert.equal(value.controller.getState().summary.expenseOutMinor, 25000);
  assert.equal(value.controller.getState().summary.expectedCashMinor, 75000);
  await value.controller.submit('close', { countedCash: '74000' });
  const state = value.controller.getState();
  assert.equal(state.state, 'closed-session');
  assert.equal(state.session, null);
  assert.equal(state.lastClosedSession.closingSummary.differenceMinor, -1000);
});

test('double submit memakai promise dan operasi yang sama', async () => {
  const value = await harness();
  const first = value.controller.submit('open', { openingCash: '0' });
  const second = value.controller.submit('open', { openingCash: '0' });
  assert.equal(first, second);
  await first;
  const sessions = await value.memory.cashSessionRepository.listByWorkspace(ACCOUNT_A, WORKSPACE_A);
  assert.equal(sessions.length, 1);
});

test('cashier dapat membuka sesi tetapi tidak mendapat permission expense atau close', async () => {
  const fixture = await seedMemoryWorkspace();
  const owner = await fixture.memory.membershipRepository.getByUserScope(ACCOUNT_A, WORKSPACE_A, USER_A);
  const cashier = { ...owner, role: 'cashier' };
  let authListener;
  const controller = createCashManagementController({
    contract: { enabled: true },
    view: fakeView(),
    subscribeAuth(listener) { authListener = listener; return () => {}; },
    createScopes: async () => ({ accountScope: ACCOUNT_A, userScope: USER_A }),
    openDatabase: async () => ({ close() {} }),
    createContext: () => ({
      run(storeNames, mode, callback) {
        if (storeNames.includes('workspaces')) {
          return callback({
            workspaceRepository: { listByStatus: async () => [{ workspaceId: WORKSPACE_A }] },
            membershipRepository: { getByUserScope: async () => cashier },
          });
        }
        return callback({
          cashSessionRepository: { listByWorkspace: async () => [] },
        });
      },
    }),
    createService: () => ({ open: async () => {}, recordExpense: async () => {}, close: async () => {} }),
    cryptoRef: webcrypto,
  });
  authListener({ isAuthenticated: true, user: { uid: 'fixture' } });
  await settle();
  assert.equal(controller.getState().canOpen, true);
  assert.equal(controller.getState().canExpense, false);
  assert.equal(controller.getState().canClose, false);
  await assert.rejects(controller.submit('expense', {}), { code: 'permission_denied' });
});

test('logout menutup koneksi, membuang data lama, dan destroy aman', async () => {
  const value = await harness();
  await value.controller.submit('open', { openingCash: '1000' });
  value.authListener({ isAuthenticated: false, user: null });
  await settle();
  assert.equal(value.controller.getState().state, 'signed-out');
  assert.equal(value.controller.getState().session, null);
  assert.equal(value.closeCalls, 1);
  value.controller.destroy();
});

test('normalisasi uang menolak kosong, negatif, pecahan, exponent, ambigu, dan unsafe', () => {
  for (const value of ['', '-1', '1.5', '1e3', '1,000', 'NaN', 'Infinity', '9007199254740992']) {
    assert.throws(() => normalizeCashInput(value));
  }
  assert.equal(normalizeCashInput('Rp15.000'), 15000);
  assert.throws(() => normalizeCashInput('0', { positive: true }));
});

test('markup, navigasi, keamanan render, dan aksesibilitas memenuhi kontrak', () => {
  assert.match(html, /<title>Kas dan Pengeluaran — NusaKasir<\/title>/u);
  assert.match(html, /href="\.\/cash\.html" aria-current="page"/u);
  assert.match(productHtml, /Kas dan Pengeluaran[\s\S]*href="\.\/cash\.html"|href="\.\/cash\.html"[\s\S]*Kas dan Pengeluaran/u);
  assert.match(inventoryHtml, /href="\.\/cash\.html"/u);
  assert.match(viteConfig, /mandiriKasirCash:\s*resolve\(__dirname, 'mandiri\/kasir\/cash\.html'\)/u);
  assert.equal((html.match(/<h1>/gu) || []).length, 1);
  assert.match(html, /aria-live="polite"/u);
  assert.match(html, /<dialog[^>]+aria-labelledby=/u);
  assert.match(html, /maxlength="240"/u);
  assert.match(html, /data-expense-readonly/u);
  assert.doesNotMatch(source, /innerHTML|localStorage|caches\./u);
  assert.doesNotMatch(html, /Hapus|Edit pengeluaran/u);
  assert.match(css, /min-width:\s*320px/u);
  assert.match(css, /:focus-visible/u);
  assert.match(css, /prefers-reduced-motion/u);
  assert.match(css, /forced-colors: active/u);
  assert.match(css, /max-width:\s*680px/u);
});
