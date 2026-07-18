import { createLearningCatalogLoader } from '../data/catalog-loader.js';
import { createLearningPackageLoader } from '../data/package-loader.js';
import { resolveLearningCatalogUrl } from '../data/safe-content-path.js';
import { createLearningCatalogService } from '../services/learning-catalog-service.js';
import {
  createLearningPageController,
  getBuildLearningFeatureContract,
} from './learning-shell.js';
import { createLessonHref } from './learning-routing.js';

function textElement(documentRef, tagName, value, className) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

export function renderCatalogHierarchy(documentRef, model) {
  const fragment = documentRef.createDocumentFragment();
  model.packages.forEach((learningPackage) => {
    learningPackage.programs.forEach((program) => {
      const programSection = documentRef.createElement('section');
      programSection.className = 'vn-learning-program';
      programSection.append(
        textElement(documentRef, 'p', learningPackage.title, 'vn-learning-kicker'),
        textElement(documentRef, 'h2', program.title),
        textElement(documentRef, 'p', program.summary, 'vn-learning-summary'),
      );
      program.courses.forEach((course) => {
        const courseSection = documentRef.createElement('section');
        courseSection.className = 'vn-learning-course';
        courseSection.append(
          textElement(documentRef, 'h3', course.title),
          textElement(documentRef, 'p', course.summary),
        );
        course.modules.forEach((module) => {
          const moduleSection = documentRef.createElement('section');
          moduleSection.className = 'vn-learning-module';
          moduleSection.append(
            textElement(documentRef, 'h4', module.title),
            textElement(documentRef, 'p', module.summary),
          );
          const lessonList = documentRef.createElement('ol');
          lessonList.className = 'vn-learning-lesson-list';
          module.lessons.forEach((lesson) => {
            const item = documentRef.createElement('li');
            const card = documentRef.createElement('article');
            card.className = 'vn-learning-lesson-card';
            const link = textElement(documentRef, 'a', 'Buka pelajaran', 'vn-learning-button');
            link.href = createLessonHref(lesson.lessonId);
            card.append(
              textElement(documentRef, 'h5', lesson.title),
              textElement(documentRef, 'p', lesson.summary),
              textElement(
                documentRef,
                'p',
                `Perkiraan waktu: ${lesson.estimatedMinutes} menit`,
                'vn-learning-muted',
              ),
              link,
            );
            item.append(card);
            lessonList.append(item);
          });
          moduleSection.append(lessonList);
          courseSection.append(moduleSection);
        });
        programSection.append(courseSection);
      });
      fragment.append(programSection);
    });
  });
  return fragment;
}

export function createCatalogPageView(documentRef) {
  const root = documentRef.querySelector('[data-learning-page]');
  const unavailable = documentRef.querySelector('[data-learning-unavailable]');
  const shell = documentRef.querySelector('[data-learning-shell]');
  const status = documentRef.querySelector('[data-learning-status]');
  const content = documentRef.querySelector('[data-learning-catalog-content]');
  const retry = documentRef.querySelector('[data-learning-retry]');
  if (!root || !unavailable || !shell || !status || !content || !retry) {
    throw new Error('Markup halaman katalog NusaBelajar tidak lengkap.');
  }

  let retryHandler = null;
  const onRetry = () => retryHandler?.();

  return Object.freeze({
    bind({ onRetry: handler }) {
      retryHandler = handler;
      retry.addEventListener('click', onRetry);
    },
    render(model) {
      root.dataset.learningState = model.state;
      root.setAttribute('aria-busy', String(model.busy));
      unavailable.hidden = model.state !== 'disabled';
      shell.hidden = model.state === 'disabled';
      status.textContent = model.message;
      retry.hidden = !model.retryable;
      content.replaceChildren();
      if (model.state === 'ready' && model.data) {
        content.append(renderCatalogHierarchy(documentRef, model.data));
      }
    },
    destroy() {
      retry.removeEventListener('click', onRetry);
      retryHandler = null;
      content.replaceChildren();
    },
  });
}

export function createDefaultLearningCatalogService({ windowRef, fetchImpl } = {}) {
  const catalogUrl = resolveLearningCatalogUrl(windowRef.location.href);
  const catalogLoader = createLearningCatalogLoader({ fetchImpl, catalogUrl });
  const packageLoader = createLearningPackageLoader({ fetchImpl });
  return createLearningCatalogService({ catalogLoader, packageLoader });
}

export function createCatalogPageController({
  contract,
  view,
  serviceFactory,
} = {}) {
  let service = null;
  const controller = createLearningPageController({
    contract,
    view,
    async load({ force }) {
      service ||= serviceFactory();
      const data = await service.getCatalogView({ force });
      return { state: data.packages.length > 0 ? 'ready' : 'empty', data };
    },
  });
  return Object.freeze({
    destroy: controller.destroy,
    getState: controller.getState,
    retry: controller.retry,
    whenSettled: controller.whenSettled,
  });
}

export function initLearningCatalogPage({
  documentRef = document,
  windowRef = documentRef.defaultView || window,
  contract = getBuildLearningFeatureContract(),
  fetchImpl = windowRef.fetch?.bind(windowRef),
  serviceFactory = () => createDefaultLearningCatalogService({ windowRef, fetchImpl }),
} = {}) {
  return createCatalogPageController({
    contract,
    view: createCatalogPageView(documentRef),
    serviceFactory,
  });
}

if (typeof document !== 'undefined') {
  initLearningCatalogPage();
}
