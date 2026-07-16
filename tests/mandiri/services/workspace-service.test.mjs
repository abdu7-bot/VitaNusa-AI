import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import { createWorkspaceService } from '../../../assets/js/mandiri/services/workspace-service.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const ACCOUNT_A = `account:${HASH_A}`;
const USER_A = `user:${HASH_A}`;
const ACCOUNT_B = `account:${HASH_B}`;
const USER_B = `user:${HASH_B}`;
const NOW = '2026-07-17T08:00:00.000Z';

function uuid(sequence) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

function createHarness({ repositoryContextTransform, now = NOW } = {}) {
  const memory = createMemoryRepositories();
  let sequence = 0;
  const calls = [];
  const idFactory = (prefix) => {
    calls.push(prefix);
    sequence += 1;
    return `${prefix}_${uuid(sequence)}`;
  };
  const operationIdFactory = () => {
    calls.push('op');
    sequence += 1;
    return `op_${uuid(sequence)}`;
  };
  const repositoryContext = repositoryContextTransform
    ? repositoryContextTransform(memory.repositoryContext)
    : memory.repositoryContext;
  const service = createWorkspaceService({
    repositoryContext,
    idFactory,
    operationIdFactory,
    now: () => now,
  });
  return { memory, service, calls };
}

function prepare(service, overrides = {}) {
  return service.prepareCreateWorkspaceCommand({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    name: '  Warung Rukun  ',
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
    ...overrides,
  });
}

async function readAll(memory, command) {
  const [workspaces, memberships, auditEvents, receipt] = await Promise.all([
    memory.workspaceRepository.listByAccount(command.accountScope),
    memory.membershipRepository.listByWorkspace(command.accountScope, command.workspaceId),
    memory.auditRepository.listByWorkspace(command.accountScope, command.workspaceId),
    memory.operationReceiptRepository.getByOperationId(
      command.accountScope,
      command.operationId,
    ),
  ]);
  return { workspaces, memberships, auditEvents, receipt };
}

function failRepositoryMethod(baseContext, repositoryName, methodName) {
  return Object.freeze({
    run(storeNames, mode, callback) {
      return baseContext.run(storeNames, mode, (repositories) => {
        const original = repositories[repositoryName];
        const replacement = Object.freeze({
          ...original,
          [methodName]: async () => {
            throw new Error('simulated write failure without record data');
          },
        });
        return callback(Object.freeze({
          ...repositories,
          [repositoryName]: replacement,
        }));
      });
    },
  });
}

test('command valid disiapkan dengan seluruh ID dan waktu hanya sekali', () => {
  const { service, calls } = createHarness();
  const command = prepare(service);

  assert.deepEqual(calls, ['workspace', 'membership', 'audit', 'op']);
  assert.match(command.workspaceId, /^workspace_/);
  assert.match(command.membershipId, /^membership_/);
  assert.match(command.eventId, /^audit_/);
  assert.match(command.operationId, /^op_/);
  assert.equal(command.createdAtLocal, NOW);
  assert.equal(Object.isFrozen(command), true);
});

test('command menormalisasi nama dan memakai default IDR serta Asia/Jakarta', () => {
  const { service } = createHarness();
  const command = service.prepareCreateWorkspaceCommand({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    name: '  Ruang Bersama  ',
  });

  assert.equal(command.name, 'Ruang Bersama');
  assert.equal(command.currencyCode, 'IDR');
  assert.equal(command.timezone, 'Asia/Jakarta');
});

test('command immutable dan input tidak dimutasi', () => {
  const { service } = createHarness();
  const input = Object.freeze({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    name: '  Ruang Aman  ',
    timezone: 'Asia/Makassar',
    currencyCode: 'IDR',
  });
  const command = service.prepareCreateWorkspaceCommand(input);

  assert.throws(() => { command.name = 'Diubah'; }, TypeError);
  assert.equal(input.name, '  Ruang Aman  ');
});

test('command dari schema version yang belum didukung ditolak', async () => {
  const { service } = createHarness();
  const command = prepare(service);
  await assert.rejects(
    service.createWorkspace(Object.freeze({ ...command, schemaVersion: 2 })),
    { code: 'invalid_workspace_input' },
  );
});

test('userScope kosong dan scope yang tidak berpasangan ditolak', () => {
  const { service } = createHarness();
  assert.throws(() => prepare(service, { userScope: '' }), { code: 'invalid_workspace_input' });
  assert.throws(() => prepare(service, { userScope: USER_B }), { code: 'scope_mismatch' });
});

test('validasi form menolak nama kosong, whitespace, dan terlalu panjang', () => {
  const { service } = createHarness();
  assert.throws(() => prepare(service, { name: '' }), { code: 'invalid_workspace_input' });
  assert.throws(() => prepare(service, { name: '   ' }), { code: 'invalid_workspace_input' });
  assert.throws(() => prepare(service, { name: 'a'.repeat(121) }), {
    code: 'invalid_workspace_input',
  });
});

test('validasi form menerima timezone IANA dan menolak timezone tidak dikenal', () => {
  const { service } = createHarness();
  assert.equal(prepare(service, { timezone: 'Asia/Jayapura' }).timezone, 'Asia/Jayapura');
  assert.throws(() => prepare(service, { timezone: 'Indonesia/Unknown' }), {
    code: 'invalid_workspace_input',
  });
});

test('validasi form hanya menerima IDR dan menolak field tambahan', () => {
  const { service } = createHarness();
  assert.equal(prepare(service, { currencyCode: 'IDR' }).currencyCode, 'IDR');
  assert.throws(() => prepare(service, { currencyCode: 'USD' }), {
    code: 'invalid_workspace_input',
  });
  assert.throws(
    () => service.prepareCreateWorkspaceCommand({
      accountScope: ACCOUNT_A,
      userScope: USER_A,
      name: 'Ruang Aman',
      token: 'not-a-real-token',
    }),
    { code: 'invalid_workspace_input' },
  );
});

test('workspace, owner, audit, dan receipt dibuat dengan satu scope', async () => {
  const { memory, service } = createHarness();
  const command = prepare(service);
  const created = await service.createWorkspace(command);
  const records = await readAll(memory, command);

  assert.equal(created.status, 'created');
  assert.equal(records.workspaces.length, 1);
  assert.equal(records.memberships.length, 1);
  assert.equal(records.auditEvents.length, 1);
  assert.ok(records.receipt);
  assert.equal(records.workspaces[0].accountScope, ACCOUNT_A);
  assert.equal(records.memberships[0].accountScope, ACCOUNT_A);
  assert.equal(records.auditEvents[0].accountScope, ACCOUNT_A);
  assert.equal(records.receipt.accountScope, ACCOUNT_A);
  assert.equal(records.memberships[0].workspaceId, command.workspaceId);
  assert.equal(records.auditEvents[0].workspaceId, command.workspaceId);
  assert.equal(records.receipt.workspaceId, command.workspaceId);
});

test('owner membership memakai merchant_owner aktif', async () => {
  const { memory, service } = createHarness();
  const command = prepare(service);
  await service.createWorkspace(command);
  const membership = await memory.membershipRepository.getById(
    ACCOUNT_A,
    command.workspaceId,
    command.membershipId,
  );

  assert.equal(membership.role, 'merchant_owner');
  assert.equal(membership.status, 'active');
  assert.equal(membership.userScope, USER_A);
});

test('audit workspace_created minimal dan aman', async () => {
  const { memory, service } = createHarness();
  const command = prepare(service);
  await service.createWorkspace(command);
  const event = await memory.auditRepository.getById(
    ACCOUNT_A,
    command.workspaceId,
    command.eventId,
  );

  assert.equal(event.action, 'workspace_created');
  assert.equal(event.actorRole, 'merchant_owner');
  assert.equal(event.entityType, 'workspace');
  assert.equal(event.result, 'success');
  assert.equal(event.reasonCode, 'none');
  assert.equal(Object.hasOwn(event, 'before'), false);
  assert.equal(Object.hasOwn(event, 'after'), false);
});

test('receipt committed hanya menyimpan digest dan bukan payload', async () => {
  const { memory, service } = createHarness();
  const command = prepare(service);
  await service.createWorkspace(command);
  const receipt = await memory.operationReceiptRepository.getByOperationId(
    ACCOUNT_A,
    command.operationId,
  );

  assert.equal(receipt.result, 'committed');
  assert.equal(receipt.operationType, 'workspace_create');
  assert.match(receipt.payloadDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(Object.hasOwn(receipt, 'payload'), false);
  assert.doesNotMatch(JSON.stringify(receipt), /Warung Rukun/);
});

test('satu akun hanya dapat mempunyai satu workspace lokal', async () => {
  const { memory, service } = createHarness();
  await service.createWorkspace(prepare(service, { name: 'Workspace Pertama' }));
  const second = prepare(service, { name: 'Workspace Kedua' });

  await assert.rejects(service.createWorkspace(second), { code: 'workspace_already_exists' });
  assert.equal((await memory.workspaceRepository.listByAccount(ACCOUNT_A)).length, 1);
});

test('retry command yang sama menjadi duplicate-safe tanpa record kedua', async () => {
  const { memory, service } = createHarness();
  const command = prepare(service);
  const first = await service.createWorkspace(command);
  const second = await service.createWorkspace(command);
  const records = await readAll(memory, command);

  assert.equal(first.status, 'created');
  assert.equal(second.status, 'duplicate-safe');
  assert.equal(records.workspaces.length, 1);
  assert.equal(records.memberships.length, 1);
  assert.equal(records.auditEvents.length, 1);
  assert.ok(records.receipt);
});

test('double invocation in-flight memakai satu operasi dan satu set record', async () => {
  const { memory, service } = createHarness();
  const command = prepare(service);
  const [first, second] = await Promise.all([
    service.createWorkspace(command),
    service.createWorkspace(command),
  ]);
  const records = await readAll(memory, command);

  assert.deepEqual([first.status, second.status].sort(), ['created', 'duplicate-safe']);
  assert.equal(records.workspaces.length, 1);
  assert.equal(records.memberships.length, 1);
  assert.equal(records.auditEvents.length, 1);
});

test('operation ID sama dengan payload berbeda ditolak', async () => {
  const { memory, service } = createHarness();
  const command = prepare(service);
  await service.createWorkspace(command);
  const mismatched = Object.freeze({ ...command, name: 'Nama Berbeda' });

  await assert.rejects(service.createWorkspace(mismatched), { code: 'idempotency_mismatch' });
  assert.equal((await memory.workspaceRepository.listByAccount(ACCOUNT_A)).length, 1);
});

test('receipt rusak tidak diperbaiki atau ditimpa diam-diam', async () => {
  const source = createHarness();
  const command = prepare(source.service);
  await source.service.createWorkspace(command);
  const receipt = await source.memory.operationReceiptRepository.getByOperationId(
    ACCOUNT_A,
    command.operationId,
  );

  const target = createHarness();
  await target.memory.operationReceiptRepository.append(ACCOUNT_A, receipt);
  await assert.rejects(target.service.createWorkspace(command), { code: 'integrity_error' });
  assert.equal((await target.memory.workspaceRepository.listByAccount(ACCOUNT_A)).length, 0);
  assert.equal(
    (await target.memory.operationReceiptRepository.getByOperationId(
      ACCOUNT_A,
      command.operationId,
    )).payloadDigest,
    receipt.payloadDigest,
  );
});

for (const [label, repositoryName, methodName] of [
  ['membership', 'membershipRepository', 'add'],
  ['audit', 'auditRepository', 'append'],
  ['receipt', 'operationReceiptRepository', 'append'],
]) {
  test(`kegagalan ${label} me-rollback seluruh write sebelumnya`, async () => {
    let memoryRef;
    const harness = createHarness({
      repositoryContextTransform(baseContext) {
        return failRepositoryMethod(baseContext, repositoryName, methodName);
      },
    });
    memoryRef = harness.memory;
    const command = prepare(harness.service);

    await assert.rejects(harness.service.createWorkspace(command), {
      code: 'transaction_aborted',
    });
    const records = await readAll(memoryRef, command);
    assert.equal(records.workspaces.length, 0);
    assert.equal(records.memberships.length, 0);
    assert.equal(records.auditEvents.length, 0);
    assert.equal(records.receipt, null);
  });
}

test('account isolation mencegah akun B membaca workspace akun A', async () => {
  const { service } = createHarness();
  await service.createWorkspace(prepare(service));

  assert.equal((await service.getWorkspaceState(ACCOUNT_A, USER_A)).status, 'ready');
  assert.equal((await service.getWorkspaceState(ACCOUNT_B, USER_B)).status, 'empty');
  assert.equal((await service.listLocalWorkspaces(ACCOUNT_B)).length, 0);
});

test('input command tidak dimutasi dan output tidak membuka referensi internal', async () => {
  const { service } = createHarness();
  const command = prepare(service);
  const snapshot = structuredClone(command);
  const created = await service.createWorkspace(command);

  assert.deepEqual(command, snapshot);
  assert.throws(() => { created.workspace.name = 'Mutasi'; }, TypeError);
  assert.equal((await service.getWorkspaceState(ACCOUNT_A, USER_A)).workspace.name, 'Warung Rukun');
});

test('markup pada nama tetap data teks dan tidak menjadi field aktif', async () => {
  const { service } = createHarness();
  const command = prepare(service, { name: '<b>Ruang Teks</b>' });
  const created = await service.createWorkspace(command);

  assert.equal(created.workspace.name, '<b>Ruang Teks</b>');
  assert.equal(Object.hasOwn(created.workspace, 'innerHTML'), false);
});

test('record yang dibuat tidak mengandung email atau token', async () => {
  const { service } = createHarness();
  const created = await service.createWorkspace(prepare(service));
  const serialized = JSON.stringify(created);

  assert.doesNotMatch(serialized, /@/);
  assert.doesNotMatch(serialized, /accessToken|refreshToken|password/i);
});
