import { createEntityId, isValidEntityId } from '../../domain/ids.js';
import { assertMoney, subtractMoney } from '../../domain/money.js';
import {
  assertExactFields, MandiriDomainError, normalizeIsoTimestamp,
  normalizePositiveVersion, normalizeScope,
} from '../../domain/validation.js';
import { normalizeWorkspaceScope } from './product-validation.js';

const FIELDS = Object.freeze([
  'schemaVersion', 'paymentId', 'workspaceId', 'saleId', 'method', 'status',
  'currencyCode', 'amountDueMinor', 'amountTenderedMinor', 'amountAppliedMinor',
  'changeMinor', 'operationId', 'actorScope', 'actorRole', 'recordedAtLocal',
]);

function id(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  return value;
}

export function createPaymentId(cryptoRef = globalThis.crypto) {
  return createEntityId('payment', cryptoRef);
}

export function normalizePayment(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, FIELDS, { path: 'payment' });
  if (input.method !== 'cash' || input.status !== 'recorded' || input.currencyCode !== 'IDR') {
    throw new MandiriDomainError('data_invalid', 'payment MVP hanya cash recorded IDR', 'payment');
  }
  if (!['merchant_owner', 'cashier'].includes(input.actorRole)) {
    throw new MandiriDomainError('unknown_workspace_role', 'role tidak valid', 'payment.actorRole');
  }
  const due = assertMoney(input.amountDueMinor);
  const tendered = assertMoney(input.amountTenderedMinor);
  if (tendered < due) throw new MandiriDomainError('underpayment', 'pembayaran kurang', 'payment.amountTenderedMinor');
  const change = subtractMoney(tendered, due);
  if (input.amountAppliedMinor !== due || input.changeMinor !== change) {
    throw new MandiriDomainError('data_invalid', 'nilai payment tidak konsisten', 'payment');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'payment.schemaVersion'),
    paymentId: id(input.paymentId, 'payment', 'payment.paymentId'),
    workspaceId: normalizeWorkspaceScope(input.workspaceId, expectedWorkspaceId, 'payment.workspaceId'),
    saleId: id(input.saleId, 'sale', 'payment.saleId'),
    method: 'cash',
    status: 'recorded',
    currencyCode: 'IDR',
    amountDueMinor: due,
    amountTenderedMinor: tendered,
    amountAppliedMinor: due,
    changeMinor: change,
    operationId: id(input.operationId, 'op', 'payment.operationId'),
    actorScope: normalizeScope(input.actorScope, 'payment.actorScope'),
    actorRole: input.actorRole,
    recordedAtLocal: normalizeIsoTimestamp(input.recordedAtLocal, 'payment.recordedAtLocal'),
  });
}
