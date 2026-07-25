import { createEntityId, isValidEntityId } from '../../domain/ids.js';
import { assertMoney } from '../../domain/money.js';
import { isWorkspaceRole } from '../../domain/membership.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeCode,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
  normalizeTrimmedString,
} from '../../domain/validation.js';

export const EXPENSE_CATEGORIES = Object.freeze([
  'operational',
  'supplies',
  'transport',
  'utilities',
  'maintenance',
  'other',
]);

const FIELDS = Object.freeze([
  'schemaVersion', 'expenseId', 'workspaceId', 'cashSessionId', 'category',
  'amountMinor', 'note', 'status', 'operationId', 'actorScope', 'actorRole',
  'recordedAtLocal',
]);

function entityId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  }
  return value;
}

export function createExpenseId(cryptoRef = globalThis.crypto) {
  return createEntityId('expense', cryptoRef);
}

export function normalizeExpense(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, FIELDS, { path: 'expense' });
  const workspaceId = entityId(input.workspaceId, 'workspace', 'expense.workspaceId');
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId) {
    throw new MandiriDomainError('scope_mismatch', 'workspace tidak sesuai', 'expense.workspaceId');
  }
  const category = normalizeCode(input.category, {
    path: 'expense.category',
    maxLength: 80,
    pattern: /^[a-z][a-z0-9_]*$/,
  });
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new MandiriDomainError('data_invalid', 'kategori expense tidak didukung', 'expense.category');
  }
  const amountMinor = assertMoney(input.amountMinor);
  if (amountMinor === 0) {
    throw new MandiriDomainError('data_invalid', 'amountMinor harus lebih besar dari nol', 'expense.amountMinor');
  }
  if (input.status !== 'recorded') {
    throw new MandiriDomainError('data_invalid', 'expense MVP harus recorded', 'expense.status');
  }
  if (!isWorkspaceRole(input.actorRole)) {
    throw new MandiriDomainError('unknown_workspace_role', 'role workspace tidak valid', 'expense.actorRole');
  }
  const note = input.note === null ? null : normalizeTrimmedString(input.note, {
    path: 'expense.note',
    maxLength: 240,
  });

  return Object.freeze({
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'expense.schemaVersion'),
    expenseId: entityId(input.expenseId, 'expense', 'expense.expenseId'),
    workspaceId,
    cashSessionId: entityId(
      input.cashSessionId,
      'cashsession',
      'expense.cashSessionId',
    ),
    category,
    amountMinor,
    note,
    status: 'recorded',
    operationId: entityId(input.operationId, 'op', 'expense.operationId'),
    actorScope: normalizeScope(input.actorScope, 'expense.actorScope'),
    actorRole: input.actorRole,
    recordedAtLocal: normalizeIsoTimestamp(input.recordedAtLocal, 'expense.recordedAtLocal'),
  });
}
