import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createRepositoryContext } from '../../../assets/js/mandiri/repositories/repository-context.js';
import { createLearningProgressService } from '../../../assets/js/mandiri/learning/services/learning-progress-service.js';

const learnerScope = `user:${'a'.repeat(64)}`;
const ids = {
  firstAttempt: 'attempt_11111111-1111-4111-8111-111111111111',
  secondAttempt: 'attempt_22222222-2222-4222-8222-222222222222',
  firstOperation: 'op_33333333-3333-4333-8333-333333333333',
  secondOperation: 'op_44444444-4444-4444-8444-444444444444',
};

function attempt(overrides = {}) {
  const correctCount = overrides.correctCount ?? 1;
  const questionCount = 2;
  return {
    schemaVersion: 1,
    attemptId: ids.firstAttempt,
    learnerScope,
    courseId: 'course-money-id',
    moduleId: 'module-money-id',
    lessonId: 'lesson-money-id',
    quizId: 'quiz-money-id',
    contentVersion: 1,
    answers: [
      { exerciseId: 'exercise-one-id', answer: 10 },
      { exerciseId: 'exercise-two-id', answer: 'choice-two-id' },
    ],
    scoreBasisPoints: correctCount * 5000,
    correctCount,
    questionCount,
    status: 'completed',
    startedAtLocal: '2026-07-19T00:00:00.000Z',
    completedAtLocal: '2026-07-19T00:01:00.000Z',
    operationId: ids.firstOperation,
    ...overrides,
  };
}

test('completion atomic menjaga best score, attemptCount, immutable attempt, dan duplicate operation', async () => {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(), keyRangeFactory: IDBKeyRange, databaseName: 'learning-service',
  });
  const context = createRepositoryContext(connection);
  const service = createLearningProgressService({ repositoryContext: context });
  const first = attempt();
  const created = await service.completeAttempt({ attempt: first, passingThresholdBasisPoints: 7000 });
  assert.equal(created.progress.bestScoreBasisPoints, 5000);
  assert.equal(created.progress.attemptCount, 1);
  assert.equal(created.progress.state, 'needs_practice');

  const duplicate = await service.completeAttempt({ attempt: structuredClone(first), passingThresholdBasisPoints: 7000 });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.progress.attemptCount, 1);

  const second = attempt({
    attemptId: ids.secondAttempt,
    operationId: ids.secondOperation,
    correctCount: 2,
    scoreBasisPoints: 10000,
    completedAtLocal: '2026-07-19T00:02:00.000Z',
  });
  const updated = await service.completeAttempt({ attempt: second, passingThresholdBasisPoints: 7000 });
  assert.equal(updated.progress.bestScoreBasisPoints, 10000);
  assert.equal(updated.progress.attemptCount, 2);
  assert.equal(updated.progress.state, 'mastered_this_practice');
  await assert.rejects(context.run(['learningAttempts'], 'readwrite', async ({ learningAttemptRepository }) => {
    await learningAttemptRepository.addCompleted(learnerScope, second);
  }), { code: 'constraint_violation' });
  connection.close();
});

test('learnerScope lain tidak dapat membaca attempt atau progress', async () => {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(), keyRangeFactory: IDBKeyRange, databaseName: 'learning-scope',
  });
  const context = createRepositoryContext(connection);
  const service = createLearningProgressService({ repositoryContext: context });
  await service.completeAttempt({ attempt: attempt(), passingThresholdBasisPoints: 7000 });
  const other = `user:${'b'.repeat(64)}`;
  const values = await context.run(['learningAttempts', 'learningProgress'], 'readonly', async (repositories) => ({
    attempt: await repositories.learningAttemptRepository.getById(other, ids.firstAttempt),
    progress: await repositories.learningProgressRepository.get(other, attempt()),
  }));
  assert.deepEqual(values, { attempt: null, progress: null });
  connection.close();
});

test('contentVersion baru tidak mewarisi best score atau attemptCount versi lama', async () => {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(), keyRangeFactory: IDBKeyRange, databaseName: 'learning-version',
  });
  const service = createLearningProgressService({
    repositoryContext: createRepositoryContext(connection),
  });
  await service.completeAttempt({
    attempt: attempt({ correctCount: 2, scoreBasisPoints: 10000 }),
    passingThresholdBasisPoints: 7000,
  });
  const nextVersion = attempt({
    attemptId: ids.secondAttempt,
    operationId: ids.secondOperation,
    contentVersion: 2,
    correctCount: 1,
    scoreBasisPoints: 5000,
    completedAtLocal: '2026-07-19T00:02:00.000Z',
  });
  const result = await service.completeAttempt({
    attempt: nextVersion,
    passingThresholdBasisPoints: 7000,
  });
  assert.equal(result.progress.contentVersion, 2);
  assert.equal(result.progress.bestScoreBasisPoints, 5000);
  assert.equal(result.progress.attemptCount, 1);
  connection.close();
});
