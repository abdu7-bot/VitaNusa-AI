import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createEntityId, createOperationId } from '../../../assets/js/mandiri/domain/ids.js';
import {
  normalizeStockMovement,
  STOCK_MOVEMENT_TYPES,
} from '../../../assets/js/mandiri/pos/domain/inventory.js';
import {
  createSaleReversalId,
  normalizeSaleReversal,
  SALE_REVERSAL_REASON_CODES,
} from '../../../assets/js/mandiri/pos/domain/sale-reversal.js';

function validInput(overrides = {}) {
  return {
    schemaVersion: 1,
    reversalId: createSaleReversalId(webcrypto),
    workspaceId: createEntityId('workspace', webcrypto),
    originalSaleId: createEntityId('sale', webcrypto),
    paymentId: createEntityId('payment', webcrypto),
    cashSessionId: createEntityId('cashsession', webcrypto),
    reasonCode: 'operator_error',
    reasonNote: 'Nominal salah input',
    reversedAmountMinor: 25000,
    operationId: createOperationId(webcrypto),
    actorScope: 'user:owner-001',
    actorRole: 'merchant_owner',
    reversedAtLocal: '2026-07-26T06:30:00.000Z',
    ...overrides,
  };
}

test('reason code SaleReversal bersifat allowlist immutable', () => {
  assert.deepEqual(SALE_REVERSAL_REASON_CODES, [
    'customer_cancelled',
    'operator_error',
    'duplicate_sale',
    'wrong_items',
    'wrong_amount',
    'other',
  ]);
  assert.equal(Object.isFrozen(SALE_REVERSAL_REASON_CODES), true);
});

test('membuat dan menormalisasi SaleReversal append-only', () => {
  const input = validInput({ reasonNote: '  Nominal salah input  ' });
  const value = normalizeSaleReversal(input, { workspaceId: input.workspaceId });

  assert.equal(value.reversalId, input.reversalId);
  assert.equal(value.originalSaleId, input.originalSaleId);
  assert.equal(value.paymentId, input.paymentId);
  assert.equal(value.cashSessionId, input.cashSessionId);
  assert.equal(value.reasonNote, 'Nominal salah input');
  assert.equal(value.reversedAmountMinor, 25000);
  assert.equal(value.actorRole, 'merchant_owner');
  assert.equal(Object.isFrozen(value), true);
});

test('reasonNote boleh null tetapi string kosong dan terlalu panjang ditolak', () => {
  assert.equal(normalizeSaleReversal(validInput({ reasonNote: null })).reasonNote, null);
  assert.throws(
    () => normalizeSaleReversal(validInput({ reasonNote: '   ' })),
    { code: 'string_too_short' },
  );
  assert.throws(
    () => normalizeSaleReversal(validInput({ reasonNote: 'x'.repeat(241) })),
    { code: 'string_too_long' },
  );
});

test('hanya merchant owner dapat menjadi actor SaleReversal', () => {
  assert.throws(
    () => normalizeSaleReversal(validInput({ actorRole: 'cashier' })),
    { code: 'owner_permission_required' },
  );
});

test('reasonCode di luar allowlist ditolak', () => {
  assert.throws(
    () => normalizeSaleReversal(validInput({ reasonCode: 'refund' })),
    { code: 'data_invalid' },
  );
});

test('nominal nol, negatif, dan unsafe ditolak', () => {
  assert.throws(
    () => normalizeSaleReversal(validInput({ reversedAmountMinor: 0 })),
    { code: 'data_invalid' },
  );
  assert.throws(
    () => normalizeSaleReversal(validInput({ reversedAmountMinor: -1 })),
  );
  assert.throws(
    () => normalizeSaleReversal(validInput({ reversedAmountMinor: Number.MAX_SAFE_INTEGER + 1 })),
  );
});

test('scope workspace dan seluruh referensi ID wajib valid', () => {
  const input = validInput();
  const otherWorkspaceId = createEntityId('workspace', webcrypto);

  assert.throws(
    () => normalizeSaleReversal(input, { workspaceId: otherWorkspaceId }),
    { code: 'scope_mismatch' },
  );
  for (const field of [
    'reversalId', 'workspaceId', 'originalSaleId', 'paymentId',
    'cashSessionId', 'operationId',
  ]) {
    assert.throws(
      () => normalizeSaleReversal(validInput({ [field]: 'invalid' })),
      { code: 'invalid_entity_id' },
    );
  }
});

test('field tidak dikenal dan timestamp invalid ditolak fail-closed', () => {
  assert.throws(
    () => normalizeSaleReversal({ ...validInput(), refundId: 'not-supported' }),
    { code: 'unknown_field' },
  );
  assert.throws(
    () => normalizeSaleReversal(validInput({ reversedAtLocal: '26-07-2026' })),
    { code: 'invalid_timestamp' },
  );
});

test('stock void_reversal bersifat movement masuk positif dan tanpa reason manual', () => {
  assert.equal(STOCK_MOVEMENT_TYPES.includes('void_reversal'), true);
  const value = normalizeStockMovement({
    schemaVersion: 1,
    movementId: createEntityId('movement', webcrypto),
    workspaceId: createEntityId('workspace', webcrypto),
    productId: createEntityId('product', webcrypto),
    movementType: 'void_reversal',
    quantityDelta: 4,
    reason: null,
    actorScope: 'user:owner-001',
    actorRole: 'merchant_owner',
    sourceReference: createEntityId('reversal', webcrypto),
    operationId: createOperationId(webcrypto),
    createdAtLocal: '2026-07-26T06:30:00.000Z',
  });
  assert.equal(value.quantityDelta, 4);
  assert.throws(() => normalizeStockMovement({
    ...value,
    quantityDelta: -4,
  }), { code: 'invalid_quantity' });
  assert.throws(() => normalizeStockMovement({
    ...value,
    reason: 'tidak boleh disisipkan',
  }), { code: 'unknown_field' });
});
