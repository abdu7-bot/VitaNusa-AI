import { normalizeAuditEvent } from '../domain/audit.js';
import {
  createEntityId,
  createOperationId,
  createPayloadDigest,
  isValidEntityId,
} from '../domain/ids.js';
import { normalizeMembership } from '../domain/membership.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from '../domain/validation.js';
import { normalizeWorkspace } from '../domain/workspace.js';
import { normalizeOperationReceipt } from '../repositories/operation-receipt-repository.js';
import { ATOMIC_WORKSPACE_STORE_NAMES } from '../repositories/repository-context.js';
import { MANDIRI_STORE_NAMES } from '../storage/schema.js';
import {
  MandiriWorkspaceError,
  mapWorkspaceError,
  workspaceError,
} from './workspace-errors.js';

const DEFAULT_TIMEZONE = 'Asia/Jakarta';
const DEFAULT_CURRENCY_CODE = 'IDR';
const SCOPE_PATTERN = /^(account|user):([0-9a-f]{64})$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const COMMAND_FIELDS = Object.freeze([
  'schemaVersion',
  'accountScope',
  'userScope',
  'workspaceId',
  'membershipId',
  'eventId',
  'operationId',
  'name',
  'timezone',
  'currencyCode',
  'createdAtLocal',
]);
const PREPARE_FIELDS = Object.freeze([
  'accountScope',
  'userScope',
  'name',
  'timezone',
  'currencyCode',
]);

function normalizeRelatedScopes(accountScopeValue, userScopeValue) {
  const accountScope = normalizeScope(accountScopeValue, 'command.accountScope');
  const userScope = normalizeScope(userScopeValue, 'command.userScope');
  const accountMatch = accountScope.match(SCOPE_PATTERN);
  const userMatch = userScope.match(SCOPE_PATTERN);
  if (
    !accountMatch
    || !userMatch
    || accountMatch[1] !== 'account'
    || userMatch[1] !== 'user'
    || accountMatch[2] !== userMatch[2]
  ) {
    throw new MandiriDomainError(
      'scope_mismatch',
      'accountScope dan userScope tidak berasal dari identitas lokal yang sama',
      'command',
    );
  }
  return Object.freeze({ accountScope, userScope });
}

function assertId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID command tidak valid', path);
  }
  return value;
}

export function normalizeCreateWorkspaceCommand(input) {
  assertExactFields(input, COMMAND_FIELDS, {
    requiredFields: COMMAND_FIELDS,
    path: 'createWorkspaceCommand',
  });
  const scopes = normalizeRelatedScopes(input.accountScope, input.userScope);
  const createdAtLocal = normalizeIsoTimestamp(
    input.createdAtLocal,
    'createWorkspaceCommand.createdAtLocal',
  );

  const workspace = normalizeWorkspace({
    schemaVersion: 1,
    version: 1,
    workspaceId: input.workspaceId,
    accountScope: scopes.accountScope,
    name: input.name,
    timezone: input.timezone,
    currencyCode: input.currencyCode,
    status: 'active',
    createdAtLocal,
    updatedAtLocal: createdAtLocal,
  });

  const schemaVersion = normalizePositiveVersion(
    input.schemaVersion,
    'createWorkspaceCommand.schemaVersion',
  );
  if (schemaVersion !== 1) {
    throw new MandiriDomainError(
      'unsupported_command_version',
      'versi command belum didukung',
      'createWorkspaceCommand.schemaVersion',
    );
  }

  return Object.freeze({
    schemaVersion,
    accountScope: scopes.accountScope,
    userScope: scopes.userScope,
    workspaceId: workspace.workspaceId,
    membershipId: assertId(input.membershipId, 'membership', 'createWorkspaceCommand.membershipId'),
    eventId: assertId(input.eventId, 'audit', 'createWorkspaceCommand.eventId'),
    operationId: assertId(input.operationId, 'op', 'createWorkspaceCommand.operationId'),
    name: workspace.name,
    timezone: workspace.timezone,
    currencyCode: workspace.currencyCode,
    createdAtLocal,
  });
}

function createDigestPayload(command) {
  return Object.freeze({
    schemaVersion: command.schemaVersion,
    accountScope: command.accountScope,
    userScope: command.userScope,
    workspaceId: command.workspaceId,
    membershipId: command.membershipId,
    eventId: command.eventId,
    name: command.name,
    timezone: command.timezone,
    currencyCode: command.currencyCode,
    createdAtLocal: command.createdAtLocal,
  });
}

function buildRecords(command, payloadDigest) {
  const workspace = normalizeWorkspace({
    schemaVersion: 1,
    version: 1,
    workspaceId: command.workspaceId,
    accountScope: command.accountScope,
    name: command.name,
    timezone: command.timezone,
    currencyCode: command.currencyCode,
    status: 'active',
    createdAtLocal: command.createdAtLocal,
    updatedAtLocal: command.createdAtLocal,
  });
  const membership = normalizeMembership({
    schemaVersion: 1,
    version: 1,
    membershipId: command.membershipId,
    accountScope: command.accountScope,
    workspaceId: command.workspaceId,
    userScope: command.userScope,
    role: 'merchant_owner',
    status: 'active',
    createdAtLocal: command.createdAtLocal,
    updatedAtLocal: command.createdAtLocal,
  }, {
    accountScope: command.accountScope,
    workspaceId: command.workspaceId,
  });
  const auditEvent = normalizeAuditEvent({
    schemaVersion: 1,
    eventId: command.eventId,
    accountScope: command.accountScope,
    workspaceId: command.workspaceId,
    actorScope: command.userScope,
    actorRole: 'merchant_owner',
    action: 'workspace_created',
    entityType: 'workspace',
    entityId: command.workspaceId,
    operationId: command.operationId,
    result: 'success',
    reasonCode: 'none',
    createdAtLocal: command.createdAtLocal,
  });
  const operationReceipt = normalizeOperationReceipt({
    schemaVersion: 1,
    accountScope: command.accountScope,
    workspaceId: command.workspaceId,
    operationId: command.operationId,
    operationType: 'workspace_create',
    payloadDigest,
    entityType: 'workspace',
    entityId: command.workspaceId,
    result: 'committed',
    createdAtLocal: command.createdAtLocal,
  });
  return Object.freeze({ workspace, membership, auditEvent, operationReceipt });
}

function result(status, records) {
  return Object.freeze({ ...records, status });
}

function workspaceMatchesCommand(workspace, command) {
  return (
    workspace.workspaceId === command.workspaceId
    && workspace.accountScope === command.accountScope
    && workspace.name === command.name
    && workspace.timezone === command.timezone
    && workspace.currencyCode === command.currencyCode
    && workspace.createdAtLocal === command.createdAtLocal
  );
}

async function readDuplicateOutcome(repositories, command, receipt, payloadDigest) {
  if (receipt.payloadDigest !== payloadDigest) {
    return Object.freeze({ kind: 'error', code: 'idempotency_mismatch' });
  }
  if (
    receipt.result !== 'committed'
    || receipt.workspaceId !== command.workspaceId
    || receipt.entityType !== 'workspace'
    || receipt.entityId !== command.workspaceId
    || receipt.operationType !== 'workspace_create'
  ) {
    return Object.freeze({ kind: 'error', code: 'integrity_error' });
  }

  const [workspace, membership, auditEvents] = await Promise.all([
    repositories.workspaceRepository.getById(command.accountScope, command.workspaceId),
    repositories.membershipRepository.getByUserScope(
      command.accountScope,
      command.workspaceId,
      command.userScope,
    ),
    repositories.auditRepository.listByOperation(command.accountScope, command.operationId),
  ]);
  const auditEvent = auditEvents.find((event) => event.eventId === command.eventId);
  if (
    !workspace
    || !workspaceMatchesCommand(workspace, command)
    || !membership
    || membership.membershipId !== command.membershipId
    || membership.role !== 'merchant_owner'
    || membership.status !== 'active'
    || !auditEvent
    || auditEvent.action !== 'workspace_created'
    || auditEvent.entityId !== command.workspaceId
    || auditEvent.result !== 'success'
  ) {
    return Object.freeze({ kind: 'error', code: 'integrity_error' });
  }

  return Object.freeze({
    kind: 'result',
    value: result('duplicate-safe', {
      workspace,
      membership,
      auditEvent,
      operationReceipt: receipt,
    }),
  });
}

export function createWorkspaceService({
  repositoryContext,
  idFactory = createEntityId,
  operationIdFactory = createOperationId,
  payloadDigest = createPayloadDigest,
  now = () => new Date().toISOString(),
} = {}) {
  if (
    !repositoryContext
    || typeof repositoryContext.run !== 'function'
    || typeof idFactory !== 'function'
    || typeof operationIdFactory !== 'function'
    || typeof payloadDigest !== 'function'
    || typeof now !== 'function'
  ) {
    throw workspaceError('unknown_error');
  }

  const inFlight = new Map();

  function prepareCreateWorkspaceCommand(input) {
    try {
      assertExactFields(input, PREPARE_FIELDS, {
        requiredFields: ['accountScope', 'userScope', 'name'],
        path: 'workspaceInput',
      });
      const createdAtLocal = now();
      return normalizeCreateWorkspaceCommand({
        schemaVersion: 1,
        accountScope: input.accountScope,
        userScope: input.userScope,
        workspaceId: idFactory('workspace'),
        membershipId: idFactory('membership'),
        eventId: idFactory('audit'),
        operationId: operationIdFactory(),
        name: input.name,
        timezone: Object.hasOwn(input, 'timezone') ? input.timezone : DEFAULT_TIMEZONE,
        currencyCode: Object.hasOwn(input, 'currencyCode')
          ? input.currencyCode
          : DEFAULT_CURRENCY_CODE,
        createdAtLocal,
      });
    } catch (error) {
      throw mapWorkspaceError(error, 'invalid_workspace_input');
    }
  }

  async function createWorkspace(commandInput) {
    let command;
    let digest;
    try {
      command = normalizeCreateWorkspaceCommand(commandInput);
      digest = await payloadDigest(createDigestPayload(command));
      if (typeof digest !== 'string' || !DIGEST_PATTERN.test(digest)) {
        throw new MandiriDomainError('invalid_payload_digest', 'payload digest tidak valid');
      }
    } catch (error) {
      throw mapWorkspaceError(error, 'invalid_workspace_input');
    }

    const operationKey = `${command.accountScope}:${command.operationId}`;
    const existingOperation = inFlight.get(operationKey);
    if (existingOperation) {
      if (existingOperation.digest !== digest) throw workspaceError('idempotency_mismatch');
      return existingOperation.promise.then((value) => (
        value.status === 'created' ? result('duplicate-safe', value) : value
      ));
    }

    const records = buildRecords(command, digest);
    const operationPromise = (async () => repositoryContext.run(
      ATOMIC_WORKSPACE_STORE_NAMES,
      'readwrite',
      async (repositories) => {
        const receipt = await repositories.operationReceiptRepository.getByOperationId(
          command.accountScope,
          command.operationId,
        );
        if (receipt) {
          return readDuplicateOutcome(repositories, command, receipt, digest);
        }

        const existingWorkspaces = await repositories.workspaceRepository.listByAccount(
          command.accountScope,
        );
        if (existingWorkspaces.length > 0) {
          return Object.freeze({ kind: 'error', code: 'workspace_already_exists' });
        }

        const workspace = await repositories.workspaceRepository.add(
          command.accountScope,
          records.workspace,
        );
        const membership = await repositories.membershipRepository.add(
          command.accountScope,
          command.workspaceId,
          records.membership,
        );
        const auditEvent = await repositories.auditRepository.append(
          command.accountScope,
          command.workspaceId,
          records.auditEvent,
        );
        const operationReceipt = await repositories.operationReceiptRepository.append(
          command.accountScope,
          records.operationReceipt,
        );
        return Object.freeze({
          kind: 'result',
          value: result('created', { workspace, membership, auditEvent, operationReceipt }),
        });
      },
    ))()
      .then((outcome) => {
        if (outcome?.kind === 'error') throw workspaceError(outcome.code);
        if (outcome?.kind !== 'result') throw workspaceError('integrity_error');
        return outcome.value;
      })
      .catch((error) => {
        throw mapWorkspaceError(error, 'storage_error');
      });

    inFlight.set(operationKey, Object.freeze({ digest, promise: operationPromise }));
    try {
      return await operationPromise;
    } finally {
      if (inFlight.get(operationKey)?.promise === operationPromise) inFlight.delete(operationKey);
    }
  }

  async function listLocalWorkspaces(accountScopeValue) {
    let accountScope;
    try {
      accountScope = normalizeRelatedScopes(
        accountScopeValue,
        `user:${String(accountScopeValue).split(':')[1] ?? ''}`,
      ).accountScope;
    } catch (error) {
      throw mapWorkspaceError(error, 'scope_mismatch');
    }
    try {
      const workspaces = await repositoryContext.run(
        [MANDIRI_STORE_NAMES.WORKSPACES],
        'readonly',
        (repositories) => repositories.workspaceRepository.listByAccount(accountScope),
      );
      return Object.freeze([...workspaces]);
    } catch (error) {
      throw mapWorkspaceError(error, 'storage_error');
    }
  }

  async function getWorkspaceState(accountScopeValue, userScopeValue) {
    let scopes;
    try {
      scopes = normalizeRelatedScopes(accountScopeValue, userScopeValue);
    } catch (error) {
      throw mapWorkspaceError(error, 'scope_mismatch');
    }

    try {
      return await repositoryContext.run(
        [MANDIRI_STORE_NAMES.WORKSPACES, MANDIRI_STORE_NAMES.MEMBERSHIPS],
        'readonly',
        async (repositories) => {
          const workspaces = await repositories.workspaceRepository.listByAccount(
            scopes.accountScope,
          );
          if (workspaces.length === 0) {
            return Object.freeze({ status: 'empty', workspace: null, membership: null });
          }
          if (workspaces.length !== 1) throw workspaceError('integrity_error');

          const workspace = workspaces[0];
          const membership = await repositories.membershipRepository.getByUserScope(
            scopes.accountScope,
            workspace.workspaceId,
            scopes.userScope,
          );
          if (
            !membership
            || membership.role !== 'merchant_owner'
            || membership.status !== 'active'
          ) {
            throw workspaceError('integrity_error');
          }
          return Object.freeze({ status: 'ready', workspace, membership });
        },
      );
    } catch (error) {
      if (error instanceof MandiriWorkspaceError) throw error;
      throw mapWorkspaceError(error, 'storage_error');
    }
  }

  return Object.freeze({
    prepareCreateWorkspaceCommand,
    createWorkspace,
    getWorkspaceState,
    listLocalWorkspaces,
  });
}
