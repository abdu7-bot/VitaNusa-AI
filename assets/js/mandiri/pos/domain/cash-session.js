import { createEntityId, isValidEntityId } from '../../domain/ids.js';
import { addMoney, assertMoney, subtractMoney } from '../../domain/money.js';
import { isWorkspaceRole } from '../../domain/membership.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from '../../domain/validation.js';

export const CASH_SESSION_STATUSES = Object.freeze(['open', 'closed']);

const FIELDS = Object.freeze([
  'schemaVersion', 'version', 'cashSessionId', 'workspaceId', 'status',
  'openingCashMinor', 'openedByScope', 'openedByRole', 'openOperationId',
  'openedAtLocal', 'closedByScope', 'closedByRole', 'closeOperationId',
  'closedAtLocal', 'closingSummary', 'updatedAtLocal',
]);
const SUMMARY_FIELDS = Object.freeze([
  'cashSalesMinor', 'expenseOutMinor', 'expectedCashMinor',
  'countedCashMinor', 'differenceMinor',
]);

function entityId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  }
  return value;
}

function role(value, path) {
  if (!isWorkspaceRole(value)) {
    throw new MandiriDomainError('unknown_workspace_role', 'role workspace tidak valid', path);
  }
  return value;
}

function calculateDifference(countedCashMinor, expectedCashMinor) {
  return expectedCashMinor >= 0
    ? subtractMoney(countedCashMinor, expectedCashMinor)
    : addMoney(countedCashMinor, -expectedCashMinor);
}

export function createCashSessionId(cryptoRef = globalThis.crypto) {
  return createEntityId('cashsession', cryptoRef);
}

export function createClosingSummary({
  openingCashMinor,
  cashSalesMinor,
  expenseOutMinor,
  countedCashMinor,
}) {
  const opening = assertMoney(openingCashMinor);
  const sales = assertMoney(cashSalesMinor);
  const expenses = assertMoney(expenseOutMinor);
  const counted = assertMoney(countedCashMinor);
  const expected = subtractMoney(addMoney(opening, sales), expenses);
  return Object.freeze({
    cashSalesMinor: sales,
    expenseOutMinor: expenses,
    expectedCashMinor: expected,
    countedCashMinor: counted,
    differenceMinor: calculateDifference(counted, expected),
  });
}

function normalizeClosingSummary(value, openingCashMinor) {
  assertExactFields(value, SUMMARY_FIELDS, { path: 'cashSession.closingSummary' });
  const summary = createClosingSummary({
    openingCashMinor,
    cashSalesMinor: value.cashSalesMinor,
    expenseOutMinor: value.expenseOutMinor,
    countedCashMinor: value.countedCashMinor,
  });
  if (
    value.expectedCashMinor !== summary.expectedCashMinor
    || value.differenceMinor !== summary.differenceMinor
  ) {
    throw new MandiriDomainError(
      'data_invalid',
      'closing summary tidak konsisten',
      'cashSession.closingSummary',
    );
  }
  return summary;
}

export function normalizeCashSession(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertExactFields(input, FIELDS, { path: 'cashSession' });
  if (!CASH_SESSION_STATUSES.includes(input.status)) {
    throw new MandiriDomainError('data_invalid', 'status cash session tidak didukung', 'cashSession.status');
  }
  const workspaceId = entityId(input.workspaceId, 'workspace', 'cashSession.workspaceId');
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId) {
    throw new MandiriDomainError(
      'scope_mismatch',
      'workspace tidak sesuai',
      'cashSession.workspaceId',
    );
  }
  const openingCashMinor = assertMoney(input.openingCashMinor);
  const openedAtLocal = normalizeIsoTimestamp(input.openedAtLocal, 'cashSession.openedAtLocal');
  const updatedAtLocal = normalizeIsoTimestamp(input.updatedAtLocal, 'cashSession.updatedAtLocal');
  if (updatedAtLocal < openedAtLocal) {
    throw new MandiriDomainError('data_invalid', 'updatedAt mendahului open', 'cashSession.updatedAtLocal');
  }

  const base = {
    schemaVersion: normalizePositiveVersion(input.schemaVersion, 'cashSession.schemaVersion'),
    version: normalizePositiveVersion(input.version, 'cashSession.version'),
    cashSessionId: entityId(
      input.cashSessionId,
      'cashsession',
      'cashSession.cashSessionId',
    ),
    workspaceId,
    status: input.status,
    openingCashMinor,
    openedByScope: normalizeScope(input.openedByScope, 'cashSession.openedByScope'),
    openedByRole: role(input.openedByRole, 'cashSession.openedByRole'),
    openOperationId: entityId(
      input.openOperationId,
      'op',
      'cashSession.openOperationId',
    ),
    openedAtLocal,
  };

  if (input.status === 'open') {
    if (
      input.closedByScope !== null
      || input.closedByRole !== null
      || input.closeOperationId !== null
      || input.closedAtLocal !== null
      || input.closingSummary !== null
    ) {
      throw new MandiriDomainError('data_invalid', 'session open memiliki field close', 'cashSession');
    }
    return Object.freeze({
      ...base,
      closedByScope: null,
      closedByRole: null,
      closeOperationId: null,
      closedAtLocal: null,
      closingSummary: null,
      updatedAtLocal,
    });
  }

  const closedAtLocal = normalizeIsoTimestamp(input.closedAtLocal, 'cashSession.closedAtLocal');
  if (closedAtLocal < openedAtLocal || updatedAtLocal !== closedAtLocal) {
    throw new MandiriDomainError('data_invalid', 'waktu close tidak konsisten', 'cashSession.closedAtLocal');
  }
  return Object.freeze({
    ...base,
    closedByScope: normalizeScope(input.closedByScope, 'cashSession.closedByScope'),
    closedByRole: role(input.closedByRole, 'cashSession.closedByRole'),
    closeOperationId: entityId(
      input.closeOperationId,
      'op',
      'cashSession.closeOperationId',
    ),
    closedAtLocal,
    closingSummary: normalizeClosingSummary(input.closingSummary, openingCashMinor),
    updatedAtLocal,
  });
}
