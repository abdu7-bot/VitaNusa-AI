import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuizSession,
  submitQuizAnswer,
} from '../../../assets/js/mandiri/learning/engine/quiz-session.js';

test('quiz session menyelesaikan urutan soal dan menghitung basis points', () => {
  let state = createQuizSession({ quizId: 'quiz-a', exerciseIds: ['exercise-a', 'exercise-b'] });
  state = submitQuizAnswer(state, { exerciseId: 'exercise-a', answer: 'choice-a', correct: true });
  state = submitQuizAnswer(state, { exerciseId: 'exercise-b', answer: 20, correct: false });
  assert.equal(state.status, 'completed');
  assert.equal(state.correctCount, 1);
  assert.equal(state.scoreBasisPoints, 5000);
  assert.equal(Object.isFrozen(state.answers), true);
});

test('quiz session menolak duplicate exercise dan jawaban di luar urutan', () => {
  assert.throws(() => createQuizSession({ quizId: 'quiz-a', exerciseIds: ['a', 'a'] }));
  const state = createQuizSession({ quizId: 'quiz-a', exerciseIds: ['exercise-a'] });
  assert.throws(() => submitQuizAnswer(state, {
    exerciseId: 'exercise-b', answer: 1, correct: true,
  }));
});
