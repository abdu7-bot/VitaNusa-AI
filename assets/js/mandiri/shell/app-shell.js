import {
  getMandiriFeatureContract,
  getMandiriFeatureState,
  MANDIRI_FEATURE_STATES,
} from '../config/feature-flags.js';
import {
  getNusaBelajarFeatureContract,
  getNusaBelajarFeatureState,
} from '../learning/config/learning-flags.js';
import { initMandiriOfflineStatus } from './offline-status.js';

const MANDIRI_APP_CONTROLLERS = new WeakMap();

export const MANDIRI_PLANNED_MODULES = Object.freeze([
  Object.freeze({ name: 'NusaBelajar', state: 'direncanakan' }),
  Object.freeze({ name: 'NusaKasir', state: 'direncanakan' }),
  Object.freeze({ name: 'VitaSheet', state: 'direncanakan' }),
]);

export function createMandiriModuleModels({ mandiriState, learningState } = {}) {
  const learningContract = getNusaBelajarFeatureContract({ mandiriState, learningState });
  return Object.freeze(MANDIRI_PLANNED_MODULES.map((module) => {
    if (module.name !== 'NusaBelajar' || !learningContract.enabled) return module;
    return Object.freeze({
      name: module.name,
      state: 'internal',
      statusLabel: 'Internal',
      description: 'Baca tiga pelajaran published dan coba latihan deterministik tanpa penyimpanan progress.',
      note: 'Lesson reader internal tersedia. Jawaban latihan belum disimpan.',
      href: './belajar/',
      actionLabel: 'Buka NusaBelajar',
    });
  }));
}

export function createMandiriShellModel(
  value,
  learningValue = getNusaBelajarFeatureState(),
) {
  const contract = getMandiriFeatureContract(value);

  if (contract.state === MANDIRI_FEATURE_STATES.OFF) {
    return Object.freeze({
      state: contract.state,
      view: 'unavailable',
      title: 'VitaNusa Mandiri belum tersedia',
      activeFeatures: false,
      startsStorage: contract.startsStorage,
      modules: Object.freeze([]),
    });
  }

  const modules = createMandiriModuleModels({
    mandiriState: contract.state,
    learningState: learningValue,
  });
  return Object.freeze({
    state: contract.state,
    view: 'internal-shell',
    title: 'VitaNusa Mandiri',
    modeLabel: 'Mode fondasi lokal',
    activeFeatures: modules.some((module) => module.state === 'internal'),
    startsStorage: contract.startsStorage,
    modules,
  });
}

export function applyMandiriShellModel(documentRef, model) {
  const root = documentRef.querySelector('[data-mandiri-root]');
  const unavailableView = documentRef.querySelector('[data-mandiri-unavailable]');
  const internalView = documentRef.querySelector('[data-mandiri-shell]');
  const featureState = documentRef.querySelector('[data-mandiri-feature-state]');

  if (!root || !unavailableView || !internalView) {
    throw new Error('Mandiri shell markup is incomplete.');
  }

  root.dataset.mandiriState = model.state;
  unavailableView.hidden = model.view !== 'unavailable';
  internalView.hidden = model.view !== 'internal-shell';

  if (featureState) {
    featureState.textContent = model.state === MANDIRI_FEATURE_STATES.INTERNAL
      ? 'Internal — terbatas untuk review'
      : 'Off — belum tersedia';
  }

  const learningModule = model.modules.find((module) => module.name === 'NusaBelajar');
  const learningStatus = documentRef.querySelector('[data-mandiri-module-state="nusabelajar"]');
  const learningDescription = documentRef.querySelector('[data-mandiri-module-description="nusabelajar"]');
  const learningNote = documentRef.querySelector('[data-mandiri-module-note="nusabelajar"]');
  const learningLink = documentRef.querySelector('[data-mandiri-module-link="nusabelajar"]');
  if (learningModule && learningStatus) {
    learningStatus.textContent = learningModule.statusLabel || 'Direncanakan';
    learningStatus.dataset.moduleState = learningModule.state;
  }
  if (learningModule?.description && learningDescription) {
    learningDescription.textContent = learningModule.description;
  }
  if (learningModule && learningNote) {
    learningNote.textContent = learningModule.note || 'Segera dibangun · Belum tersedia pada Fase 1';
  }
  if (learningLink) {
    const isActive = learningModule?.state === 'internal';
    learningLink.hidden = !isActive;
    if (isActive) {
      learningLink.href = learningModule.href;
      learningLink.textContent = learningModule.actionLabel;
    } else {
      learningLink.removeAttribute?.('href');
    }
  }

  return model;
}

async function initializeSharedVitaNusaShell() {
  const module = await import('../../modules/nusa-ui-shell.js?v=20260716-mandiri-f1-shell-v1');
  return module.initNusaUiShell({ mandiriState: MANDIRI_FEATURE_STATES.INTERNAL });
}

async function initializeLocalWorkspacePanel(options) {
  const module = await import('./workspace-panel.js?v=20260717-mandiri-f1-backup-v1');
  return module.initMandiriWorkspacePanel(options);
}

export async function initializeMandiriApp({
  documentRef = document,
  windowRef = documentRef.defaultView || window,
  featureState = getMandiriFeatureState(),
  learningFeatureState = getNusaBelajarFeatureState(),
  initializeSharedShell = initializeSharedVitaNusaShell,
  initializeStatus = initMandiriOfflineStatus,
  initializeWorkspacePanel = initializeLocalWorkspacePanel,
} = {}) {
  const model = createMandiriShellModel(featureState, learningFeatureState);
  applyMandiriShellModel(documentRef, model);

  if (model.view === 'unavailable') {
    return Object.freeze({
      model,
      statusController: null,
      workspaceController: null,
      destroy() {},
    });
  }

  const statusController = initializeStatus({ documentRef, windowRef });
  const hasWorkspacePanel = Boolean(
    documentRef.querySelector('[data-mandiri-workspace-panel]'),
  );
  const [sharedShellOutcome, workspaceOutcome] = await Promise.allSettled([
    initializeSharedShell(),
    hasWorkspacePanel
      ? initializeWorkspacePanel({
        documentRef,
        featureState: MANDIRI_FEATURE_STATES.INTERNAL,
      })
      : null,
  ]);
  const workspaceController = workspaceOutcome.status === 'fulfilled'
    ? workspaceOutcome.value
    : null;
  if (sharedShellOutcome.status === 'rejected' || workspaceOutcome.status === 'rejected') {
    workspaceController?.destroy?.();
    statusController?.destroy?.();
    throw sharedShellOutcome.status === 'rejected'
      ? sharedShellOutcome.reason
      : workspaceOutcome.reason;
  }

  return Object.freeze({
    model,
    statusController,
    workspaceController,
    destroy() {
      workspaceController?.destroy?.();
      statusController?.destroy?.();
    },
  });
}

export function getOrCreateMandiriAppSingleton(registry, key, factory) {
  if (registry.has(key)) return registry.get(key);
  const controller = factory();
  registry.set(key, controller);
  return controller;
}

export function initMandiriApp(options = {}) {
  const documentRef = options.documentRef || document;

  return getOrCreateMandiriAppSingleton(
    MANDIRI_APP_CONTROLLERS,
    documentRef,
    () => initializeMandiriApp({ ...options, documentRef }).catch((error) => {
      MANDIRI_APP_CONTROLLERS.delete(documentRef);
      throw error;
    }),
  );
}

if (typeof document !== 'undefined') {
  const boot = () => {
    void initMandiriApp().catch((error) => {
      console.warn('VitaNusa Mandiri shell belum dapat diinisialisasi:', error?.message || 'shell-init-failed');
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
