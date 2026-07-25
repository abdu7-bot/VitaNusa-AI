import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createClosingSummary } from '../../../assets/js/mandiri/pos/domain/cash-session.js';
import { normalizeExpense } from '../../../assets/js/mandiri/pos/domain/expense.js';
import { createCashSessionService } from '../../../assets/js/mandiri/pos/services/cash-session-service.js';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import {
  ATOMIC_CASH_STORE_NAMES,
  createRepositoryContext,
} from '../../../assets/js/mandiri/repositories/repository-context.js';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';

const ACCOUNT = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE = 'workspace_11111111-1111-4111-8111-111111111111';
const SESSION = 'cashsession_22222222-2222-4222-8222-222222222222';
const SESSION_B = 'cashsession_33333333-3333-4333-8333-333333333333';
const EXPENSE = 'expense_44444444-4444-4444-8444-444444444444';
const OPEN_OP = 'op_55555555-5555-4555-8555-555555555555';
const EXPENSE_OP = 'op_66666666-6666-4666-8666-666666666666';
const CLOSE_OP = 'op_77777777-7777-4777-8777-777777777777';
const OPEN_EVENT = 'audit_88888888-8888-4888-8888-888888888888';
const EXPENSE_EVENT = 'audit_99999999-9999-4999-8999-999999999999';
const CLOSE_EVENT = 'audit_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACTOR = 'user_scope_actor';
const OPENED_AT = '2026-07-25T01:00:00.000Z';
const EXPENSE_AT = '2026-07-25T02:00:00.000Z';
const CLOSED_AT = '2026-07-25T03:00:00.000Z';

const digest = (value) => createPayloadDigest(value, webcrypto);

const openCommand = (overrides = {}) => ({
  schemaVersion: 1,
  accountScope: ACCOUNT,
  workspaceId: WORKSPACE,
  actorScope: ACTOR,
  actorRole: 'merchant_owner',
  operationId: OPEN_OP,
  eventId: OPEN_EVENT,
  cashSessionId: SESSION,
  openingCashMinor: 10000,
  createdAtLocal: OPENED_AT,
  ...overrides,
});

const expenseCommand = (overrides = {}) => ({
  schemaVersion: 1,
  accountScope: ACCOUNT,
  workspaceId: WORKSPACE,
  actorScope: ACTOR,
  actorRole: 'merchant_owner',
  operationId: EXPENSE_OP,
  eventId: EXPENSE_EVENT,
  cashSessionId: SESSION,
  expenseId: EXPENSE,
  expectedVersion: 1,
  category: 'operational',
  amountMinor: 2000,
  note: 'Air minum toko',
  createdAtLocal: EXPENSE_AT,
  ...overrides,
});

const closeCommand = (overrides = {}) => ({
  schemaVersion: 1,
  accountScope: ACCOUNT,
  workspaceId: WORKSPACE,
  actorScope: ACTOR,
  actorRole: 'merchant_owner',
  operationId: CLOSE_OP,
  eventId: CLOSE_EVENT,
  cashSessionId: SESSION,
  expectedVersion: 2,
  countedCashMinor: 7500,
  createdAtLocal: CLOSED_AT,
  ...overrides,
});

async function addMembership(repositories, {
  accountScope = ACCOUNT,
  workspaceId = WORKSPACE,
  actorScope = ACTOR,
  role = 'merchant_owner',
  membershipId = 'membership_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
} = {}) {
  await repositories.membershipRepository.add(accountScope, workspaceId, {
    schemaVersion: 1,
    version: 1,
    membershipId,
    accountScope,
    workspaceId,
    userScope: actorScope,
    role,
    status: 'active',
    createdAtLocal: OPENED_AT,
    updatedAtLocal: OPENED_AT,
  });
}

async function setupMemory({ role = 'merchant_owner' } = {}) {
  const memory = createMemoryRepositories();
  await addMembership(memory, { role });
  const service = createCashSessionService({
    repositoryContext: memory.repositoryContext,
    digestFactory: digest,
  });
  return { memory, service };
}

test('Expense immutable dan closing summary memakai safe integer money', () => {
  const expense = normalizeExpense({
    schemaVersion: 1,
    expenseId: EXPENSE,
    workspaceId: WORKSPACE,
    cashSessionId: SESSION,
    category: 'operational',
    amountMinor: 2000,
    note: null,
    status: 'recorded',
    operationId: EXPENSE_OP,
    actorScope: ACTOR,
    actorRole: 'merchant_owner',
    recordedAtLocal: EXPENSE_AT,
  });
  assert.equal(Object.isFrozen(expense), true);
  const summary = createClosingSummary({
    openingCashMinor: 10000,
    cashSalesMinor: 5000,
    expenseOutMinor: 2000,
    countedCashMinor: 12500,
  });
  assert.deepEqual(summary, {
    cashSalesMinor: 5000,
    expenseOutMinor: 2000,
    expectedCashMinor: 13000,
    countedCashMinor: 12500,
    differenceMinor: -500,
  });
  assert.equal(Object.isFrozen(summary), true);
});

test('membuka, mencatat expense, dan menutup session menghasilkan summary serta audit atomik', async () => {
  const { memory, service } = await setupMemory();
  const opened = await service.open(openCommand());
  assert.equal(opened.status, 'committed');
  assert.equal(opened.cashSession.status, 'open');
  assert.equal(opened.cashSession.version, 1);

  const recorded = await service.recordExpense(expenseCommand());
  assert.equal(recorded.expense.amountMinor, 2000);
  assert.equal(recorded.cashSession.version, 2);

  const closed = await service.close(closeCommand());
  assert.equal(closed.cashSession.status, 'closed');
  assert.equal(closed.cashSession.version, 3);
  assert.deepEqual(closed.cashSession.closingSummary, {
    cashSalesMinor: 0,
    expenseOutMinor: 2000,
    expectedCashMinor: 8000,
    countedCashMinor: 7500,
    differenceMinor: -500,
  });
  assert.equal((await memory.auditRepository.listByOperation(ACCOUNT, CLOSE_OP)).length, 1);
  assert.ok(await memory.operationReceiptRepository.getByOperationId(ACCOUNT, CLOSE_OP));
});

test('session ganda ditolak dan session closed immutable', async () => {
  const { service } = await setupMemory();
  await service.open(openCommand());
  await assert.rejects(service.open(openCommand({
    operationId: 'op_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    eventId: 'audit_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    cashSessionId: SESSION_B,
  })), { code: 'cash_session_already_open' });
  await service.close(closeCommand({ expectedVersion: 1, countedCashMinor: 10000 }));
  await assert.rejects(service.recordExpense(expenseCommand()), { code: 'cash_session_closed' });
});

test('expense invalid, overflow, dan version conflict ditolak tanpa mutation', async () => {
  const { memory, service } = await setupMemory();
  await assert.rejects(service.open(openCommand({
    openingCashMinor: Number.MAX_SAFE_INTEGER + 1,
  })), { code: 'unsafe_integer' });
  await service.open(openCommand());
  for (const invalid of [
    expenseCommand({ amountMinor: 0 }),
    expenseCommand({ category: 'not_allowed' }),
  ]) {
    await assert.rejects(service.recordExpense(invalid), { code: 'data_invalid' });
  }
  await assert.rejects(service.recordExpense(expenseCommand({
    expectedVersion: 2,
  })), { code: 'version_conflict' });
  assert.equal((await memory.expenseRepository.listByCashSession(
    ACCOUNT,
    WORKSPACE,
    SESSION,
  )).length, 0);
  assert.throws(() => createClosingSummary({
    openingCashMinor: Number.MAX_SAFE_INTEGER,
    cashSalesMinor: 1,
    expenseOutMinor: 0,
    countedCashMinor: 0,
  }), { code: 'money_overflow' });
});

test('permission diperiksa di transaksi dan repository mengisolasi account/workspace', async () => {
  const cashier = await setupMemory({ role: 'cashier' });
  assert.equal((await cashier.service.open(openCommand({ actorRole: 'cashier' }))).status, 'committed');
  await assert.rejects(cashier.service.recordExpense(expenseCommand({
    actorRole: 'cashier',
  })), { code: 'permission_denied' });
  await assert.rejects(cashier.service.close(closeCommand({
    actorRole: 'cashier',
    expectedVersion: 1,
  })), { code: 'permission_denied' });
  assert.equal(await cashier.memory.cashSessionRepository.get(ACCOUNT_B, WORKSPACE, SESSION), null);
  await assert.rejects(cashier.service.open(openCommand({
    accountScope: ACCOUNT_B,
    operationId: 'op_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    eventId: 'audit_ffffffff-ffff-4fff-8fff-ffffffffffff',
    cashSessionId: SESSION_B,
  })), { code: 'permission_denied' });
});

test('retry payload sama duplicate-safe dan payload berbeda ditolak', async () => {
  const { service } = await setupMemory();
  assert.equal((await service.open(openCommand())).status, 'committed');
  assert.equal((await service.open(openCommand())).status, 'duplicate-safe');
  await assert.rejects(service.open(openCommand({ openingCashMinor: 12000 })), {
    code: 'idempotency_mismatch',
  });
  assert.equal((await service.recordExpense(expenseCommand())).status, 'committed');
  assert.equal((await service.recordExpense(expenseCommand())).status, 'duplicate-safe');
  await assert.rejects(service.recordExpense(expenseCommand({ amountMinor: 3000 })), {
    code: 'idempotency_mismatch',
  });
  assert.equal((await service.close(closeCommand())).status, 'committed');
  assert.equal((await service.close(closeCommand())).status, 'duplicate-safe');
  await assert.rejects(service.close(closeCommand({ countedCashMinor: 8000 })), {
    code: 'idempotency_mismatch',
  });
});

test('kegagalan audit me-rollback expense, session version, dan operation receipt', async () => {
  const fixture = await setupMemory();
  await fixture.service.open(openCommand());
  const failingContext = {
    run(storeNames, mode, callback) {
      return fixture.memory.repositoryContext.run(storeNames, mode, (repositories) => callback(
        Object.freeze({
          ...repositories,
          auditRepository: Object.freeze({
            ...repositories.auditRepository,
            append: async () => { throw new Error('injected'); },
          }),
        }),
      ));
    },
  };
  const service = createCashSessionService({
    repositoryContext: failingContext,
    digestFactory: digest,
  });
  await assert.rejects(service.recordExpense(expenseCommand()), { code: 'transaction_aborted' });
  assert.equal(await fixture.memory.expenseRepository.get(ACCOUNT, WORKSPACE, EXPENSE), null);
  assert.equal((await fixture.memory.cashSessionRepository.get(
    ACCOUNT,
    WORKSPACE,
    SESSION,
  )).version, 1);
  assert.equal(
    await fixture.memory.operationReceiptRepository.getByOperationId(ACCOUNT, EXPENSE_OP),
    null,
  );
});

test('memory dan IndexedDB parity bertahan setelah reopen', async () => {
  const indexedDBFactory = new IDBFactory();
  const databaseName = 'cash-session-indexed-parity';
  let connection = await openMandiriDatabase({
    indexedDBFactory,
    keyRangeFactory: IDBKeyRange,
    databaseName,
  });
  let context = createRepositoryContext(connection);
  await context.run(ATOMIC_CASH_STORE_NAMES, 'readwrite', (repositories) => (
    addMembership(repositories)
  ));
  let service = createCashSessionService({ repositoryContext: context, digestFactory: digest });
  await service.open(openCommand());
  await service.recordExpense(expenseCommand());
  await service.close(closeCommand());
  connection.close();

  connection = await openMandiriDatabase({
    indexedDBFactory,
    keyRangeFactory: IDBKeyRange,
    databaseName,
  });
  context = createRepositoryContext(connection);
  const persisted = await context.run(
    ATOMIC_CASH_STORE_NAMES,
    'readonly',
    async (repositories) => ({
      session: await repositories.cashSessionRepository.get(ACCOUNT, WORKSPACE, SESSION),
      expense: await repositories.expenseRepository.get(ACCOUNT, WORKSPACE, EXPENSE),
    }),
  );
  assert.equal(persisted.session.status, 'closed');
  assert.equal(persisted.session.closingSummary.expenseOutMinor, 2000);
  assert.equal(persisted.expense.amountMinor, 2000);
  service = createCashSessionService({ repositoryContext: context, digestFactory: digest });
  assert.equal((await service.close(closeCommand())).status, 'duplicate-safe');
  connection.close();
});
