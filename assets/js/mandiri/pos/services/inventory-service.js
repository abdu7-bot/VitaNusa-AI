import { normalizeAuditEvent } from '../../domain/audit.js';
import { createPayloadDigest, isValidEntityId } from '../../domain/ids.js';
import { isWorkspaceRole } from '../../domain/membership.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizePositiveVersion,
  normalizeScope,
} from '../../domain/validation.js';
import { normalizeOperationReceipt } from '../../repositories/operation-receipt-repository.js';
import { ATOMIC_INVENTORY_STORE_NAMES } from '../../repositories/repository-context.js';
import { MandiriStorageError, mapStorageError, storageError } from '../../storage/storage-errors.js';
import { normalizeInventoryBalance, normalizeStockMovement } from '../domain/inventory.js';

const COMMAND_FIELDS = Object.freeze([
  'schemaVersion', 'accountScope', 'workspaceId', 'actorScope', 'actorRole',
  'expectedVersion', 'movement', 'eventId',
]);
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

function id(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  return value;
}

export function normalizeInventoryCommand(input) {
  assertExactFields(input, COMMAND_FIELDS, { path: 'inventoryCommand' });
  const workspaceId = id(input.workspaceId, 'workspace', 'inventoryCommand.workspaceId');
  const actorRole = input.actorRole;
  if (!isWorkspaceRole(actorRole)) throw new MandiriDomainError('unknown_workspace_role', 'role tidak valid');
  const movement = normalizeStockMovement(input.movement, { workspaceId });
  if (movement.actorRole !== actorRole || movement.actorScope !== input.actorScope) {
    throw new MandiriDomainError('scope_mismatch', 'actor movement tidak sesuai command');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'inventoryCommand.schemaVersion'),
    accountScope: normalizeScope(input.accountScope, 'inventoryCommand.accountScope'),
    workspaceId,
    actorScope: normalizeScope(input.actorScope, 'inventoryCommand.actorScope'),
    actorRole,
    expectedVersion: Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0
      ? input.expectedVersion
      : (() => { throw new MandiriDomainError('invalid_version', 'expectedVersion minimal nol'); })(),
    movement,
    eventId: id(input.eventId, 'audit', 'inventoryCommand.eventId'),
  });
}

function actor(membership) {
  return {
    accountScope: membership.accountScope,
    workspaceId: membership.workspaceId,
    userScope: membership.userScope,
    role: membership.role,
    status: membership.status,
  };
}

export function createInventoryService({ repositoryContext, digestFactory = createPayloadDigest } = {}) {
  if (!repositoryContext?.run || typeof digestFactory !== 'function') throw storageError('data_invalid');

  async function recordMovement(input) {
    let command;
    let digest;
    try {
      command = normalizeInventoryCommand(input);
      digest = await digestFactory(command);
      if (!DIGEST_PATTERN.test(digest)) throw new MandiriDomainError('invalid_payload_digest');
    } catch (error) {
      throw mapStorageError(error, 'data_invalid');
    }
    try {
      return await repositoryContext.run(ATOMIC_INVENTORY_STORE_NAMES, 'readwrite', async (repositories) => {
        const membership = await repositories.membershipRepository.getByUserScope(
          command.accountScope, command.workspaceId, command.actorScope,
        );
        if (
          !membership
          || membership.role !== command.actorRole
          || !canPerformWorkspaceAction(actor(membership), 'inventory.update', {
            accountScope: command.accountScope, workspaceId: command.workspaceId,
          })
        ) throw storageError('permission_denied');

        const oldReceipt = await repositories.operationReceiptRepository.getByOperationId(
          command.accountScope, command.movement.operationId,
        );
        if (oldReceipt) {
          if (
            oldReceipt.payloadDigest !== digest
            || oldReceipt.workspaceId !== command.workspaceId
            || oldReceipt.operationType !== `stock_${command.movement.movementType}`
            || oldReceipt.entityType !== 'stock_movement'
            || oldReceipt.entityId !== command.movement.movementId
          ) throw storageError('idempotency_mismatch');
          const movements = await repositories.inventoryRepository.listMovements(
            command.accountScope, command.workspaceId, command.movement.productId,
          );
          const movement = movements.find((item) => item.operationId === command.movement.operationId);
          const balance = await repositories.inventoryRepository.getBalance(
            command.accountScope, command.workspaceId, command.movement.productId,
          );
          if (!movement || !balance) throw storageError('data_invalid');
          return Object.freeze({ status: 'duplicate-safe', movement, balance, operationReceipt: oldReceipt });
        }

        const product = await repositories.productRepository.get(
          command.accountScope, command.workspaceId, command.movement.productId,
        );
        if (!product) throw storageError('invalid_reference');
        if (!product.stockTracking) throw storageError('stock_tracking_disabled');
        const current = await repositories.inventoryRepository.getBalance(
          command.accountScope, command.workspaceId, product.productId,
        );
        const currentQuantity = current?.quantityOnHand ?? 0;
        const nextQuantity = currentQuantity + command.movement.quantityDelta;
        if (!Number.isSafeInteger(nextQuantity)) throw storageError('data_invalid');
        const balance = normalizeInventoryBalance({
          schemaVersion: 1,
          version: command.expectedVersion + 1,
          workspaceId: command.workspaceId,
          productId: product.productId,
          quantityOnHand: nextQuantity,
          lastMovementId: command.movement.movementId,
          updatedAtLocal: command.movement.createdAtLocal,
        }, { workspaceId: command.workspaceId });
        const inventory = await repositories.inventoryRepository.appendMovement(
          command.accountScope, command.workspaceId, command.movement, balance, command.expectedVersion,
        );
        const operationType = `stock_${command.movement.movementType}`;
        const auditEvent = await repositories.auditRepository.append(
          command.accountScope, command.workspaceId, normalizeAuditEvent({
            schemaVersion: 1,
            eventId: command.eventId,
            accountScope: command.accountScope,
            workspaceId: command.workspaceId,
            actorScope: command.actorScope,
            actorRole: command.actorRole,
            action: operationType,
            entityType: 'stock_movement',
            entityId: command.movement.movementId,
            operationId: command.movement.operationId,
            result: 'success',
            reasonCode: 'none',
            createdAtLocal: command.movement.createdAtLocal,
          }),
        );
        const operationReceipt = await repositories.operationReceiptRepository.append(
          command.accountScope, normalizeOperationReceipt({
            schemaVersion: 1,
            accountScope: command.accountScope,
            workspaceId: command.workspaceId,
            operationId: command.movement.operationId,
            operationType,
            payloadDigest: digest,
            entityType: 'stock_movement',
            entityId: command.movement.movementId,
            result: 'committed',
            createdAtLocal: command.movement.createdAtLocal,
          }),
        );
        return Object.freeze({ status: 'committed', ...inventory, auditEvent, operationReceipt });
      });
    } catch (error) {
      if (error instanceof MandiriStorageError) throw error;
      throw mapStorageError(error, 'transaction_aborted');
    }
  }
  return Object.freeze({ recordMovement });
}
