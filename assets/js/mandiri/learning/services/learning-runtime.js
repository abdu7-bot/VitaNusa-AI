import { createEntityId, createOperationId } from '../../domain/ids.js';
import { createRepositoryContext } from '../../repositories/repository-context.js';
import { openMandiriDatabase } from '../../storage/database.js';
import { createAttempt } from '../domain/attempt.js';
import { createLearningProgressService } from './learning-progress-service.js';

const GUEST_SCOPE_KEY = 'vitanusa.mandiri.learning.guestScope.v1';

export function getOrCreateGuestLearnerScope({ storage, cryptoRef = globalThis.crypto } = {}) {
  const existing = storage?.getItem?.(GUEST_SCOPE_KEY);
  if (typeof existing === 'string' && /^guest:[a-z0-9_-]{3,128}$/i.test(existing)) return existing;
  const generated = `guest:${cryptoRef.randomUUID().replaceAll('-', '')}`;
  storage?.setItem?.(GUEST_SCOPE_KEY, generated);
  return generated;
}

export function createLearningRuntime({
  indexedDBFactory = globalThis.indexedDB,
  keyRangeFactory = globalThis.IDBKeyRange,
  storage = globalThis.localStorage,
  cryptoRef = globalThis.crypto,
  now = () => new Date().toISOString(),
} = {}) {
  let connectionPromise = null;
  const learnerScope = getOrCreateGuestLearnerScope({ storage, cryptoRef });
  const service = async () => {
    connectionPromise ||= openMandiriDatabase({ indexedDBFactory, keyRangeFactory });
    const connection = await connectionPromise;
    return createLearningProgressService({ repositoryContext: createRepositoryContext(connection) });
  };

  return Object.freeze({
    learnerScope,
    async completeQuiz({ viewModel, quizSession, startedAtLocal }) {
      const progressService = await service();
      const completedAtLocal = now();
      const attempt = createAttempt({
        schemaVersion: 1,
        attemptId: createEntityId('attempt', cryptoRef),
        learnerScope,
        courseId: viewModel.course.courseId,
        moduleId: viewModel.module.moduleId,
        lessonId: viewModel.lesson.lessonId,
        quizId: viewModel.quiz.quizId,
        contentVersion: viewModel.package.contentVersion,
        answers: quizSession.answers,
        scoreBasisPoints: quizSession.scoreBasisPoints,
        correctCount: quizSession.correctCount,
        questionCount: quizSession.questionCount,
        status: 'completed',
        startedAtLocal,
        completedAtLocal,
        operationId: createOperationId(cryptoRef),
      });
      return progressService.completeAttempt({
        attempt,
        passingThresholdBasisPoints: viewModel.quiz.passingThresholdBasisPoints,
      });
    },
    async getProgress(viewModel) {
      const progressService = await service();
      return progressService.getLessonProgress({
        learnerScope,
        courseId: viewModel.course.courseId,
        moduleId: viewModel.module.moduleId,
        lessonId: viewModel.lesson.lessonId,
      });
    },
    async close() {
      const connection = await connectionPromise;
      connection?.close();
      connectionPromise = null;
    },
  });
}
