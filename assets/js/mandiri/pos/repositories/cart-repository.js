import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { storageError } from '../../storage/storage-errors.js';
import {
  createRepositoryExecutor,
  keyRangeBound,
  keyRangeOnly,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeWorkspaceScope,
} from '../../repositories/repository-utils.js';
import {
  normalizeScopedCartDraft,
  normalizeScopedCartLine,
  publicCartDraft,
  publicCartLine,
} from './pos-repository-utils.js';

const DRAFTS = MANDIRI_STORE_NAMES.CART_DRAFTS;
const LINES = MANDIRI_STORE_NAMES.CART_LINES;
const STORES = Object.freeze([DRAFTS, LINES]);

function workspaceUpdatedRange(transaction, accountScope, workspaceId) {
  return keyRangeBound(
    transaction,
    [accountScope, workspaceId, ''],
    [accountScope, workspaceId, '\uffff'],
  );
}

function sortDrafts(records) {
  return records.sort((left, right) => (
    right.updatedAtLocal.localeCompare(left.updatedAtLocal)
    || left.cartId.localeCompare(right.cartId)
  ));
}

function sortLines(records) {
  return records.sort((left, right) => (
    left.cartId.localeCompare(right.cartId)
    || left.lineNo - right.lineNo
  ));
}

function composeCart(draft, lines) {
  return Object.freeze({
    ...publicCartDraft(draft),
    lines: Object.freeze(lines.map(publicCartLine)),
  });
}

async function replaceLines(transaction, accountScope, workspaceId, cartId, lines) {
  const store = transaction.objectStore(LINES);
  const index = store.index('byCart');
  const existing = await transaction.request(index.getAllKeys(
    keyRangeOnly(transaction, [accountScope, workspaceId, cartId]),
  ));
  for (const key of existing) {
    await transaction.request(store.delete(key));
  }
  for (const line of lines) {
    await transaction.request(store.add(line));
  }
}

export function createCartRepository(options) {
  const executor = createRepositoryExecutor(options);

  const repository = {
    async create(explicitAccountScope, explicitWorkspaceId, draftInput, lineInputs) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const draft = normalizeScopedCartDraft(accountScope, workspaceId, draftInput);
      const lines = lineInputs.map((lineInput) => normalizeScopedCartLine(accountScope, workspaceId, lineInput));
      return executor.run(STORES, 'readwrite', async (transaction) => {
        const draftStore = transaction.objectStore(DRAFTS);
        const existing = await transaction.request(draftStore.get([
          accountScope, workspaceId, draft.cartId,
        ]));
        if (existing !== undefined) throw storageError('constraint_violation');
        if (new Set(lines.map((line) => line.lineNo)).size !== lines.length) {
          throw storageError('data_invalid');
        }
        await transaction.request(draftStore.add(draft));
        for (const line of lines) {
          await transaction.request(transaction.objectStore(LINES).add(line));
        }
        return composeCart(draft, sortLines(lines));
      });
    },

    async update(explicitAccountScope, explicitWorkspaceId, draftInput, lineInputs, expectedVersion) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const draft = normalizeScopedCartDraft(accountScope, workspaceId, draftInput);
      const lines = lineInputs.map((lineInput) => normalizeScopedCartLine(accountScope, workspaceId, lineInput));
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw storageError('data_invalid');
      return executor.run(STORES, 'readwrite', async (transaction) => {
        const draftStore = transaction.objectStore(DRAFTS);
        const key = [accountScope, workspaceId, draft.cartId];
        const current = await transaction.request(draftStore.get(key));
        if (current === undefined) throw storageError('record_not_found');
        if (current.version !== expectedVersion || draft.version !== expectedVersion + 1) {
          throw storageError('version_conflict');
        }
        if (new Set(lines.map((line) => line.lineNo)).size !== lines.length) {
          throw storageError('data_invalid');
        }
        await transaction.request(draftStore.put(draft));
        await replaceLines(transaction, accountScope, workspaceId, draft.cartId, lines);
        return composeCart(draft, sortLines(lines));
      });
    },

    async get(explicitAccountScope, explicitWorkspaceId, cartIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const cartId = normalizeEntityIdentifier(cartIdValue, 'cart');
      return executor.run(STORES, 'readonly', async (transaction) => {
        const draft = await transaction.request(
          transaction.objectStore(DRAFTS).get([accountScope, workspaceId, cartId]),
        );
        if (draft === undefined) return null;
        const lines = await transaction.request(
          transaction.objectStore(LINES).index('byCart').getAll(
            keyRangeOnly(transaction, [accountScope, workspaceId, cartId]),
          ),
        );
        return composeCart(draft, sortLines(lines));
      });
    },

    async list(explicitAccountScope, explicitWorkspaceId) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      return executor.run([DRAFTS], 'readonly', async (transaction) => {
        const records = await transaction.request(
          transaction.objectStore(DRAFTS).index('byWorkspaceUpdatedAt').getAll(
            workspaceUpdatedRange(transaction, accountScope, workspaceId),
          ),
        );
        return Object.freeze(sortDrafts(records.map(publicCartDraft)));
      });
    },

    async listLines(explicitAccountScope, explicitWorkspaceId, cartIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const cartId = normalizeEntityIdentifier(cartIdValue, 'cart');
      return executor.run([LINES], 'readonly', async (transaction) => {
        const records = await transaction.request(
          transaction.objectStore(LINES).index('byCart').getAll(
            keyRangeOnly(transaction, [accountScope, workspaceId, cartId]),
          ),
        );
        return Object.freeze(sortLines(records.map(publicCartLine)));
      });
    },
  };
  Object.defineProperty(repository, 'listForBackup', {
    enumerable: false,
    value: async (explicitAccountScope, explicitWorkspaceId) => {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      return executor.run(STORES, 'readonly', async (transaction) => {
        const drafts = await transaction.request(
          transaction.objectStore(DRAFTS).index('byWorkspaceUpdatedAt').getAll(
            workspaceUpdatedRange(transaction, accountScope, workspaceId),
          ),
        );
        const cartLines = [];
        for (const draft of drafts) {
          const lines = await transaction.request(
            transaction.objectStore(LINES).index('byCart').getAll(
              keyRangeOnly(transaction, [accountScope, workspaceId, draft.cartId]),
            ),
          );
          cartLines.push(...lines);
        }
        return {
          cartDrafts: Object.freeze(sortDrafts(drafts.map(publicCartDraft))),
          cartLines: Object.freeze(sortLines(cartLines.map(publicCartLine))),
        };
      });
    },
  });
  return Object.freeze(repository);
}
