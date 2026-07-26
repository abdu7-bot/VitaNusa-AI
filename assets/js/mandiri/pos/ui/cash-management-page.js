import { getMandiriFeatureState } from '../../config/feature-flags.js';
import { createEntityId, createOperationId } from '../../domain/ids.js';
import {
  addMoney, formatMoney, parseControlledMoneyInput, subtractMoney,
} from '../../domain/money.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import { createRepositoryContext } from '../../repositories/repository-context.js';
import { createLocalScopesFromUser } from '../../services/account-scope.js';
import { openMandiriDatabase } from '../../storage/database.js';
import { getSafeStorageMessage, storageError } from '../../storage/storage-errors.js';
import { subscribeUserAuth } from '../../../modules/user-auth.js';
import { getNusaKasirFeatureContract, getNusaKasirFeatureState } from '../config/nusakasir-flags.js';
import { createClosingSummary } from '../domain/cash-session.js';
import { createCashSessionId } from '../domain/cash-session.js';
import { createExpenseId, EXPENSE_CATEGORIES } from '../domain/expense.js';
import {
  createCashSessionService, normalizeRecordExpenseCommand,
} from '../services/cash-session-service.js';

export const CASH_PAGE_STATES = Object.freeze([
  'disabled', 'auth-loading', 'signed-out', 'loading', 'no-open-session',
  'open-session', 'closed-session', 'permission-denied', 'submitting',
  'version-conflict', 'error',
]);

export const EXPENSE_CATEGORY_LABELS = Object.freeze({
  operational: 'Operasional',
  supplies: 'Perlengkapan',
  transport: 'Transportasi',
  utilities: 'Utilitas',
  maintenance: 'Perawatan',
  other: 'Lainnya',
});

const MESSAGES = Object.freeze({
  disabled: 'NusaKasir belum tersedia pada build ini.',
  'auth-loading': 'Memeriksa sesi akun VitaNusa.',
  'signed-out': 'Login diperlukan sebelum membuka data kas lokal.',
  loading: 'Memuat sesi kas dan pengeluaran lokal.',
  'no-open-session': 'Belum ada sesi kas aktif. Data sesi disimpan lokal pada perangkat ini.',
  'open-session': 'Sesi kas aktif dan data terbaru telah dimuat.',
  'closed-session': 'Tidak ada sesi aktif. Ringkasan sesi terakhir tersedia.',
  'permission-denied': 'Membership aktif tidak memiliki akses ke workspace ini.',
  submitting: 'Menyimpan perubahan kas secara lokal.',
  'version-conflict': 'Data berubah di tab lain. Data terbaru telah dimuat; periksa kembali sebelum mencoba.',
  opened: 'Sesi kas berhasil dibuka secara lokal.',
  expense: 'Pengeluaran berhasil dicatat secara lokal.',
  closed: 'Sesi kas berhasil ditutup secara lokal.',
  permission_denied: 'Role workspace aktif tidak memiliki izin untuk tindakan ini.',
  invalid_money_input: 'Nominal harus rupiah bulat, misalnya 15000 atau Rp15.000.',
  data_invalid: 'Data yang dimasukkan tidak valid. Periksa kembali formulir.',
  duplicate_operation: 'Operasi ini sudah diproses. Data terbaru telah dimuat.',
  idempotency_mismatch: 'Operasi tidak dapat diproses ulang karena datanya berbeda.',
  operation_payload_mismatch: 'Operasi tidak dapat diproses ulang karena datanya berbeda.',
  record_not_found: 'Data sesi tidak ditemukan. Data terbaru telah dimuat.',
  invalid_reference: 'Referensi sesi tidak lagi valid. Data terbaru telah dimuat.',
  cash_session_already_open: 'Sesi kas lain sudah aktif. Data terbaru telah dimuat.',
  session_already_open: 'Sesi kas lain sudah aktif. Data terbaru telah dimuat.',
  cash_session_required: 'Buka sesi kas sebelum mencatat pengeluaran.',
  session_not_open: 'Buka sesi kas sebelum melanjutkan.',
  cash_session_closed: 'Sesi kas sudah ditutup. Data terbaru telah dimuat.',
  session_already_closed: 'Sesi kas sudah ditutup. Data terbaru telah dimuat.',
  schema_too_new: 'Versi data lokal lebih baru. Perbarui aplikasi sebelum melanjutkan.',
  database_newer_version: 'Versi data lokal lebih baru. Perbarui aplikasi sebelum melanjutkan.',
  storage_error: 'Data lokal belum dapat diproses. Tidak ada perubahan palsu yang ditampilkan.',
});
const PENDING_EXPENSE_STORAGE_PREFIX = 'vitanusa.mandiri.pending-expense.v1';

function safeMessage(code) {
  return MESSAGES[code] || getSafeStorageMessage(code) || MESSAGES.storage_error;
}

function actor(membership) {
  return {
    accountScope: membership.accountScope,
    workspaceId: membership.workspaceId,
    userScope: membership.userScope,
    role: membership.role,
    status: membership.status,
  };
}

export function normalizeCashInput(value, { positive = false } = {}) {
  const amount = parseControlledMoneyInput(value);
  if (positive && amount === 0) throw storageError('data_invalid');
  return amount;
}

function sortExpenses(values) {
  return Object.freeze([...values].sort((left, right) => (
    right.recordedAtLocal.localeCompare(left.recordedAtLocal)
    || right.expenseId.localeCompare(left.expenseId)
  )));
}

function normalizeExpenseMaterial(input, cashSessionId) {
  return Object.freeze({
    cashSessionId,
    category: EXPENSE_CATEGORIES.includes(input?.category) ? input.category : '',
    amountMinor: normalizeCashInput(input?.amount, { positive: true }),
    note: String(input?.note || '').trim() || null,
  });
}

function expenseMaterialKey(value) {
  return JSON.stringify([
    value.cashSessionId, value.category, value.amountMinor, value.note,
  ]);
}

function expenseMatchesCommand(expense, command) {
  return expense.expenseId === command.expenseId
    && expense.operationId === command.operationId
    && expense.cashSessionId === command.cashSessionId
    && expense.category === command.category
    && expense.amountMinor === command.amountMinor
    && expense.note === command.note
    && expense.recordedAtLocal === command.createdAtLocal;
}

function pendingExpenseStorageKey(scopes, workspace) {
  if (!scopes?.accountScope || !scopes?.userScope || !workspace?.workspaceId) return null;
  return [
    PENDING_EXPENSE_STORAGE_PREFIX,
    scopes.accountScope,
    workspace.workspaceId,
    scopes.userScope,
  ].join(':');
}

function getSessionStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeRestorableExpenseSubmission(
  value,
  { scopes, workspace, session, membership },
) {
  if (!value?.command || !session) return null;
  let command;
  try {
    command = normalizeRecordExpenseCommand(value.command);
  } catch {
    return null;
  }
  const material = {
    cashSessionId: command.cashSessionId,
    category: command.category,
    amountMinor: command.amountMinor,
    note: command.note,
  };
  const materialKey = expenseMaterialKey(material);
  if (
    !['pending', 'orphaned', 'absent'].includes(value.outcome)
    || command.schemaVersion !== 1
    || command.accountScope !== scopes.accountScope
    || command.workspaceId !== workspace.workspaceId
    || command.actorScope !== scopes.userScope
    || command.actorRole !== membership.role
    || command.cashSessionId !== session.cashSessionId
    || command.expectedVersion > session.version
  ) return null;
  return Object.freeze({
    command,
    materialKey,
    outcome: value.outcome,
  });
}

function model(state, values = {}) {
  return Object.freeze({
    state,
    message: values.message || MESSAGES[state] || MESSAGES.storage_error,
    session: values.session || null,
    lastClosedSession: values.lastClosedSession || null,
    expenses: sortExpenses(values.expenses || []),
    summary: values.summary || null,
    canOpen: values.canOpen === true,
    canExpense: values.canExpense === true,
    canClose: values.canClose === true,
    submitting: values.submitting === true,
    confirmOpen: values.confirmOpen === true,
    focusStatus: values.focusStatus === true,
  });
}

export function createCashManagementController({
  contract,
  view,
  subscribeAuth = subscribeUserAuth,
  createScopes = createLocalScopesFromUser,
  openDatabase = openMandiriDatabase,
  createContext = createRepositoryContext,
  createService = createCashSessionService,
  now = () => new Date().toISOString(),
  cryptoRef = globalThis.crypto,
  pendingExpenseStore,
} = {}) {
  if (!view?.render) throw storageError('data_invalid');
  const expenseSubmissionStore = pendingExpenseStore === undefined && contract?.enabled
    ? getSessionStorage()
    : pendingExpenseStore;
  let current = model(contract?.enabled ? 'auth-loading' : 'disabled');
  let unsubscribe = () => {};
  let connection = null;
  let context = null;
  let service = null;
  let scopes = null;
  let workspace = null;
  let membership = null;
  let generation = 0;
  let activeSubmission = null;
  let pendingExpenseSubmissions = new Map();
  let confirmedExpenseSubmissions = new Map();
  const knownPendingExpenseKeys = new Set();
  let lastAuthState = null;
  let destroyed = false;

  const render = (next) => {
    current = next;
    view.render(next);
    return next;
  };

  function clearOperationalReferences() {
    const previousConnection = connection;
    connection = context = service = scopes = workspace = membership = null;
    activeSubmission = null;
    pendingExpenseSubmissions = new Map();
    confirmedExpenseSubmissions = new Map();
    previousConnection?.close?.();
  }

  function persistPendingExpenseSubmissions() {
    const key = pendingExpenseStorageKey(scopes, workspace);
    if (!key || !expenseSubmissionStore) return;
    knownPendingExpenseKeys.add(key);
    try {
      const entries = [...pendingExpenseSubmissions.values()];
      if (entries.length === 0) {
        expenseSubmissionStore.removeItem(key);
        return;
      }
      expenseSubmissionStore.setItem(key, JSON.stringify(entries));
    } catch {
      // In-memory idempotency remains active when Web Storage is unavailable.
    }
  }

  function removePersistedExpenseSubmissions(key) {
    if (!key || !expenseSubmissionStore) return;
    try {
      expenseSubmissionStore.removeItem(key);
    } catch {
      // Cleanup is best-effort when the browser blocks Web Storage.
    }
  }

  function removeKnownPersistedExpenseSubmissions() {
    knownPendingExpenseKeys.forEach(removePersistedExpenseSubmissions);
    knownPendingExpenseKeys.clear();
  }

  function removePendingExpenseSubmission(materialKey) {
    if (!pendingExpenseSubmissions.delete(materialKey)) return;
    persistPendingExpenseSubmissions();
  }

  function discardAbsentExpenseSubmissions() {
    let removed = false;
    for (const [materialKey, submission] of pendingExpenseSubmissions) {
      if (submission.outcome === 'absent') {
        pendingExpenseSubmissions.delete(materialKey);
        removed = true;
      }
    }
    if (removed) persistPendingExpenseSubmissions();
  }

  function preserveActiveExpenseSubmission() {
    if (activeSubmission?.kind !== 'expense') return;
    const pending = pendingExpenseSubmissions.get(activeSubmission.logicalKey);
    if (!pending) return;
    pendingExpenseSubmissions.set(activeSubmission.logicalKey, Object.freeze({
      ...pending,
      outcome: 'orphaned',
    }));
    persistPendingExpenseSubmissions();
  }

  function restorePendingExpenseSubmissions() {
    const key = pendingExpenseStorageKey(scopes, workspace);
    if (!key || !expenseSubmissionStore) return;
    let values;
    try {
      const serialized = expenseSubmissionStore.getItem(key);
      if (!serialized) return;
      values = JSON.parse(serialized);
      if (!Array.isArray(values)) throw storageError('data_invalid');
    } catch {
      removePersistedExpenseSubmissions(key);
      return;
    }
    let mismatch = false;
    pendingExpenseSubmissions = new Map();
    confirmedExpenseSubmissions = new Map();
    values.forEach((value) => {
      const restored = normalizeRestorableExpenseSubmission(value, {
        scopes, workspace, session: current.session, membership,
      });
      if (!restored) return;
      const recorded = current.expenses.find((expense) => (
        expense.expenseId === restored.command.expenseId
        || expense.operationId === restored.command.operationId
      ));
      if (recorded) {
        if (!expenseMatchesCommand(recorded, restored.command)) {
          mismatch = true;
        } else if (restored.outcome === 'orphaned') {
          confirmedExpenseSubmissions.set(restored.materialKey, Object.freeze({
            command: restored.command,
            expense: recorded,
          }));
        }
        return;
      }
      pendingExpenseSubmissions.set(restored.materialKey, restored);
    });
    persistPendingExpenseSubmissions();
    if (mismatch) {
      render(model('error', {
        ...current,
        message: safeMessage('idempotency_mismatch'),
        focusStatus: true,
      }));
    }
  }

  function permissions() {
    const subject = membership && actor(membership);
    const scope = workspace && { accountScope: scopes.accountScope, workspaceId: workspace.workspaceId };
    return {
      canOpen: !!subject && canPerformWorkspaceAction(subject, 'cash_session.open', scope),
      canExpense: !!subject && canPerformWorkspaceAction(subject, 'expense.create', scope),
      canClose: !!subject && canPerformWorkspaceAction(subject, 'cash_session.close', scope),
    };
  }

  async function readCashData() {
    const readAt = now();
    const activeContext = context;
    const accountScope = scopes.accountScope;
    const workspaceId = workspace.workspaceId;
    return activeContext.run(['cashSessions', 'expenses', 'sales'], 'readonly', async (repositories) => {
      const sessions = await repositories.cashSessionRepository.listByWorkspace(
        accountScope, workspaceId,
      );
      const openSession = sessions.find((entry) => entry.status === 'open') || null;
      const lastClosedSession = [...sessions].reverse().find((entry) => entry.status === 'closed') || null;
      if (!openSession) return { session: null, lastClosedSession, expenses: [], summary: null };
      const expenses = await repositories.expenseRepository.listByCashSession(
        accountScope, workspaceId, openSession.cashSessionId,
      );
      const expenseOutMinor = expenses.reduce(
        (total, expense) => addMoney(total, expense.amountMinor), 0,
      );
      const cashSalesMinor = await repositories.saleRepository.sumCashSalesBetween(
        accountScope, workspaceId, openSession.openedAtLocal, readAt,
      );
      const summary = createClosingSummary({
        openingCashMinor: openSession.openingCashMinor,
        cashSalesMinor,
        expenseOutMinor,
        countedCashMinor: 0,
      });
      return { session: openSession, lastClosedSession, expenses, summary };
    });
  }

  async function reload({ message, focusStatus = false, conflict = false } = {}) {
    const token = generation;
    const data = await readCashData();
    if (destroyed || token !== generation) return current;
    const state = conflict
      ? 'version-conflict'
      : data.session ? 'open-session' : data.lastClosedSession ? 'closed-session' : 'no-open-session';
    return render(model(state, {
      ...data, ...permissions(), message: message || MESSAGES[state], focusStatus,
    }));
  }

  async function handleAuth(authState) {
    lastAuthState = authState;
    const token = ++generation;
    let nextConnection = null;
    const previousPendingKey = pendingExpenseStorageKey(scopes, workspace);
    if (authState?.isAuthenticated && authState.user) preserveActiveExpenseSubmission();
    clearOperationalReferences();
    if (!authState?.isAuthenticated || !authState.user) {
      if (previousPendingKey) knownPendingExpenseKeys.add(previousPendingKey);
      removeKnownPersistedExpenseSubmissions();
      render(model('signed-out'));
      return;
    }
    render(model('loading'));
    try {
      const nextScopes = await createScopes(authState.user);
      if (destroyed || token !== generation) return;
      nextConnection = await openDatabase();
      if (destroyed || token !== generation) return nextConnection.close?.();
      const nextContext = createContext(nextConnection);
      const access = await nextContext.run(['workspaces', 'memberships'], 'readonly', async (repositories) => {
        const workspaces = await repositories.workspaceRepository.listByStatus(nextScopes.accountScope, 'active');
        if (workspaces.length !== 1) throw storageError('record_not_found');
        const selected = workspaces[0];
        const member = await repositories.membershipRepository.getByUserScope(
          nextScopes.accountScope, selected.workspaceId, nextScopes.userScope,
        );
        return { workspace: selected, membership: member };
      });
      if (!access.membership || !canPerformWorkspaceAction(
        actor(access.membership), 'workspace.read',
        { accountScope: nextScopes.accountScope, workspaceId: access.workspace.workspaceId },
      )) throw storageError('permission_denied');
      if (destroyed || token !== generation) return nextConnection.close?.();
      connection = nextConnection;
      nextConnection = null;
      context = nextContext;
      service = createService({ repositoryContext: context });
      scopes = nextScopes;
      workspace = access.workspace;
      membership = access.membership;
      await reload();
      if (destroyed || token !== generation) return;
      restorePendingExpenseSubmissions();
    } catch (error) {
      nextConnection?.close?.();
      if (destroyed || token !== generation) return;
      clearOperationalReferences();
      const denied = error?.code === 'permission_denied';
      render(model(denied ? 'permission-denied' : 'error', {
        message: safeMessage(error?.code), focusStatus: true,
      }));
    }
  }

  function rebindWorkspace() {
    if (destroyed || !lastAuthState) return Promise.reject(storageError('permission_denied'));
    return handleAuth(lastAuthState);
  }

  function submit(kind, input) {
    const permission = permissions();
    if (!contract?.enabled || !service || !permission[
      kind === 'open' ? 'canOpen' : kind === 'expense' ? 'canExpense' : 'canClose'
    ]) return Promise.reject(storageError('permission_denied'));
    const session = current.session;
    let logicalKey;
    let normalizedInput;
    let command;
    try {
      if (kind === 'expense') {
        if (!session) throw storageError('cash_session_required');
        if (session.status !== 'open') throw storageError('cash_session_closed');
        if (!session.cashSessionId || !Number.isSafeInteger(session.version) || session.version < 1) {
          throw storageError('cash_session_required');
        }
        normalizedInput = normalizeExpenseMaterial(input, session.cashSessionId);
        logicalKey = expenseMaterialKey(normalizedInput);
      } else if (kind === 'open') {
        normalizedInput = normalizeCashInput(input?.openingCash);
        logicalKey = JSON.stringify(['open', session?.cashSessionId || null, normalizedInput]);
      } else if (kind === 'close') {
        normalizedInput = normalizeCashInput(input?.countedCash);
        logicalKey = JSON.stringify([
          'close', session?.cashSessionId || null, session?.version || null, normalizedInput,
        ]);
      } else {
        throw storageError('data_invalid');
      }
    } catch (error) {
      render(model(current.state, { ...current, message: safeMessage(error?.code), focusStatus: true }));
      return Promise.reject(error);
    }
    if (activeSubmission) {
      if (
        activeSubmission.generation === generation
        && activeSubmission.kind === kind
        && activeSubmission.logicalKey === logicalKey
      ) return activeSubmission.promise;
      const error = storageError('operation_in_progress');
      render(model(current.state, {
        ...current, message: safeMessage(error.code), focusStatus: true,
      }));
      return Promise.reject(error);
    }
    if (kind === 'expense') {
      const confirmed = confirmedExpenseSubmissions.get(logicalKey);
      if (confirmed) {
        confirmedExpenseSubmissions.delete(logicalKey);
        render(model(current.session ? 'open-session' : current.state, {
          ...current, submitting: false, message: MESSAGES.expense, focusStatus: true,
        }));
        return Promise.resolve(Object.freeze({
          status: 'duplicate-safe',
          expense: confirmed.expense,
        }));
      }
    }
    try {
      if (kind === 'expense') {
        const materialKey = logicalKey;
        const pendingExpenseSubmission = pendingExpenseSubmissions.get(materialKey);
        if (pendingExpenseSubmission) {
          command = pendingExpenseSubmission.command;
        } else {
          const createdAtLocal = now();
          command = Object.freeze({
            schemaVersion: 1,
            accountScope: scopes.accountScope,
            workspaceId: workspace.workspaceId,
            actorScope: scopes.userScope,
            actorRole: membership.role,
            operationId: createOperationId(cryptoRef),
            eventId: createEntityId('audit', cryptoRef),
            cashSessionId: normalizedInput.cashSessionId,
            createdAtLocal,
            expenseId: createExpenseId(cryptoRef),
            expectedVersion: session?.version,
            category: normalizedInput.category,
            amountMinor: normalizedInput.amountMinor,
            note: normalizedInput.note,
          });
          pendingExpenseSubmissions.set(materialKey, Object.freeze({
            command, materialKey, outcome: 'pending',
          }));
          persistPendingExpenseSubmissions();
        }
      }
      if (kind !== 'expense') {
        const createdAtLocal = now();
        const base = {
          schemaVersion: 1,
          accountScope: scopes.accountScope,
          workspaceId: workspace.workspaceId,
          actorScope: scopes.userScope,
          actorRole: membership.role,
          operationId: createOperationId(cryptoRef),
          eventId: createEntityId('audit', cryptoRef),
          cashSessionId: kind === 'open' ? createCashSessionId(cryptoRef) : session?.cashSessionId,
          createdAtLocal,
        };
        if (kind === 'open') command = {
          ...base, openingCashMinor: normalizedInput,
        };
        if (kind === 'close') command = {
          ...base,
          expectedVersion: session?.version,
          countedCashMinor: normalizedInput,
        };
      }
    } catch (error) {
      render(model(current.state, { ...current, message: safeMessage(error?.code), focusStatus: true }));
      return Promise.reject(error);
    }
    const token = generation;
    const activeService = service;
    render(model('submitting', { ...current, submitting: true, message: MESSAGES.submitting }));
    const submission = {
      command, kind, logicalKey, generation: token, promise: null,
    };
    const operation = Promise.resolve()
      .then(() => activeService[kind === 'expense' ? 'recordExpense' : kind](Object.freeze(command)))
      .then(async (result) => {
        if (destroyed || token !== generation) return result;
        await reload({ message: MESSAGES[kind], focusStatus: true });
        if (destroyed || token !== generation) return result;
        if (kind === 'expense') {
          removePendingExpenseSubmission(expenseMaterialKey(command));
          discardAbsentExpenseSubmissions();
        }
        return result;
      })
      .catch(async (error) => {
        if (destroyed || token !== generation) throw error;
        let expenseReconciled = false;
        if (error?.code === 'version_conflict') {
          await reload({ message: MESSAGES['version-conflict'], focusStatus: true, conflict: true });
          if (destroyed || token !== generation) throw error;
          expenseReconciled = kind === 'expense';
        } else if ([
          'cash_session_already_open', 'cash_session_required', 'cash_session_closed',
          'record_not_found', 'invalid_reference', 'duplicate_operation',
        ].includes(error?.code)) {
          await reload({ message: safeMessage(error.code), focusStatus: true });
          if (destroyed || token !== generation) throw error;
          expenseReconciled = kind === 'expense';
        } else {
          let reloaded = false;
          if (kind === 'expense') {
            try {
              await reload();
              if (destroyed || token !== generation) throw error;
              reloaded = true;
              expenseReconciled = true;
            } catch (reloadError) {
              if (destroyed || token !== generation) throw error;
              render(model('error', {
                ...current, submitting: false, message: safeMessage(reloadError?.code), focusStatus: true,
              }));
            }
          }
          if (!reloaded || kind !== 'expense') {
            render(model('error', {
              ...current, submitting: false, message: safeMessage(error?.code), focusStatus: true,
            }));
          }
        }
        if (destroyed || token !== generation) throw error;
        if (kind === 'expense') {
          const materialKey = expenseMaterialKey(command);
          const recorded = current.expenses.find((expense) => (
            expense.expenseId === command.expenseId || expense.operationId === command.operationId
          ));
          if (recorded) {
            if (!expenseMatchesCommand(recorded, command)) {
              removePendingExpenseSubmission(materialKey);
              const mismatch = storageError('idempotency_mismatch');
              render(model('error', {
                ...current, submitting: false, message: safeMessage(mismatch.code), focusStatus: true,
              }));
              throw mismatch;
            }
            removePendingExpenseSubmission(materialKey);
            render(model(current.session ? 'open-session' : current.state, {
              ...current, submitting: false, message: MESSAGES.expense, focusStatus: true,
            }));
            return Object.freeze({ status: 'duplicate-safe', expense: recorded });
          }
          if (
            error?.code === 'version_conflict'
            && pendingExpenseSubmissions.get(materialKey)?.command === command
            && current.session?.cashSessionId === command.cashSessionId
          ) {
            pendingExpenseSubmissions.set(materialKey, Object.freeze({
              ...pendingExpenseSubmissions.get(materialKey),
              command: Object.freeze({ ...command, expectedVersion: current.session.version }),
              outcome: 'pending',
            }));
            persistPendingExpenseSubmissions();
          } else if (expenseReconciled && current.session?.cashSessionId === command.cashSessionId) {
            pendingExpenseSubmissions.set(materialKey, Object.freeze({
              ...pendingExpenseSubmissions.get(materialKey),
              outcome: 'absent',
            }));
            persistPendingExpenseSubmissions();
          }
        }
        throw error;
      })
      .finally(() => {
        if (activeSubmission === submission) activeSubmission = null;
      });
    submission.promise = operation;
    activeSubmission = submission;
    return operation;
  }

  function setConfirmOpen(value) {
    return render(model(current.state, { ...current, confirmOpen: value === true }));
  }

  function resetExpenseSubmission() {
    if (activeSubmission) return;
    pendingExpenseSubmissions.clear();
    persistPendingExpenseSubmissions();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation += 1;
    activeSubmission = null;
    unsubscribe();
    clearOperationalReferences();
    lastAuthState = null;
    view.destroy?.();
  }

  render(current);
  if (contract?.enabled) {
    view.bind?.({ submit, reload, resetExpenseSubmission, setConfirmOpen });
    unsubscribe = subscribeAuth((state) => { void handleAuth(state); });
  }
  return Object.freeze({
    destroy, getState: () => current, rebindWorkspace, reload,
    resetExpenseSubmission, submit, setConfirmOpen,
  });
}

function setHidden(element, hidden) { if (element) element.hidden = hidden; }
function text(element, value) { if (element) element.textContent = value; }
function dateTime(value) {
  try { return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return 'Waktu tidak tersedia'; }
}

export function createCashManagementView(root, documentRef = root?.ownerDocument) {
  if (!root || !documentRef) throw storageError('data_invalid');
  const listeners = [];
  const status = root.querySelector('[data-cash-status]');
  const expenseList = root.querySelector('[data-expense-list]');
  const closeDialog = root.querySelector('#close-session-dialog');
  const closeForm = root.querySelector('[data-close-form]');
  let dialogTrigger = null;
  let expectedCashMinor = 0;
  const add = (element, type, listener) => {
    element?.addEventListener(type, listener);
    listeners.push([element, type, listener]);
  };

  function fillSummary(container, session, summary) {
    if (!container || !session) return;
    const closed = session.status === 'closed';
    const values = closed ? session.closingSummary : summary;
    const rows = [
      ['Waktu dibuka', dateTime(session.openedAtLocal)],
      ['Saldo awal', formatMoney(session.openingCashMinor)],
      ['Penjualan tunai', formatMoney(values?.cashSalesMinor || 0)],
      ['Total pengeluaran', formatMoney(values?.expenseOutMinor || 0)],
      ['Kas yang diharapkan', formatMoney(values?.expectedCashMinor || 0)],
      ...(closed ? [
        ['Kas yang dihitung', formatMoney(values.countedCashMinor)],
        ['Selisih', formatMoney(values.differenceMinor)],
        ['Waktu ditutup', dateTime(session.closedAtLocal)],
      ] : []),
      ['Status', closed ? 'Closed' : 'Open'],
    ];
    container.replaceChildren();
    rows.forEach(([label, value]) => {
      const group = documentRef.createElement('div');
      const dt = documentRef.createElement('dt');
      const dd = documentRef.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      group.append(dt, dd);
      container.append(group);
    });
  }

  function renderExpenses(modelValue) {
    expenseList?.replaceChildren();
    modelValue.expenses.forEach((expense) => {
      const item = documentRef.createElement('li');
      const heading = documentRef.createElement('strong');
      const amount = documentRef.createElement('span');
      const meta = documentRef.createElement('span');
      heading.textContent = EXPENSE_CATEGORY_LABELS[expense.category] || 'Kategori tercatat';
      amount.textContent = formatMoney(expense.amountMinor);
      meta.textContent = `${dateTime(expense.recordedAtLocal)} • Recorded`;
      item.append(heading, amount, meta);
      if (expense.note) {
        const note = documentRef.createElement('p');
        note.textContent = expense.note;
        item.append(note);
      }
      expenseList.append(item);
    });
  }

  function render(modelValue) {
    root.dataset.cashState = modelValue.state;
    root.setAttribute('aria-busy', String(['auth-loading', 'loading', 'submitting'].includes(modelValue.state)));
    text(status, modelValue.message);
    if (modelValue.focusStatus) status?.focus?.({ preventScroll: true });
    setHidden(root.querySelector('[data-disabled]'), modelValue.state !== 'disabled');
    setHidden(root.querySelector('[data-signed-out]'), modelValue.state !== 'signed-out');
    setHidden(root.querySelector('[data-loading]'), !['auth-loading', 'loading'].includes(modelValue.state));
    setHidden(root.querySelector('[data-access-error]'), !['permission-denied', 'error'].includes(modelValue.state));
    setHidden(root.querySelector('[data-no-session]'), !!modelValue.session || ![
      'no-open-session', 'closed-session', 'version-conflict',
    ].includes(modelValue.state));
    setHidden(root.querySelector('[data-open-session]'), !modelValue.session);
    setHidden(root.querySelector('[data-last-session]'), !modelValue.lastClosedSession);
    setHidden(root.querySelector('[data-expense-form-wrap]'), !modelValue.session || !modelValue.canExpense);
    setHidden(root.querySelector('[data-expense-readonly]'), !modelValue.session || modelValue.canExpense);
    setHidden(root.querySelector('[data-close-wrap]'), !modelValue.session || !modelValue.canClose);
    root.querySelectorAll('fieldset').forEach((field) => { field.disabled = modelValue.submitting; });
    fillSummary(root.querySelector('[data-open-summary]'), modelValue.session, modelValue.summary);
    fillSummary(root.querySelector('[data-last-summary]'), modelValue.lastClosedSession, null);
    text(root.querySelector('[data-expense-count]'), String(modelValue.expenses.length));
    text(root.querySelector('[data-expected-cash]'), formatMoney(modelValue.summary?.expectedCashMinor || 0));
    renderExpenses(modelValue);
    if (modelValue.confirmOpen && closeDialog && !closeDialog.open) closeDialog.showModal?.();
    if (!modelValue.confirmOpen && closeDialog?.open) closeDialog.close?.();
  }

  function bind(callbacks) {
    const openForm = root.querySelector('[data-open-form]');
    const expenseForm = root.querySelector('[data-expense-form]');
    add(openForm, 'submit', (event) => {
      event.preventDefault();
      void callbacks.submit('open', { openingCash: openForm.elements.openingCash.value })
        .then(() => openForm.reset()).catch(() => {});
    });
    add(expenseForm, 'submit', (event) => {
      event.preventDefault();
      void callbacks.submit('expense', {
        category: expenseForm.elements.category.value,
        amount: expenseForm.elements.amount.value,
        note: expenseForm.elements.note.value,
      }).then(() => expenseForm.reset()).catch(() => {});
    });
    add(expenseForm?.querySelector('[data-reset-expense]'), 'click', () => {
      callbacks.resetExpenseSubmission();
      expenseForm.reset();
    });
    add(root.querySelector('[data-open-close-dialog]'), 'click', (event) => {
      dialogTrigger = event.currentTarget;
      callbacks.setConfirmOpen(true);
      closeForm?.elements?.countedCash?.focus?.();
    });
    add(closeForm, 'input', () => {
      let preview = 'Masukkan kas yang dihitung.';
      try {
        const counted = normalizeCashInput(closeForm.elements.countedCash.value);
        const difference = expectedCashMinor >= 0
          ? subtractMoney(counted, expectedCashMinor)
          : addMoney(counted, -expectedCashMinor);
        preview = formatMoney(difference);
      } catch {}
      text(root.querySelector('[data-difference-preview]'), preview);
    });
    add(closeForm, 'submit', (event) => {
      event.preventDefault();
      void callbacks.submit('close', { countedCash: closeForm.elements.countedCash.value })
        .then(() => { callbacks.setConfirmOpen(false); closeForm.reset(); }).catch(() => {});
    });
    const close = () => {
      callbacks.setConfirmOpen(false);
      dialogTrigger?.focus?.();
    };
    add(closeDialog, 'cancel', (event) => { event.preventDefault(); close(); });
    add(closeDialog?.querySelector('[data-cancel-close]'), 'click', close);
  }

  return Object.freeze({
    bind,
    render(modelValue) {
      expectedCashMinor = modelValue.summary?.expectedCashMinor || 0;
      render(modelValue);
    },
    destroy() {
      listeners.splice(0).forEach(([element, type, listener]) => element?.removeEventListener(type, listener));
      closeDialog?.close?.();
    },
  });
}

export function initCashManagementPage({
  documentRef = document,
  mandiriState = getMandiriFeatureState(),
  nusakasirState = getNusaKasirFeatureState(),
  ...dependencies
} = {}) {
  const root = documentRef.querySelector('[data-cash-root]');
  if (!root) throw storageError('data_invalid');
  return createCashManagementController({
    contract: getNusaKasirFeatureContract({ mandiriState, nusakasirState }),
    view: createCashManagementView(root, documentRef),
    ...dependencies,
  });
}

if (typeof document !== 'undefined') {
  const boot = () => { initCashManagementPage(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
