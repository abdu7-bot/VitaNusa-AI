import { createPayloadDigest, isValidEntityId } from '../../domain/ids.js';
import { addMoney, assertMoney } from '../../domain/money.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from '../../domain/validation.js';
import { normalizeOperationReceipt } from '../../repositories/operation-receipt-repository.js';
import { ATOMIC_CASH_STORE_NAMES } from '../../repositories/repository-context.js';
import {
  MandiriStorageError,
  mapStorageError,
  storageError,
} from '../../storage/storage-errors.js';
import { createClosingSummary } from '../domain/cash-session.js';
import { normalizeExpense } from '../domain/expense.js';

const BASE_FIELDS = Object.freeze([
  'schemaVersion', 'accountScope', 'workspaceId', 'actorScope', 'actorRole',
  'operationId', 'eventId', 'cashSessionId', 'createdAtLocal',
]);
const OPEN_FIELDS = Object.freeze([...BASE_FIELDS, 'openingCashMinor']);
const EXPENSE_FIELDS = Object.freeze([
  ...BASE_FIELDS, 'expenseId', 'expectedVersion', 'category', 'amountMinor', 'note',
]);
const CLOSE_FIELDS = Object.freeze([...BASE_FIELDS, 'expectedVersion', 'countedCashMinor']);

function id(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  }
  return value;
}

function normalizeActorRole(value) {
  if (!['merchant_owner', 'cashier'].includes(value)) {
    throw new MandiriDomainError('unknown_workspace_role', 'role tidak valid', 'actorRole');
  }
  return value;
}

function normalizeBase(input, fields, path) {
  assertExactFields(input, fields, { path });
  return {
    schemaVersion: normalizePositiveVersion(input.schemaVersion, `${path}.schemaVersion`),
    accountScope: normalizeScope(input.accountScope, `${path}.accountScope`),
    workspaceId: id(input.workspaceId, 'workspace', `${path}.workspaceId`),
    actorScope: normalizeScope(input.actorScope, `${path}.actorScope`),
    actorRole: normalizeActorRole(input.actorRole),
    operationId: id(input.operationId, 'op', `${path}.operationId`),
    eventId: id(input.eventId, 'audit', `${path}.eventId`),
    cashSessionId: id(input.cashSessionId, 'cashsession', `${path}.cashSessionId`),
    createdAtLocal: normalizeIsoTimestamp(input.createdAtLocal, `${path}.createdAtLocal`),
  };
}

export function normalizeOpenCashSessionCommand(input) {
  const base = normalizeBase(input, OPEN_FIELDS, 'openCashSessionCommand');
  return Object.freeze({
    ...base,
    openingCashMinor: assertMoney(input.openingCashMinor),
  });
}

export function normalizeRecordExpenseCommand(input) {
  const base = normalizeBase(input, EXPENSE_FIELDS, 'recordExpenseCommand');
  const expense = normalizeExpense({
    schemaVersion: input.schemaVersion,
    expenseId: input.expenseId,
    workspaceId: input.workspaceId,
    cashSessionId: input.cashSessionId,
    category: input.category,
    amountMinor: input.amountMinor,
    note: input.note,
    status: 'recorded',
    operationId: input.operationId,
    actorScope: input.actorScope,
    actorRole: input.actorRole,
    recordedAtLocal: input.createdAtLocal,
  }, { workspaceId: base.workspaceId });
  return Object.freeze({
    ...base,
    expenseId: expense.expenseId,
    expectedVersion: normalizePositiveVersion(
      input.expectedVersion,
      'recordExpenseCommand.expectedVersion',
    ),
    category: expense.category,
    amountMinor: expense.amountMinor,
    note: expense.note,
  });
}

export function normalizeCloseCashSessionCommand(input) {
  const base = normalizeBase(input, CLOSE_FIELDS, 'closeCashSessionCommand');
  return Object.freeze({
    ...base,
    expectedVersion: normalizePositiveVersion(
      input.expectedVersion,
      'closeCashSessionCommand.expectedVersion',
    ),
    countedCashMinor: assertMoney(input.countedCashMinor),
  });
}

function assertPermission(membership, command, action) {
  const allowed = membership && membership.role === command.actorRole && canPerformWorkspaceAction(
    {
      accountScope: membership.accountScope,
      workspaceId: membership.workspaceId,
      userScope: membership.userScope,
      role: membership.role,
      status: membership.status,
    },
    action,
    { accountScope: command.accountScope, workspaceId: command.workspaceId },
  );
  if (!allowed) throw storageError('permission_denied');
}

function receiptMatches(receipt, command, operationType, entityType, entityId) {
  return (
    receipt.payloadDigest === command.payloadDigest
    && receipt.operationType === operationType
    && receipt.workspaceId === command.workspaceId
    && receipt.entityType === entityType
    && receipt.entityId === entityId
    && receipt.result === 'committed'
  );
}

async function appendAuditAndReceipt(
  repositories,
  command,
  { action, entityType, entityId, operationType },
) {
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
      action,
      entityType,
      entityId,
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
      operationType,
      payloadDigest: command.payloadDigest,
      entityType,
      entityId,
      result: 'committed',
      createdAtLocal: command.createdAtLocal,
    }),
  );
  return { auditEvent, operationReceipt };
}

function validationError(error) {
  return ['money_overflow', 'unsafe_integer'].includes(error?.code)
    ? storageError('unsafe_integer', error)
    : mapStorageError(error, 'data_invalid');
}

export function createCashSessionService({
  repositoryContext,
  digestFactory = createPayloadDigest,
} = {}) {
  if (!repositoryContext?.run || typeof digestFactory !== 'function') {
    throw storageError('data_invalid');
  }

  async function prepare(input, normalizer) {
    try {
      const normalized = normalizer(input);
      return Object.freeze({
        ...normalized,
        payloadDigest: await digestFactory(normalized),
      });
    } catch (error) {
      throw validationError(error);
    }
  }

  async function open(input) {
    const command = await prepare(input, normalizeOpenCashSessionCommand);
    try {
      return await repositoryContext.run(
        ATOMIC_CASH_STORE_NAMES,
        'readwrite',
        async (repositories) => {
          const membership = await repositories.membershipRepository.getByUserScope(
            command.accountScope,
            command.workspaceId,
            command.actorScope,
          );
          assertPermission(membership, command, 'cash_session.open');
          const oldOperation = await repositories.operationReceiptRepository.getByOperationId(
            command.accountScope,
            command.operationId,
          );
          if (oldOperation) {
            if (!receiptMatches(
              oldOperation,
              command,
              'cash_session_open',
              'cash_session',
              command.cashSessionId,
            )) throw storageError('idempotency_mismatch');
            const cashSession = await repositories.cashSessionRepository.get(
              command.accountScope,
              command.workspaceId,
              command.cashSessionId,
            );
            if (!cashSession) throw storageError('data_invalid');
            return Object.freeze({
              status: 'duplicate-safe',
              cashSession,
              operationReceipt: oldOperation,
            });
          }
          if (await repositories.cashSessionRepository.findOpen(
            command.accountScope,
            command.workspaceId,
          )) throw storageError('cash_session_already_open');
          const sessions = await repositories.cashSessionRepository.listByWorkspace(
            command.accountScope,
            command.workspaceId,
          );
          const latest = sessions.at(-1);
          if (latest?.closedAtLocal && command.createdAtLocal < latest.closedAtLocal) {
            throw storageError('data_invalid');
          }
          const cashSession = await repositories.cashSessionRepository.create(
            command.accountScope,
            command.workspaceId,
            {
              schemaVersion: 1,
              version: 1,
              cashSessionId: command.cashSessionId,
              workspaceId: command.workspaceId,
              status: 'open',
              openingCashMinor: command.openingCashMinor,
              openedByScope: command.actorScope,
              openedByRole: command.actorRole,
              openOperationId: command.operationId,
              openedAtLocal: command.createdAtLocal,
              closedByScope: null,
              closedByRole: null,
              closeOperationId: null,
              closedAtLocal: null,
              closingSummary: null,
              updatedAtLocal: command.createdAtLocal,
            },
          );
          const records = await appendAuditAndReceipt(repositories, command, {
            action: 'cash_session_opened',
            entityType: 'cash_session',
            entityId: command.cashSessionId,
            operationType: 'cash_session_open',
          });
          return Object.freeze({ status: 'committed', cashSession, ...records });
        },
      );
    } catch (error) {
      if (error instanceof MandiriStorageError) throw error;
      throw mapStorageError(error, 'transaction_aborted');
    }
  }

  async function recordExpense(input) {
    const command = await prepare(input, normalizeRecordExpenseCommand);
    try {
      return await repositoryContext.run(
        ATOMIC_CASH_STORE_NAMES,
        'readwrite',
        async (repositories) => {
          const membership = await repositories.membershipRepository.getByUserScope(
            command.accountScope,
            command.workspaceId,
            command.actorScope,
          );
          assertPermission(membership, command, 'expense.create');
          const oldOperation = await repositories.operationReceiptRepository.getByOperationId(
            command.accountScope,
            command.operationId,
          );
          if (oldOperation) {
            if (!receiptMatches(
              oldOperation,
              command,
              'expense_record',
              'expense',
              command.expenseId,
            )) throw storageError('idempotency_mismatch');
            const expense = await repositories.expenseRepository.get(
              command.accountScope,
              command.workspaceId,
              command.expenseId,
            );
            if (!expense) throw storageError('data_invalid');
            return Object.freeze({
              status: 'duplicate-safe',
              expense,
              operationReceipt: oldOperation,
            });
          }
          const session = await repositories.cashSessionRepository.get(
            command.accountScope,
            command.workspaceId,
            command.cashSessionId,
          );
          if (!session) throw storageError('cash_session_required');
          if (session.status !== 'open') throw storageError('cash_session_closed');
          if (session.version !== command.expectedVersion) throw storageError('version_conflict');
          if (command.createdAtLocal < session.openedAtLocal) throw storageError('data_invalid');
          const expense = await repositories.expenseRepository.append(
            command.accountScope,
            command.workspaceId,
            {
              schemaVersion: 1,
              expenseId: command.expenseId,
              workspaceId: command.workspaceId,
              cashSessionId: command.cashSessionId,
              category: command.category,
              amountMinor: command.amountMinor,
              note: command.note,
              status: 'recorded',
              operationId: command.operationId,
              actorScope: command.actorScope,
              actorRole: command.actorRole,
              recordedAtLocal: command.createdAtLocal,
            },
          );
          const cashSession = await repositories.cashSessionRepository.update(
            command.accountScope,
            command.workspaceId,
            {
              ...session,
              version: session.version + 1,
              updatedAtLocal: command.createdAtLocal,
            },
            command.expectedVersion,
          );
          const records = await appendAuditAndReceipt(repositories, command, {
            action: 'expense_recorded',
            entityType: 'expense',
            entityId: command.expenseId,
            operationType: 'expense_record',
          });
          return Object.freeze({
            status: 'committed',
            expense,
            cashSession,
            ...records,
          });
        },
      );
    } catch (error) {
      if (error instanceof MandiriStorageError) throw error;
      throw mapStorageError(error, 'transaction_aborted');
    }
  }

  async function close(input) {
    const command = await prepare(input, normalizeCloseCashSessionCommand);
    try {
      return await repositoryContext.run(
        ATOMIC_CASH_STORE_NAMES,
        'readwrite',
        async (repositories) => {
          const membership = await repositories.membershipRepository.getByUserScope(
            command.accountScope,
            command.workspaceId,
            command.actorScope,
          );
          assertPermission(membership, command, 'cash_session.close');
          const oldOperation = await repositories.operationReceiptRepository.getByOperationId(
            command.accountScope,
            command.operationId,
          );
          if (oldOperation) {
            if (!receiptMatches(
              oldOperation,
              command,
              'cash_session_close',
              'cash_session',
              command.cashSessionId,
            )) throw storageError('idempotency_mismatch');
            const cashSession = await repositories.cashSessionRepository.get(
              command.accountScope,
              command.workspaceId,
              command.cashSessionId,
            );
            if (!cashSession || cashSession.status !== 'closed') throw storageError('data_invalid');
            return Object.freeze({
              status: 'duplicate-safe',
              cashSession,
              operationReceipt: oldOperation,
            });
          }
          const session = await repositories.cashSessionRepository.get(
            command.accountScope,
            command.workspaceId,
            command.cashSessionId,
          );
          if (!session) throw storageError('record_not_found');
          if (session.status !== 'open') throw storageError('cash_session_closed');
          if (session.version !== command.expectedVersion) throw storageError('version_conflict');
          if (command.createdAtLocal < session.updatedAtLocal) throw storageError('data_invalid');
          const expenses = await repositories.expenseRepository.listByCashSession(
            command.accountScope,
            command.workspaceId,
            command.cashSessionId,
          );
          let expenseOutMinor;
          let cashSalesMinor;
          let closingSummary;
          try {
            expenseOutMinor = expenses.reduce(
              (total, expense) => addMoney(total, expense.amountMinor),
              0,
            );
            cashSalesMinor = await repositories.saleRepository.sumCashSalesBetween(
              command.accountScope,
              command.workspaceId,
              session.openedAtLocal,
              command.createdAtLocal,
            );
            closingSummary = createClosingSummary({
              openingCashMinor: session.openingCashMinor,
              cashSalesMinor,
              expenseOutMinor,
              countedCashMinor: command.countedCashMinor,
            });
          } catch (error) {
            throw validationError(error);
          }
          const cashSession = await repositories.cashSessionRepository.update(
            command.accountScope,
            command.workspaceId,
            {
              ...session,
              version: session.version + 1,
              status: 'closed',
              closedByScope: command.actorScope,
              closedByRole: command.actorRole,
              closeOperationId: command.operationId,
              closedAtLocal: command.createdAtLocal,
              closingSummary,
              updatedAtLocal: command.createdAtLocal,
            },
            command.expectedVersion,
          );
          const records = await appendAuditAndReceipt(repositories, command, {
            action: 'cash_session_closed',
            entityType: 'cash_session',
            entityId: command.cashSessionId,
            operationType: 'cash_session_close',
          });
          return Object.freeze({
            status: 'committed',
            cashSession,
            expenses,
            ...records,
          });
        },
      );
    } catch (error) {
      if (error instanceof MandiriStorageError) throw error;
      throw mapStorageError(error, 'transaction_aborted');
    }
  }

  return Object.freeze({ open, recordExpense, close });
}
