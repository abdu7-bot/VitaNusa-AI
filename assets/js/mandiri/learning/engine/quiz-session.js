import { calculateBasisPointScore, deepFreezeLearningValue } from '../domain/learning-validation.js';

function freeze(state) {
  return deepFreezeLearningValue({
    quizId: state.quizId,
    status: state.status,
    exerciseIds: [...state.exerciseIds],
    answers: state.answers.map((answer) => ({ ...answer })),
    currentIndex: state.currentIndex,
    correctCount: state.correctCount,
    questionCount: state.exerciseIds.length,
    scoreBasisPoints: state.scoreBasisPoints,
  });
}

export function createQuizSession({ quizId, exerciseIds } = {}) {
  if (typeof quizId !== 'string' || !Array.isArray(exerciseIds) || exerciseIds.length < 1) {
    throw new TypeError('Quiz session membutuhkan quizId dan exerciseIds.');
  }
  if (new Set(exerciseIds).size !== exerciseIds.length) {
    throw new TypeError('Exercise quiz tidak boleh duplicate.');
  }
  return freeze({
    quizId,
    status: 'answering',
    exerciseIds,
    answers: [],
    currentIndex: 0,
    correctCount: 0,
    scoreBasisPoints: null,
  });
}

export function submitQuizAnswer(state, { exerciseId, answer, correct } = {}) {
  if (!state || state.status !== 'answering') return state;
  const expected = state.exerciseIds[state.currentIndex];
  if (exerciseId !== expected || typeof correct !== 'boolean') {
    throw new TypeError('Jawaban quiz tidak sesuai urutan session.');
  }
  const answers = [...state.answers, { exerciseId, answer }];
  const correctCount = state.correctCount + (correct ? 1 : 0);
  const currentIndex = state.currentIndex + 1;
  const completed = currentIndex === state.exerciseIds.length;
  return freeze({
    ...state,
    status: completed ? 'completed' : 'answering',
    answers,
    currentIndex,
    correctCount,
    scoreBasisPoints: completed
      ? calculateBasisPointScore(correctCount, state.exerciseIds.length)
      : null,
  });
}
