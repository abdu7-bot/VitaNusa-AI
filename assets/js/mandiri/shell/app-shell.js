import {
  getMandiriFeatureContract,
  getMandiriFeatureState,
  MANDIRI_FEATURE_STATES,
} from '../config/feature-flags.js';
import { initMandiriOfflineStatus } from './offline-status.js';

const MANDIRI_APP_CONTROLLERS = new WeakMap();
const MANDIRI_MOBILE_SIDEBAR_QUERY = '(max-width: 1180px)';

export const MANDIRI_MODULE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  PLANNED: 'planned',
});

export const MANDIRI_MODULES = Object.freeze([
  Object.freeze({
    id: 'tanya-nusa',
    name: 'Tanya Nusa',
    description: 'Asisten utama untuk percakapan, langkah kerja, edukasi, dan refleksi berbasis konteks.',
    status: MANDIRI_MODULE_STATUSES.ACTIVE,
    href: '../index.html',
  }),
  Object.freeze({
    id: 'nusakasir',
    name: 'NusaKasir',
    description: 'Rencana pencatatan usaha. Transaksi dan kasir aktif belum tersedia.',
    status: MANDIRI_MODULE_STATUSES.PLANNED,
  }),
  Object.freeze({
    id: 'nusabelajar',
    name: 'NusaBelajar',
    description: 'Rencana pembelajaran singkat dan terarah pada fase terpisah.',
    status: MANDIRI_MODULE_STATUSES.PLANNED,
  }),
  Object.freeze({
    id: 'vitasheet',
    name: 'VitaSheet',
    description: 'Rencana laporan dan ekspor terstruktur yang belum tersedia pada Fase 1.',
    status: MANDIRI_MODULE_STATUSES.PLANNED,
  }),
]);

export const MANDIRI_PLANNED_MODULES = Object.freeze([
  Object.freeze({ name: 'NusaBelajar', state: 'direncanakan' }),
  Object.freeze({ name: 'NusaKasir', state: 'direncanakan' }),
  Object.freeze({ name: 'VitaSheet', state: 'direncanakan' }),
]);

export function createMandiriShellModel(value) {
  const contract = getMandiriFeatureContract(value);

  if (contract.state === MANDIRI_FEATURE_STATES.OFF) {
    return Object.freeze({
      state: contract.state,
      view: 'unavailable',
      title: 'VitaNusa Mandiri belum tersedia',
      activeFeatures: false,
      activeModuleCount: 0,
      startsStorage: contract.startsStorage,
      modules: Object.freeze([]),
    });
  }

  return Object.freeze({
    state: contract.state,
    view: 'internal-shell',
    title: 'VitaNusa Mandiri',
    modeLabel: 'Mode fondasi lokal',
    activeFeatures: false,
    activeModuleCount: MANDIRI_MODULES.filter(
      (module) => module.status === MANDIRI_MODULE_STATUSES.ACTIVE,
    ).length,
    startsStorage: contract.startsStorage,
    modules: MANDIRI_MODULES,
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

  return model;
}

function getSidebarFocusableElements(sidebar) {
  if (!sidebar || typeof sidebar.querySelectorAll !== 'function') return [];
  return [...sidebar.querySelectorAll('a[href], button:not([disabled])')]
    .filter((element) => element.hidden !== true);
}

export function initMandiriDashboardNavigation({
  documentRef = document,
  windowRef = documentRef.defaultView || window,
} = {}) {
  const root = documentRef.querySelector?.('[data-mandiri-root]');
  const sidebar = documentRef.querySelector?.('[data-mandiri-sidebar]');
  const toggle = documentRef.querySelector?.('[data-mandiri-sidebar-toggle]');
  const closeButton = documentRef.querySelector?.('[data-mandiri-sidebar-close]');
  const overlay = documentRef.querySelector?.('[data-mandiri-sidebar-overlay]');

  if (!root || !sidebar || !toggle || !closeButton || !overlay) return null;

  const mediaQuery = typeof windowRef.matchMedia === 'function'
    ? windowRef.matchMedia(MANDIRI_MOBILE_SIDEBAR_QUERY)
    : { matches: false };
  const listeners = [];
  let open = false;

  const addListener = (target, type, listener) => {
    target?.addEventListener?.(type, listener);
    listeners.push([target, type, listener]);
  };

  const sync = ({ focusTarget = null } = {}) => {
    const mobile = mediaQuery.matches === true;
    const visible = mobile && open;

    root.dataset.sidebarOpen = String(visible);
    toggle.setAttribute('aria-expanded', String(visible));
    sidebar.setAttribute('aria-hidden', String(mobile && !visible));
    overlay.hidden = !visible;
    overlay.setAttribute('aria-hidden', String(!visible));
    documentRef.body?.classList?.toggle('vn-mandiri-sidebar-open', visible);

    if ('inert' in sidebar) sidebar.inert = mobile && !visible;
    focusTarget?.focus?.({ preventScroll: true });
    return visible;
  };

  const setOpen = (value, { returnFocus = false } = {}) => {
    open = mediaQuery.matches === true && value === true;
    return sync({ focusTarget: open ? closeButton : (returnFocus ? toggle : null) });
  };

  const handleToggle = () => setOpen(!open);
  const handleClose = () => setOpen(false, { returnFocus: true });
  const handleMediaChange = () => {
    open = false;
    sync();
  };
  const handleKeydown = (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault?.();
      handleClose();
      return;
    }

    if (event.key !== 'Tab' || !open || mediaQuery.matches !== true) return;
    const focusable = getSidebarFocusableElements(sidebar);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = documentRef.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault?.();
      last.focus?.();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault?.();
      first.focus?.();
    }
  };

  addListener(toggle, 'click', handleToggle);
  addListener(closeButton, 'click', handleClose);
  addListener(overlay, 'click', handleClose);
  addListener(documentRef, 'keydown', handleKeydown);
  addListener(mediaQuery, 'change', handleMediaChange);

  const navigationLinks = sidebar.querySelectorAll?.('a[href]') || [];
  [...navigationLinks].forEach((link) => addListener(link, 'click', () => {
    if (mediaQuery.matches === true) setOpen(false, { returnFocus: true });
  }));

  sync();

  return Object.freeze({
    open() {
      return setOpen(true);
    },
    close() {
      return setOpen(false, { returnFocus: true });
    },
    isOpen() {
      return open;
    },
    destroy() {
      listeners.splice(0).forEach(([target, type, listener]) => {
        target?.removeEventListener?.(type, listener);
      });
      open = false;
      sync();
    },
  });
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
  initializeSharedShell = initializeSharedVitaNusaShell,
  initializeStatus = initMandiriOfflineStatus,
  initializeWorkspacePanel = initializeLocalWorkspacePanel,
  initializeDashboardNavigation = initMandiriDashboardNavigation,
} = {}) {
  const model = createMandiriShellModel(featureState);
  applyMandiriShellModel(documentRef, model);

  if (model.view === 'unavailable') {
    return Object.freeze({
      model,
      statusController: null,
      workspaceController: null,
      dashboardNavigationController: null,
      destroy() {},
    });
  }

  const statusController = initializeStatus({ documentRef, windowRef });
  const dashboardNavigationController = initializeDashboardNavigation({ documentRef, windowRef });
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
    dashboardNavigationController?.destroy?.();
    statusController?.destroy?.();
    throw sharedShellOutcome.status === 'rejected'
      ? sharedShellOutcome.reason
      : workspaceOutcome.reason;
  }

  return Object.freeze({
    model,
    statusController,
    workspaceController,
    dashboardNavigationController,
    destroy() {
      workspaceController?.destroy?.();
      dashboardNavigationController?.destroy?.();
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
