import { createEntityId, isValidEntityId } from '../../domain/ids.js';
import { assertMoney } from '../../domain/money.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeCode,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
  normalizeTrimmedString,
} from '../../domain/validation.js';

export const SALE_REVERSAL_REASON_CODES = Object.freeze([
  'customer_cancelled',
  'operator_error',
  'duplicate_sale',
  'wrong_items',
  'wrong_amount',
  'other',
]);

const FIELDS = Object.freeze([
  'schemaVersion',
  'reversalId',
  'workspaceId',
  'originalSaleId',
  'paymentId',
  'cashSessionId',
  'reasonCode',
  'reasonNote',
  'reversedAmountMinor',
  'operationId',
  'actorScope',
  'actorRole',
  'reversedAtLocal',
]);

function entityId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  }
  return value;
}

export function createSaleReversalId(cryptoRef = globalThis.crypto) {
  return createEntityId('reversal', cryptoRef);
}

export function normalizeSaleReversal(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, FIELDS, { path: 'saleReversal' });

  const workspaceId = entityId(
    input.workspaceId,
    'workspace',
    'saleReversal.workspaceId',
  );
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId) {
    throw new MandiriDomainError(
      'scope_mismatch',
      'workspace tidak sesuai',
      'saleReversal.workspaceId',
    );
  }

  const reasonCode = normalizeCode(input.reasonCode, {
    path: 'saleReversal.reasonCode',
    maxLength: 80,
    pattern: /^[a-z][a-z0-9_]*$/,
  });
  if (!SALE_REVERSAL_REASON_CODES.includes(reasonCode)) {
    throw new MandiriDomainError(
      'data_invalid',
      'reasonCode void tidak didukung',
      'saleReversal.reasonCode',
    );
  }

  const reversedAmountMinor = assertMoney(input.reversedAmountMinor);
  if (reversedAmountMinor === 0) {
    throw new MandiriDomainError(
      'data_invalid',
      'reversedAmountMinor harus lebih besar dari nol',
      'saleReversal.reversedAmountMinor',
    );
  }

  if (input.actorRole !== 'merchant_owner') {
    throw new MandiriDomainError(
      'owner_permission_required',
      'void hanya dapat dilakukan merchant owner',
      'saleReversal.actorRole',
    );
  }

  const reasonNote = input.reasonNote === null ? null : normalizeTrimmedString(
    input.reasonNote,
    {
      path: 'saleReversal.reasonNote',
      maxLength: 240,
    },
  );

  return Object.freeze({
    schemaVersion: normalizePositiveVersion(
      input.schemaVersion,
      'saleReversal.schemaVersion',
    ),
    reversalId: entityId(
      input.reversalId,
      'reversal',
      'saleReversal.reversalId',
    ),
    workspaceId,
    originalSaleId: entityId(
      input.originalSaleId,
      'sale',
      'saleReversal.originalSaleId',
    ),
    paymentId: entityId(
      input.paymentId,
      'payment',
      'saleReversal.paymentId',
    ),
    cashSessionId: entityId(
      input.cashSessionId,
      'cashsession',
      'saleReversal.cashSessionId',
    ),
    reasonCode,
    reasonNote,
    reversedAmountMinor,
    operationId: entityId(
      input.operationId,
      'op',
      'saleReversal.operationId',
    ),
    actorScope: normalizeScope(
      input.actorScope,
      'saleReversal.actorScope',
    ),
    actorRole: 'merchant_owner',
    reversedAtLocal: normalizeIsoTimestamp(
      input.reversedAtLocal,
      'saleReversal.reversedAtLocal',
    ),
  });
}
