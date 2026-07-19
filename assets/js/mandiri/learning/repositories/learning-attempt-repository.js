import { normalizeAttempt } from '../domain/attempt.js';
import { normalizeLearnerScope } from '../domain/learning-validation.js';
import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { storageError } from '../../storage/storage-errors.js';
import {
  asStorageValidationError,
  createRepositoryExecutor,
  cursorToArray,
  keyRangeBound,
  keyRangeOnly,
  normalizeEntityIdentifier,
  normalizeExportListOptions,
  normalizeWith,
} from '../../repositories/repository-utils.js';

const STORE_NAME = MANDIRI_STORE_NAMES.LEARNING_ATTEMPTS;

function scope(value) {
  try { return normalizeLearnerScope(value); } catch (error) {
    throw asStorageValidationError(error);
  }
}

function recordFor(learnerScope, value) {
  const normalized = normalizeWith(normalizeAttempt, value);
  if (normalized.learnerScope !== learnerScope) throw storageError('scope_mismatch');
  return normalized;
}

export function createLearningAttemptRepository(options) {
  const executor = createRepositoryExecutor(options);
  const repository = {
    async addCompleted(explicitScope, attempt) {
      const learnerScope = scope(explicitScope);
      const normalized = recordFor(learnerScope, attempt);
      if (normalized.status !== 'completed') throw storageError('data_invalid');
      return executor.run([STORE_NAME], 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(STORE_NAME).add(normalized));
        return recordFor(learnerScope, normalized);
      });
    },
    async getById(explicitScope, attemptIdValue) {
      const learnerScope = scope(explicitScope);
      const attemptId = normalizeEntityIdentifier(attemptIdValue, 'attempt');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const value = await transaction.request(
          transaction.objectStore(STORE_NAME).get([learnerScope, attemptId]),
        );
        return value === undefined ? null : recordFor(learnerScope, value);
      });
    },
    async getByOperationId(explicitScope, operationIdValue) {
      const learnerScope = scope(explicitScope);
      const operationId = normalizeEntityIdentifier(operationIdValue, 'op');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const value = await transaction.request(
          transaction.objectStore(STORE_NAME).index('byLearnerOperation')
            .get([learnerScope, operationId]),
        );
        return value === undefined ? null : recordFor(learnerScope, value);
      });
    },
    async listByLesson(explicitScope, lessonId) {
      const learnerScope = scope(explicitScope);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const values = await transaction.request(
          transaction.objectStore(STORE_NAME).index('byLearnerLesson')
            .getAll(keyRangeOnly(transaction, [learnerScope, lessonId])),
        );
        return values.map((value) => recordFor(learnerScope, value));
      });
    },
  };
  Object.defineProperty(repository, 'listForBackup', {
    enumerable: false,
    value: async (explicitScope, optionsValue) => {
      const learnerScope = scope(explicitScope);
      const { limit } = normalizeExportListOptions(optionsValue);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byLearnerCompletedAt');
        const values = await cursorToArray(index, keyRangeBound(
          transaction,
          [learnerScope, ''],
          [learnerScope, '\uffff'],
        ), { limit });
        return values.map((value) => recordFor(learnerScope, value));
      });
    },
  });
  return Object.freeze(repository);
}
