import {
  resolveMandiriFeatureState,
  MANDIRI_FEATURE_STATES,
} from '../config/feature-flags.js';
import { createRepositoryContext } from '../repositories/repository-context.js';
import { createLocalScopesFromUser } from '../services/account-scope.js';
import {
  getWorkspaceErrorMessage,
  isRetryableWorkspaceError,
  mapWorkspaceError,
  workspaceError,
} from '../services/workspace-errors.js';
import { createWorkspaceService } from '../services/workspace-service.js';
import { openMandiriDatabase } from '../storage/database.js';
import {
  signInPublicUser,
  subscribeUserAuth,
} from '../../modules/user-auth.js';

export const WORKSPACE_PANEL_STATES = Object.freeze([
  'feature-off',
  'auth-loading',
  'signed-out',
  'opening-storage',
  'ready-no-workspace',
  'creating',
  'ready-with-workspace',
  'error',
]);

const STATE_MESSAGES = Object.freeze({
  'feature-off': 'Fitur workspace lokal belum tersedia pada build ini.',
  'auth-loading': 'Memeriksa sesi akun VitaNusa.',
  'signed-out': 'Login diperlukan untuk memisahkan workspace lokal antar-akun. Data workspace tetap disimpan hanya di perangkat ini.',
  'opening-storage': 'Membuka penyimpanan lokal untuk akun ini.',
  'ready-no-workspace': 'Belum ada workspace lokal untuk akun ini.',
  creating: 'Membuat workspace lokal secara atomik.',
  'ready-with-workspace': 'Workspace lokal tersedia pada perangkat ini.',
  error: 'Workspace lokal belum dapat ditampilkan.',
});

function safeUserLabel(value) {
  if (typeof value !== 'string') return 'Pengguna VitaNusa';
  const label = value.trim().slice(0, 120);
  return label && !label.includes('@') ? label : 'Pengguna VitaNusa';
}

function safeWorkspaceSummary(workspace, membership) {
  if (!workspace || !membership) return null;
  return Object.freeze({
    name: typeof workspace.name === 'string' ? workspace.name : '',
    timezone: typeof workspace.timezone === 'string' ? workspace.timezone : '',
    currencyCode: workspace.currencyCode === 'IDR' ? 'IDR' : '',
    status: workspace.status === 'active' ? 'active' : 'archived',
    role: membership.role === 'merchant_owner' ? 'merchant_owner' : '',
  });
}

export function createWorkspacePanelModel(stateValue, options = {}) {
  const state = WORKSPACE_PANEL_STATES.includes(stateValue) ? stateValue : 'error';
  const summary = state === 'ready-with-workspace'
    ? safeWorkspaceSummary(options.workspace, options.membership)
    : null;
  return Object.freeze({
    state,
    message: state === 'error'
      ? (typeof options.message === 'string' ? options.message : STATE_MESSAGES.error)
      : STATE_MESSAGES[state],
    retryable: state === 'error' && options.retryable === true,
    summary,
    userLabel: typeof options.userLabel === 'string'
      ? safeUserLabel(options.userLabel)
      : null,
  });
}

function setHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function setText(element, value) {
  if (element) element.textContent = value;
}

export function renderWorkspacePanel(root, model) {
  if (!root || typeof root.querySelector !== 'function') {
    throw workspaceError('unknown_error');
  }

  root.dataset.workspacePanelState = model.state;
  root.setAttribute('aria-busy', String([
    'auth-loading',
    'opening-storage',
    'creating',
  ].includes(model.state)));

  const status = root.querySelector('[data-workspace-status]');
  const loading = root.querySelector('[data-workspace-loading]');
  const signedOut = root.querySelector('[data-workspace-signed-out]');
  const formPanel = root.querySelector('[data-workspace-form-panel]');
  const summaryPanel = root.querySelector('[data-workspace-summary]');
  const errorPanel = root.querySelector('[data-workspace-error]');
  const fieldset = root.querySelector('[data-workspace-fieldset]');
  const submit = root.querySelector('[data-workspace-submit]');
  const retry = root.querySelector('[data-workspace-retry]');
  const userPanel = root.querySelector('[data-workspace-user-panel]');

  setText(status, model.message);
  setHidden(loading, !['auth-loading', 'opening-storage'].includes(model.state));
  setHidden(signedOut, model.state !== 'signed-out');
  setHidden(formPanel, !['ready-no-workspace', 'creating'].includes(model.state));
  setHidden(summaryPanel, model.state !== 'ready-with-workspace');
  setHidden(errorPanel, model.state !== 'error');
  if (fieldset) fieldset.disabled = model.state === 'creating';
  if (submit) submit.textContent = model.state === 'creating'
    ? 'Membuat workspace...'
    : 'Buat workspace lokal';
  if (retry) retry.hidden = !model.retryable;
  setHidden(userPanel, !model.userLabel);
  if (model.userLabel) {
    setText(root.querySelector('[data-workspace-user-name]'), model.userLabel);
  }

  if (model.state === 'error') {
    setText(root.querySelector('[data-workspace-error-message]'), model.message);
  }
  if (model.summary) {
    setText(root.querySelector('[data-workspace-name]'), model.summary.name);
    setText(root.querySelector('[data-workspace-timezone]'), model.summary.timezone);
    setText(root.querySelector('[data-workspace-currency]'), model.summary.currencyCode);
    setText(root.querySelector('[data-workspace-record-status]'), model.summary.status);
    setText(root.querySelector('[data-workspace-role]'), model.summary.role);
  }
  return model;
}

export function createDomWorkspacePanelView(root) {
  if (!root || typeof root.querySelector !== 'function') throw workspaceError('unknown_error');
  const loginButton = root.querySelector('[data-workspace-login]');
  const form = root.querySelector('[data-workspace-form]');
  const retryButton = root.querySelector('[data-workspace-retry]');
  const listeners = [];

  return Object.freeze({
    render(model) {
      return renderWorkspacePanel(root, model);
    },
    readFormInput() {
      return Object.freeze({
        name: form?.elements?.workspaceName?.value ?? '',
        timezone: form?.elements?.workspaceTimezone?.value ?? 'Asia/Jakarta',
        currencyCode: form?.elements?.workspaceCurrency?.value ?? 'IDR',
      });
    },
    bind({ onLogin, onSubmit, onRetry }) {
      const loginHandler = () => { void onLogin(); };
      const submitHandler = (event) => {
        event.preventDefault();
        void onSubmit(this.readFormInput());
      };
      const retryHandler = () => { void onRetry(); };
      loginButton?.addEventListener('click', loginHandler);
      form?.addEventListener('submit', submitHandler);
      retryButton?.addEventListener('click', retryHandler);
      listeners.push(
        [loginButton, 'click', loginHandler],
        [form, 'submit', submitHandler],
        [retryButton, 'click', retryHandler],
      );
    },
    destroy() {
      listeners.splice(0).forEach(([element, type, listener]) => {
        element?.removeEventListener(type, listener);
      });
    },
  });
}

function workspaceModelFromState(workspaceState) {
  if (workspaceState.status === 'empty') return createWorkspacePanelModel('ready-no-workspace');
  return createWorkspacePanelModel('ready-with-workspace', {
    workspace: workspaceState.workspace,
    membership: workspaceState.membership,
  });
}

export function createWorkspacePanelController({
  featureState,
  view,
  subscribeAuth = subscribeUserAuth,
  signIn = signInPublicUser,
  createScopes = createLocalScopesFromUser,
  openDatabase = openMandiriDatabase,
  createContext = createRepositoryContext,
  createService = createWorkspaceService,
} = {}) {
  if (!view || typeof view.render !== 'function') throw workspaceError('unknown_error');

  const resolvedFeatureState = resolveMandiriFeatureState(featureState);
  let model = createWorkspacePanelModel(
    resolvedFeatureState === MANDIRI_FEATURE_STATES.INTERNAL ? 'auth-loading' : 'feature-off',
  );
  let destroyed = false;
  let generation = 0;
  let unsubscribe = () => {};
  let connection = null;
  let service = null;
  let scopes = null;
  let activeUid = null;
  let activeUserLabel = null;
  let lastAuthState = null;
  let activeCommand = null;
  let creatingPromise = null;
  let loginPromise = null;
  let retryMode = null;

  const render = (nextModel) => {
    model = activeUserLabel
      ? Object.freeze({ ...nextModel, userLabel: activeUserLabel })
      : nextModel;
    view.render(model);
    return model;
  };

  const closeConnection = () => {
    const current = connection;
    connection = null;
    service = null;
    scopes = null;
    current?.close?.();
  };

  const isCurrent = (expectedGeneration) => !destroyed && generation === expectedGeneration;

  const showError = (error, { retry = isRetryableWorkspaceError(error), mode = null } = {}) => {
    const mapped = mapWorkspaceError(error);
    retryMode = retry ? mode : null;
    render(createWorkspacePanelModel('error', {
      message: mapped.message,
      retryable: retry,
    }));
    return mapped;
  };

  async function handleAuthState(state, { force = false } = {}) {
    if (destroyed) return;
    lastAuthState = state;
    const signedIn = Boolean(state?.isAuthenticated && state.user?.uid);
    if (!signedIn) {
      generation += 1;
      activeUid = null;
      activeUserLabel = null;
      activeCommand = null;
      creatingPromise = null;
      retryMode = null;
      closeConnection();
      render(createWorkspacePanelModel('signed-out'));
      return;
    }

    activeUserLabel = safeUserLabel(state.user.displayName);
    if (!force && activeUid === state.user.uid) return;
    const currentGeneration = ++generation;
    activeUid = state.user.uid;
    activeCommand = null;
    creatingPromise = null;
    retryMode = null;
    closeConnection();
    render(createWorkspacePanelModel('opening-storage'));

    try {
      const nextScopes = await createScopes(state.user);
      if (!isCurrent(currentGeneration)) return;
      const nextConnection = await openDatabase();
      if (!isCurrent(currentGeneration)) {
        nextConnection.close?.();
        return;
      }
      connection = nextConnection;
      const nextService = createService({ repositoryContext: createContext(nextConnection) });
      service = nextService;
      scopes = nextScopes;
      const workspaceState = await nextService.getWorkspaceState(
        nextScopes.accountScope,
        nextScopes.userScope,
      );
      if (!isCurrent(currentGeneration)) return;
      render(workspaceModelFromState(workspaceState));
    } catch (error) {
      if (!isCurrent(currentGeneration)) return;
      activeUid = null;
      closeConnection();
      showError(error, { mode: 'storage' });
    }
  }

  function login() {
    if (
      destroyed
      || resolvedFeatureState !== MANDIRI_FEATURE_STATES.INTERNAL
    ) {
      return Promise.reject(workspaceError('feature_disabled'));
    }
    if (loginPromise) return loginPromise;
    retryMode = null;
    render(createWorkspacePanelModel('auth-loading'));
    loginPromise = Promise.resolve()
      .then(() => signIn())
      .catch((error) => {
        const mapped = showError(error, { retry: true, mode: 'login' });
        throw mapped;
      })
      .finally(() => { loginPromise = null; });
    return loginPromise;
  }

  function submit(input) {
    if (resolvedFeatureState !== MANDIRI_FEATURE_STATES.INTERNAL) {
      return Promise.reject(workspaceError('feature_disabled'));
    }
    if (creatingPromise) return creatingPromise;
    if (!service || !scopes) return Promise.reject(workspaceError('auth_required'));

    try {
      if (!activeCommand) {
        activeCommand = service.prepareCreateWorkspaceCommand({
          accountScope: scopes.accountScope,
          userScope: scopes.userScope,
          name: input?.name,
          timezone: input?.timezone,
          currencyCode: input?.currencyCode,
        });
      }
    } catch (error) {
      activeCommand = null;
      return Promise.reject(showError(error, { retry: false }));
    }

    const currentGeneration = generation;
    const currentService = service;
    const currentScopes = scopes;
    const command = activeCommand;
    render(createWorkspacePanelModel('creating'));
    retryMode = null;

    const operation = Promise.resolve()
      .then(() => currentService.createWorkspace(command))
      .then((creationResult) => {
        if (isCurrent(currentGeneration)) {
          activeCommand = null;
          render(createWorkspacePanelModel('ready-with-workspace', {
            workspace: creationResult.workspace,
            membership: creationResult.membership,
          }));
        }
        return creationResult;
      })
      .catch(async (error) => {
        const mapped = mapWorkspaceError(error);
        if (!isCurrent(currentGeneration)) throw mapped;

        if (mapped.code === 'workspace_already_exists') {
          try {
            const existingState = await currentService.getWorkspaceState(
              currentScopes.accountScope,
              currentScopes.userScope,
            );
            if (isCurrent(currentGeneration) && existingState.status === 'ready') {
              activeCommand = null;
              render(workspaceModelFromState(existingState));
              return Object.freeze({
                status: 'existing',
                workspace: existingState.workspace,
                membership: existingState.membership,
              });
            }
          } catch {
            // The original safe error is retained; no record or identifier is exposed.
          }
        }

        if (!isRetryableWorkspaceError(mapped)) activeCommand = null;
        throw showError(mapped, {
          retry: isRetryableWorkspaceError(mapped),
          mode: 'command',
        });
      })
      .finally(() => {
        if (creatingPromise === operation) creatingPromise = null;
      });
    creatingPromise = operation;
    return operation;
  }

  function retry() {
    if (retryMode === 'login') return login();
    if (activeCommand && service) return submit();
    if (lastAuthState?.isAuthenticated) return handleAuthState(lastAuthState, { force: true });
    render(createWorkspacePanelModel('signed-out'));
    return Promise.resolve();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation += 1;
    unsubscribe();
    closeConnection();
    activeUid = null;
    activeUserLabel = null;
    activeCommand = null;
    creatingPromise = null;
    loginPromise = null;
    retryMode = null;
    render(createWorkspacePanelModel('signed-out'));
    view.destroy?.();
  }

  render(model);
  if (resolvedFeatureState !== MANDIRI_FEATURE_STATES.INTERNAL) {
    return Object.freeze({ destroy, getState: () => model, login, retry, submit });
  }

  view.bind?.({
    onLogin: () => login().catch(() => {}),
    onSubmit: (input) => submit(input).catch(() => {}),
    onRetry: () => retry().catch(() => {}),
  });
  try {
    unsubscribe = subscribeAuth((state) => { void handleAuthState(state); });
  } catch (error) {
    showError(error, { mode: 'login' });
  }

  return Object.freeze({ destroy, getState: () => model, login, retry, submit });
}

export function initMandiriWorkspacePanel({
  documentRef = document,
  featureState = MANDIRI_FEATURE_STATES.INTERNAL,
  ...dependencies
} = {}) {
  const root = documentRef.querySelector('[data-mandiri-workspace-panel]');
  if (!root) throw workspaceError('unknown_error');
  return createWorkspacePanelController({
    featureState,
    view: createDomWorkspacePanelView(root),
    ...dependencies,
  });
}

export { getWorkspaceErrorMessage };
