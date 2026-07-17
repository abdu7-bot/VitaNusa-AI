import { downloadBackupJson } from '../export/backup-download.js';
import {
  backupError,
  getBackupErrorMessage,
  MandiriBackupError,
  mapBackupError,
} from '../export/backup-errors.js';

export const BACKUP_PANEL_STATES = Object.freeze([
  'idle',
  'preparing',
  'downloading',
  'success',
  'error',
]);

const STATE_MESSAGES = Object.freeze({
  idle: 'Backup dibuat hanya saat kamu menekan tombol unduh.',
  preparing: 'Menyiapkan data workspace yang ter-scope.',
  downloading: 'Menyiapkan file JSON untuk diunduh.',
  success: 'File backup JSON sudah disiapkan untuk diunduh.',
  error: 'Backup belum dapat dibuat.',
});

export function createBackupPanelModel(stateValue, options = {}) {
  const state = BACKUP_PANEL_STATES.includes(stateValue) ? stateValue : 'error';
  return Object.freeze({
    state,
    visible: options.visible === true,
    message: state === 'error' && typeof options.message === 'string'
      ? options.message
      : STATE_MESSAGES[state],
  });
}

function setText(root, selector, value) {
  const element = root.querySelector(selector);
  if (element) element.textContent = value;
}

export function renderBackupPanel(root, model) {
  if (!root || typeof root.querySelector !== 'function') throw backupError('backup_invalid');
  const busy = ['preparing', 'downloading'].includes(model.state);
  root.hidden = !model.visible;
  root.dataset.backupPanelState = model.state;
  root.setAttribute('aria-busy', String(busy));
  const button = root.querySelector('[data-backup-download]');
  if (button) button.disabled = busy || !model.visible;
  setText(root, '[data-backup-status]', model.message);
  return model;
}

export function createDomBackupPanelView(root) {
  if (!root || typeof root.querySelector !== 'function') throw backupError('backup_invalid');
  const button = root.querySelector('[data-backup-download]');
  let listener = null;

  return Object.freeze({
    render(model) {
      return renderBackupPanel(root, model);
    },
    bind(onDownload) {
      if (typeof onDownload !== 'function') throw backupError('backup_invalid');
      listener = () => { void onDownload(); };
      button?.addEventListener('click', listener);
    },
    destroy() {
      if (listener) button?.removeEventListener('click', listener);
      listener = null;
    },
  });
}

export function createBackupPanelController({
  view,
  downloader = downloadBackupJson,
} = {}) {
  if (!view || typeof view.render !== 'function' || typeof downloader !== 'function') {
    throw backupError('backup_invalid');
  }
  let model = createBackupPanelModel('idle');
  let context = null;
  let inFlight = null;
  let destroyed = false;

  const render = (next) => {
    model = next;
    view.render(model);
    return model;
  };

  function clear() {
    context = null;
    inFlight = null;
    if (!destroyed) render(createBackupPanelModel('idle'));
  }

  function setWorkspace({ backupService, accountScope, workspaceId, workspaceName } = {}) {
    if (
      destroyed
      || typeof backupService?.createWorkspaceBackup !== 'function'
      || typeof accountScope !== 'string'
      || typeof workspaceId !== 'string'
      || typeof workspaceName !== 'string'
    ) {
      throw backupError('backup_invalid');
    }
    context = Object.freeze({ backupService, accountScope, workspaceId, workspaceName });
    render(createBackupPanelModel('idle', { visible: true }));
    return model;
  }

  function download() {
    if (destroyed || !context) return Promise.reject(backupError('auth_required'));
    if (inFlight) return inFlight;
    const activeContext = context;
    render(createBackupPanelModel('preparing', { visible: true }));

    const operation = Promise.resolve()
      .then(() => activeContext.backupService.createWorkspaceBackup({
        accountScope: activeContext.accountScope,
        workspaceId: activeContext.workspaceId,
      }))
      .then((backup) => {
        if (destroyed || context !== activeContext) throw backupError('scope_mismatch');
        render(createBackupPanelModel('downloading', { visible: true }));
        return downloader({
          backup,
          workspaceName: activeContext.workspaceName,
          userInitiated: true,
        });
      })
      .then((result) => {
        if (!destroyed && context === activeContext) {
          render(createBackupPanelModel('success', { visible: true }));
        }
        return result;
      })
      .catch((error) => {
        const mapped = error instanceof MandiriBackupError
          ? error
          : mapBackupError(error, 'download_failed');
        if (!destroyed && context === activeContext) {
          render(createBackupPanelModel('error', {
            visible: true,
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
    context = null;
    inFlight = null;
    view.destroy?.();
  }

  render(model);
  view.bind?.(() => download().catch(() => {}));
  return Object.freeze({ clear, destroy, download, getState: () => model, setWorkspace });
}

export function initMandiriBackupPanel({ documentRef = document, ...dependencies } = {}) {
  const root = documentRef.querySelector('[data-mandiri-backup-panel]');
  if (!root) throw backupError('backup_invalid');
  return createBackupPanelController({
    view: createDomBackupPanelView(root),
    ...dependencies,
  });
}

export { getBackupErrorMessage };
