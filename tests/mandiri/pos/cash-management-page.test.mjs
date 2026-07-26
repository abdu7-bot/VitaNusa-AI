import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  CASH_PAGE_STATES,
  createCashManagementController,
  createCashManagementView,
  normalizeCashInput,
} from '../../../assets/js/mandiri/pos/ui/cash-management-page.js';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createCashSessionService } from '../../../assets/js/mandiri/pos/services/cash-session-service.js';
import { storageError } from '../../../assets/js/mandiri/storage/storage-errors.js';
import {
  seedMemoryWorkspace, ACCOUNT_A, ACCOUNT_B, USER_A, USER_B, WORKSPACE_A, WORKSPACE_B,
} from '../export/fixtures.mjs';
import {
  FakeDocument, FakeElement, collectText, findAll,
} from '../learning-reader/fixtures.mjs';

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
  const renders = [];
  return {
    get callbacks() { return callbacks; },
    get renders() { return renders; },
    bind(value) { callbacks = value; },
    render(value) { renders.push(value); },
    destroy() {},
  };
}

async function settle() {
  for (let index = 0; index < 7; index += 1) await new Promise((resolve) => setImmediate(resolve));
}

function fakeSessionStore() {
  const values = new Map();
  return {
    corrupt() {
      for (const key of values.keys()) values.set(key, '{invalid-json');
    },
    transform(callback) {
      for (const [key, value] of values) {
        values.set(key, JSON.stringify(callback(JSON.parse(value))));
      }
    },
    getItem(key) { return values.get(key) || null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, value); },
    get entries() {
      return [...values.values()].flatMap((value) => {
        try { return JSON.parse(value); } catch { return []; }
      });
    },
    get keys() { return [...values.keys()]; },
    serialized(key) { return values.get(key) || null; },
    get size() { return values.size; },
  };
}

async function harness({
  decorateService = (value) => value, createContext, fixture = null, pendingExpenseStore,
  now = () => '2026-07-25T04:00:00.000Z', cryptoRef = webcrypto,
} = {}) {
  const currentFixture = fixture || await seedMemoryWorkspace();
  const view = fakeView();
  let authListener;
  let closeCalls = 0;
  const controller = createCashManagementController({
    contract: { enabled: true },
    view,
    subscribeAuth(listener) { authListener = listener; return () => {}; },
    createScopes: async () => ({ accountScope: ACCOUNT_A, userScope: USER_A }),
    openDatabase: async () => ({ close() { closeCalls += 1; } }),
    createContext: () => createContext?.(currentFixture) || currentFixture.memory.repositoryContext,
    createService: ({ repositoryContext }) => decorateService(createCashSessionService({
      repositoryContext, digestFactory,
    })),
    now,
    cryptoRef,
    pendingExpenseStore,
  });
  authListener({ isAuthenticated: true, user: { uid: 'fixture' } });
  await settle();
  return {
    ...currentFixture, controller, view, authListener, get closeCalls() { return closeCalls; },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  return { promise, reject, resolve };
}

async function createScopeFixture({
  accountScope, userScope, workspaceId, label, sessionSuffix,
}) {
  const seeded = await seedMemoryWorkspace();
  const owner = await seeded.memory.membershipRepository.getByUserScope(
    ACCOUNT_A, WORKSPACE_A, USER_A,
  );
  const workspace = Object.freeze({
    ...seeded.command,
    accountScope,
    workspaceId,
    name: `Workspace ${label}`,
  });
  const membership = Object.freeze({
    ...owner,
    accountScope,
    workspaceId,
    userScope,
    membershipId: `membership_${sessionSuffix.repeat(8)}-${sessionSuffix.repeat(4)}-4${sessionSuffix.repeat(3)}-8${sessionSuffix.repeat(3)}-${sessionSuffix.repeat(12)}`,
  });
  const session = {
    schemaVersion: 1,
    accountScope,
    workspaceId,
    cashSessionId: `cashsession_${sessionSuffix.repeat(8)}-${sessionSuffix.repeat(4)}-4${sessionSuffix.repeat(3)}-8${sessionSuffix.repeat(3)}-${sessionSuffix.repeat(12)}`,
    openedByScope: userScope,
    openedByRole: 'merchant_owner',
    openedAtLocal: '2026-07-25T03:00:00.000Z',
    openingCashMinor: 100000,
    status: 'open',
    version: 1,
    updatedAtLocal: '2026-07-25T03:00:00.000Z',
  };
  const fixture = {
    accountScope,
    expenses: [],
    label,
    membership,
    session,
    userScope,
    workspace,
    closeCalls: 0,
    readGate: null,
    recordExpense: null,
  };
  fixture.context = {
    fixture,
    run(storeNames, mode, callback) {
      if (storeNames.includes('workspaces')) {
        return callback({
          workspaceRepository: {
            listByStatus: async (requestedAccount) => (
              requestedAccount === accountScope ? [workspace] : []
            ),
          },
          membershipRepository: {
            getByUserScope: async (
              requestedAccount, requestedWorkspace, requestedUser,
            ) => (
              requestedAccount === accountScope
              && requestedWorkspace === workspaceId
              && requestedUser === userScope
                ? membership
                : null
            ),
          },
        });
      }
      return callback({
        cashSessionRepository: {
          async listByWorkspace() {
            if (fixture.readGate) await fixture.readGate.promise;
            return [fixture.session];
          },
        },
        expenseRepository: {
          listByCashSession: async () => [...fixture.expenses],
        },
        saleRepository: {
          sumCashSalesBetween: async () => 0,
        },
      });
    },
  };
  fixture.service = {
    async recordExpense(command) {
      if (fixture.recordExpense) return fixture.recordExpense(command);
      const expense = Object.freeze({
        ...command,
        recordedAtLocal: command.createdAtLocal,
      });
      fixture.expenses.push(expense);
      fixture.session = { ...fixture.session, version: fixture.session.version + 1 };
      return Object.freeze({ status: 'committed', expense });
    },
    open: async () => { throw storageError('cash_session_already_open'); },
    close: async () => { throw storageError('operation_in_progress'); },
  };
  fixture.connection = {
    context: fixture.context,
    close() { fixture.closeCalls += 1; },
  };
  return fixture;
}

async function scopedHarness(initialFixture, pendingExpenseStore) {
  let selectedFixture = initialFixture;
  let authListener;
  const view = fakeView();
  const controller = createCashManagementController({
    contract: { enabled: true },
    view,
    subscribeAuth(listener) { authListener = listener; return () => {}; },
    createScopes: async (user) => user.scopes,
    openDatabase: async () => selectedFixture.connection,
    createContext: (connection) => connection.context,
    createService: ({ repositoryContext }) => repositoryContext.fixture.service,
    now: () => '2026-07-25T04:00:00.000Z',
    cryptoRef: webcrypto,
    pendingExpenseStore,
  });
  const authenticate = async (fixture) => {
    selectedFixture = fixture;
    authListener({
      isAuthenticated: true,
      user: { uid: fixture.label, scopes: {
        accountScope: fixture.accountScope, userScope: fixture.userScope,
      } },
    });
    await settle();
  };
  const rebind = async (fixture) => {
    selectedFixture = fixture;
    await controller.rebindWorkspace();
  };
  const signOut = async () => {
    authListener({ isAuthenticated: false, user: null });
    await settle();
  };
  await authenticate(initialFixture);
  return {
    authenticate, controller, rebind, signOut, view,
  };
}

const EXPENSE_INPUT = Object.freeze({
  category: 'operational', amount: '25.000', note: 'Air minum',
});

async function openSession(value) {
  await value.controller.submit('open', { openingCash: 'Rp100.000' });
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

test('commit berhasil tetapi respons dan reconciliation pertama gagal memakai identity yang sama saat retry', async () => {
  let failNextRead = false;
  const commands = [];
  const value = await harness({
    createContext(fixture) {
      return {
        run(storeNames, mode, callback) {
          if (mode === 'readonly' && failNextRead) {
            failNextRead = false;
            throw storageError('storage_error');
          }
          return fixture.memory.repositoryContext.run(storeNames, mode, callback);
        },
      };
    },
    decorateService(service) {
      return {
        ...service,
        async recordExpense(command) {
          commands.push(command);
          const result = await service.recordExpense(command);
          if (commands.length === 1) {
            failNextRead = true;
            throw storageError('storage_error');
          }
          return result;
        },
      };
    },
  });
  await openSession(value);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT), { code: 'storage_unknown' });
  await value.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].operationId, commands[1].operationId);
  assert.equal(commands[0].expenseId, commands[1].expenseId);
  assert.equal(commands[0].eventId, commands[1].eventId);
  assert.equal(commands[0].createdAtLocal, commands[1].createdAtLocal);
  const expenses = await value.memory.expenseRepository.listByCashSession(
    ACCOUNT_A, WORKSPACE_A, value.controller.getState().session.cashSessionId,
  );
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].expenseId, commands[0].expenseId);
});

test('retry berkali-kali mempertahankan identity dan hanya menyimpan satu Expense', async () => {
  const commands = [];
  let failures = 2;
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          commands.push(command);
          if (failures > 0) {
            failures -= 1;
            return Promise.reject(storageError('storage_error'));
          }
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(value);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT));
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT));
  await value.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(new Set(commands.map((command) => command.operationId)).size, 1);
  assert.equal(new Set(commands.map((command) => command.expenseId)).size, 1);
  assert.equal(value.controller.getState().expenses.length, 1);
});

test('reset eksplisit setelah commit ambigu membuang pending identity', async () => {
  let failNextRead = false;
  const pendingExpenseStore = fakeSessionStore();
  const value = await harness({
    pendingExpenseStore,
    createContext(fixture) {
      return {
        run(storeNames, mode, callback) {
          if (mode === 'readonly' && failNextRead) {
            failNextRead = false;
            throw storageError('storage_error');
          }
          return fixture.memory.repositoryContext.run(storeNames, mode, callback);
        },
      };
    },
    decorateService(service) {
      return {
        ...service,
        async recordExpense(command) {
          const result = await service.recordExpense(command);
          failNextRead = true;
          throw storageError('storage_error');
        },
      };
    },
  });
  await openSession(value);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT), { code: 'storage_unknown' });
  assert.equal(pendingExpenseStore.size, 1);
  value.controller.resetExpenseSubmission();
  assert.equal(pendingExpenseStore.size, 0);
  const expenses = await value.memory.expenseRepository.listByCashSession(
    ACCOUNT_A, WORKSPACE_A, value.controller.getState().session.cashSessionId,
  );
  assert.equal(expenses.length, 1);
});

test('hard refresh membersihkan snapshot commit yang sudah ditemukan lalu payload sama menjadi Expense baru', async () => {
  const fixture = await seedMemoryWorkspace();
  const pendingExpenseStore = fakeSessionStore();
  let failNextRead = false;
  let firstCommand;
  const first = await harness({
    fixture,
    pendingExpenseStore,
    createContext(value) {
      return {
        run(storeNames, mode, callback) {
          if (mode === 'readonly' && failNextRead) {
            failNextRead = false;
            throw storageError('storage_error');
          }
          return value.memory.repositoryContext.run(storeNames, mode, callback);
        },
      };
    },
    decorateService(service) {
      return {
        ...service,
        async recordExpense(command) {
          firstCommand = command;
          const result = await service.recordExpense(command);
          failNextRead = true;
          throw storageError('storage_error');
        },
      };
    },
  });
  await openSession(first);
  await assert.rejects(first.controller.submit('expense', EXPENSE_INPUT), { code: 'storage_unknown' });
  first.controller.destroy();

  const commands = [];
  const second = await harness({
    fixture,
    pendingExpenseStore,
    now: () => '2026-07-25T05:00:00.000Z',
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          commands.push(command);
          return service.recordExpense(command);
        },
      };
    },
  });
  assert.equal(second.controller.getState().expenses.length, 1);
  assert.equal(pendingExpenseStore.size, 0);
  await second.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(commands.length, 1);
  assert.notEqual(commands[0].operationId, firstCommand.operationId);
  assert.notEqual(commands[0].expenseId, firstCommand.expenseId);
  assert.notEqual(commands[0].eventId, firstCommand.eventId);
  assert.notEqual(commands[0].createdAtLocal, firstCommand.createdAtLocal);
  const expenses = await fixture.memory.expenseRepository.listByCashSession(
    ACCOUNT_A, WORKSPACE_A, second.controller.getState().session.cashSessionId,
  );
  assert.equal(expenses.length, 2);
});

test('restore memakai command canonical sehingga whitespace tidak membuat mismatch atau Expense ganda', async () => {
  const fixture = await seedMemoryWorkspace();
  const pendingExpenseStore = fakeSessionStore();
  let firstCommand;
  const first = await harness({
    fixture,
    pendingExpenseStore,
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          firstCommand = command;
          return Promise.reject(storageError('storage_error'));
        },
      };
    },
  });
  await openSession(first);
  await assert.rejects(first.controller.submit('expense', EXPENSE_INPUT));
  first.controller.destroy();
  pendingExpenseStore.transform((entries) => entries.map((entry) => ({
    ...entry,
    materialKey: 'stale-non-canonical-key',
    command: {
      ...entry.command,
      category: ` ${entry.command.category} `,
      note: ` ${entry.command.note} `,
    },
  })));

  const commands = [];
  const second = await harness({
    fixture,
    pendingExpenseStore,
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          commands.push(command);
          return service.recordExpense(command);
        },
      };
    },
  });
  await second.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].operationId, firstCommand.operationId);
  assert.equal(commands[0].expenseId, firstCommand.expenseId);
  assert.equal(commands[0].category, 'operational');
  assert.equal(commands[0].note, 'Air minum');
  assert.equal(second.controller.getState().expenses.length, 1);
});

test('session storage rusak dibuang tanpa memblokir halaman atau membuat bypass', async () => {
  const fixture = await seedMemoryWorkspace();
  const pendingExpenseStore = fakeSessionStore();
  let failOnce = true;
  const first = await harness({
    fixture,
    pendingExpenseStore,
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          if (failOnce) {
            failOnce = false;
            return Promise.reject(storageError('storage_error'));
          }
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(first);
  await assert.rejects(first.controller.submit('expense', EXPENSE_INPUT));
  assert.equal(pendingExpenseStore.size, 1);
  first.controller.destroy();
  pendingExpenseStore.corrupt();

  const second = await harness({ fixture, pendingExpenseStore });
  assert.equal(second.controller.getState().state, 'open-session');
  assert.equal(pendingExpenseStore.size, 0);
  await second.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(second.controller.getState().expenses.length, 1);
});

test('restore membuang snapshot bila identity bertabrakan dengan payload Expense berbeda', async () => {
  const fixture = await seedMemoryWorkspace();
  const pendingExpenseStore = fakeSessionStore();
  let pendingCommand;
  const first = await harness({
    fixture,
    pendingExpenseStore,
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          pendingCommand = command;
          return Promise.reject(storageError('storage_error'));
        },
      };
    },
  });
  await openSession(first);
  await assert.rejects(first.controller.submit('expense', EXPENSE_INPUT));
  const directService = createCashSessionService({
    repositoryContext: fixture.memory.repositoryContext,
    digestFactory,
  });
  await directService.recordExpense({
    ...pendingCommand,
    amountMinor: pendingCommand.amountMinor + 1,
  });
  first.controller.destroy();

  const second = await harness({ fixture, pendingExpenseStore });
  assert.equal(pendingExpenseStore.size, 0);
  assert.equal(second.controller.getState().state, 'error');
  assert.equal(
    second.controller.getState().message,
    'Operasi tidak dapat diproses ulang karena datanya berbeda.',
  );
  const expenses = await fixture.memory.expenseRepository.listByCashSession(
    ACCOUNT_A, WORKSPACE_A, second.controller.getState().session.cashSessionId,
  );
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].amountMinor, 25001);
});

test('Web Storage yang diblokir tidak mematikan idempotensi in-memory', async () => {
  const commands = [];
  let failOnce = true;
  const blockedStore = {
    getItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const value = await harness({
    pendingExpenseStore: blockedStore,
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          commands.push(command);
          if (failOnce) {
            failOnce = false;
            return Promise.reject(storageError('storage_error'));
          }
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(value);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT));
  await value.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(commands[0].operationId, commands[1].operationId);
  assert.equal(commands[0].expenseId, commands[1].expenseId);
  assert.equal(value.controller.getState().expenses.length, 1);
});

test('double click Expense menjalankan satu write logis', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        async recordExpense(command) {
          calls += 1;
          await gate;
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(value);
  const first = value.controller.submit('expense', EXPENSE_INPUT);
  const second = value.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(first, second);
  assert.equal(value.controller.getState().submitting, true);
  release();
  await first;
  assert.equal(calls, 1);
  assert.equal(value.controller.getState().expenses.length, 1);
});

test('Expense berbeda saat in-flight ditolak tanpa menumpang Promise pertama', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        async recordExpense(command) {
          calls += 1;
          await gate;
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(value);
  const first = value.controller.submit('expense', EXPENSE_INPUT);
  const second = value.controller.submit('expense', { ...EXPENSE_INPUT, amount: '30.000' });
  assert.notEqual(first, second);
  await assert.rejects(second, { code: 'operation_in_progress' });
  assert.equal(
    value.controller.getState().message,
    'Operasi lain masih diproses. Tunggu hingga selesai sebelum mencoba lagi.',
  );
  assert.equal(calls, 1);
  release();
  await first;
  assert.equal(value.controller.getState().expenses.length, 1);
});

test('close tidak menumpang hasil Expense yang masih in-flight', async () => {
  let release;
  let closeCalls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        async recordExpense(command) {
          await gate;
          return service.recordExpense(command);
        },
        close(command) {
          closeCalls += 1;
          return service.close(command);
        },
      };
    },
  });
  await openSession(value);
  const expense = value.controller.submit('expense', EXPENSE_INPUT);
  const close = value.controller.submit('close', { countedCash: '100000' });
  assert.notEqual(expense, close);
  await assert.rejects(close, { code: 'operation_in_progress' });
  assert.equal(closeCalls, 0);
  release();
  await expense;
});

test('rebind workspace dan account membersihkan scope lama serta mengabaikan reload stale', async () => {
  const workspaceA = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_A,
    label: 'account-a-workspace-a',
    sessionSuffix: '1',
  });
  const workspaceB = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_B,
    label: 'account-a-workspace-b',
    sessionSuffix: '2',
  });
  const accountB = await createScopeFixture({
    accountScope: ACCOUNT_B,
    userScope: USER_B,
    workspaceId: 'workspace_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    label: 'account-b-workspace-b',
    sessionSuffix: '3',
  });
  workspaceA.expenses.push({
    expenseId: 'expense_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    operationId: 'op_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    cashSessionId: workspaceA.session.cashSessionId,
    category: 'operational',
    amountMinor: 11000,
    note: 'Data Workspace A',
    recordedAtLocal: '2026-07-25T03:30:00.000Z',
  });
  workspaceB.expenses.push({
    expenseId: 'expense_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    operationId: 'op_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    cashSessionId: workspaceB.session.cashSessionId,
    category: 'supplies',
    amountMinor: 22000,
    note: 'Data Workspace B',
    recordedAtLocal: '2026-07-25T03:40:00.000Z',
  });
  accountB.expenses.push({
    expenseId: 'expense_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    operationId: 'op_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    cashSessionId: accountB.session.cashSessionId,
    category: 'other',
    amountMinor: 33000,
    note: 'Data Account B',
    recordedAtLocal: '2026-07-25T03:50:00.000Z',
  });

  const value = await scopedHarness(workspaceA);
  assert.equal(value.controller.getState().expenses[0].note, 'Data Workspace A');

  workspaceA.readGate = deferred();
  const staleReload = value.controller.reload();
  await value.rebind(workspaceB);
  assert.equal(workspaceA.closeCalls, 1);
  assert.equal(value.controller.getState().expenses[0].note, 'Data Workspace B');
  workspaceA.readGate.resolve();
  await staleReload;
  assert.equal(value.controller.getState().expenses[0].note, 'Data Workspace B');

  await value.authenticate(accountB);
  assert.equal(workspaceB.closeCalls, 1);
  assert.equal(value.controller.getState().expenses[0].note, 'Data Account B');
  assert.equal(value.controller.getState().session.workspaceId, accountB.workspace.workspaceId);
});

test('continuation handleAuth stale tidak menyentuh snapshot atau submission lifecycle baru', async () => {
  const pendingExpenseStore = fakeSessionStore();
  const workspaceA = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_A,
    label: 'overlap-workspace-a',
    sessionSuffix: '6',
  });
  const workspaceB = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_B,
    label: 'overlap-workspace-b',
    sessionSuffix: '7',
  });
  const reloadA = deferred();
  const writeB = deferred();
  workspaceB.recordExpense = async (command) => {
    await writeB.promise;
    workspaceB.expenses.push({ ...command, recordedAtLocal: command.createdAtLocal });
    return { status: 'committed' };
  };
  const value = await scopedHarness(workspaceA, pendingExpenseStore);

  workspaceA.readGate = reloadA;
  const staleLifecycle = value.rebind(workspaceA);
  await new Promise((resolve) => setImmediate(resolve));
  const currentLifecycle = value.rebind(workspaceB);
  await currentLifecycle;
  const submissionB = value.controller.submit('expense', EXPENSE_INPUT);
  const snapshotBKey = pendingExpenseStore.keys[0];
  const snapshotBBefore = pendingExpenseStore.serialized(snapshotBKey);
  const renderCountBefore = value.view.renders.length;

  reloadA.resolve();
  await staleLifecycle;
  assert.equal(value.view.renders.length, renderCountBefore);
  assert.equal(value.controller.getState().state, 'submitting');
  assert.equal(value.controller.getState().session.workspaceId, WORKSPACE_B);
  assert.equal(pendingExpenseStore.serialized(snapshotBKey), snapshotBBefore);
  assert.equal(value.controller.submit('expense', EXPENSE_INPUT), submissionB);

  writeB.resolve();
  await submissionB;
  assert.equal(value.controller.getState().expenses.length, 1);
});

test('snapshot write lama dipertahankan lintas rebind dan direkonsiliasi duplicate-safe', async () => {
  const pendingExpenseStore = fakeSessionStore();
  const workspaceA = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_A,
    label: 'old-workspace',
    sessionSuffix: '4',
  });
  const workspaceB = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_B,
    label: 'new-workspace',
    sessionSuffix: '5',
  });
  const oldWrite = deferred();
  let oldCommand;
  let oldCalls = 0;
  workspaceA.recordExpense = async (command) => {
    oldCalls += 1;
    oldCommand = command;
    await oldWrite.promise;
    workspaceA.expenses.push({ ...command, recordedAtLocal: command.createdAtLocal });
    throw storageError('storage_error');
  };
  workspaceB.recordExpense = async () => { throw storageError('storage_error'); };

  const value = await scopedHarness(workspaceA, pendingExpenseStore);
  const staleSubmission = value.controller.submit('expense', EXPENSE_INPUT);
  const staleResult = staleSubmission.catch((error) => error);
  assert.equal(pendingExpenseStore.size, 1);
  const snapshotAKey = pendingExpenseStore.keys[0];
  const pendingCommandA = pendingExpenseStore.entries[0].command;
  await value.rebind(workspaceB);
  const snapshotABefore = pendingExpenseStore.serialized(snapshotAKey);
  assert.equal(pendingExpenseStore.entries.find(
    (entry) => entry.command.operationId === pendingCommandA.operationId,
  ).outcome, 'orphaned');
  await assert.rejects(value.controller.submit('expense', {
    ...EXPENSE_INPUT, amount: '30.000',
  }));
  const snapshotBKey = pendingExpenseStore.keys.find((key) => key !== snapshotAKey);
  const snapshotBBefore = pendingExpenseStore.serialized(snapshotBKey);
  const stateBBefore = value.controller.getState();

  oldWrite.resolve();
  assert.equal((await staleResult).code, 'storage_unknown');
  assert.equal(value.controller.getState().session.workspaceId, WORKSPACE_B);
  assert.equal(value.controller.getState(), stateBBefore);
  assert.equal(pendingExpenseStore.serialized(snapshotAKey), snapshotABefore);
  assert.equal(pendingExpenseStore.serialized(snapshotBKey), snapshotBBefore);

  await value.rebind(workspaceA);
  assert.equal(workspaceA.expenses.length, 1);
  assert.equal(pendingExpenseStore.serialized(snapshotAKey), null);
  assert.equal(pendingExpenseStore.serialized(snapshotBKey), snapshotBBefore);
  const reconciled = await value.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(reconciled.status, 'duplicate-safe');
  assert.equal(reconciled.expense.operationId, oldCommand.operationId);
  assert.equal(reconciled.expense.expenseId, oldCommand.expenseId);
  assert.equal(oldCalls, 1);
  assert.equal(workspaceA.expenses.length, 1);
  assert.equal(pendingExpenseStore.serialized(snapshotBKey), snapshotBBefore);
});

test('failure sebelum commit tetap dapat retry dengan identity sama setelah kembali ke workspace', async () => {
  const pendingExpenseStore = fakeSessionStore();
  const workspaceA = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_A,
    label: 'retry-workspace-a',
    sessionSuffix: '8',
  });
  const workspaceB = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_B,
    label: 'retry-workspace-b',
    sessionSuffix: '9',
  });
  const commands = [];
  let fail = true;
  workspaceA.recordExpense = async (command) => {
    commands.push(command);
    if (fail) {
      fail = false;
      throw storageError('storage_error');
    }
    workspaceA.expenses.push({ ...command, recordedAtLocal: command.createdAtLocal });
    return { status: 'committed' };
  };
  const value = await scopedHarness(workspaceA, pendingExpenseStore);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT));
  const snapshotAKey = pendingExpenseStore.keys[0];
  assert.equal(pendingExpenseStore.entries[0].outcome, 'absent');

  await value.rebind(workspaceB);
  assert.notEqual(pendingExpenseStore.serialized(snapshotAKey), null);
  await value.rebind(workspaceA);
  assert.notEqual(pendingExpenseStore.serialized(snapshotAKey), null);
  await value.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].operationId, commands[1].operationId);
  assert.equal(commands[0].expenseId, commands[1].expenseId);
  assert.equal(workspaceA.expenses.length, 1);
  assert.equal(pendingExpenseStore.serialized(snapshotAKey), null);
});

test('orphaned write dengan payload collision tetap menjadi idempotency mismatch', async () => {
  const pendingExpenseStore = fakeSessionStore();
  const workspaceA = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_A,
    label: 'collision-workspace-a',
    sessionSuffix: 'c',
  });
  const workspaceB = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_B,
    label: 'collision-workspace-b',
    sessionSuffix: 'd',
  });
  const writeA = deferred();
  let commandA;
  workspaceA.recordExpense = async (command) => {
    commandA = command;
    await writeA.promise;
    workspaceA.expenses.push({
      ...command,
      amountMinor: command.amountMinor + 1,
      recordedAtLocal: command.createdAtLocal,
    });
    throw storageError('storage_error');
  };
  const value = await scopedHarness(workspaceA, pendingExpenseStore);
  const staleSubmission = value.controller.submit('expense', EXPENSE_INPUT);
  const staleResult = staleSubmission.catch((error) => error);
  const snapshotAKey = pendingExpenseStore.keys[0];
  await value.rebind(workspaceB);
  writeA.resolve();
  assert.equal((await staleResult).code, 'storage_unknown');

  await value.rebind(workspaceA);
  assert.equal(value.controller.getState().state, 'error');
  assert.equal(
    value.controller.getState().message,
    'Operasi tidak dapat diproses ulang karena datanya berbeda.',
  );
  assert.equal(workspaceA.expenses.length, 1);
  assert.equal(workspaceA.expenses[0].expenseId, commandA.expenseId);
  assert.equal(workspaceA.expenses[0].amountMinor, commandA.amountMinor + 1);
  assert.equal(pendingExpenseStore.serialized(snapshotAKey), null);
});

test('logout membersihkan pending snapshot dari seluruh scope yang dikunjungi controller', async () => {
  const pendingExpenseStore = fakeSessionStore();
  const workspaceA = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_A,
    label: 'logout-workspace-a',
    sessionSuffix: 'a',
  });
  const workspaceB = await createScopeFixture({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    workspaceId: WORKSPACE_B,
    label: 'logout-workspace-b',
    sessionSuffix: 'b',
  });
  workspaceA.recordExpense = async () => { throw storageError('storage_error'); };
  workspaceB.recordExpense = async () => { throw storageError('storage_error'); };
  const value = await scopedHarness(workspaceA, pendingExpenseStore);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT));
  await value.rebind(workspaceB);
  await assert.rejects(value.controller.submit('expense', {
    ...EXPENSE_INPUT, amount: '30.000',
  }));
  assert.equal(pendingExpenseStore.size, 2);
  await value.signOut();
  assert.equal(pendingExpenseStore.size, 0);
  assert.equal(value.controller.getState().state, 'signed-out');
});

test('logout melepas guard lama dan finally stale tidak membersihkan guard konteks baru', async () => {
  let oldRelease;
  let nextRelease;
  let calls = 0;
  const oldGate = new Promise((resolve) => { oldRelease = resolve; });
  const nextGate = new Promise((resolve) => { nextRelease = resolve; });
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        async recordExpense(command) {
          calls += 1;
          if (calls === 1) {
            await oldGate;
            throw storageError('storage_error');
          }
          await nextGate;
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(value);
  const stale = value.controller.submit('expense', EXPENSE_INPUT);
  const staleResult = stale.then(
    () => null,
    (error) => error,
  );
  value.authListener({ isAuthenticated: false, user: null });
  await settle();
  value.authListener({ isAuthenticated: true, user: { uid: 'fixture' } });
  await settle();
  const current = value.controller.submit('expense', { ...EXPENSE_INPUT, amount: '30.000' });
  oldRelease();
  assert.equal((await staleResult).code, 'storage_unknown');
  const duplicate = value.controller.submit('expense', { ...EXPENSE_INPUT, amount: '30.000' });
  assert.equal(duplicate, current);
  assert.equal(value.controller.getState().state, 'submitting');
  nextRelease();
  await current;
  assert.equal(value.controller.getState().expenses.length, 1);
});

test('sukses terminal dan perubahan payload material memperoleh identity baru', async () => {
  const commands = [];
  let failFirst = true;
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          commands.push(command);
          if (failFirst) {
            failFirst = false;
            return Promise.reject(storageError('storage_error'));
          }
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(value);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT));
  await value.controller.submit('expense', { ...EXPENSE_INPUT, amount: '30.000' });
  await value.controller.submit('expense', EXPENSE_INPUT);
  assert.notEqual(commands[0].operationId, commands[1].operationId);
  assert.notEqual(commands[0].expenseId, commands[1].expenseId);
  assert.notEqual(commands[1].operationId, commands[2].operationId);
  assert.notEqual(commands[1].expenseId, commands[2].expenseId);
  assert.equal(value.controller.getState().expenses.length, 2);
});

test('reset form setelah failure membuang logical submission lama', async () => {
  const commands = [];
  let failFirst = true;
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          commands.push(command);
          if (failFirst) {
            failFirst = false;
            return Promise.reject(storageError('storage_error'));
          }
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(value);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT));
  value.controller.resetExpenseSubmission();
  await value.controller.submit('expense', EXPENSE_INPUT);
  assert.notEqual(commands[0].operationId, commands[1].operationId);
  assert.notEqual(commands[0].expenseId, commands[1].expenseId);
  assert.equal(value.controller.getState().expenses.length, 1);
});

test('record identity sama dengan payload material berbeda direkonsiliasi sebagai conflict aman', async () => {
  let captured;
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        async recordExpense(command) {
          captured = command;
          await service.recordExpense({ ...command, amountMinor: command.amountMinor + 1 });
          throw storageError('storage_error');
        },
      };
    },
  });
  await openSession(value);
  await assert.rejects(
    value.controller.submit('expense', EXPENSE_INPUT),
    { code: 'idempotency_mismatch' },
  );
  const expenses = await value.memory.expenseRepository.listByCashSession(
    ACCOUNT_A, WORKSPACE_A, captured.cashSessionId,
  );
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].amountMinor, 25001);
  assert.equal(value.controller.getState().message, 'Operasi tidak dapat diproses ulang karena datanya berbeda.');
});

test('version conflict mempertahankan operationId dan expenseId pada retry', async () => {
  const commands = [];
  let conflict = true;
  const value = await harness({
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          commands.push(command);
          if (conflict) {
            conflict = false;
            return Promise.reject(storageError('version_conflict'));
          }
          return service.recordExpense(command);
        },
      };
    },
  });
  await openSession(value);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT), { code: 'version_conflict' });
  await value.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(commands[0].operationId, commands[1].operationId);
  assert.equal(commands[0].expenseId, commands[1].expenseId);
  assert.equal(value.controller.getState().expenses.length, 1);
});

test('Expense tanpa sesi ditolak sebelum service, snapshot, atau pembuatan ID', async () => {
  let serviceCalls = 0;
  let idCalls = 0;
  const pendingExpenseStore = fakeSessionStore();
  const cryptoRef = {
    getRandomValues(value) {
      idCalls += 1;
      return webcrypto.getRandomValues(value);
    },
    randomUUID() {
      idCalls += 1;
      return webcrypto.randomUUID();
    },
  };
  const value = await harness({
    pendingExpenseStore,
    cryptoRef,
    decorateService(service) {
      return {
        ...service,
        recordExpense() {
          serviceCalls += 1;
          return Promise.resolve();
        },
      };
    },
  });
  assert.equal(value.controller.getState().session, null);
  idCalls = 0;
  await assert.rejects(
    value.controller.submit('expense', EXPENSE_INPUT),
    { code: 'cash_session_required' },
  );
  assert.equal(serviceCalls, 0);
  assert.equal(pendingExpenseStore.size, 0);
  assert.equal(idCalls, 0);
});

test('kegagalan reload saat inisialisasi menutup koneksi dan submit fail-closed', async () => {
  const fixture = await seedMemoryWorkspace();
  let authListener;
  let closeCalls = 0;
  let serviceCalls = 0;
  const controller = createCashManagementController({
    contract: { enabled: true },
    view: fakeView(),
    subscribeAuth(listener) { authListener = listener; return () => {}; },
    createScopes: async () => ({ accountScope: ACCOUNT_A, userScope: USER_A }),
    openDatabase: async () => ({ close() { closeCalls += 1; } }),
    createContext: () => ({
      run(storeNames, mode, callback) {
        if (storeNames.includes('workspaces')) {
          return fixture.memory.repositoryContext.run(storeNames, mode, callback);
        }
        throw storageError('storage_error');
      },
    }),
    createService: () => ({
      recordExpense() { serviceCalls += 1; },
      open() { serviceCalls += 1; },
      close() { serviceCalls += 1; },
    }),
    cryptoRef: webcrypto,
  });
  authListener({ isAuthenticated: true, user: { uid: 'fixture' } });
  await settle();
  assert.equal(controller.getState().state, 'error');
  assert.equal(controller.getState().session, null);
  assert.deepEqual(controller.getState().expenses, []);
  assert.equal(closeCalls, 1);
  await assert.rejects(controller.submit('expense', EXPENSE_INPUT), { code: 'permission_denied' });
  assert.equal(serviceCalls, 0);
});

test('failure sebelum commit mempersistenkan absent dan refresh mempertahankan lifecycle retry', async () => {
  const fixture = await seedMemoryWorkspace();
  const pendingExpenseStore = fakeSessionStore();
  let firstCommand;
  const first = await harness({
    fixture,
    pendingExpenseStore,
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          firstCommand = command;
          return Promise.reject(storageError('storage_error'));
        },
      };
    },
  });
  await openSession(first);
  await assert.rejects(first.controller.submit('expense', EXPENSE_INPUT));
  assert.equal(pendingExpenseStore.entries.length, 1);
  assert.equal(pendingExpenseStore.entries[0].outcome, 'absent');
  first.controller.destroy();

  const commands = [];
  const second = await harness({
    fixture,
    pendingExpenseStore,
    now: () => '2026-07-25T05:00:00.000Z',
    decorateService(service) {
      return {
        ...service,
        recordExpense(command) {
          commands.push(command);
          return service.recordExpense(command);
        },
      };
    },
  });
  assert.equal(pendingExpenseStore.entries.length, 1);
  assert.equal(pendingExpenseStore.entries[0].outcome, 'absent');
  await second.controller.submit('expense', EXPENSE_INPUT);
  assert.equal(commands[0].operationId, firstCommand.operationId);
  assert.equal(commands[0].expenseId, firstCommand.expenseId);
  assert.equal(second.controller.getState().expenses.length, 1);
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

test('logout membuang pending Expense yang belum memiliki hasil pasti', async () => {
  const pendingExpenseStore = fakeSessionStore();
  const value = await harness({
    pendingExpenseStore,
    decorateService(service) {
      return {
        ...service,
        recordExpense() { return Promise.reject(storageError('storage_error')); },
      };
    },
  });
  await openSession(value);
  await assert.rejects(value.controller.submit('expense', EXPENSE_INPUT), { code: 'storage_unknown' });
  assert.equal(pendingExpenseStore.size, 1);
  value.authListener({ isAuthenticated: false, user: null });
  await settle();
  assert.equal(pendingExpenseStore.size, 0);
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

test('render Expense menampilkan payload HTML sebagai plain text tanpa membuat elemen aktif', () => {
  const documentRef = new FakeDocument();
  const status = new FakeElement('p');
  const expenseList = new FakeElement('ul');
  const root = {
    ownerDocument: documentRef,
    dataset: {},
    setAttribute() {},
    querySelector(selector) {
      if (selector === '[data-cash-status]') return status;
      if (selector === '[data-expense-list]') return expenseList;
      return null;
    },
    querySelectorAll() { return []; },
  };
  const payload = '<img src=x onerror="globalThis.__xss=true">';
  globalThis.__xss = false;
  try {
    const view = createCashManagementView(root, documentRef);
    view.render({
      state: 'open-session',
      message: 'Sesi kas aktif.',
      session: null,
      lastClosedSession: null,
      expenses: [{
        expenseId: 'expense_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category: 'operational',
        amountMinor: 25000,
        note: payload,
        recordedAtLocal: '2026-07-25T04:00:00.000Z',
      }],
      summary: null,
      canExpense: true,
      canClose: true,
      submitting: false,
      confirmOpen: false,
    });
    assert.match(collectText(expenseList), new RegExp(payload.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
    assert.equal(findAll(expenseList, (node) => node.tagName === 'IMG').length, 0);
    assert.equal(globalThis.__xss, false);
  } finally {
    delete globalThis.__xss;
  }
});
