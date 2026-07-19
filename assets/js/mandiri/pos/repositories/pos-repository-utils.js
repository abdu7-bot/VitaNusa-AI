import { normalizeCategory } from '../domain/category.js';
import { normalizeProduct } from '../domain/product.js';
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
