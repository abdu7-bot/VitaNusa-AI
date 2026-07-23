import { createPayloadDigest, isValidEntityId } from '../../domain/ids.js';
import { assertMoney } from '../../domain/money.js';
import {
  assertExactFields, MandiriDomainError, normalizeIsoTimestamp,
  normalizePositiveVersion, normalizeScope,
} from '../../domain/validation.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import { normalizeOperationReceipt } from '../../repositories/operation-receipt-repository.js';
import { ATOMIC_SALE_STORE_NAMES } from '../../repositories/repository-context.js';
import { MandiriStorageError, mapStorageError, storageError } from '../../storage/storage-errors.js';

const COMMAND_FIELDS = Object.freeze([
  'schemaVersion', 'accountScope', 'workspaceId', 'actorScope', 'actorRole',
  'operationId', 'eventId', 'saleId', 'paymentId', 'receiptId', 'stockMovementIds',
  'cartId', 'expectedCartVersion', 'payment', 'createdAtLocal',
]);
const PAYMENT_FIELDS = Object.freeze(['method', 'amountTenderedMinor']);

function id(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  return value;
}

export function normalizeFinalizeSaleCommand(input) {
  assertExactFields(input, COMMAND_FIELDS, { path: 'finalizeSaleCommand' });
  assertExactFields(input.payment, PAYMENT_FIELDS, { path: 'finalizeSaleCommand.payment' });
  if (!['merchant_owner', 'cashier'].includes(input.actorRole)) {
    throw new MandiriDomainError('unknown_workspace_role', 'role tidak valid');
  }
  if (input.payment.method !== 'cash') {
    throw new MandiriDomainError('data_invalid', 'metode payment MVP hanya cash');
  }
  if (!Array.isArray(input.stockMovementIds)) {
    throw new MandiriDomainError('data_invalid', 'stockMovementIds wajib array');
  }
  const stockMovementIds = Object.freeze(input.stockMovementIds.map((value, index) => (
    id(value, 'movement', `finalizeSaleCommand.stockMovementIds.${index}`)
  )));
  if (new Set(stockMovementIds).size !== stockMovementIds.length) {
    throw new MandiriDomainError('data_invalid', 'stockMovementIds duplicate');
  }
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'finalizeSaleCommand.schemaVersion'),
    accountScope: normalizeScope(input.accountScope, 'finalizeSaleCommand.accountScope'),
    workspaceId: id(input.workspaceId, 'workspace', 'finalizeSaleCommand.workspaceId'),
    actorScope: normalizeScope(input.actorScope, 'finalizeSaleCommand.actorScope'),
    actorRole: input.actorRole,
    operationId: id(input.operationId, 'op', 'finalizeSaleCommand.operationId'),
    eventId: id(input.eventId, 'audit', 'finalizeSaleCommand.eventId'),
    saleId: id(input.saleId, 'sale', 'finalizeSaleCommand.saleId'),
    paymentId: id(input.paymentId, 'payment', 'finalizeSaleCommand.paymentId'),
    receiptId: id(input.receiptId, 'receipt', 'finalizeSaleCommand.receiptId'),
    stockMovementIds,
    cartId: id(input.cartId, 'cart', 'finalizeSaleCommand.cartId'),
    expectedCartVersion: normalizePositiveVersion(input.expectedCartVersion, 'finalizeSaleCommand.expectedCartVersion'),
    payment: Object.freeze({
      method: 'cash',
      amountTenderedMinor: assertMoney(input.payment.amountTenderedMinor),
    }),
    createdAtLocal: normalizeIsoTimestamp(input.createdAtLocal, 'finalizeSaleCommand.createdAtLocal'),
  });
}

function assertPermission(membership, command) {
  const allowed = membership && membership.role === command.actorRole && canPerformWorkspaceAction(
    {
      accountScope: membership.accountScope,
      workspaceId: membership.workspaceId,
      userScope: membership.userScope,
      role: membership.role,
      status: membership.status,
    },
    'sale.create',
    { accountScope: command.accountScope, workspaceId: command.workspaceId },
  );
  if (!allowed) throw storageError('permission_denied');
}

function saleLine(cartLine, saleId, product) {
  return {
    schemaVersion: 1,
    saleId,
    lineNo: cartLine.lineNo,
    productId: cartLine.productId,
    productNameSnapshot: cartLine.productNameSnapshot,
    skuSnapshot: cartLine.skuSnapshot,
    quantityScaled: cartLine.quantityScaled,
    quantityScale: cartLine.quantityScale,
    unitPriceMinor: cartLine.unitPriceMinor,
    lineDiscountMinor: cartLine.lineDiscountMinor,
    lineGrossMinor: cartLine.lineGrossMinor,
    lineSubtotalMinor: cartLine.lineSubtotalMinor,
    stockTrackingSnapshot: product.stockTracking,
  };
}

export function createSaleFinalizationService({
  repositoryContext,
  digestFactory = createPayloadDigest,
} = {}) {
  if (!repositoryContext?.run || typeof digestFactory !== 'function') throw storageError('data_invalid');

  async function finalize(input) {
    let command;
    let digest;
    try {
      command = normalizeFinalizeSaleCommand(input);
      digest = await digestFactory(command);
    } catch (error) {
      throw mapStorageError(error, error?.code === 'underpayment' ? 'underpayment' : 'data_invalid');
    }

    try {
      return await repositoryContext.run(ATOMIC_SALE_STORE_NAMES, 'readwrite', async (repositories) => {
        const membership = await repositories.membershipRepository.getByUserScope(
          command.accountScope, command.workspaceId, command.actorScope,
        );
        assertPermission(membership, command);

        const oldOperation = await repositories.operationReceiptRepository.getByOperationId(
          command.accountScope, command.operationId,
        );
        if (oldOperation) {
          if (
            oldOperation.payloadDigest !== digest || oldOperation.operationType !== 'sale_finalize'
            || oldOperation.workspaceId !== command.workspaceId || oldOperation.entityType !== 'sale'
            || oldOperation.entityId !== command.saleId || oldOperation.result !== 'committed'
          ) throw storageError('idempotency_mismatch');
          const bundle = await repositories.saleRepository.get(
            command.accountScope, command.workspaceId, command.saleId,
          );
          if (!bundle) throw storageError('data_invalid');
          return Object.freeze({ status: 'duplicate-safe', ...bundle, operationReceipt: oldOperation });
        }

        const cart = await repositories.cartRepository.get(
          command.accountScope, command.workspaceId, command.cartId,
        );
        if (!cart) throw storageError('record_not_found');
        if (cart.status === 'cancelled') throw storageError('cart_cancelled');
        if (cart.status === 'finalized') throw storageError('cart_already_finalized');
        if (cart.version !== command.expectedCartVersion) throw storageError('version_conflict');
        if (cart.lines.length === 0) throw storageError('empty_cart');

        const products = new Map();
        const balances = new Map();
        for (const line of cart.lines) {
          const product = await repositories.productRepository.get(
            command.accountScope, command.workspaceId, line.productId,
          );
          if (!product) throw storageError('invalid_reference');
          if (!product.active) throw storageError('inactive_product');
          if (product.sellingPriceMinor !== line.unitPriceMinor) throw storageError('price_changed');
          products.set(line.productId, product);
          if (product.stockTracking) {
            const balance = await repositories.inventoryRepository.getBalance(
              command.accountScope, command.workspaceId, line.productId,
            );
            if (!balance || balance.quantityOnHand < line.quantityScaled) {
              throw storageError('insufficient_local_stock');
            }
            balances.set(line.productId, balance);
          }
        }

        if (command.payment.amountTenderedMinor < cart.grandTotalMinor) throw storageError('underpayment');
        const trackedLines = cart.lines.filter((line) => products.get(line.productId).stockTracking);
        if (trackedLines.length !== command.stockMovementIds.length) throw storageError('data_invalid');
        const lines = cart.lines.map((line) => saleLine(line, command.saleId, products.get(line.productId)));
        const sale = {
          schemaVersion: 1,
          saleId: command.saleId,
          workspaceId: command.workspaceId,
          cartId: command.cartId,
          cartVersion: cart.version,
          status: 'final',
          currencyCode: cart.currencyCode,
          discountMinor: cart.discountMinor,
          subtotalMinor: cart.subtotalMinor,
          grandTotalMinor: cart.grandTotalMinor,
          lineCount: lines.length,
          paymentId: command.paymentId,
          receiptId: command.receiptId,
          operationId: command.operationId,
          actorScope: command.actorScope,
          actorRole: command.actorRole,
          finalizedAtLocal: command.createdAtLocal,
        };
        const payment = {
          schemaVersion: 1,
          paymentId: command.paymentId,
          workspaceId: command.workspaceId,
          saleId: command.saleId,
          method: 'cash',
          status: 'recorded',
          currencyCode: 'IDR',
          amountDueMinor: cart.grandTotalMinor,
          amountTenderedMinor: command.payment.amountTenderedMinor,
          amountAppliedMinor: cart.grandTotalMinor,
          changeMinor: command.payment.amountTenderedMinor - cart.grandTotalMinor,
          operationId: command.operationId,
          actorScope: command.actorScope,
          actorRole: command.actorRole,
          recordedAtLocal: command.createdAtLocal,
        };
        const receipt = {
          schemaVersion: 1,
          receiptId: command.receiptId,
          workspaceId: command.workspaceId,
          saleId: command.saleId,
          paymentId: command.paymentId,
          currencyCode: 'IDR',
          subtotalMinor: cart.subtotalMinor,
          discountMinor: cart.discountMinor,
          grandTotalMinor: cart.grandTotalMinor,
          amountTenderedMinor: payment.amountTenderedMinor,
          changeMinor: payment.changeMinor,
          paymentMethod: 'cash',
          lineCount: lines.length,
          lines,
          finalizedAtLocal: command.createdAtLocal,
        };

        const bundle = await repositories.saleRepository.appendFinal(
          command.accountScope, command.workspaceId, sale, lines, payment, receipt,
        );
        for (const [index, line] of trackedLines.entries()) {
          const balance = balances.get(line.productId);
          const quantityOnHand = balance.quantityOnHand - line.quantityScaled;
          await repositories.inventoryRepository.appendMovement(
            command.accountScope,
            command.workspaceId,
            {
              schemaVersion: 1,
              movementId: command.stockMovementIds[index],
              workspaceId: command.workspaceId,
              productId: line.productId,
              movementType: 'sale',
              quantityDelta: -line.quantityScaled,
              reason: null,
              actorScope: command.actorScope,
              actorRole: command.actorRole,
              sourceReference: command.saleId,
              operationId: command.stockMovementIds[index].replace(/^movement_/, 'op_'),
              createdAtLocal: command.createdAtLocal,
            },
            {
              schemaVersion: 1,
              version: balance.version + 1,
              workspaceId: command.workspaceId,
              productId: line.productId,
              quantityOnHand,
              lastMovementId: command.stockMovementIds[index],
              updatedAtLocal: command.createdAtLocal,
            },
            balance.version,
          );
        }
        const { lines: _cartLines, ...cartDraft } = cart;
        const closedCart = await repositories.cartRepository.update(
          command.accountScope,
          command.workspaceId,
          { ...cartDraft, status: 'finalized', version: cart.version + 1, updatedAtLocal: command.createdAtLocal },
          cart.lines,
          cart.version,
        );
        const auditEvent = await repositories.auditRepository.append(
          command.accountScope, command.workspaceId, {
            schemaVersion: 1,
            eventId: command.eventId,
            accountScope: command.accountScope,
            workspaceId: command.workspaceId,
            actorScope: command.actorScope,
            actorRole: command.actorRole,
            action: 'sale_created',
            entityType: 'sale',
            entityId: command.saleId,
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
            operationType: 'sale_finalize',
            payloadDigest: digest,
            entityType: 'sale',
            entityId: command.saleId,
            result: 'committed',
            createdAtLocal: command.createdAtLocal,
          }),
        );
        return Object.freeze({
          status: 'committed', ...bundle, cart: closedCart, auditEvent, operationReceipt,
        });
      });
    } catch (error) {
      if (error instanceof MandiriStorageError) throw error;
      throw mapStorageError(error, 'transaction_aborted');
    }
  }

  return Object.freeze({ finalize });
}
