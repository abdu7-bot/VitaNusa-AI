import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createRepositoryContext } from '../../../assets/js/mandiri/repositories/repository-context.js';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { storageError } from '../../../assets/js/mandiri/storage/storage-errors.js';
import { createWorkspaceService } from '../../../assets/js/mandiri/services/workspace-service.js';

const HASH_A = 'c'.repeat(64);
const HASH_B = 'd'.repeat(64);
const ACCOUNT_A = `account:${HASH_A}`;
const USER_A = `user:${HASH_A}`;
const ACCOUNT_B = `account:${HASH_B}`;
const USER_B = `user:${HASH_B}`;

async function openHarness(name, { factory = new IDBFactory(), contextTransform } = {}) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
  const baseContext = createRepositoryContext(connection);
  const repositoryContext = contextTransform ? contextTransform(baseContext) : baseContext;
  const service = createWorkspaceService({ repositoryContext });
  return { connection, factory, baseContext, repositoryContext, service };
}

function prepare(service, {
  accountScope = ACCOUNT_A,
  userScope = USER_A,
  name = 'Workspace IndexedDB',
} = {}) {
  return service.prepareCreateWorkspaceCommand({
    accountScope,
    userScope,
    name,
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
  });
}

async function readRecords(context, command) {
  return context.run(
    ['workspaces', 'memberships', 'auditEvents', 'operationReceipts'],
    'readonly',
    async (repositories) => {
      const workspaces = await repositories.workspaceRepository.listByAccount(
        command.accountScope,
      );
      const memberships = await repositories.membershipRepository.listByWorkspace(
        command.accountScope,
        command.workspaceId,
      );
      const auditEvents = await repositories.auditRepository.listByWorkspace(
        command.accountScope,
        command.workspaceId,
      );
      const receipt = await repositories.operationReceiptRepository.getByOperationId(
        command.accountScope,
        command.operationId,
      );
      return { workspaces, memberships, auditEvents, receipt };
    },
  );
}

test('membuka IndexedDB schema version 1', async (t) => {
  const harness = await openHarness('workspace-service-open-v1');
  t.after(() => harness.connection.close());
  assert.equal(harness.connection.schemaVersion, 1);
});

test('create workspace menulis empat store dalam satu operasi', async (t) => {
  const harness = await openHarness('workspace-service-four-stores');
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);
  const result = await harness.service.createWorkspace(command);
  const records = await readRecords(harness.baseContext, command);

  assert.equal(result.status, 'created');
  assert.equal(records.workspaces.length, 1);
  assert.equal(records.memberships.length, 1);
  assert.equal(records.auditEvents.length, 1);
  assert.ok(records.receipt);
});

test('service resolve hanya setelah repository transaction complete', async (t) => {
  let transactionCompleted = false;
  const harness = await openHarness('workspace-service-waits-complete', {
    contextTransform(baseContext) {
      return {
        async run(...args) {
          const value = await baseContext.run(...args);
          transactionCompleted = true;
          return value;
        },
      };
    },
  });
  t.after(() => harness.connection.close());

  await harness.service.createWorkspace(prepare(harness.service));
  assert.equal(transactionCompleted, true);
});

test('duplicate submit menghasilkan satu workspace', async (t) => {
  const harness = await openHarness('workspace-service-duplicate-workspace');
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);
  await harness.service.createWorkspace(command);
  const duplicate = await harness.service.createWorkspace(command);
  const records = await readRecords(harness.baseContext, command);

  assert.equal(duplicate.status, 'duplicate-safe');
  assert.equal(records.workspaces.length, 1);
});

test('duplicate submit menghasilkan satu owner membership', async (t) => {
  const harness = await openHarness('workspace-service-duplicate-membership');
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);
  await harness.service.createWorkspace(command);
  await harness.service.createWorkspace(command);
  assert.equal((await readRecords(harness.baseContext, command)).memberships.length, 1);
});

test('duplicate submit menghasilkan satu audit event', async (t) => {
  const harness = await openHarness('workspace-service-duplicate-audit');
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);
  await harness.service.createWorkspace(command);
  await harness.service.createWorkspace(command);
  assert.equal((await readRecords(harness.baseContext, command)).auditEvents.length, 1);
});

test('duplicate submit menghasilkan satu operation receipt', async (t) => {
  const harness = await openHarness('workspace-service-duplicate-receipt');
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);
  await harness.service.createWorkspace(command);
  await harness.service.createWorkspace(command);
  const records = await readRecords(harness.baseContext, command);

  assert.ok(records.receipt);
  assert.equal(records.receipt.operationId, command.operationId);
});

test('receipt digest mismatch ditolak tanpa write baru', async (t) => {
  const harness = await openHarness('workspace-service-mismatch');
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);
  await harness.service.createWorkspace(command);

  await assert.rejects(
    harness.service.createWorkspace(Object.freeze({ ...command, name: 'Nama Berbeda' })),
    { code: 'idempotency_mismatch' },
  );
  assert.equal((await readRecords(harness.baseContext, command)).workspaces.length, 1);
});

test('abort setelah workspace write menghapus seluruh partial write', async (t) => {
  const harness = await openHarness('workspace-service-atomic-abort', {
    contextTransform(baseContext) {
      return {
        run(storeNames, mode, callback) {
          return baseContext.run(storeNames, mode, (repositories) => callback(Object.freeze({
            ...repositories,
            membershipRepository: Object.freeze({
              ...repositories.membershipRepository,
              async add() {
                throw new Error('simulated membership failure');
              },
            }),
          })));
        },
      };
    },
  });
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);

  await assert.rejects(harness.service.createWorkspace(command), {
    code: 'transaction_aborted',
  });
  const records = await readRecords(harness.baseContext, command);
  assert.equal(records.workspaces.length, 0);
  assert.equal(records.memberships.length, 0);
  assert.equal(records.auditEvents.length, 0);
  assert.equal(records.receipt, null);
});

test('close dan reopen mempertahankan workspace tanpa membuat record baru', async () => {
  const factory = new IDBFactory();
  const name = 'workspace-service-reload';
  const first = await openHarness(name, { factory });
  const command = prepare(first.service);
  await first.service.createWorkspace(command);
  first.connection.close();

  const second = await openHarness(name, { factory });
  try {
    const state = await second.service.getWorkspaceState(ACCOUNT_A, USER_A);
    assert.equal(state.status, 'ready');
    assert.equal(state.workspace.workspaceId, command.workspaceId);
    assert.equal((await second.service.listLocalWorkspaces(ACCOUNT_A)).length, 1);
  } finally {
    second.connection.close();
  }
});

test('akun A tidak terlihat oleh akun B pada database yang sama', async (t) => {
  const harness = await openHarness('workspace-service-account-isolation');
  t.after(() => harness.connection.close());
  await harness.service.createWorkspace(prepare(harness.service));

  assert.equal((await harness.service.getWorkspaceState(ACCOUNT_B, USER_B)).status, 'empty');
  assert.equal((await harness.service.listLocalWorkspaces(ACCOUNT_B)).length, 0);
});

test('akun A dan akun B dapat mempunyai workspace masing-masing', async (t) => {
  const harness = await openHarness('workspace-service-two-scopes');
  t.after(() => harness.connection.close());
  const commandA = prepare(harness.service, { name: 'Workspace A' });
  const commandB = prepare(harness.service, {
    accountScope: ACCOUNT_B,
    userScope: USER_B,
    name: 'Workspace B',
  });

  await harness.service.createWorkspace(commandA);
  await harness.service.createWorkspace(commandB);
  assert.equal((await harness.service.listLocalWorkspaces(ACCOUNT_A))[0].name, 'Workspace A');
  assert.equal((await harness.service.listLocalWorkspaces(ACCOUNT_B))[0].name, 'Workspace B');
});

test('connection yang ditutup dapat diganti dengan connection baru', async () => {
  const factory = new IDBFactory();
  const name = 'workspace-service-close-reopen';
  const first = await openHarness(name, { factory });
  first.connection.close();
  await assert.rejects(first.service.listLocalWorkspaces(ACCOUNT_A), {
    code: 'storage_error',
  });

  const second = await openHarness(name, { factory });
  try {
    assert.deepEqual(await second.service.listLocalWorkspaces(ACCOUNT_A), []);
  } finally {
    second.connection.close();
  }
});

test('quota error dipetakan ke pesan workspace yang aman', async () => {
  const service = createWorkspaceService({
    repositoryContext: {
      run() {
        throw storageError('quota_exceeded', new Error('record payload should stay hidden'));
      },
    },
  });
  const command = prepare(service);

  await assert.rejects(service.createWorkspace(command), (error) => {
    assert.equal(error.code, 'quota_exceeded');
    assert.doesNotMatch(error.message, /record payload/);
    return true;
  });
});

test('record IndexedDB tidak memuat email atau token', async (t) => {
  const harness = await openHarness('workspace-service-private-records');
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);
  await harness.service.createWorkspace(command);
  const serialized = JSON.stringify(await readRecords(harness.baseContext, command));

  assert.doesNotMatch(serialized, /@/);
  assert.doesNotMatch(serialized, /accessToken|refreshToken|password|privateKey/i);
});

test('double submit serentak tetap menghasilkan satu set record', async (t) => {
  const harness = await openHarness('workspace-service-concurrent-submit');
  t.after(() => harness.connection.close());
  const command = prepare(harness.service);
  const results = await Promise.all([
    harness.service.createWorkspace(command),
    harness.service.createWorkspace(command),
  ]);
  const records = await readRecords(harness.baseContext, command);

  assert.deepEqual(results.map(({ status }) => status).sort(), ['created', 'duplicate-safe']);
  assert.deepEqual(
    [records.workspaces.length, records.memberships.length, records.auditEvents.length],
    [1, 1, 1],
  );
});
