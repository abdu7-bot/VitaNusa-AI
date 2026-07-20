export const MANDIRI_DATABASE_NAME = 'vitanusa-mandiri';
export const MANDIRI_DATABASE_VERSION = 4;

export const MANDIRI_STORE_NAMES = Object.freeze({
  METADATA: 'metadata',
  WORKSPACES: 'workspaces',
  MEMBERSHIPS: 'memberships',
  AUDIT_EVENTS: 'auditEvents',
  OPERATION_RECEIPTS: 'operationReceipts',
  LEARNING_ATTEMPTS: 'learningAttempts',
  LEARNING_PROGRESS: 'learningProgress',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  STOCK_MOVEMENTS: 'stockMovements',
  INVENTORY_BALANCES: 'inventoryBalances',
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

export const MANDIRI_SCHEMA_V2 = Object.freeze({
  ...MANDIRI_SCHEMA_V1,
  [MANDIRI_STORE_NAMES.LEARNING_ATTEMPTS]: store(['learnerScope', 'attemptId'], {
    byLearnerCompletedAt: index(['learnerScope', 'completedAtLocal']),
    byLearnerQuiz: index(['learnerScope', 'quizId']),
    byLearnerLesson: index(['learnerScope', 'lessonId']),
    byLearnerOperation: index(['learnerScope', 'operationId'], { unique: true }),
  }),
  [MANDIRI_STORE_NAMES.LEARNING_PROGRESS]: store([
    'learnerScope',
    'courseId',
    'moduleId',
    'lessonId',
  ], {
    byLearnerCourse: index(['learnerScope', 'courseId']),
    byLearnerModule: index(['learnerScope', 'moduleId']),
    byLearnerPracticedAt: index(['learnerScope', 'lastPracticedAtLocal']),
  }),
});

export const MANDIRI_SCHEMA_V3 = Object.freeze({
  ...MANDIRI_SCHEMA_V2,
  [MANDIRI_STORE_NAMES.CATEGORIES]: store(
    ['accountScope', 'workspaceId', 'categoryId'],
    {
      byWorkspace: index(['accountScope', 'workspaceId']),
      byWorkspaceActive: index(['accountScope', 'workspaceId', 'active']),
    },
  ),
  [MANDIRI_STORE_NAMES.PRODUCTS]: store(
    ['accountScope', 'workspaceId', 'productId'],
    {
      byWorkspace: index(['accountScope', 'workspaceId']),
      byWorkspaceActive: index(['accountScope', 'workspaceId', 'active']),
      byWorkspaceSku: index(['accountScope', 'workspaceId', 'sku'], { unique: true }),
      byWorkspaceCategory: index(['accountScope', 'workspaceId', 'categoryId']),
    },
  ),
});

export const MANDIRI_SCHEMA_V4 = Object.freeze({
  ...MANDIRI_SCHEMA_V3,
  [MANDIRI_STORE_NAMES.STOCK_MOVEMENTS]: store(
    ['accountScope', 'workspaceId', 'movementId'],
    {
      byWorkspaceCreatedAt: index(['accountScope', 'workspaceId', 'createdAtLocal']),
      byProductCreatedAt: index(['accountScope', 'workspaceId', 'productId', 'createdAtLocal']),
      byWorkspaceOperation: index(['accountScope', 'workspaceId', 'operationId'], { unique: true }),
    },
  ),
  [MANDIRI_STORE_NAMES.INVENTORY_BALANCES]: store(
    ['accountScope', 'workspaceId', 'productId'],
    {
      byWorkspace: index(['accountScope', 'workspaceId']),
    },
  ),
});

export const MANDIRI_ALLOWED_STORE_NAMES = Object.freeze(Object.keys(MANDIRI_SCHEMA_V4));

export const MANDIRI_FUTURE_STORE_NAMES = Object.freeze([
  'sales',
  'saleLines',
  'payments',
  'expenses',
  'cashSessions',
  'syncOutbox',
  'syncConflicts',
]);

export function isMandiriStoreName(value) {
  return typeof value === 'string' && MANDIRI_ALLOWED_STORE_NAMES.includes(value);
}
