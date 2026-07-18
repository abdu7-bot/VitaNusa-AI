import {
  getMandiriFeatureState,
} from '../../config/feature-flags.js';
import {
  getNusaBelajarFeatureContract,
  getNusaBelajarFeatureState,
} from '../config/learning-flags.js';
import {
  NusaBelajarContentError,
  getLearningContentErrorMessage,
} from '../data/content-loader-errors.js';

export const LEARNING_PAGE_STATES = Object.freeze([
  'disabled',
  'loading',
  'ready',
  'empty',
  'not_found',
  'error',
]);

export function getBuildLearningFeatureContract({
  mandiriState = getMandiriFeatureState(),
  learningState = getNusaBelajarFeatureState(),
} = {}) {
  return getNusaBelajarFeatureContract({ mandiriState, learningState });
}

export function createLearningPageModel(stateValue, options = {}) {
  const state = LEARNING_PAGE_STATES.includes(stateValue) ? stateValue : 'error';
  const messages = {
    disabled: 'NusaBelajar belum tersedia pada build ini.',
    loading: 'Memuat materi pembelajaran yang telah dipublikasikan.',
    ready: 'Materi siap dibaca pada halaman ini.',
    empty: 'Belum ada materi published yang tersedia.',
    not_found: 'Pelajaran yang diminta tidak ditemukan.',
    error: 'Materi belum dapat dibuka. Coba lagi.',
  };
  return Object.freeze({
    state,
    message: typeof options.message === 'string' ? options.message : messages[state],
    busy: state === 'loading',
    retryable: state === 'error',
    data: options.data || null,
  });
}

export function createLearningPageController({ contract, view, load } = {}) {
  if (!view || typeof view.render !== 'function' || typeof load !== 'function') {
    throw new TypeError('Learning page controller membutuhkan view dan loader.');
  }
  let destroyed = false;
  let generation = 0;
  let state = createLearningPageModel(contract?.enabled ? 'loading' : 'disabled');
  let activePromise = null;

  const render = (model) => {
    state = model;
    view.render(model);
    return model;
  };

  async function run({ force = false } = {}) {
    if (destroyed || !contract?.enabled) return state;
    if (activePromise && !force) return activePromise;
    const current = ++generation;
    render(createLearningPageModel('loading'));
    const operation = Promise.resolve()
      .then(() => load({ force }))
      .then((result) => {
        if (destroyed || current !== generation) return state;
        const nextState = result?.state || 'ready';
        return render(createLearningPageModel(nextState, {
          data: result?.data ?? result,
          message: result?.message,
        }));
      })
      .catch((error) => {
        if (destroyed || current !== generation) return state;
        const safeCode = error instanceof NusaBelajarContentError
          ? error.code
          : 'unknown_error';
        return render(createLearningPageModel(
          safeCode === 'lesson_not_found' ? 'not_found' : 'error',
          { message: getLearningContentErrorMessage(safeCode) },
        ));
      })
      .finally(() => {
        if (activePromise === operation) activePromise = null;
      });
    activePromise = operation;
    return operation;
  }

  function retry() {
    return run({ force: true });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation += 1;
    activePromise = null;
    view.destroy?.();
  }

  render(state);
  if (contract?.enabled) {
    view.bind?.({ onRetry: () => { void retry(); } });
    void run();
  }
  return Object.freeze({
    destroy,
    getState: () => state,
    retry,
    whenSettled: () => activePromise || Promise.resolve(state),
  });
}
