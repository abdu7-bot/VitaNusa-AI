import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createSaleReversalRepository } from '../../../assets/js/mandiri/pos/repositories/sale-reversal-repository.js';

const ACCOUNT = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const SALE = 'sale_33333333-3333-4333-8333-333333333333';
const PAYMENT = 'payment_44444444-4444-4444-8444-444444444444';
const CASH_SESSION = 'cashsession_55555555-5555-4555-8555-555555555555';
const REVERSAL = 'reversal_66666666-6666-4666-8666-666666666666';
const OPERATION = 'op_77777777-7777-4777-8777-777777777777';
const AT = '2026-07-26T06:30:00.000Z';

function reversal(overrides = {}) {
  return {
    schemaVersion: 1,
    reversalId: REVERSAL,
    workspaceId: WORKSPACE,
    originalSaleId: SALE,
    paymentId: PAYMENT,
    cashSessionId: CASH_SESSION,
    reasonCode: 'operator_error',
    reasonNote: 'Nominal salah input',
    reversedAmountMinor: 25000,
    operationId: OPERATION,
    actorScope: 'user_scope_owner',
    actorRole: 'merchant_owner',
    reversedAtLocal: AT,
    ...overrides,
  };
}

async function fixture(name) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
  return {
    connection,
    repository: createSaleReversalRepository({ connection }),
  };
}

test('append/get/getBySale/list ter-scope dan immutable', async () => {
  const value = await fixture('sale-reversal-repository');
  const inserted = await value.repository.append(ACCOUNT, WORKSPACE, reversal());

  assert.equal(inserted.reversalId, REVERSAL);
  assert.equal(Object.isFrozen(inserted), true);
  assert.deepEqual(await value.repository.get(ACCOUNT, WORKSPACE, REVERSAL), inserted);
  assert.deepEqual(await value.repository.getBySale(ACCOUNT, WORKSPACE, SALE), inserted);
  assert.deepEqual(await value.repository.get(ACCOUNT_B, WORKSPACE, REVERSAL), null);
  assert.deepEqual(await value.repository.get(ACCOUNT, WORKSPACE_B, REVERSAL), null);
  assert.deepEqual(await value.repository.listByWorkspace(ACCOUNT, WORKSPACE), [inserted]);

  value.connection.close();
});

test('satu Sale hanya memiliki satu reversal normal committed', async () => {
  const value = await fixture('sale-reversal-unique-sale');
  await value.repository.append(ACCOUNT, WORKSPACE, reversal());

  await assert.rejects(value.repository.append(ACCOUNT, WORKSPACE, reversal({
    reversalId: 'reversal_88888888-8888-4888-8888-888888888888',
    operationId: 'op_99999999-9999-4999-8999-999999999999',
    reversedAtLocal: '2026-07-26T06:31:00.000Z',
  })), { code: 'constraint_violation' });

  assert.equal((await value.repository.listByWorkspace(ACCOUNT, WORKSPACE)).length, 1);
  value.connection.close();
});

test('operationId unik dan payload workspace mismatch ditolak', async () => {
  const value = await fixture('sale-reversal-unique-operation');
  await value.repository.append(ACCOUNT, WORKSPACE, reversal());

  await assert.rejects(value.repository.append(ACCOUNT, WORKSPACE, reversal({
    reversalId: 'reversal_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    originalSaleId: 'sale_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    paymentId: 'payment_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    cashSessionId: 'cashsession_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  })), { code: 'constraint_violation' });

  await assert.rejects(value.repository.append(ACCOUNT, WORKSPACE, reversal({
    reversalId: 'reversal_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    workspaceId: WORKSPACE_B,
    originalSaleId: 'sale_ffffffff-ffff-4fff-8fff-ffffffffffff',
    paymentId: 'payment_12121212-1212-4212-8212-121212121212',
    cashSessionId: 'cashsession_13131313-1313-4313-8313-131313131313',
    operationId: 'op_14141414-1414-4414-8414-141414141414',
  })), { code: 'scope_mismatch' });

  value.connection.close();
});

test('listByWorkspace terurut timestamp lalu reversalId', async () => {
  const value = await fixture('sale-reversal-order');
  await value.repository.append(ACCOUNT, WORKSPACE, reversal({
    reversalId: 'reversal_f1111111-1111-4111-8111-111111111111',
    originalSaleId: 'sale_f2222222-2222-4222-8222-222222222222',
    paymentId: 'payment_f3333333-3333-4333-8333-333333333333',
    cashSessionId: 'cashsession_f4444444-4444-4444-8444-444444444444',
    operationId: 'op_f5555555-5555-4555-8555-555555555555',
    reversedAtLocal: '2026-07-26T06:32:00.000Z',
  }));
  await value.repository.append(ACCOUNT, WORKSPACE, reversal());

  assert.deepEqual(
    (await value.repository.listByWorkspace(ACCOUNT, WORKSPACE)).map((item) => item.reversalId),
    [REVERSAL, 'reversal_f1111111-1111-4111-8111-111111111111'],
  );
  value.connection.close();
});
