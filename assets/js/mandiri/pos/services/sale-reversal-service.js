import { createPayloadDigest, isValidEntityId } from '../../domain/ids.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from '../../domain/validation.js';
import { normalizeOperationReceipt } from '../../repositories/operation-receipt-repository.js';
import { ATOMIC_REVERSAL_STORE_NAMES } from '../../repositories/repository-context.js';
import {
  MandiriStorageError,
  mapStorageError,
  storageError,
} from '../../storage/storage-errors.js';
import {
  normalizeSaleReversal,
  SALE_REVERSAL_REASON_CODES,
} from '../domain/sale-reversal.js';

const COMMAND_FIELDS = Object.freeze([
  'schemaVersion',
  'accountScope',
  'workspaceId',
  'actorScope',
  'actorRole',
  'operationId',
  'eventId',
  'reversalId',
  'originalSaleId',
  'cashSessionId',
  'stockMovementIds',
  'reasonCode',
  'reasonNote',
  'createdAtLocal',
]);

function id(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  }
  return value;
}

export function normalizeVoidSaleCommand(input) {
  assertExactFields(input, COMMAND_FIELDS, { path: 'voidSaleCommand' });
  if (input.actorRole !== 'merchant_owner') {
    throw new MandiriDomainError(
      'owner_permission_required',
      'void hanya dapat dilakukan merchant owner',
      'voidSaleCommand.actorRole',
    );
  }
  if (!SALE_REVERSAL_REASON_CODES.includes(input.reasonCode)) {
    throw new MandiriDomainError(
      'data_invalid',
      'reasonCode void tidak didukung',
      'voidSaleCommand.reasonCode',
    );
  }
  if (!Array.isArray(input.stockMovementIds)) {
    throw new MandiriDomainError(
      'data_invalid',
      'stockMovementIds wajib array',
      'voidSaleCommand.stockMovementIds',
    );
  }
  const stockMovementIds = Object.freeze(input.stockMovementIds.map((value, index) => (
    id(value, 'movement', `voidSaleCommand.stockMovementIds.${index}`)
  )));
  if (new Set(stockMovementIds).size !== stockMovementIds.length) {
    throw new MandiriDomainError(
      'data_invalid',
      'stockMovementIds duplicate',
      'voidSaleCommand.stockMovementIds',
    );
  }
  const reasonNote = input.reasonNote === null ? null : String(input.reasonNote).trim();
  if (reasonNote !== null && (reasonNote.length < 1 || reasonNote.length > 240)) {
    throw new MandiriDomainError(
      'data_invalid',
      'reasonNote void tidak valid',
      'voidSaleCommand.reasonNote',
    );
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(
      input.schemaVersion,
      'voidSaleCommand.schemaVersion',
    ),
    accountScope: normalizeScope(input.accountScope, 'voidSaleCommand.accountScope'),
    workspaceId: id(input.workspaceId, 'workspace', 'voidSaleCommand.workspaceId'),
    actorScope: normalizeScope(input.actorScope, 'voidSaleCommand.actorScope'),
    actorRole: 'merchant_owner',
    operationId: id(input.operationId, 'op', 'voidSaleCommand.operationId'),
    eventId: id(input.eventId, 'audit', 'voidSaleCommand.eventId'),
    reversalId: id(input.reversalId, 'reversal', 'voidSaleCommand.reversalId'),
    originalSaleId: id(input.originalSaleId, 'sale', 'voidSaleCommand.originalSaleId'),
    cashSessionId: id(input.cashSessionId, 'cashsession', 'voidSaleCommand.cashSessionId'),
    stockMovementIds,
    reasonCode: input.reasonCode,
    reasonNote,
    createdAtLocal: normalizeIsoTimestamp(
      input.createdAtLocal,
      'voidSaleCommand.createdAtLocal',
    ),
  });
}

function assertPermission(membership, command) {
  const allowed = membership
    && membership.role === command.actorRole
    && canPerformWorkspaceAction(
      {
        accountScope: membership.accountScope,
        workspaceId: membership.workspaceId,
        userScope: membership.userScope,
        role: membership.role,
        status: membership.status,
      },
      'sale.void',
      {
        accountScope: command.accountScope,
        workspaceId: command.workspaceId,
      },
    );
  if (!allowed) throw storageError('permission_denied');
}

function aggregateTrackedQuantities(lines) {
  const quantities = new Map();
  for (const line of lines) {
    if (!line.stockTrackingSnapshot) continue;
    if (line.quantityScale !== 1 || !Number.isSafeInteger(line.quantityScaled)) {
      throw storageError('invalid_quantity');
    }
    const next = (quantities.get(line.productId) ?? 0) + line.quantityScaled;
    if (!Number.isSafeInteger(next) || next < 1) throw storageError('invalid_quantity');
    quantities.set(line.productId, next);
  }
  return [...quantities].sort(([left], [right]) => left.localeCompare(right));
}

function receiptMatches(receipt, command, digest) {
  return receipt.payloadDigest === digest
    && receipt.operationType === 'sale_void'
    && receipt.workspaceId === command.workspaceId
    && receipt.entityType === 'sale_reversal'
    && receipt.entityId === command.reversalId
    && receipt.result === 'committed';
}

export function createSaleReversalService({
  repositoryContext,
  digestFactory = createPayloadDigest,
} = {}) {
  if (!repositoryContext?.run || typeof digestFactory !== 'function') {
    throw storageError('data_invalid');
  }

  async function voidSale(input) {
    let command;
    let digest;
    try {
      command = normalizeVoidSaleCommand(input);
      digest = await digestFactory(command);
    } catch (error) {
      throw mapStorageError(error, 'data_invalid');
    }

    try {
      return await repositoryContext.run(
        ATOMIC_REVERSAL_STORE_NAMES,
        'readwrite',
        async (repositories) => {
          const membership = await repositories.membershipRepository.getByUserScope(
            command.accountScope,
            command.workspaceId,
            command.actorScope,
          );
          assertPermission(membership, command);

          const oldOperation = await repositories.operationReceiptRepository.getByOperationId(
            command.accountScope,
            command.operationId,
          );
          if (oldOperation) {
            if (!receiptMatches(oldOperation, command, digest)) {
              throw storageError('idempotency_mismatch');
            }
            const reversal = await repositories.saleReversalRepository.get(
              command.accountScope,
              command.workspaceId,
              command.reversalId,
            );
            if (!reversal) throw storageError('data_invalid');
            return Object.freeze({
              status: 'duplicate-safe',
              reversal,
              operationReceipt: oldOperation,
            });
          }

          const existingReversal = await repositories.saleReversalRepository.getBySale(
            command.accountScope,
            command.workspaceId,
            command.originalSaleId,
          );
          if (existingReversal) throw storageError('sale_immutable');

          const bundle = await repositories.saleRepository.get(
            command.accountScope,
            command.workspaceId,
            command.originalSaleId,
          );
          if (!bundle) throw storageError('record_not_found');
          if (bundle.sale.status !== 'final' || bundle.payment.status !== 'recorded') {
            throw storageError('data_invalid');
          }
          if (bundle.payment.method !== 'cash') throw storageError('data_invalid');
          if (bundle.payment.paymentId !== bundle.sale.paymentId) {
            throw storageError('data_invalid');
          }
          if (command.createdAtLocal < bundle.sale.finalizedAtLocal) {
            throw storageError('data_invalid');
          }

          const cashSession = await repositories.cashSessionRepository.get(
            command.accountScope,
            command.workspaceId,
            command.cashSessionId,
          );
          if (!cashSession) throw storageError('cash_session_required');
          if (cashSession.status !== 'open') throw storageError('cash_session_closed');
          if (bundle.sale.finalizedAtLocal < cashSession.openedAtLocal) {
            throw storageError('invalid_reference');
          }

          const trackedQuantities = aggregateTrackedQuantities(bundle.lines);
          if (trackedQuantities.length !== command.stockMovementIds.length) {
            throw storageError('data_invalid');
          }

          const balances = new Map();
          for (const [productId] of trackedQuantities) {
            const balance = await repositories.inventoryRepository.getBalance(
              command.accountScope,
              command.workspaceId,
              productId,
            );
            if (!balance) throw storageError('invalid_reference');
            balances.set(productId, balance);
          }

          const reversal = normalizeSaleReversal({
            schemaVersion: 1,
            reversalId: command.reversalId,
            workspaceId: command.workspaceId,
            originalSaleId: command.originalSaleId,
            paymentId: bundle.payment.paymentId,
            cashSessionId: command.cashSessionId,
            reasonCode: command.reasonCode,
            reasonNote: command.reasonNote,
            reversedAmountMinor: bundle.payment.amountAppliedMinor,
            operationId: command.operationId,
            actorScope: command.actorScope,
            actorRole: command.actorRole,
            reversedAtLocal: command.createdAtLocal,
          }, { workspaceId: command.workspaceId });

          const storedReversal = await repositories.saleReversalRepository.append(
            command.accountScope,
            command.workspaceId,
            reversal,
          );

          const stockReversals = [];
          for (const [index, [productId, quantityScaled]] of trackedQuantities.entries()) {
            const balance = balances.get(productId);
            const movementId = command.stockMovementIds[index];
            const result = await repositories.inventoryRepository.appendMovement(
              command.accountScope,
              command.workspaceId,
              {
                schemaVersion: 1,
                movementId,
                workspaceId: command.workspaceId,
                productId,
                movementType: 'void_reversal',
                quantityDelta: quantityScaled,
                reason: null,
                actorScope: command.actorScope,
                actorRole: command.actorRole,
                sourceReference: command.reversalId,
                operationId: movementId.replace(/^movement_/, 'op_'),
                createdAtLocal: command.createdAtLocal,
              },
              {
                schemaVersion: 1,
                version: balance.version + 1,
                workspaceId: command.workspaceId,
                productId,
                quantityOnHand: balance.quantityOnHand + quantityScaled,
                lastMovementId: movementId,
                updatedAtLocal: command.createdAtLocal,
              },
              balance.version,
            );
            stockReversals.push(result);
          }

          const auditEvent = await repositories.auditRepository.append(
            command.accountScope,
            command.workspaceId,
            {
              schemaVersion: 1,
              eventId: command.eventId,
              accountScope: command.accountScope,
              workspaceId: command.workspaceId,
              actorScope: command.actorScope,
              actorRole: command.actorRole,
              action: 'sale_voided',
              entityType: 'sale_reversal',
              entityId: command.reversalId,
              operationId: command.operationId,
              result: 'success',
              reasonCode: 'none',
              createdAtLocal: command.createdAtLocal,
            },
          );

          const operationReceipt = await repositories.operationReceiptRepository.append(
            command.accountScope,
            normalizeOperationReceipt({
              schemaVersion: 1,
              accountScope: command.accountScope,
              workspaceId: command.workspaceId,
              operationId: command.operationId,
              operationType: 'sale_void',
              payloadDigest: digest,
              entityType: 'sale_reversal',
              entityId: command.reversalId,
              result: 'committed',
              createdAtLocal: command.createdAtLocal,
            }),
          );

          return Object.freeze({
            status: 'committed',
            reversal: storedReversal,
            sale: bundle.sale,
            payment: bundle.payment,
            stockReversals: Object.freeze(stockReversals),
            auditEvent,
            operationReceipt,
          });
        },
      );
    } catch (error) {
      if (error instanceof MandiriStorageError) throw error;
      throw mapStorageError(error, 'transaction_aborted');
    }
  }

  return Object.freeze({ voidSale });
}
