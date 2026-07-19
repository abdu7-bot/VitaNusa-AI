import { canonicalizePayload } from '../../domain/ids.js';
import { ATOMIC_LEARNING_STORE_NAMES } from '../../repositories/repository-context.js';
import { storageError } from '../../storage/storage-errors.js';
import { normalizeAttempt } from '../domain/attempt.js';
import { normalizeSafeInteger } from '../domain/learning-validation.js';
import { normalizeProgress } from '../domain/progress.js';

function createNextProgress(attempt, current, passingThresholdBasisPoints) {
  const bestScoreBasisPoints = Math.max(
    current?.bestScoreBasisPoints ?? 0,
    attempt.scoreBasisPoints,
  );
  return normalizeProgress({
    schemaVersion: 1,
    learnerScope: attempt.learnerScope,
    courseId: attempt.courseId,
    moduleId: attempt.moduleId,
    lessonId: attempt.lessonId,
    contentVersion: attempt.contentVersion,
    state: bestScoreBasisPoints >= passingThresholdBasisPoints
      ? 'mastered_this_practice'
      : 'needs_practice',
    bestScoreBasisPoints,
    lastAttemptId: attempt.attemptId,
    attemptCount: (current?.attemptCount ?? 0) + 1,
    lastPracticedAtLocal: attempt.completedAtLocal,
  });
}

export function createLearningProgressService({ repositoryContext } = {}) {
  if (!repositoryContext || typeof repositoryContext.run !== 'function') {
    throw storageError('data_invalid');
  }

  async function completeAttempt({ attempt: attemptValue, passingThresholdBasisPoints } = {}) {
    const attempt = normalizeAttempt(attemptValue);
    if (attempt.status !== 'completed') throw storageError('data_invalid');
    const threshold = normalizeSafeInteger(passingThresholdBasisPoints, {
      path: 'passingThresholdBasisPoints', min: 0, max: 10000,
    });

    return repositoryContext.run(
      ATOMIC_LEARNING_STORE_NAMES,
      'readwrite',
      async ({ learningAttemptRepository, learningProgressRepository }) => {
        const priorOperation = await learningAttemptRepository.getByOperationId(
          attempt.learnerScope,
          attempt.operationId,
        );
        if (priorOperation) {
          if (canonicalizePayload(priorOperation) !== canonicalizePayload(attempt)) {
            throw storageError('constraint_violation');
          }
          const progress = await learningProgressRepository.get(attempt.learnerScope, attempt);
          if (!progress) throw storageError('data_invalid');
          return Object.freeze({ attempt: priorOperation, progress, duplicate: true });
        }

        const priorAttempt = await learningAttemptRepository.getById(
          attempt.learnerScope,
          attempt.attemptId,
        );
        if (priorAttempt) throw storageError('constraint_violation');
        const current = await learningProgressRepository.get(attempt.learnerScope, attempt);
        const progress = createNextProgress(attempt, current, threshold);
        await learningAttemptRepository.addCompleted(attempt.learnerScope, attempt);
        await learningProgressRepository.put(attempt.learnerScope, progress);
        return Object.freeze({ attempt, progress, duplicate: false });
      },
    );
  }

  async function getLessonProgress({ learnerScope, courseId, moduleId, lessonId } = {}) {
    return repositoryContext.run(
      [ATOMIC_LEARNING_STORE_NAMES[1]],
      'readonly',
      ({ learningProgressRepository }) => learningProgressRepository.get(
        learnerScope,
        { courseId, moduleId, lessonId },
      ),
    );
  }

  return Object.freeze({ completeAttempt, getLessonProgress });
}
