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

export function renderLessonReader(documentRef, viewModel, { evaluateExercise } = {}) {
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

  fragment.append(
    breadcrumb,
    header,
    article,
    activities,
    exercises,
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
  let rendered = null;
  const onRetry = () => retryHandler?.();

  return Object.freeze({
    bind({ onRetry: handler }) {
      retryHandler = handler;
      retry.addEventListener('click', onRetry);
    },
    configure({ evaluator }) { evaluateExercise = evaluator; },
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
        rendered = renderLessonReader(documentRef, model.data, { evaluateExercise });
        content.append(rendered.fragment);
      }
    },
    destroy() {
      retry.removeEventListener('click', onRetry);
      rendered?.destroy();
      rendered = null;
      retryHandler = null;
      evaluateExercise = null;
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
  const controller = createLearningPageController({
    contract,
    view,
    async load({ force }) {
      const route = parseLessonRoute(search);
      if (!route.ok) throw learningContentError('lesson_not_found');
      service ||= serviceFactory();
      view.configure?.({
        evaluator: (exerciseId, answer, options) => (
          service.evaluateExercise(exerciseId, answer, options)
        ),
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
      service = null;
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
