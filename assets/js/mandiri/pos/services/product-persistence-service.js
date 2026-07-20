import { normalizeAuditEvent } from '../../domain/audit.js';
import { createPayloadDigest, isValidEntityId } from '../../domain/ids.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from '../../domain/validation.js';
import { isWorkspaceRole } from '../../domain/membership.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import { normalizeOperationReceipt } from '../../repositories/operation-receipt-repository.js';
import { ATOMIC_PRODUCT_STORE_NAMES } from '../../repositories/repository-context.js';
import { MandiriStorageError, mapStorageError, storageError } from '../../storage/storage-errors.js';
import { normalizeCategory } from '../domain/category.js';
import { normalizeProduct } from '../domain/product.js';

export const PRODUCT_OPERATION_TYPES = Object.freeze([
  'category_create',
  'category_update',
  'product_create',
  'product_update',
]);

const COMMAND_FIELDS = Object.freeze([
  'schemaVersion',
  'accountScope',
  'workspaceId',
  'actorScope',
  'actorRole',
  'operationId',
  'eventId',
  'operationType',
  'expectedVersion',
  'createdAtLocal',
  'entity',
]);
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

function assertId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID command tidak valid', path);
  }
  return value;
}

export function normalizeProductPersistenceCommand(input) {
  assertExactFields(input, COMMAND_FIELDS, {
    requiredFields: COMMAND_FIELDS.filter((field) => field !== 'expectedVersion'),
    path: 'productPersistenceCommand',
  });
  if (!PRODUCT_OPERATION_TYPES.includes(input.operationType)) {
    throw new MandiriDomainError('unknown_operation_type', 'operationType tidak dikenal');
  }
  const isUpdate = input.operationType.endsWith('_update');
  if (isUpdate !== Object.hasOwn(input, 'expectedVersion')) {
    throw new MandiriDomainError('invalid_version', 'expectedVersion hanya wajib untuk update');
  }
  if (!isWorkspaceRole(input.actorRole)) {
    throw new MandiriDomainError('unknown_workspace_role', 'actorRole tidak dikenal');
  }
  const workspaceId = assertId(input.workspaceId, 'workspace', 'command.workspaceId');
  const normalizeEntity = input.operationType.startsWith('category_')
    ? normalizeCategory
    : normalizeProduct;
  const entity = normalizeEntity(input.entity, { workspaceId });
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'command.schemaVersion'),
    accountScope: normalizeScope(input.accountScope, 'command.accountScope'),
    workspaceId,
    actorScope: normalizeScope(input.actorScope, 'command.actorScope'),
    actorRole: input.actorRole,
    operationId: assertId(input.operationId, 'op', 'command.operationId'),
    eventId: assertId(input.eventId, 'audit', 'command.eventId'),
    operationType: input.operationType,
    ...(isUpdate ? {
      expectedVersion: normalizePositiveVersion(input.expectedVersion, 'command.expectedVersion'),
    } : {}),
    createdAtLocal: normalizeIsoTimestamp(input.createdAtLocal, 'command.createdAtLocal'),
    entity,
  });
}

function commandEntity(command) {
  const category = command.operationType.startsWith('category_');
  return Object.freeze({
    repositoryName: category ? 'categoryRepository' : 'productRepository',
    entityType: category ? 'category' : 'product',
    entityId: category ? command.entity.categoryId : command.entity.productId,
  });
}

function buildAudit(command, descriptor) {
  return normalizeAuditEvent({
    schemaVersion: 1,
    eventId: command.eventId,
    accountScope: command.accountScope,
    workspaceId: command.workspaceId,
    actorScope: command.actorScope,
    actorRole: command.actorRole,
    action: command.operationType,
    entityType: descriptor.entityType,
    entityId: descriptor.entityId,
    operationId: command.operationId,
    result: 'success',
    reasonCode: 'none',
    createdAtLocal: command.createdAtLocal,
  });
}

export function createProductPersistenceService({
  repositoryContext,
  digestFactory = createPayloadDigest,
} = {}) {
  if (!repositoryContext || typeof repositoryContext.run !== 'function' || typeof digestFactory !== 'function') {
    throw storageError('data_invalid');
  }

  async function execute(input) {
    let command;
    let digest;
    try {
      command = normalizeProductPersistenceCommand(input);
      digest = await digestFactory(command);
      if (!DIGEST_PATTERN.test(digest)) throw new MandiriDomainError('invalid_payload_digest');
    } catch (error) {
      throw mapStorageError(error, 'data_invalid');
    }
    const descriptor = commandEntity(command);

    try {
      return await repositoryContext.run(
        ATOMIC_PRODUCT_STORE_NAMES,
        'readwrite',
        async (repositories) => {
          const membership = await repositories.membershipRepository.getByUserScope(
            command.accountScope,
            command.workspaceId,
            command.actorScope,
          );
          const permitted = membership && canPerformWorkspaceAction(
            {
              accountScope: membership.accountScope,
              workspaceId: membership.workspaceId,
              userScope: membership.userScope,
              role: membership.role,
              status: membership.status,
            },
            `${descriptor.entityType}.update`,
            { accountScope: command.accountScope, workspaceId: command.workspaceId },
          );
          if (!permitted || membership.role !== command.actorRole) {
            throw storageError('permission_denied');
          }

          const oldReceipt = await repositories.operationReceiptRepository.getByOperationId(
            command.accountScope,
            command.operationId,
          );
          if (oldReceipt) {
            if (
              oldReceipt.payloadDigest !== digest
              || oldReceipt.operationType !== command.operationType
              || oldReceipt.workspaceId !== command.workspaceId
              || oldReceipt.entityType !== descriptor.entityType
              || oldReceipt.entityId !== descriptor.entityId
              || oldReceipt.result !== 'committed'
            ) throw storageError('idempotency_mismatch');
            const entity = await repositories[descriptor.repositoryName].get(
              command.accountScope,
              command.workspaceId,
              descriptor.entityId,
            );
            if (!entity) throw storageError('data_invalid');
            return Object.freeze({ status: 'duplicate-safe', entity, operationReceipt: oldReceipt });
          }

          const repository = repositories[descriptor.repositoryName];
          const entity = command.operationType.endsWith('_create')
            ? await repository.create(command.accountScope, command.workspaceId, command.entity)
            : await repository.update(
              command.accountScope,
              command.workspaceId,
              command.entity,
              command.expectedVersion,
            );
          const auditEvent = await repositories.auditRepository.append(
            command.accountScope,
            command.workspaceId,
            buildAudit(command, descriptor),
          );
          const operationReceipt = await repositories.operationReceiptRepository.append(
            command.accountScope,
            normalizeOperationReceipt({
              schemaVersion: 1,
              accountScope: command.accountScope,
              workspaceId: command.workspaceId,
              operationId: command.operationId,
              operationType: command.operationType,
              payloadDigest: digest,
              entityType: descriptor.entityType,
              entityId: descriptor.entityId,
              result: 'committed',
              createdAtLocal: command.createdAtLocal,
            }),
          );
          return Object.freeze({ status: 'committed', entity, auditEvent, operationReceipt });
        },
      );
    } catch (error) {
      if (error instanceof MandiriStorageError) throw error;
      throw mapStorageError(error, 'transaction_aborted');
    }
  }

  return Object.freeze({ execute });
}
