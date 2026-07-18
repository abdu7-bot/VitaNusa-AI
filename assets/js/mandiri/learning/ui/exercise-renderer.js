import {
  createExerciseSession,
  resetExerciseSession,
  submitExerciseSession,
  updateExerciseSessionAnswer,
} from '../engine/exercise-session.js';
import { learningContentError } from '../data/content-loader-errors.js';
import { getLearningFeedbackMessage } from './feedback-messages.js';

function textElement(documentRef, tagName, value, className) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

export function createInitialSequenceOrder(exercise) {
  return Object.freeze(exercise.choices.map((choice) => choice.choiceId));
}

export function moveSequenceItem(order, index, direction) {
  if (!Array.isArray(order) || !Number.isInteger(index) || ![-1, 1].includes(direction)) {
    return Object.freeze([...(Array.isArray(order) ? order : [])]);
  }
  const target = index + direction;
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) {
    return Object.freeze([...order]);
  }
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return Object.freeze(next);
}

function appendChoiceInputs(documentRef, fieldset, exercise, multiple) {
  const inputs = [];
  exercise.choices.forEach((choice) => {
    const label = documentRef.createElement('label');
    label.className = 'vn-learning-choice';
    const input = documentRef.createElement('input');
    input.type = multiple ? 'checkbox' : 'radio';
    input.name = `answer-${exercise.exerciseId}`;
    input.value = choice.choiceId;
    label.append(input, textElement(documentRef, 'span', choice.label));
    fieldset.append(label);
    inputs.push(input);
  });
  return () => {
    const selected = inputs.filter((input) => input.checked).map((input) => input.value);
    return multiple ? selected : (selected[0] || '');
  };
}

function appendTextInput(documentRef, fieldset, exercise, numeric) {
  const label = textElement(
    documentRef,
    'label',
    numeric ? 'Jawaban dalam angka' : 'Jawaban singkat',
  );
  const input = documentRef.createElement('input');
  input.type = 'text';
  input.name = `answer-${exercise.exerciseId}`;
  input.autocomplete = 'off';
  if (numeric) {
    input.inputMode = 'numeric';
    input.maxLength = 16;
  } else {
    input.maxLength = 120;
  }
  label.append(input);
  fieldset.append(label);
  if (numeric) {
    fieldset.append(textElement(
      documentRef,
      'p',
      'Masukkan angka tanpa tanda Rp dan tanpa titik.',
      'vn-learning-muted',
    ));
  }
  return () => input.value;
}

function appendSequenceInput(documentRef, fieldset, exercise) {
  const choices = new Map(exercise.choices.map((choice) => [choice.choiceId, choice]));
  const initialOrder = createInitialSequenceOrder(exercise);
  let order = initialOrder;
  const list = documentRef.createElement('ol');
  list.className = 'vn-learning-sequence';
  const announcement = textElement(documentRef, 'p', '', 'vn-learning-visually-hidden');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');

  const renderRows = () => {
    const rows = order.map((choiceId, index) => {
      const row = documentRef.createElement('li');
      row.append(textElement(documentRef, 'span', choices.get(choiceId)?.label || ''));
      const actions = documentRef.createElement('span');
      actions.className = 'vn-learning-sequence-actions';
      const up = textElement(documentRef, 'button', 'Naik');
      up.type = 'button';
      up.disabled = index === 0;
      up.setAttribute('aria-label', `Naikkan ${choices.get(choiceId)?.label || 'item'}`);
      up.addEventListener('click', () => {
        order = moveSequenceItem(order, index, -1);
        announcement.textContent = `${choices.get(choiceId)?.label || 'Item'} dipindahkan naik.`;
        renderRows();
      });
      const down = textElement(documentRef, 'button', 'Turun');
      down.type = 'button';
      down.disabled = index === order.length - 1;
      down.setAttribute('aria-label', `Turunkan ${choices.get(choiceId)?.label || 'item'}`);
      down.addEventListener('click', () => {
        order = moveSequenceItem(order, index, 1);
        announcement.textContent = `${choices.get(choiceId)?.label || 'Item'} dipindahkan turun.`;
        renderRows();
      });
      actions.append(up, down);
      row.append(actions);
      return row;
    });
    list.replaceChildren(...rows);
  };
  renderRows();
  fieldset.append(list, announcement);
  return Object.freeze({
    read: () => [...order],
    reset() {
      order = initialOrder;
      announcement.textContent = 'Urutan dikembalikan ke posisi awal.';
      renderRows();
    },
  });
}

function createAnswerReader(documentRef, fieldset, exercise) {
  if (exercise.type === 'single_choice') {
    return { read: appendChoiceInputs(documentRef, fieldset, exercise, false) };
  }
  if (exercise.type === 'multiple_choice') {
    return { read: appendChoiceInputs(documentRef, fieldset, exercise, true) };
  }
  if (exercise.type === 'numeric_input') {
    return { read: appendTextInput(documentRef, fieldset, exercise, true) };
  }
  if (exercise.type === 'short_text_exact') {
    return { read: appendTextInput(documentRef, fieldset, exercise, false) };
  }
  if (exercise.type === 'sequence') {
    return appendSequenceInput(documentRef, fieldset, exercise);
  }
  throw learningContentError('unsupported_exercise');
}

export function renderLearningExercise(documentRef, exercise, { evaluateExercise } = {}) {
  if (!documentRef?.createElement || typeof evaluateExercise !== 'function') {
    throw learningContentError('unsupported_exercise');
  }
  const section = documentRef.createElement('section');
  section.className = 'vn-learning-exercise';
  section.dataset.exerciseId = exercise.exerciseId;
  const form = documentRef.createElement('form');
  form.noValidate = true;
  const fieldset = documentRef.createElement('fieldset');
  const legend = textElement(documentRef, 'legend', exercise.prompt);
  fieldset.append(legend);
  const answerReader = createAnswerReader(documentRef, fieldset, exercise);
  const submit = textElement(documentRef, 'button', 'Periksa jawaban', 'vn-learning-primary-button');
  submit.type = 'submit';
  fieldset.append(submit);
  form.append(fieldset);

  const feedback = textElement(documentRef, 'p', '', 'vn-learning-feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.tabIndex = -1;
  const explanation = textElement(documentRef, 'p', '', 'vn-learning-explanation');
  explanation.hidden = true;
  const attempts = textElement(documentRef, 'p', '', 'vn-learning-muted');
  const reset = textElement(documentRef, 'button', 'Ulangi latihan ini');
  reset.type = 'button';
  reset.hidden = true;
  section.append(form, feedback, explanation, attempts, reset);

  let session = createExerciseSession({
    exerciseId: exercise.exerciseId,
    maxAttempts: exercise.maxAttempts,
  });
  let submitting = false;

  const renderSession = () => {
    feedback.textContent = session.feedbackCode
      ? getLearningFeedbackMessage(session.feedbackCode)
      : '';
    explanation.textContent = session.explanation || '';
    explanation.hidden = !session.explanation || session.status === 'invalid';
    attempts.textContent = session.attemptsRemaining === null
      ? `${session.submissionCount} jawaban diperiksa pada sesi ini.`
      : `${session.attemptsRemaining} kesempatan tersisa pada sesi ini.`;
    const terminal = ['correct', 'limit_reached'].includes(session.status);
    fieldset.disabled = terminal || submitting;
    reset.hidden = !terminal;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting || ['correct', 'limit_reached'].includes(session.status)) return;
    const answer = answerReader.read();
    session = updateExerciseSessionAnswer(session, answer);
    submitting = true;
    renderSession();
    try {
      const evaluation = await evaluateExercise(exercise.exerciseId, answer, {
        submissionCount: session.submissionCount,
      });
      session = submitExerciseSession(session, evaluation);
    } catch {
      session = submitExerciseSession(session, {
        correct: false,
        feedbackCode: 'invalid_answer',
        explanation: null,
        submissionCount: session.submissionCount,
        attemptsRemaining: session.attemptsRemaining,
      });
    } finally {
      submitting = false;
      renderSession();
      feedback.focus?.();
    }
  };
  const onReset = () => {
    session = resetExerciseSession(session);
    form.reset?.();
    answerReader.reset?.();
    renderSession();
  };
  form.addEventListener('submit', onSubmit);
  reset.addEventListener('click', onReset);
  renderSession();

  return Object.freeze({
    element: section,
    getSession: () => session,
    destroy() {
      form.removeEventListener('submit', onSubmit);
      reset.removeEventListener('click', onReset);
    },
  });
}
