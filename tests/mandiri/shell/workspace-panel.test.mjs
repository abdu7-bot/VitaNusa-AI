import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeMandiriApp } from '../../../assets/js/mandiri/shell/app-shell.js';
import {
  createWorkspacePanelController,
  createWorkspacePanelModel,
  renderWorkspacePanel,
  WORKSPACE_PANEL_STATES,
} from '../../../assets/js/mandiri/shell/workspace-panel.js';
import { workspaceError } from '../../../assets/js/mandiri/services/workspace-errors.js';

const rootUrl = new URL('../../../', import.meta.url);
const panelSource = await readFile(
  new URL('assets/js/mandiri/shell/workspace-panel.js', rootUrl),
  'utf8',
);
const appShellSource = await readFile(
  new URL('assets/js/mandiri/shell/app-shell.js', rootUrl),
  'utf8',
);
const html = await readFile(new URL('mandiri/index.html', rootUrl), 'utf8');

const HASH_A = 'e'.repeat(64);
const HASH_B = 'f'.repeat(64);
const SCOPES_A = Object.freeze({
  accountScope: `account:${HASH_A}`,
  userScope: `user:${HASH_A}`,
});
const SCOPES_B = Object.freeze({
  accountScope: `account:${HASH_B}`,
  userScope: `user:${HASH_B}`,
});

const WORKSPACE = Object.freeze({
  name: 'Ruang Lokal',
  timezone: 'Asia/Jakarta',
  currencyCode: 'IDR',
  status: 'active',
});
const MEMBERSHIP = Object.freeze({ role: 'merchant_owner', status: 'active' });

const signedOut = Object.freeze({ status: 'signed-out', isAuthenticated: false, user: null });
const signedIn = (uid) => Object.freeze({
  status: 'signed-in',
  isAuthenticated: true,
  user: Object.freeze({ uid, email: `${uid}@example.test`, displayName: 'Pengguna VitaNusa' }),
});

function createFakeView() {
  const models = [];
  let handlers = null;
  let destroyCalls = 0;
  return {
    models,
    get handlers() { return handlers; },
    get destroyCalls() { return destroyCalls; },
    render(model) { models.push(model); },
    bind(value) { handlers = value; },
    destroy() { destroyCalls += 1; },
  };
}

function createConnection(label = 'connection') {
  return {
    label,
    closeCalls: 0,
    close() { this.closeCalls += 1; },
  };
}

function emptyService(overrides = {}) {
  return {
    prepareCreateWorkspaceCommand(input) {
      return Object.freeze({ command: true, ...input });
    },
    async createWorkspace() {
      return Object.freeze({
        status: 'created',
        workspace: WORKSPACE,
        membership: MEMBERSHIP,
      });
    },
    async getWorkspaceState() {
      return Object.freeze({ status: 'empty', workspace: null, membership: null });
    },
    ...overrides,
  };
}

function createAuthHarness(options = {}) {
  const view = options.view ?? createFakeView();
  let listener = null;
  let unsubscribeCalls = 0;
  let subscribeCalls = 0;
  const connections = [];
  const openDatabase = options.openDatabase ?? (async () => {
    const connection = createConnection(`connection-${connections.length + 1}`);
    connections.push(connection);
    return connection;
  });
  const createService = options.createService ?? (() => emptyService());
  const controller = createWorkspacePanelController({
    featureState: options.featureState ?? 'internal',
    view,
    subscribeAuth(callback) {
      subscribeCalls += 1;
      listener = callback;
      if (options.initialAuthState !== undefined) callback(options.initialAuthState);
      return () => { unsubscribeCalls += 1; };
    },
    signIn: options.signIn ?? (async () => ({ mode: 'popup' })),
    createScopes: options.createScopes ?? (async (user) => (
      user.uid === 'account-b' ? SCOPES_B : SCOPES_A
    )),
    openDatabase,
    createContext: options.createContext ?? ((connection) => ({ connection })),
    createService,
  });
  return {
    controller,
    connections,
    emit(state) { listener?.(state); },
    get subscribeCalls() { return subscribeCalls; },
    get unsubscribeCalls() { return unsubscribeCalls; },
    view,
  };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

test('daftar state panel hanya memuat state PR 4', () => {
  assert.deepEqual(WORKSPACE_PANEL_STATES, [
    'feature-off',
    'auth-loading',
    'signed-out',
    'opening-storage',
    'ready-no-workspace',
    'creating',
    'ready-with-workspace',
    'error',
  ]);
});

test('feature off tidak menginisialisasi auth atau membuka storage', async () => {
  let openCalls = 0;
  const harness = createAuthHarness({
    featureState: 'off',
    openDatabase: async () => { openCalls += 1; },
  });

  assert.equal(harness.subscribeCalls, 0);
  assert.equal(openCalls, 0);
  assert.equal(harness.controller.getState().state, 'feature-off');
  await assert.rejects(harness.controller.login(), { code: 'feature_disabled' });
  await assert.rejects(harness.controller.submit({ name: 'Tidak aktif' }), {
    code: 'feature_disabled',
  });
  assert.equal(openCalls, 0);
});

test('application shell tidak memuat panel ketika feature off', async () => {
  const elements = {
    '[data-mandiri-root]': { dataset: {} },
    '[data-mandiri-unavailable]': { hidden: false },
    '[data-mandiri-shell]': { hidden: true },
    '[data-mandiri-feature-state]': { textContent: '' },
    '[data-mandiri-workspace-panel]': {},
  };
  let panelCalls = 0;
  await initializeMandiriApp({
    documentRef: { querySelector: (selector) => elements[selector] ?? null },
    windowRef: {},
    featureState: 'off',
    initializeSharedShell: async () => {},
    initializeStatus: () => {},
    initializeWorkspacePanel: async () => { panelCalls += 1; },
  });

  assert.equal(panelCalls, 0);
  assert.match(appShellSource, /import\('\.\/workspace-panel\.js/);
});

test('signed out menampilkan login tanpa membuka database', async () => {
  let openCalls = 0;
  const harness = createAuthHarness({
    initialAuthState: signedOut,
    openDatabase: async () => { openCalls += 1; },
  });
  await settle();

  assert.equal(harness.controller.getState().state, 'signed-out');
  assert.match(harness.controller.getState().message, /Login diperlukan/);
  assert.equal(openCalls, 0);
  assert.match(html, /Login dengan Google/);
});

test('auth loading ditampilkan sebelum observer memberi state', () => {
  const harness = createAuthHarness();
  assert.equal(harness.controller.getState().state, 'auth-loading');
});

test('signed in tanpa workspace menampilkan form', async () => {
  const harness = createAuthHarness({ initialAuthState: signedIn('account-a') });
  await settle();

  assert.equal(harness.controller.getState().state, 'ready-no-workspace');
  assert.equal(harness.connections.length, 1);
  assert.match(html, /data-workspace-form/);
  assert.match(html, /Nama usaha atau ruang kerja/);
  assert.match(html, /Asia\/Jakarta/);
  assert.match(html, /value="IDR" readonly/);
});

test('signed in dengan workspace hanya menampilkan ringkasan aman', async () => {
  const harness = createAuthHarness({
    initialAuthState: signedIn('account-a'),
    createService: () => emptyService({
      async getWorkspaceState() {
        return { status: 'ready', workspace: WORKSPACE, membership: MEMBERSHIP };
      },
    }),
  });
  await settle();
  const model = harness.controller.getState();

  assert.equal(model.state, 'ready-with-workspace');
  assert.deepEqual(model.summary, {
    name: 'Ruang Lokal',
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
    status: 'active',
    role: 'merchant_owner',
  });
  assert.doesNotMatch(JSON.stringify(model), /account-a|accountScope|membershipId|operationId/);
});

test('label akun pada UI tidak meneruskan email', () => {
  const model = createWorkspacePanelModel('ready-no-workspace', {
    userLabel: 'private@example.test',
  });
  assert.equal(model.userLabel, 'Pengguna VitaNusa');
});

test('render nama workspace memakai textContent, bukan innerHTML', () => {
  const elements = new Map();
  const selectors = [
    '[data-workspace-status]', '[data-workspace-loading]', '[data-workspace-signed-out]',
    '[data-workspace-form-panel]', '[data-workspace-summary]', '[data-workspace-error]',
    '[data-workspace-fieldset]', '[data-workspace-submit]', '[data-workspace-retry]',
    '[data-workspace-error-message]', '[data-workspace-name]', '[data-workspace-timezone]',
    '[data-workspace-currency]', '[data-workspace-record-status]', '[data-workspace-role]',
    '[data-workspace-user-panel]', '[data-workspace-user-name]',
  ];
  selectors.forEach((selector) => elements.set(selector, { hidden: false, textContent: '' }));
  const root = {
    dataset: {},
    setAttribute() {},
    querySelector(selector) { return elements.get(selector) ?? null; },
  };
  const model = createWorkspacePanelModel('ready-with-workspace', {
    workspace: { ...WORKSPACE, name: '<img src=x onerror=alert(1)>' },
    membership: MEMBERSHIP,
  });

  renderWorkspacePanel(root, model);
  assert.equal(
    elements.get('[data-workspace-name]').textContent,
    '<img src=x onerror=alert(1)>',
  );
  assert.doesNotMatch(panelSource, /\.innerHTML\s*=/);
});

test('submit pertama menonaktifkan alur dan double click tidak membuat command kedua', async () => {
  const pending = deferred();
  let prepareCalls = 0;
  let createCalls = 0;
  const service = emptyService({
    prepareCreateWorkspaceCommand(input) {
      prepareCalls += 1;
      return Object.freeze({ operation: 'stable', ...input });
    },
    createWorkspace() {
      createCalls += 1;
      return pending.promise;
    },
  });
  const harness = createAuthHarness({
    initialAuthState: signedIn('account-a'),
    createService: () => service,
  });
  await settle();

  const first = harness.controller.submit({
    name: 'Ruang Klik', timezone: 'Asia/Jakarta', currencyCode: 'IDR',
  });
  const second = harness.controller.submit({
    name: 'Nama Diabaikan', timezone: 'Asia/Jayapura', currencyCode: 'IDR',
  });
  assert.equal(first, second);
  assert.equal(harness.controller.getState().state, 'creating');
  assert.equal(prepareCalls, 1);
  await settle();
  assert.equal(createCalls, 1);

  pending.resolve({ status: 'created', workspace: WORKSPACE, membership: MEMBERSHIP });
  await first;
  assert.equal(harness.controller.getState().state, 'ready-with-workspace');
});

test('retry storage memakai command dan operation yang sama', async () => {
  let prepareCalls = 0;
  const commands = [];
  let createCalls = 0;
  const service = emptyService({
    prepareCreateWorkspaceCommand(input) {
      prepareCalls += 1;
      return Object.freeze({ operationId: 'stable-operation', ...input });
    },
    async createWorkspace(command) {
      createCalls += 1;
      commands.push(command);
      if (createCalls === 1) throw workspaceError('transaction_aborted');
      return { status: 'created', workspace: WORKSPACE, membership: MEMBERSHIP };
    },
  });
  const harness = createAuthHarness({
    initialAuthState: signedIn('account-a'),
    createService: () => service,
  });
  await settle();

  await assert.rejects(harness.controller.submit({
    name: 'Ruang Retry', timezone: 'Asia/Jakarta', currencyCode: 'IDR',
  }), { code: 'transaction_aborted' });
  assert.equal(harness.controller.getState().state, 'error');
  assert.equal(harness.controller.getState().retryable, true);
  await harness.controller.retry();

  assert.equal(prepareCalls, 1);
  assert.equal(createCalls, 2);
  assert.equal(commands[0], commands[1]);
  assert.equal(harness.controller.getState().state, 'ready-with-workspace');
});

test('error internal ditampilkan sebagai pesan aman', async () => {
  const harness = createAuthHarness({
    initialAuthState: signedIn('account-a'),
    createService: () => emptyService({
      async createWorkspace() {
        throw new Error('UID-full-and-record-payload');
      },
    }),
  });
  await settle();

  await assert.rejects(harness.controller.submit({
    name: 'Ruang Aman', timezone: 'Asia/Jakarta', currencyCode: 'IDR',
  }), { code: 'unknown_error' });
  assert.doesNotMatch(harness.controller.getState().message, /UID-full|record-payload/);
});

test('logout membersihkan ringkasan akun lama dan menutup connection', async () => {
  const harness = createAuthHarness({
    initialAuthState: signedIn('account-a'),
    createService: () => emptyService({
      async getWorkspaceState() {
        return { status: 'ready', workspace: WORKSPACE, membership: MEMBERSHIP };
      },
    }),
  });
  await settle();
  assert.equal(harness.controller.getState().state, 'ready-with-workspace');

  harness.emit(signedOut);
  await settle();
  assert.equal(harness.controller.getState().state, 'signed-out');
  assert.equal(harness.controller.getState().summary, null);
  assert.equal(harness.connections[0].closeCalls, 1);
});

test('pergantian akun menutup connection lama dan hanya merender scope baru', async () => {
  const services = [
    emptyService({
      async getWorkspaceState() {
        return { status: 'ready', workspace: { ...WORKSPACE, name: 'Workspace A' }, membership: MEMBERSHIP };
      },
    }),
    emptyService({
      async getWorkspaceState() {
        return { status: 'ready', workspace: { ...WORKSPACE, name: 'Workspace B' }, membership: MEMBERSHIP };
      },
    }),
  ];
  const harness = createAuthHarness({ createService: () => services.shift() });
  harness.emit(signedIn('account-a'));
  await settle();
  assert.equal(harness.controller.getState().summary.name, 'Workspace A');

  harness.emit(signedIn('account-b'));
  await settle();
  assert.equal(harness.controller.getState().summary.name, 'Workspace B');
  assert.equal(harness.connections[0].closeCalls, 1);
  assert.equal(harness.connections.length, 2);
});

test('hasil async sesi akun lama diabaikan', async () => {
  const pendingScopeA = deferred();
  const harness = createAuthHarness({
    createScopes(user) {
      return user.uid === 'account-a' ? pendingScopeA.promise : Promise.resolve(SCOPES_B);
    },
    createService: () => emptyService({
      async getWorkspaceState() {
        return { status: 'ready', workspace: { ...WORKSPACE, name: 'Workspace B' }, membership: MEMBERSHIP };
      },
    }),
  });

  harness.emit(signedIn('account-a'));
  harness.emit(signedIn('account-b'));
  await settle();
  assert.equal(harness.controller.getState().summary.name, 'Workspace B');
  pendingScopeA.resolve(SCOPES_A);
  await settle();

  assert.equal(harness.controller.getState().summary.name, 'Workspace B');
  assert.equal(harness.connections.length, 1);
});

test('destroy melepas auth listener, menutup connection, dan menghancurkan view', async () => {
  const harness = createAuthHarness({ initialAuthState: signedIn('account-a') });
  await settle();
  harness.controller.destroy();

  assert.equal(harness.unsubscribeCalls, 1);
  assert.equal(harness.connections[0].closeCalls, 1);
  assert.equal(harness.view.destroyCalls, 1);
  assert.equal(harness.controller.getState().summary, null);
});

test('login CTA menggunakan dependency auth yang sudah tersedia', async () => {
  let signInCalls = 0;
  const harness = createAuthHarness({
    initialAuthState: signedOut,
    signIn: async () => {
      signInCalls += 1;
      return { mode: 'popup' };
    },
  });
  await harness.controller.login();
  assert.equal(signInCalls, 1);
});

test('HTML tidak menampilkan identifier internal atau aksi produk dan transaksi', () => {
  assert.doesNotMatch(html, />\s*(?:UID|accountScope|membership ID|operation ID)\s*</i);
  assert.doesNotMatch(html, /Mulai Kasir|Buat Produk|Buat Transaksi/i);
  assert.match(html, /Belum ada sinkronisasi cloud atau pencadangan otomatis/);
  assert.match(html, /Nama ini hanya tampil di UI dan tidak disimpan dalam record workspace/);
});
