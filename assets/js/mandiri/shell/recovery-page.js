import {
  getMandiriFeatureState,
  MANDIRI_FEATURE_STATES,
  resolveMandiriFeatureState,
} from '../config/feature-flags.js';
import {
  backupError,
  MandiriBackupError,
  mapBackupError,
} from '../export/backup-errors.js';
import { readBackupFile } from '../export/restore-preview.js';
import { createAccountScopeFromUser } from '../services/account-scope.js';

export const RECOVERY_PAGE_STATES = Object.freeze([
  'feature-off',
  'auth-loading',
  'signed-out',
  'ready',
  'processing',
  'preview',
  'error',
]);

const STATE_MESSAGES = Object.freeze({
  'feature-off': 'Pemeriksaan backup belum tersedia pada build ini.',
  'auth-loading': 'Memeriksa sesi akun VitaNusa.',
  'signed-out': 'Login diperlukan sebelum file backup dapat diperiksa.',
  ready: 'Pilih satu file JSON, lalu tekan Periksa File.',
  processing: 'Memeriksa struktur, scope, dan checksum file.',
  preview: 'File valid untuk akun ini. Belum ada data yang dimasukkan ke perangkat.',
  error: 'File belum dapat diperiksa.',
});

export function createRecoveryPageModel(stateValue, options = {}) {
  const state = RECOVERY_PAGE_STATES.includes(stateValue) ? stateValue : 'error';
  return Object.freeze({
    state,
    hasFile: options.hasFile === true,
    message: state === 'error' && typeof options.message === 'string'
      ? options.message
      : STATE_MESSAGES[state],
    preview: state === 'preview' && options.preview ? options.preview : null,
  });
}

function setHidden(root, selector, hidden) {
  const element = root.querySelector(selector);
  if (element) element.hidden = hidden;
}

function setText(root, selector, value) {
  const element = root.querySelector(selector);
  if (element) element.textContent = value;
}

export function renderRecoveryPage(root, model) {
  if (!root || typeof root.querySelector !== 'function') throw backupError('backup_invalid');
  const off = model.state === 'feature-off';
  const busy = ['auth-loading', 'processing'].includes(model.state);
  const fileEnabled = ['ready', 'preview', 'error'].includes(model.state);
  root.dataset.recoveryState = model.state;
  root.setAttribute('aria-busy', String(busy));
  setHidden(root, '[data-recovery-unavailable]', !off);
  setHidden(root, '[data-recovery-shell]', off);
  setHidden(root, '[data-recovery-signed-out]', model.state !== 'signed-out');
  setHidden(root, '[data-recovery-file-panel]', !fileEnabled && model.state !== 'processing');
  setHidden(root, '[data-recovery-preview]', model.state !== 'preview');
  setHidden(root, '[data-recovery-error]', model.state !== 'error');
  setText(root, '[data-recovery-status]', model.message);

  const input = root.querySelector('[data-recovery-file]');
  const submit = root.querySelector('[data-recovery-submit]');
  if (input) input.disabled = !fileEnabled;
  if (submit) submit.disabled = !fileEnabled || !model.hasFile || busy;
  if (model.state === 'processing' && submit) submit.textContent = 'Memeriksa file...';
  else if (submit) submit.textContent = 'Periksa File';

  if (model.state === 'error') setText(root, '[data-recovery-error-message]', model.message);
  if (model.preview) {
    const fields = {
      '[data-preview-workspace-name]': model.preview.workspaceName,
      '[data-preview-timezone]': model.preview.timezone,
      '[data-preview-currency]': model.preview.currencyCode,
      '[data-preview-status]': model.preview.workspaceStatus,
      '[data-preview-memberships]': String(model.preview.membershipCount),
      '[data-preview-audit-events]': String(model.preview.auditEventCount),
      '[data-preview-operation-receipts]': String(model.preview.operationReceiptCount),
      '[data-preview-created-at]': model.preview.createdAt,
      '[data-preview-format-version]': String(model.preview.formatVersion),
      '[data-preview-schema-version]': String(model.preview.databaseSchemaVersion),
      '[data-preview-checksum-status]': model.preview.checksumStatus,
      '[data-preview-scope-status]': model.preview.scopeStatus,
    };
    for (const [selector, value] of Object.entries(fields)) setText(root, selector, value);
  }
  return model;
}

export function createDomRecoveryPageView(root) {
  if (!root || typeof root.querySelector !== 'function') throw backupError('backup_invalid');
  const loginButton = root.querySelector('[data-recovery-login]');
  const fileInput = root.querySelector('[data-recovery-file]');
  const form = root.querySelector('[data-recovery-form]');
  const listeners = [];

  return Object.freeze({
    render(model) {
      return renderRecoveryPage(root, model);
    },
    getFile() {
      return fileInput?.files?.[0] ?? null;
    },
    clearFile() {
      if (fileInput) fileInput.value = '';
    },
    bind({ onLogin, onFileSelected, onCheck }) {
      const loginHandler = () => { void onLogin(); };
      const fileHandler = () => onFileSelected(Boolean(this.getFile()));
      const submitHandler = (event) => {
        event.preventDefault();
        void onCheck(this.getFile());
      };
      loginButton?.addEventListener('click', loginHandler);
      fileInput?.addEventListener('change', fileHandler);
      form?.addEventListener('submit', submitHandler);
      listeners.push(
        [loginButton, 'click', loginHandler],
        [fileInput, 'change', fileHandler],
        [form, 'submit', submitHandler],
      );
    },
    destroy() {
      listeners.splice(0).forEach(([element, type, listener]) => {
        element?.removeEventListener(type, listener);
      });
      this.clearFile();
    },
  });
}

export function createRecoveryPageController({
  featureState,
  view,
  subscribeAuth,
  signIn,
  createScope = createAccountScopeFromUser,
  previewFile = readBackupFile,
} = {}) {
  if (!view || typeof view.render !== 'function') throw backupError('backup_invalid');
  const resolvedFeatureState = resolveMandiriFeatureState(featureState);
  if (
    resolvedFeatureState === MANDIRI_FEATURE_STATES.INTERNAL
    && (typeof subscribeAuth !== 'function' || typeof signIn !== 'function')
  ) {
    throw backupError('backup_invalid');
  }
  let model = createRecoveryPageModel(
    resolvedFeatureState === MANDIRI_FEATURE_STATES.INTERNAL ? 'auth-loading' : 'feature-off',
  );
  let destroyed = false;
  let generation = 0;
  let unsubscribe = () => {};
  let accountScope = null;
  let inFlight = null;

  const render = (next) => {
    model = next;
    view.render(model);
    return model;
  };

  async function handleAuthState(state) {
    if (destroyed) return;
    const currentGeneration = ++generation;
    accountScope = null;
    inFlight = null;
    view.clearFile?.();
    if (!state?.isAuthenticated || !state.user?.uid) {
      render(createRecoveryPageModel('signed-out'));
      return;
    }
    render(createRecoveryPageModel('auth-loading'));
    try {
      const nextScope = await createScope(state.user);
      if (destroyed || currentGeneration !== generation) return;
      accountScope = nextScope;
      render(createRecoveryPageModel('ready'));
    } catch (error) {
      if (destroyed || currentGeneration !== generation) return;
      const mapped = mapBackupError(error, 'auth_required');
      render(createRecoveryPageModel('error', { message: mapped.message }));
    }
  }

  function login() {
    if (resolvedFeatureState !== MANDIRI_FEATURE_STATES.INTERNAL) {
      return Promise.reject(backupError('feature_disabled'));
    }
    return Promise.resolve().then(() => signIn());
  }

  function fileSelected(hasFile) {
    if (!accountScope) return render(createRecoveryPageModel('signed-out'));
    view.clearPreview?.();
    return render(createRecoveryPageModel('ready', { hasFile }));
  }

  function check(file) {
    if (inFlight) return inFlight;
    if (!accountScope) return Promise.reject(backupError('auth_required'));
    if (!file) return Promise.reject(backupError('backup_invalid'));
    const currentGeneration = generation;
    const expectedAccountScope = accountScope;
    render(createRecoveryPageModel('processing', { hasFile: true }));
    const operation = Promise.resolve()
      .then(() => previewFile({ file, expectedAccountScope }))
      .then((preview) => {
        if (destroyed || currentGeneration !== generation) return null;
        render(createRecoveryPageModel('preview', { hasFile: true, preview }));
        return preview;
      })
      .catch((error) => {
        const mapped = error instanceof MandiriBackupError
          ? error
          : mapBackupError(error, 'backup_invalid');
        if (!destroyed && currentGeneration === generation) {
          render(createRecoveryPageModel('error', {
            hasFile: true,
            message: mapped.message,
          }));
        }
        throw mapped;
      })
      .finally(() => {
        if (inFlight === operation) inFlight = null;
      });
    inFlight = operation;
    return operation;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation += 1;
    accountScope = null;
    inFlight = null;
    unsubscribe();
    view.destroy?.();
  }

  render(model);
  if (resolvedFeatureState !== MANDIRI_FEATURE_STATES.INTERNAL) {
    return Object.freeze({ check, destroy, fileSelected, getState: () => model, login });
  }
  view.bind?.({
    onLogin: () => login().catch(() => {}),
    onFileSelected: fileSelected,
    onCheck: (file) => check(file).catch(() => {}),
  });
  unsubscribe = subscribeAuth((state) => { void handleAuthState(state); });
  return Object.freeze({ check, destroy, fileSelected, getState: () => model, login });
}

export async function initMandiriRecoveryPage({
  documentRef = document,
  featureState = getMandiriFeatureState(),
  ...dependencies
} = {}) {
  const root = documentRef.querySelector('[data-mandiri-recovery]');
  if (!root) throw backupError('backup_invalid');
  const view = createDomRecoveryPageView(root);
  if (resolveMandiriFeatureState(featureState) !== MANDIRI_FEATURE_STATES.INTERNAL) {
    return createRecoveryPageController({ featureState, view, ...dependencies });
  }
  const auth = await import('../../modules/user-auth.js');
  return createRecoveryPageController({
    featureState,
    view,
    subscribeAuth: auth.subscribeUserAuth,
    signIn: auth.signInPublicUser,
    ...dependencies,
  });
}

if (typeof document !== 'undefined') {
  const boot = () => {
    void initMandiriRecoveryPage().catch((error) => {
      console.warn('Pemeriksaan backup Mandiri belum dapat dibuka:', error?.code || 'recovery-init-failed');
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
