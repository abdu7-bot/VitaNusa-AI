export const MANDIRI_DATABASE_NAME = 'vitanusa-mandiri';
export const MANDIRI_DATABASE_VERSION = 1;

export const MANDIRI_STORE_NAMES = Object.freeze({
  METADATA: 'metadata',
  WORKSPACES: 'workspaces',
  MEMBERSHIPS: 'memberships',
  AUDIT_EVENTS: 'auditEvents',
  OPERATION_RECEIPTS: 'operationReceipts',
});

function index(keyPath, options = {}) {
  return Object.freeze({
    keyPath: Object.freeze(Array.isArray(keyPath) ? [...keyPath] : keyPath),
    unique: options.unique === true,
    multiEntry: false,
  });
}

function store(keyPath, indexes = {}) {
  return Object.freeze({
    keyPath: Object.freeze(Array.isArray(keyPath) ? [...keyPath] : keyPath),
    indexes: Object.freeze(indexes),
  });
}

export const MANDIRI_SCHEMA_V1 = Object.freeze({
  [MANDIRI_STORE_NAMES.METADATA]: store('key'),
  [MANDIRI_STORE_NAMES.WORKSPACES]: store(['accountScope', 'workspaceId'], {
    byAccountStatus: index(['accountScope', 'status']),
    byAccountUpdatedAt: index(['accountScope', 'updatedAtLocal']),
  }),
  [MANDIRI_STORE_NAMES.MEMBERSHIPS]: store(
    ['accountScope', 'workspaceId', 'membershipId'],
    {
      byWorkspace: index(['accountScope', 'workspaceId']),
      byWorkspaceStatus: index(['accountScope', 'workspaceId', 'status']),
      byUserScope: index(['accountScope', 'userScope']),
      byWorkspaceUser: index(['accountScope', 'workspaceId', 'userScope'], { unique: true }),
    },
  ),
  [MANDIRI_STORE_NAMES.AUDIT_EVENTS]: store(['accountScope', 'workspaceId', 'eventId'], {
    byWorkspaceCreatedAt: index(['accountScope', 'workspaceId', 'createdAtLocal']),
    byOperation: index(['accountScope', 'operationId']),
    byEntity: index(['accountScope', 'workspaceId', 'entityType', 'entityId']),
  }),
  [MANDIRI_STORE_NAMES.OPERATION_RECEIPTS]: store(['accountScope', 'operationId'], {
    byWorkspaceCreatedAt: index(['accountScope', 'workspaceId', 'createdAtLocal']),
    byEntity: index(['accountScope', 'workspaceId', 'entityType', 'entityId']),
  }),
});

export const MANDIRI_ALLOWED_STORE_NAMES = Object.freeze(Object.keys(MANDIRI_SCHEMA_V1));

export const MANDIRI_FUTURE_STORE_NAMES = Object.freeze([
  'products',
  'sales',
  'saleLines',
  'payments',
  'expenses',
  'stockMovements',
  'cashSessions',
  'learningProgress',
  'syncOutbox',
  'syncConflicts',
]);

export function isMandiriStoreName(value) {
  return typeof value === 'string' && MANDIRI_ALLOWED_STORE_NAMES.includes(value);
}
