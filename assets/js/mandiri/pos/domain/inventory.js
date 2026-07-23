import { createEntityId, isValidEntityId } from '../../domain/ids.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
  normalizeTrimmedString,
} from '../../domain/validation.js';
import { isWorkspaceRole } from '../../domain/membership.js';

export const MANUAL_STOCK_MOVEMENT_TYPES = Object.freeze([
  'opening_stock', 'purchase_in', 'adjustment',
]);
export const STOCK_MOVEMENT_TYPES = Object.freeze([...MANUAL_STOCK_MOVEMENT_TYPES, 'sale']);

const MOVEMENT_FIELDS = Object.freeze([
  'schemaVersion', 'movementId', 'workspaceId', 'productId', 'movementType',
  'quantityDelta', 'reason', 'actorScope', 'actorRole', 'sourceReference',
  'operationId', 'createdAtLocal',
]);
const BALANCE_FIELDS = Object.freeze([
  'schemaVersion', 'version', 'workspaceId', 'productId', 'quantityOnHand',
  'lastMovementId', 'updatedAtLocal',
]);

function entityId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  }
  return value;
}

function workspace(value, expected) {
  const normalized = entityId(value, 'workspace', 'inventory.workspaceId');
  if (expected !== undefined && normalized !== expected) {
    throw new MandiriDomainError('scope_mismatch', 'workspace tidak sesuai', 'inventory.workspaceId');
  }
  return normalized;
}

function signedQuantity(value, path) {
  if (!Number.isSafeInteger(value)) {
    throw new MandiriDomainError('invalid_quantity', 'quantity harus safe integer', path);
  }
  if (value === 0) throw new MandiriDomainError('invalid_quantity', 'quantity tidak boleh nol', path);
  return value;
}

export function createStockMovementId(cryptoRef = globalThis.crypto) {
  return createEntityId('movement', cryptoRef);
}

export function normalizeStockMovement(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, MOVEMENT_FIELDS, { path: 'stockMovement' });
  if (!STOCK_MOVEMENT_TYPES.includes(input.movementType)) {
    throw new MandiriDomainError('invalid_movement_type', 'jenis movement tidak didukung', 'stockMovement.movementType');
  }
  const quantityDelta = signedQuantity(input.quantityDelta, 'stockMovement.quantityDelta');
  if (['opening_stock', 'purchase_in'].includes(input.movementType) && quantityDelta < 1) {
    throw new MandiriDomainError('invalid_quantity', 'movement masuk harus positif', 'stockMovement.quantityDelta');
  }
  const reason = input.reason === null ? null : normalizeTrimmedString(input.reason, {
    path: 'stockMovement.reason', maxLength: 240,
  });
  if (input.movementType === 'adjustment' && reason === null) {
    throw new MandiriDomainError('adjustment_reason_required', 'adjustment wajib memiliki alasan', 'stockMovement.reason');
  }
  if (input.movementType !== 'adjustment' && reason !== null) {
    throw new MandiriDomainError('unknown_field', 'reason hanya untuk adjustment', 'stockMovement.reason');
  }
  if (!isWorkspaceRole(input.actorRole)) {
    throw new MandiriDomainError('unknown_workspace_role', 'role workspace tidak valid', 'stockMovement.actorRole');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'stockMovement.schemaVersion'),
    movementId: entityId(input.movementId, 'movement', 'stockMovement.movementId'),
    workspaceId: workspace(input.workspaceId, expectedWorkspaceId),
    productId: entityId(input.productId, 'product', 'stockMovement.productId'),
    movementType: input.movementType,
    quantityDelta,
    reason,
    actorScope: normalizeScope(input.actorScope, 'stockMovement.actorScope'),
    actorRole: input.actorRole,
    sourceReference: normalizeTrimmedString(input.sourceReference, {
      path: 'stockMovement.sourceReference', maxLength: 120,
    }),
    operationId: entityId(input.operationId, 'op', 'stockMovement.operationId'),
    createdAtLocal: normalizeIsoTimestamp(input.createdAtLocal, 'stockMovement.createdAtLocal'),
  });
}

export function normalizeInventoryBalance(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, BALANCE_FIELDS, { path: 'inventoryBalance' });
  if (!Number.isSafeInteger(input.quantityOnHand)) {
    throw new MandiriDomainError('invalid_quantity', 'saldo harus safe integer', 'inventoryBalance.quantityOnHand');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'inventoryBalance.schemaVersion'),
    version: normalizePositiveVersion(input.version, 'inventoryBalance.version'),
    workspaceId: workspace(input.workspaceId, expectedWorkspaceId),
    productId: entityId(input.productId, 'product', 'inventoryBalance.productId'),
    quantityOnHand: input.quantityOnHand,
    lastMovementId: entityId(input.lastMovementId, 'movement', 'inventoryBalance.lastMovementId'),
    updatedAtLocal: normalizeIsoTimestamp(input.updatedAtLocal, 'inventoryBalance.updatedAtLocal'),
  });
}
