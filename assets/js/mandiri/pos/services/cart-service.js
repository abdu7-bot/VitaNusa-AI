import { createPayloadDigest, isValidEntityId } from '../../domain/ids.js';
import { addMoney, assertMoney, multiplyMoney, subtractMoney } from '../../domain/money.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from '../../domain/validation.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import { normalizeOperationReceipt } from '../../repositories/operation-receipt-repository.js';
import { ATOMIC_CART_STORE_NAMES } from '../../repositories/repository-context.js';
import { MandiriStorageError, mapStorageError, storageError } from '../../storage/storage-errors.js';
import { previewCartDraft } from '../domain/cart.js';

const CART_OPERATION_TYPES = Object.freeze(['cart_create', 'cart_update']);

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
const ENTITY_FIELDS = Object.freeze(['cartId', 'discountMinor', 'lines']);
const LINE_REQUEST_FIELDS = Object.freeze(['productId', 'quantity', 'lineDiscountMinor']);

function assertId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID command tidak valid', path);
  }
  return value;
}

function assertPositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MandiriDomainError('invalid_quantity', 'nilai harus safe integer positif', path);
  }
  return value;
}

function normalizeLineRequest(input) {
  assertExactFields(input, LINE_REQUEST_FIELDS, {
    requiredFields: ['productId', 'quantity'],
    path: 'cartLineRequest',
  });
  return Object.freeze({
    productId: assertId(input.productId, 'product', 'cartLineRequest.productId'),
    quantity: assertPositiveInteger(input.quantity, 'cartLineRequest.quantity'),
    lineDiscountMinor: Object.hasOwn(input, 'lineDiscountMinor')
      ? assertMoney(input.lineDiscountMinor)
      : 0,
  });
}

function normalizeCartEntity(input) {
  assertExactFields(input, ENTITY_FIELDS, {
    requiredFields: ENTITY_FIELDS,
    path: 'cartCommand.entity',
  });
  return Object.freeze({
    cartId: assertId(input.cartId, 'cart', 'cartCommand.entity.cartId'),
    discountMinor: assertMoney(input.discountMinor),
    lines: Object.freeze(input.lines.map(normalizeLineRequest)),
  });
}

export function normalizeCartCommand(input) {
  assertExactFields(input, COMMAND_FIELDS, {
    requiredFields: COMMAND_FIELDS.filter((field) => field !== 'expectedVersion'),
    path: 'cartCommand',
  });
  if (!CART_OPERATION_TYPES.includes(input.operationType)) {
    throw new MandiriDomainError('unknown_operation_type', 'operationType tidak dikenal');
  }
  const isUpdate = input.operationType === 'cart_update';
  if (isUpdate !== Object.hasOwn(input, 'expectedVersion')) {
    throw new MandiriDomainError('invalid_version', 'expectedVersion hanya wajib untuk update');
  }
  if (!['merchant_owner', 'cashier'].includes(input.actorRole)) {
    throw new MandiriDomainError('unknown_workspace_role', 'actorRole tidak dikenal');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'cartCommand.schemaVersion'),
    accountScope: normalizeScope(input.accountScope, 'cartCommand.accountScope'),
    workspaceId: assertId(input.workspaceId, 'workspace', 'cartCommand.workspaceId'),
    actorScope: normalizeScope(input.actorScope, 'cartCommand.actorScope'),
    actorRole: input.actorRole,
    operationId: assertId(input.operationId, 'op', 'cartCommand.operationId'),
    eventId: assertId(input.eventId, 'audit', 'cartCommand.eventId'),
    operationType: input.operationType,
    ...(isUpdate ? { expectedVersion: normalizePositiveVersion(input.expectedVersion, 'cartCommand.expectedVersion') } : {}),
    createdAtLocal: normalizeIsoTimestamp(input.createdAtLocal, 'cartCommand.createdAtLocal'),
    entity: normalizeCartEntity(input.entity),
  });
}

function normalizeLineSnapshot(line, cartId, lineNo, product) {
  const quantityScaled = line.quantity;
  const quantityScale = 1;
  const unitPriceMinor = product.sellingPriceMinor;
  const lineDiscountMinor = line.lineDiscountMinor;
  const lineGrossMinor = multiplyMoney(unitPriceMinor, quantityScaled);
  if (lineDiscountMinor > lineGrossMinor) {
    throw new MandiriDomainError('discount_exceeds_subtotal', 'diskon line tidak boleh melebihi subtotal');
  }
  const lineSubtotalMinor = subtractMoney(lineGrossMinor, lineDiscountMinor);
  return {
    schemaVersion: 1,
    cartId,
    lineNo,
    productId: product.productId,
    productNameSnapshot: product.name,
    skuSnapshot: product.sku,
    quantityScaled,
    quantityScale,
    unitPriceMinor,
    lineDiscountMinor,
    lineGrossMinor,
    lineSubtotalMinor,
  };
}

function mergeRequestLines(lines) {
  const order = [];
  const byProductId = new Map();
  for (const line of lines) {
    if (!byProductId.has(line.productId)) order.push(line.productId);
    const current = byProductId.get(line.productId) ?? { quantity: 0, lineDiscountMinor: 0 };
    byProductId.set(line.productId, {
      quantity: addSafeQuantity(current.quantity, line.quantity),
      lineDiscountMinor: addMoney(current.lineDiscountMinor, line.lineDiscountMinor),
    });
  }
  return order.map((productId) => ({ productId, ...byProductId.get(productId) }));
}

function addSafeQuantity(left, right) {
  const total = left + right;
  if (!Number.isSafeInteger(total) || total < 1) {
    throw new MandiriDomainError('invalid_quantity', 'jumlah quantity melewati safe integer');
  }
  return total;
}

function currentLinePriceChanged(currentCart, productsById) {
  for (const line of currentCart.lines) {
    const product = productsById.get(line.productId);
    if (product && product.sellingPriceMinor !== line.unitPriceMinor) return true;
  }
  return false;
}

function buildAudit(command) {
  return {
    schemaVersion: 1,
    eventId: command.eventId,
    accountScope: command.accountScope,
    workspaceId: command.workspaceId,
    actorScope: command.actorScope,
    actorRole: command.actorRole,
    action: command.operationType,
    entityType: 'cart_draft',
    entityId: command.entity.cartId,
    operationId: command.operationId,
    result: 'success',
    reasonCode: 'none',
    createdAtLocal: command.createdAtLocal,
  };
}

export function createCartService({
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
      command = normalizeCartCommand(input);
      digest = await digestFactory(command);
    } catch (error) {
      throw mapStorageError(error, 'data_invalid');
    }

    try {
      return await repositoryContext.run(
        ATOMIC_CART_STORE_NAMES,
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
            'cart.update',
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
              || oldReceipt.entityType !== 'cart_draft'
              || oldReceipt.entityId !== command.entity.cartId
              || oldReceipt.result !== 'committed'
            ) throw storageError('idempotency_mismatch');
            const cart = await repositories.cartRepository.get(
              command.accountScope,
              command.workspaceId,
              command.entity.cartId,
            );
            if (!cart) throw storageError('data_invalid');
            return Object.freeze({ status: 'duplicate-safe', cart, salePreview: previewCartDraft(cart, cart.lines), operationReceipt: oldReceipt });
          }

          const productSnapshots = [];
          const aggregated = mergeRequestLines(command.entity.lines);
          if (aggregated.length === 0) throw storageError('empty_cart');
          const currentCart = command.operationType === 'cart_update'
            ? await repositories.cartRepository.get(
              command.accountScope,
              command.workspaceId,
              command.entity.cartId,
            )
            : null;
          if (command.operationType === 'cart_update') {
            if (!currentCart) throw storageError('record_not_found');
            if (currentCart.version !== command.expectedVersion) {
              throw storageError('version_conflict');
            }
          }
          const productsById = new Map();
          for (const [index, requestLine] of aggregated.entries()) {
            const product = await repositories.productRepository.get(
              command.accountScope,
              command.workspaceId,
              requestLine.productId,
            );
            if (!product) throw storageError('invalid_reference');
            if (!product.active) throw storageError('inactive_product');
            productsById.set(product.productId, product);
            const currentBalance = await repositories.inventoryRepository.getBalance(
              command.accountScope,
              command.workspaceId,
              requestLine.productId,
            );
            if (product.stockTracking && (!currentBalance || currentBalance.quantityOnHand < requestLine.quantity)) {
              throw storageError('insufficient_local_stock');
            }
            productSnapshots.push(normalizeLineSnapshot(
              requestLine,
              command.entity.cartId,
              index + 1,
              product,
            ));
          }
          if (command.operationType === 'cart_update' && currentCart && currentLinePriceChanged(currentCart, productsById)) {
            throw storageError('price_changed');
          }

          const subtotalMinor = productSnapshots.reduce(
            (sum, line) => addMoney(sum, line.lineSubtotalMinor),
            0,
          );
          if (command.entity.discountMinor > subtotalMinor) {
            throw storageError('discount_exceeds_subtotal');
          }
          const draft = {
            schemaVersion: 1,
            version: command.operationType === 'cart_create' ? 1 : (command.expectedVersion + 1),
            cartId: command.entity.cartId,
            workspaceId: command.workspaceId,
            status: 'draft',
            currencyCode: 'IDR',
            discountMinor: command.entity.discountMinor,
            subtotalMinor,
            grandTotalMinor: subtractMoney(subtotalMinor, command.entity.discountMinor),
            lineCount: productSnapshots.length,
            createdAtLocal: currentCart?.createdAtLocal ?? command.createdAtLocal,
            updatedAtLocal: command.createdAtLocal,
          };

          const cart = command.operationType === 'cart_create'
            ? await repositories.cartRepository.create(command.accountScope, command.workspaceId, draft, productSnapshots)
            : await repositories.cartRepository.update(
              command.accountScope,
              command.workspaceId,
              draft,
              productSnapshots,
              command.expectedVersion,
            );
          const auditEvent = await repositories.auditRepository.append(
            command.accountScope,
            command.workspaceId,
            buildAudit(command),
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
              entityType: 'cart_draft',
              entityId: command.entity.cartId,
              result: 'committed',
              createdAtLocal: command.createdAtLocal,
            }),
          );
          return Object.freeze({
            status: 'committed',
            cart,
            salePreview: previewCartDraft(cart, cart.lines),
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

  return Object.freeze({ execute });
}
