import { createLearningCatalogLoader } from '../data/catalog-loader.js';
import { learningContentError } from '../data/content-loader-errors.js';
import { createLearningPackageLoader } from '../data/package-loader.js';
import { resolveLearningCatalogUrl } from '../data/safe-content-path.js';
import { createLessonReaderService } from '../services/lesson-reader-service.js';
import { renderLearningActivity } from './activity-renderer.js';
import { renderLearningExercise } from './exercise-renderer.js';
import {
  createLearningPageController,
  getBuildLearningFeatureContract,
} from './learning-shell.js';
import { renderLessonBlocks } from './lesson-block-renderer.js';
import { createLessonHref, parseLessonRoute } from './learning-routing.js';
import { createQuizSession, submitQuizAnswer } from '../engine/quiz-session.js';
import { createLearningRuntime } from '../services/learning-runtime.js';

function textElement(documentRef, tagName, value, className) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function createLessonNavigation(documentRef, navigation) {
  const nav = documentRef.createElement('nav');
  nav.className = 'vn-learning-lesson-navigation';
  nav.setAttribute('aria-label', 'Navigasi pelajaran');
  const catalog = textElement(documentRef, 'a', 'Kembali ke daftar pelajaran');
  catalog.href = './';
  nav.append(catalog);
  if (navigation.previousLessonId) {
    const previous = textElement(documentRef, 'a', 'Pelajaran sebelumnya');
    previous.href = createLessonHref(navigation.previousLessonId);
    nav.append(previous);
  }
  if (navigation.nextLessonId) {
    const next = textElement(documentRef, 'a', 'Pelajaran berikutnya');
    next.href = createLessonHref(navigation.nextLessonId);
    nav.append(next);
  }
  return nav;
}

function renderQuiz(documentRef, viewModel, { evaluateExercise, completeQuiz, loadProgress }) {
  if (!viewModel.quiz) return null;
  const section = documentRef.createElement('section');
  section.className = 'vn-learning-quiz';
  section.append(
    textElement(documentRef, 'h2', 'Kuis akhir modul'),
    textElement(documentRef, 'p', 'Selesaikan semua soal, lalu simpan hasil di perangkat ini.'),
  );
  const progress = textElement(documentRef, 'p', 'Memuat progres lokal…', 'vn-learning-progress');
  progress.setAttribute('role', 'status');
  section.append(progress);
  void loadProgress(viewModel).then((value) => {
    progress.textContent = value
      ? `Skor terbaik ${Math.round(value.bestScoreBasisPoints / 100)}% dari ${value.attemptCount} percobaan.`
      : 'Belum ada percobaan tersimpan untuk pelajaran ini.';
  }).catch(() => { progress.textContent = 'Progres lokal belum dapat dibaca.'; });

  const controllers = viewModel.quiz.exercises.map((exercise) => {
    const controller = renderLearningExercise(documentRef, exercise, { evaluateExercise });
    section.append(controller.element);
    return controller;
  });
  const save = textElement(documentRef, 'button', 'Simpan hasil kuis', 'vn-learning-primary-button');
  save.type = 'button';
  const feedback = textElement(documentRef, 'p', '', 'vn-learning-feedback');
  feedback.setAttribute('role', 'status');
  section.append(save, feedback);
  const startedAtLocal = new Date().toISOString();
  let saving = false;
  const onSave = async () => {
    if (saving) return;
    const states = controllers.map((controller) => controller.getSession());
    if (states.some((state) => !state.lastEvaluation || state.status === 'invalid')) {
      feedback.textContent = 'Periksa satu jawaban valid untuk setiap soal sebelum menyimpan.';
      return;
    }
    let quizSession = createQuizSession({
      quizId: viewModel.quiz.quizId,
      exerciseIds: viewModel.quiz.exercises.map((exercise) => exercise.exerciseId),
    });
    states.forEach((state) => {
      quizSession = submitQuizAnswer(quizSession, {
        exerciseId: state.exerciseId,
        answer: state.answer,
        correct: state.lastEvaluation.correct,
      });
    });
    saving = true;
    save.disabled = true;
    try {
      const result = await completeQuiz({ viewModel, quizSession, startedAtLocal });
      progress.textContent = `Skor terbaik ${Math.round(result.progress.bestScoreBasisPoints / 100)}% dari ${result.progress.attemptCount} percobaan.`;
      feedback.textContent = `Hasil ${Math.round(quizSession.scoreBasisPoints / 100)}% tersimpan di perangkat ini.`;
    } catch {
      feedback.textContent = 'Hasil belum dapat disimpan. Coba lagi tanpa menutup halaman.';
      save.disabled = false;
    } finally {
      saving = false;
    }
  };
  save.addEventListener('click', onSave);
  return Object.freeze({
    element: section,
    destroy() {
      save.removeEventListener('click', onSave);
      controllers.forEach((controller) => controller.destroy());
    },
  });
}

export function renderLessonReader(
  documentRef,
  viewModel,
  { evaluateExercise, completeQuiz, loadProgress } = {},
) {
  const fragment = documentRef.createDocumentFragment();
  const breadcrumb = documentRef.createElement('nav');
  breadcrumb.className = 'vn-learning-breadcrumb';
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');
  const breadcrumbList = documentRef.createElement('ol');
  [viewModel.program.title, viewModel.course.title, viewModel.module.title].forEach((title) => {
    breadcrumbList.append(textElement(documentRef, 'li', title));
  });
  const current = textElement(documentRef, 'li', viewModel.lesson.title);
  current.setAttribute('aria-current', 'page');
  breadcrumbList.append(current);
  breadcrumb.append(breadcrumbList);

  const header = documentRef.createElement('header');
  header.className = 'vn-learning-lesson-header';
  header.append(
    textElement(documentRef, 'p', 'Pelajaran NusaBelajar', 'vn-learning-kicker'),
    textElement(documentRef, 'h2', viewModel.lesson.title),
    textElement(documentRef, 'p', viewModel.lesson.summary, 'vn-learning-summary'),
    textElement(
      documentRef,
      'p',
      `Tujuan: ${viewModel.lesson.learningObjective}`,
      'vn-learning-objective',
    ),
    textElement(
      documentRef,
      'p',
      `Perkiraan waktu: ${viewModel.lesson.estimatedMinutes} menit`,
      'vn-learning-muted',
    ),
  );

  const article = documentRef.createElement('article');
  article.className = 'vn-learning-lesson-body';
  article.append(renderLessonBlocks(documentRef, viewModel.lesson.blocks));

  const controllers = [];
  const activities = documentRef.createElement('div');
  activities.className = 'vn-learning-activity-list';
  viewModel.lesson.activities.forEach((activity) => {
    const controller = renderLearningActivity(documentRef, activity);
    controllers.push(controller);
    activities.append(controller.element);
  });

  const exercises = documentRef.createElement('section');
  exercises.className = 'vn-learning-exercise-list';
  exercises.append(textElement(documentRef, 'h2', 'Latihan pada halaman ini'));
  viewModel.lesson.exercises.forEach((exercise) => {
    const controller = renderLearningExercise(documentRef, exercise, { evaluateExercise });
    controllers.push(controller);
    exercises.append(controller.element);
  });
  const quiz = renderQuiz(documentRef, viewModel, { evaluateExercise, completeQuiz, loadProgress });
  if (quiz) controllers.push(quiz);

  fragment.append(
    breadcrumb,
    header,
    article,
    activities,
    exercises,
    ...(quiz ? [quiz.element] : []),
    textElement(documentRef, 'p', viewModel.localOnlyNotice, 'vn-learning-memory-notice'),
    createLessonNavigation(documentRef, viewModel.navigation),
  );
  return Object.freeze({
    fragment,
    destroy() { controllers.forEach((controller) => controller.destroy()); },
  });
}

export function createLessonPageView(documentRef) {
  const root = documentRef.querySelector('[data-learning-page]');
  const unavailable = documentRef.querySelector('[data-learning-unavailable]');
  const shell = documentRef.querySelector('[data-learning-shell]');
  const status = documentRef.querySelector('[data-learning-status]');
  const content = documentRef.querySelector('[data-learning-lesson-content]');
  const retry = documentRef.querySelector('[data-learning-retry]');
  if (!root || !unavailable || !shell || !status || !content || !retry) {
    throw new Error('Markup halaman lesson NusaBelajar tidak lengkap.');
  }
  let retryHandler = null;
  let evaluateExercise = null;
  let completeQuiz = null;
  let loadProgress = null;
  let rendered = null;
  const onRetry = () => retryHandler?.();

  return Object.freeze({
    bind({ onRetry: handler }) {
      retryHandler = handler;
      retry.addEventListener('click', onRetry);
    },
    configure({ evaluator, quizCompleter, progressLoader }) {
      evaluateExercise = evaluator;
      completeQuiz = quizCompleter;
      loadProgress = progressLoader;
    },
    render(model) {
      rendered?.destroy();
      rendered = null;
      content.replaceChildren();
      root.dataset.learningState = model.state;
      root.setAttribute('aria-busy', String(model.busy));
      unavailable.hidden = model.state !== 'disabled';
      shell.hidden = model.state === 'disabled';
      status.textContent = model.message;
      retry.hidden = !model.retryable;
      if (model.state === 'ready' && model.data && evaluateExercise) {
        rendered = renderLessonReader(documentRef, model.data, {
          evaluateExercise, completeQuiz, loadProgress,
        });
        content.append(rendered.fragment);
      }
    },
    destroy() {
      retry.removeEventListener('click', onRetry);
      rendered?.destroy();
      rendered = null;
      retryHandler = null;
      evaluateExercise = null;
      completeQuiz = null;
      loadProgress = null;
      content.replaceChildren();
    },
  });
}

export function createDefaultLessonReaderService({ windowRef, fetchImpl } = {}) {
  const catalogUrl = resolveLearningCatalogUrl(windowRef.location.href);
  const catalogLoader = createLearningCatalogLoader({ fetchImpl, catalogUrl });
  const packageLoader = createLearningPackageLoader({ fetchImpl });
  return createLessonReaderService({ catalogLoader, packageLoader });
}

export function createLessonPageController({
  contract,
  view,
  search,
  serviceFactory,
} = {}) {
  let service = null;
  let runtime = null;
  const controller = createLearningPageController({
    contract,
    view,
    async load({ force }) {
      const route = parseLessonRoute(search);
      if (!route.ok) throw learningContentError('lesson_not_found');
      service ||= serviceFactory();
      runtime ||= createLearningRuntime();
      view.configure?.({
        evaluator: (exerciseId, answer, options) => (
          service.evaluateExercise(exerciseId, answer, options)
        ),
        quizCompleter: (input) => runtime.completeQuiz(input),
        progressLoader: (viewModel) => runtime.getProgress(viewModel),
      });
      return { state: 'ready', data: await service.getLessonView(route.lessonId, { force }) };
    },
  });
  return Object.freeze({
    getState: controller.getState,
    retry: controller.retry,
    whenSettled: controller.whenSettled,
    destroy() {
      controller.destroy();
      service?.destroy?.();
      void runtime?.close?.();
      service = null;
      runtime = null;
    },
  });
}

export function initLearningLessonPage({
  documentRef = document,
  windowRef = documentRef.defaultView || window,
  contract = getBuildLearningFeatureContract(),
  fetchImpl = windowRef.fetch?.bind(windowRef),
  serviceFactory = () => createDefaultLessonReaderService({ windowRef, fetchImpl }),
} = {}) {
  return createLessonPageController({
    contract,
    view: createLessonPageView(documentRef),
    search: windowRef.location.search,
    serviceFactory,
  });
}

if (typeof document !== 'undefined') {
  initLearningLessonPage();
}
