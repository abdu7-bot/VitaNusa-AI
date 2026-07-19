import { normalizeLearnerScope } from '../domain/learning-validation.js';
import { normalizeProgress } from '../domain/progress.js';
import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { storageError } from '../../storage/storage-errors.js';
import {
  asStorageValidationError,
  createRepositoryExecutor,
  cursorToArray,
  keyRangeBound,
  normalizeExportListOptions,
  normalizeWith,
} from '../../repositories/repository-utils.js';

const STORE_NAME = MANDIRI_STORE_NAMES.LEARNING_PROGRESS;

function scope(value) {
  try { return normalizeLearnerScope(value); } catch (error) {
    throw asStorageValidationError(error);
  }
}

function recordFor(learnerScope, value) {
  const normalized = normalizeWith(normalizeProgress, value);
  if (normalized.learnerScope !== learnerScope) throw storageError('scope_mismatch');
  return normalized;
}

export function createLearningProgressRepository(options) {
  const executor = createRepositoryExecutor(options);
  const repository = {
    async get(explicitScope, { courseId, moduleId, lessonId }) {
      const learnerScope = scope(explicitScope);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const value = await transaction.request(transaction.objectStore(STORE_NAME).get([
          learnerScope, courseId, moduleId, lessonId,
        ]));
        return value === undefined ? null : recordFor(learnerScope, value);
      });
    },
    async put(explicitScope, progress) {
      const learnerScope = scope(explicitScope);
      const normalized = recordFor(learnerScope, progress);
      return executor.run([STORE_NAME], 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(STORE_NAME).put(normalized));
        return recordFor(learnerScope, normalized);
      });
    },
    async listByCourse(explicitScope, courseId) {
      const learnerScope = scope(explicitScope);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const values = await transaction.request(
          transaction.objectStore(STORE_NAME).index('byLearnerCourse')
            .getAll([learnerScope, courseId]),
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
        const index = transaction.objectStore(STORE_NAME).index('byLearnerPracticedAt');
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
