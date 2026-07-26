import { addMoney } from '../domain/money.js';
import { normalizeSaleReversal } from '../pos/domain/sale-reversal.js';
import {
  assertSafeBackupValue,
  createBackupChecksumPayload,
  deepFreezeBackup,
  MANDIRI_BACKUP_CHECKSUM_ALGORITHM,
  MANDIRI_BACKUP_FORMAT,
  MANDIRI_BACKUP_RECORD_LIMITS as V7_RECORD_LIMITS,
  normalizeBackupAccountScope,
  normalizeBackupDocument as normalizeLegacyBackupDocument,
  normalizeBackupWorkspaceId,
} from './backup-schema.js';
import { backupError, mapBackupError } from './backup-errors.js';

export {
  assertSafeBackupValue,
  createBackupChecksumPayload,
  deepFreezeBackup,
  MANDIRI_BACKUP_CHECKSUM_ALGORITHM,
  MANDIRI_BACKUP_FORMAT,
  normalizeBackupAccountScope,
  normalizeBackupWorkspaceId,
};

export const MANDIRI_BACKUP_FORMAT_VERSION = 8;
export const MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION = 8;
export const MANDIRI_BACKUP_RECORD_LIMITS = Object.freeze({
  ...V7_RECORD_LIMITS,
  saleReversals: 50000,
});

const ROOT_FIELDS = Object.freeze([
  'format',
  'formatVersion',
  'databaseSchemaVersion',
  'createdAt',
  'accountScope',
  'workspaceId',
  'checksumAlgorithm',
  'checksum',
  'recordCounts',
  'data',
]);
const V7_COLLECTION_FIELDS = Object.freeze(Object.keys(V7_RECORD_LIMITS));
const V8_COLLECTION_FIELDS = Object.freeze([
  ...V7_COLLECTION_FIELDS,
  'saleReversals',
]);

function assertExactObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw backupError('backup_invalid');
  }
  const keys = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (
    keys.length !== expected.length
    || keys.some((key, index) => key !== expected[index])
  ) throw backupError('backup_invalid');
}

function v7Projection(input) {
  const { saleReversals: _reversalCount, ...recordCounts } = input.recordCounts;
  const { saleReversals: _saleReversals, ...data } = input.data;
  return {
    ...input,
    formatVersion: 7,
    databaseSchemaVersion: 7,
    recordCounts,
    data,
  };
}

function aggregateTrackedLines(lines) {
  const quantities = new Map();
  for (const line of lines) {
    if (!line.stockTrackingSnapshot) continue;
    if (line.quantityScale !== 1 || !Number.isSafeInteger(line.quantityScaled)) {
      throw backupError('integrity_error');
    }
    const next = (quantities.get(line.productId) ?? 0) + line.quantityScaled;
    if (!Number.isSafeInteger(next) || next < 1) throw backupError('integrity_error');
    quantities.set(line.productId, next);
  }
  return quantities;
}

function validateReversalReferences(baseData, saleReversals) {
  const sales = new Map(baseData.sales.map((record) => [record.saleId, record]));
  const payments = new Map(baseData.payments.map((record) => [record.paymentId, record]));
  const sessions = new Map(baseData.cashSessions.map((record) => [record.cashSessionId, record]));
  const receipts = new Map(baseData.operationReceipts.map((record) => [record.operationId, record]));
  const auditsByOperation = new Map();
  for (const event of baseData.auditEvents) {
    const events = auditsByOperation.get(event.operationId) ?? [];
    events.push(event);
    auditsByOperation.set(event.operationId, events);
  }
  const voidMovements = baseData.stockMovements.filter(
    (record) => record.movementType === 'void_reversal',
  );
  const reversalIds = new Set(saleReversals.map((record) => record.reversalId));
  if (voidMovements.some((record) => !reversalIds.has(record.sourceReference))) {
    throw backupError('integrity_error');
  }

  for (const reversal of saleReversals) {
    const sale = sales.get(reversal.originalSaleId);
    const payment = payments.get(reversal.paymentId);
    const session = sessions.get(reversal.cashSessionId);
    const receipt = receipts.get(reversal.operationId);
    const auditEvents = auditsByOperation.get(reversal.operationId) ?? [];
    if (
      !sale
      || !payment
      || !session
      || payment.saleId !== sale.saleId
      || sale.paymentId !== payment.paymentId
      || payment.amountAppliedMinor !== reversal.reversedAmountMinor
      || session.status !== 'open'
      || sale.finalizedAtLocal < session.openedAtLocal
      || reversal.reversedAtLocal < sale.finalizedAtLocal
      || !receipt
      || receipt.operationType !== 'sale_void'
      || receipt.entityType !== 'sale_reversal'
      || receipt.entityId !== reversal.reversalId
      || receipt.result !== 'committed'
      || !auditEvents.some((event) => (
        event.action === 'sale_voided'
        && event.entityType === 'sale_reversal'
        && event.entityId === reversal.reversalId
        && event.result === 'success'
      ))
    ) throw backupError('integrity_error');

    const lines = baseData.saleLines.filter((record) => record.saleId === sale.saleId);
    const expected = aggregateTrackedLines(lines);
    const movements = voidMovements.filter(
      (record) => record.sourceReference === reversal.reversalId,
    );
    if (
      movements.length !== expected.size
      || new Set(movements.map((record) => record.productId)).size !== movements.length
      || movements.some((record) => (
        expected.get(record.productId) !== record.quantityDelta
        || record.createdAtLocal !== reversal.reversedAtLocal
        || record.actorScope !== reversal.actorScope
        || record.actorRole !== reversal.actorRole
      ))
    ) throw backupError('integrity_error');
  }
}

function normalizeV8Document(input, options) {
  assertSafeBackupValue(input);
  assertExactObject(input, ROOT_FIELDS);
  assertExactObject(input.recordCounts, V8_COLLECTION_FIELDS);
  assertExactObject(input.data, V8_COLLECTION_FIELDS);
  if (
    input.format !== MANDIRI_BACKUP_FORMAT
    || input.formatVersion !== 8
    || input.databaseSchemaVersion !== 8
    || !Array.isArray(input.data.saleReversals)
    || input.data.saleReversals.length > MANDIRI_BACKUP_RECORD_LIMITS.saleReversals
    || input.recordCounts.saleReversals !== input.data.saleReversals.length
  ) throw backupError('backup_invalid');

  const normalizedLegacy = normalizeLegacyBackupDocument(v7Projection(input), options);
  let saleReversals;
  try {
    saleReversals = input.data.saleReversals.map((record) => normalizeSaleReversal(
      record,
      { workspaceId: normalizedLegacy.workspaceId },
    ));
  } catch (error) {
    if (['scope_mismatch', 'cross_workspace_scope'].includes(error?.code)) {
      throw backupError('integrity_error', error);
    }
    throw mapBackupError(error, 'backup_invalid');
  }

  if (
    new Set(saleReversals.map((record) => record.reversalId)).size !== saleReversals.length
    || new Set(saleReversals.map((record) => record.originalSaleId)).size !== saleReversals.length
    || new Set(saleReversals.map((record) => record.operationId)).size !== saleReversals.length
  ) throw backupError('integrity_error');

  validateReversalReferences(normalizedLegacy.data, saleReversals);
  return deepFreezeBackup({
    ...normalizedLegacy,
    formatVersion: 8,
    databaseSchemaVersion: 8,
    recordCounts: {
      ...normalizedLegacy.recordCounts,
      saleReversals: saleReversals.length,
    },
    data: {
      ...normalizedLegacy.data,
      saleReversals,
    },
  });
}

export function normalizeBackupDocument(input, options = {}) {
  if (input?.formatVersion !== 8) {
    return normalizeLegacyBackupDocument(input, options);
  }
  return normalizeV8Document(input, options);
}

export function sumReversedAmount(saleReversals) {
  try {
    return saleReversals.reduce(
      (total, record) => addMoney(total, record.reversedAmountMinor),
      0,
    );
  } catch (error) {
    throw backupError('integrity_error', error);
  }
}
