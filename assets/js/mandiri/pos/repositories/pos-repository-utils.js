import { normalizeCategory } from '../domain/category.js';
import { normalizeCartDraft, normalizeCartLine } from '../domain/cart.js';
import { normalizeProduct } from '../domain/product.js';
import { normalizeInventoryBalance, normalizeStockMovement } from '../domain/inventory.js';
import {
  clonePlainRecord,
  normalizeWith,
} from '../../repositories/repository-utils.js';

function stripAccountScope(record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  return copy;
}

function scopedRecord(accountScope, normalized) {
  return Object.freeze({ accountScope, ...normalized });
}

export function normalizeScopedCategory(accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizeCategory, input, { workspaceId });
  return scopedRecord(accountScope, normalized);
}

export function normalizeScopedProduct(accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizeProduct, input, { workspaceId });
  return scopedRecord(accountScope, normalized);
}

export function normalizeScopedCartDraft(accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizeCartDraft, input, { workspaceId });
  return scopedRecord(accountScope, normalized);
}

export function normalizeScopedCartLine(accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizeCartLine, input, { workspaceId });
  return scopedRecord(accountScope, normalized);
}

export function publicCategory(record) {
  return normalizeWith(normalizeCategory, stripAccountScope(record), {
    workspaceId: record.workspaceId,
  });
}

export function publicProduct(record) {
  return normalizeWith(normalizeProduct, stripAccountScope(record), {
    workspaceId: record.workspaceId,
  });
}

export function publicCartDraft(record) {
  return normalizeWith(normalizeCartDraft, stripAccountScope(record), {
    workspaceId: record.workspaceId,
  });
}

export function publicCartLine(record) {
  return normalizeWith(normalizeCartLine, stripAccountScope(record), {
    workspaceId: record.workspaceId,
  });
}

export function normalizeScopedStockMovement(accountScope, workspaceId, input) {
  return scopedRecord(accountScope, normalizeWith(normalizeStockMovement, input, { workspaceId }));
}

export function normalizeScopedInventoryBalance(accountScope, workspaceId, input) {
  return scopedRecord(accountScope, normalizeWith(normalizeInventoryBalance, input, { workspaceId }));
}

export function publicStockMovement(record) {
  return normalizeWith(normalizeStockMovement, stripAccountScope(record), { workspaceId: record.workspaceId });
}

export function publicInventoryBalance(record) {
  return normalizeWith(normalizeInventoryBalance, stripAccountScope(record), { workspaceId: record.workspaceId });
}
