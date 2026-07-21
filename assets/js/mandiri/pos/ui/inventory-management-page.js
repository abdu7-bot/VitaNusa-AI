import { getMandiriFeatureState } from '../../config/feature-flags.js';
import { createEntityId, createOperationId } from '../../domain/ids.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import { createLocalScopesFromUser } from '../../services/account-scope.js';
import { openMandiriDatabase } from '../../storage/database.js';
import { getSafeStorageMessage, storageError } from '../../storage/storage-errors.js';
import { subscribeUserAuth } from '../../../modules/user-auth.js';
import { getNusaKasirFeatureContract, getNusaKasirFeatureState } from '../config/nusakasir-flags.js';
import { createStockMovementId, MANUAL_STOCK_MOVEMENT_TYPES } from '../domain/inventory.js';
import { createRepositoryContext } from '../../repositories/repository-context.js';
import { createInventoryService } from '../services/inventory-service.js';

export const INVENTORY_PAGE_STATES = Object.freeze([
  'disabled', 'auth-loading', 'signed-out', 'loading', 'empty', 'ready', 'error',
]);

const MOVEMENT_TYPE_LABELS = Object.freeze({
  opening_stock: 'Stok awal',
  purchase_in: 'Pembelian',
  adjustment: 'Penyesuaian',
});

const SAFE_UI_MESSAGES = Object.freeze({
  disabled: 'NusaKasir belum tersedia pada build ini.',
  'auth-loading': 'Memeriksa sesi akun VitaNusa.',
  'signed-out': 'Login diperlukan melalui halaman akun sebelum membuka data NusaKasir lokal.',
  loading: 'Memuat data stok lokal.',
  empty: 'Belum ada produk dengan pelacakan stok pada workspace ini.',
  ready: 'Data stok lokal siap dikelola.',
  permission_denied: 'Role workspace aktif hanya dapat melihat data stok.',
  stock_tracking_disabled: 'Produk ini tidak mengaktifkan pelacakan stok.',
  version_conflict: 'Data telah berubah. Daftar dimuat ulang; periksa data terbaru sebelum mencoba lagi.',
  invalid_reference: 'Produk tidak lagi tersedia. Daftar telah dimuat ulang.',
  success_movement: 'Pergerakan stok berhasil dicatat secara lokal.',
  storage_error: 'Data lokal belum dapat diproses. Tidak ada perubahan parsial yang disimpan.',
});

function safeMessage(code) {
  return SAFE_UI_MESSAGES[code] || getSafeStorageMessage(code) || SAFE_UI_MESSAGES.storage_error;
}

function actorFromMembership(membership) {
  return Object.freeze({
    accountScope: membership.accountScope,
    workspaceId: membership.workspaceId,
    userScope: membership.userScope,
    role: membership.role,
    status: membership.status,
  });
}

export function filterInventoryItems(items, { query = '', categoryId = 'all', active = 'all', balance = 'all' } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase('id-ID');
  return Object.freeze(items.filter((item) => {
    const searchable = `${item.name}\n${item.sku || ''}`.toLocaleLowerCase('id-ID');
    const quantity = item.quantityOnHand ?? 0;
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (categoryId === 'all' || item.categoryId === categoryId)
      && (active === 'all' || item.active === (active === 'active'))
      && (balance === 'all'
        || (balance === 'positive' && quantity > 0)
        || (balance === 'zero' && quantity === 0)
        || (balance === 'negative' && quantity < 0));
  }));
}

export function normalizeMovementForm(input, { workspaceId, productId, actorScope, actorRole, cryptoRef } = {}) {
  const type = String(input?.movementType || '');
  if (!MANUAL_STOCK_MOVEMENT_TYPES.includes(type)) {
    throw storageError('data_invalid');
  }
  const rawQty = String(input?.quantity || '').trim();
  const qty = Number(rawQty);
  if (!rawQty || !Number.isSafeInteger(qty) || qty === 0 || String(qty) !== rawQty) {
    throw storageError('data_invalid');
  }
  if (type !== 'adjustment' && qty < 1) throw storageError('data_invalid');
  const reason = type === 'adjustment'
    ? String(input?.reason || '').trim() || null
    : null;
  if (type === 'adjustment' && !reason) throw storageError('data_invalid');
  return Object.freeze({
    movementType: type,
    quantityDelta: qty,
    reason,
    workspaceId,
    productId,
    actorScope,
    actorRole,
    movementId: createStockMovementId(cryptoRef),
    operationId: createOperationId(cryptoRef),
    sourceReference: 'manual-ui',
  });
}

function inventoryPageModel(state, values = {}) {
  const products = Object.freeze([...(values.products || [])]);
  const balances = Object.freeze([...(values.balances || [])]);
  const categories = Object.freeze([...(values.categories || [])]);
  const movements = Object.freeze([...(values.movements || [])]);
  const filters = Object.freeze({
    query: values.filters?.query || '',
    categoryId: values.filters?.categoryId || 'all',
    active: values.filters?.active || 'all',
    balance: values.filters?.balance || 'all',
  });

  const balanceMap = new Map(balances.map((b) => [b.productId, b]));
  const categoryMap = new Map(categories.map((c) => [c.categoryId, c.name]));
  const items = products
    .filter((p) => p.stockTracking)
    .map((p) => {
      const bal = balanceMap.get(p.productId);
      return {
        ...p,
        quantityOnHand: bal?.quantityOnHand ?? 0,
        balanceVersion: bal?.version ?? 0,
        categoryName: categoryMap.get(p.categoryId) || null,
      };
    });

  return Object.freeze({
    state,
    message: values.message || SAFE_UI_MESSAGES[state] || SAFE_UI_MESSAGES.storage_error,
    items,
    visibleItems: filterInventoryItems(items, filters),
    filters,
    categories,
    movements,
    selectedProductId: values.selectedProductId || null,
    canWrite: values.canWrite === true,
    submitting: values.submitting === true,
    modalOpen: values.modalOpen === true,
    focusStatus: values.focusStatus === true,
  });
}

export function createInventoryManagementController({
  contract,
  view,
  subscribeAuth = subscribeUserAuth,
  createScopes = createLocalScopesFromUser,
  openDatabase = openMandiriDatabase,
  createContext = createRepositoryContext,
  createService = createInventoryService,
  now = () => new Date().toISOString(),
  cryptoRef = globalThis.crypto,
} = {}) {
  if (!view || typeof view.render !== 'function') throw storageError('data_invalid');
  let model = inventoryPageModel(contract?.enabled ? 'auth-loading' : 'disabled');
  let unsubscribe = () => {};
  let connection = null;
  let context = null;
  let service = null;
  let scopes = null;
  let workspace = null;
  let membership = null;
  let generation = 0;
  let submitPromise = null;
  let destroyed = false;

  const render = (next) => {
    model = next;
    view.render(next);
    return next;
  };

  async function readAll() {
    if (!context || !scopes || !workspace) throw storageError('data_invalid');
    return context.run(['categories', 'products', 'inventoryBalances'], 'readonly', async (repositories) => {
      const [categories, products, balances] = await Promise.all([
        repositories.categoryRepository.list(scopes.accountScope, workspace.workspaceId),
        repositories.productRepository.list(scopes.accountScope, workspace.workspaceId),
        repositories.inventoryRepository.listBalances(scopes.accountScope, workspace.workspaceId),
      ]);
      return { categories, products, balances };
    });
  }

  async function readMovements(productId) {
    if (!context || !scopes || !workspace) return [];
    return context.run(['stockMovements'], 'readonly', async (repositories) =>
      repositories.inventoryRepository.listMovements(scopes.accountScope, workspace.workspaceId, productId));
  }

  async function reload({ message, focusStatus = false } = {}) {
    const records = await readAll();
    const trackedCount = records.products.filter((p) => p.stockTracking).length;
    const state = trackedCount ? 'ready' : 'empty';
    let movements = model.movements;
    if (model.selectedProductId) {
      movements = await readMovements(model.selectedProductId);
    }
    return render(inventoryPageModel(state, {
      ...records,
      movements,
      canWrite: membership?.role === 'merchant_owner',
      filters: model.filters,
      selectedProductId: model.selectedProductId,
      modalOpen: model.modalOpen,
      message: message || SAFE_UI_MESSAGES[state],
      focusStatus,
    }));
  }

  async function selectProduct(productId) {
    if (!productId) {
      return render(inventoryPageModel(model.state, { ...model, selectedProductId: null, movements: [] }));
    }
    const movements = await readMovements(productId);
    return render(inventoryPageModel(model.state, { ...model, selectedProductId: productId, movements }));
  }

  async function handleAuth(authState) {
    const current = ++generation;
    let nextConnection = null;
    connection?.close?.();
    connection = null;
    context = null;
    service = null;
    scopes = null;
    workspace = null;
    membership = null;
    if (!authState?.isAuthenticated || !authState.user) {
      render(inventoryPageModel('signed-out'));
      return;
    }
    render(inventoryPageModel('loading'));
    try {
      const nextScopes = await createScopes(authState.user);
      nextConnection = await openDatabase();
      if (destroyed || current !== generation) return nextConnection.close?.();
      const nextContext = createContext(nextConnection);
      const access = await nextContext.run(['workspaces', 'memberships'], 'readonly', async (repositories) => {
        const workspaces = await repositories.workspaceRepository.listByStatus(
          nextScopes.accountScope, 'active',
        );
        if (workspaces.length !== 1) throw storageError('record_not_found');
        const selected = workspaces[0];
        const member = await repositories.membershipRepository.getByUserScope(
          nextScopes.accountScope, selected.workspaceId, nextScopes.userScope,
        );
        return { workspace: selected, membership: member };
      });
      if (!access.membership || !canPerformWorkspaceAction(
        actorFromMembership(access.membership),
        'inventory.read',
        { accountScope: nextScopes.accountScope, workspaceId: access.workspace.workspaceId },
      )) throw storageError('permission_denied');
      if (destroyed || current !== generation) return nextConnection.close?.();
      connection = nextConnection;
      nextConnection = null;
      context = nextContext;
      service = createService({ repositoryContext: nextContext });
      scopes = nextScopes;
      workspace = access.workspace;
      membership = access.membership;
      await reload();
    } catch (error) {
      nextConnection?.close?.();
      if (destroyed || current !== generation) return;
      connection?.close?.();
      connection = null;
      render(inventoryPageModel('error', { message: safeMessage(error?.code), focusStatus: true }));
    }
  }

  function updateFilters(filters) {
    return render(inventoryPageModel(model.state, { ...model, filters: { ...model.filters, ...filters } }));
  }

  function openModal() {
    return render(inventoryPageModel(model.state, { ...model, modalOpen: true }));
  }

  function closeModal() {
    return render(inventoryPageModel(model.state, { ...model, modalOpen: false }));
  }

  function recordMovement(productId, input) {
    if (!contract?.enabled) return Promise.reject(storageError('permission_denied'));
    if (submitPromise) return submitPromise;
    if (!membership || !service || membership.role !== 'merchant_owner') {
      const error = storageError('permission_denied');
      render(inventoryPageModel('error', { ...model, message: safeMessage(error.code), focusStatus: true }));
      return Promise.reject(error);
    }
    let movementInput;
    let currentBalance;
    try {
      movementInput = normalizeMovementForm(input, {
        workspaceId: workspace.workspaceId,
        productId,
        actorScope: scopes.userScope,
        actorRole: membership.role,
        cryptoRef,
      });
      currentBalance = model.items.find((item) => item.productId === productId);
    } catch (error) {
      render(inventoryPageModel(model.state, {
        ...model, message: safeMessage(error?.code), focusStatus: true,
      }));
      return Promise.reject(error);
    }

    const expectedVersion = currentBalance?.balanceVersion ?? 0;
    const command = Object.freeze({
      schemaVersion: 1,
      accountScope: scopes.accountScope,
      workspaceId: workspace.workspaceId,
      actorScope: scopes.userScope,
      actorRole: membership.role,
      expectedVersion,
      movement: Object.freeze({
        schemaVersion: 1,
        movementId: movementInput.movementId,
        workspaceId: workspace.workspaceId,
        productId: movementInput.productId,
        movementType: movementInput.movementType,
        quantityDelta: movementInput.quantityDelta,
        reason: movementInput.reason,
        actorScope: scopes.userScope,
        actorRole: membership.role,
        sourceReference: movementInput.sourceReference,
        operationId: movementInput.operationId,
        createdAtLocal: now(),
      }),
      eventId: createEntityId('audit', cryptoRef),
    });

    render(inventoryPageModel(model.state, { ...model, submitting: true, modalOpen: false }));
    const operation = service.recordMovement(command)
      .then(async () => {
        await reload({ message: SAFE_UI_MESSAGES.success_movement });
      })
      .catch(async (error) => {
        if (['version_conflict', 'invalid_reference'].includes(error?.code)) {
          await reload({ message: safeMessage(error.code), focusStatus: true });
        } else {
          render(inventoryPageModel('error', { ...model, message: safeMessage(error?.code), focusStatus: true }));
        }
        throw error;
      })
      .finally(() => { if (submitPromise === operation) submitPromise = null; });
    submitPromise = operation;
    return operation;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation += 1;
    unsubscribe();
    connection?.close?.();
    view.destroy?.();
  }

  render(model);
  if (contract?.enabled) {
    view.bind?.({ recordMovement, selectProduct, updateFilters, reload, openModal, closeModal });
    unsubscribe = subscribeAuth((state) => { void handleAuth(state); });
  }
  return Object.freeze({
    destroy,
    getState: () => model,
    reload,
    recordMovement,
    selectProduct,
    updateFilters,
    openModal,
    closeModal,
  });
}

function setHidden(element, hidden) { if (element) element.hidden = hidden; }
function setText(element, value) { if (element) element.textContent = value; }

export function createInventoryManagementView(root, documentRef = root?.ownerDocument) {
  if (!root || !documentRef) throw storageError('data_invalid');
  const statusEl = root.querySelector('.inventory-status');
  const listContainer = root.querySelector('.inventory-list-container');
  const detailContainer = root.querySelector('.inventory-detail-container');
  const modalOverlay = root.querySelector('#movement-modal-overlay');
  const movementForm = root.querySelector('#movement-form');
  const adjustmentOnlyGroup = movementForm?.querySelector('.adjustment-only');
  const listeners = [];

  function add(element, type, listener) {
    element?.addEventListener(type, listener);
    listeners.push([element, type, listener]);
  }

  function formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return iso; }
  }

  function renderList(model) {
    listContainer?.replaceChildren();
    if (!listContainer) return;
    if (['auth-loading', 'loading'].includes(model.state)) {
      const ph = documentRef.createElement('div');
      ph.className = 'loading-placeholder';
      ph.textContent = 'Memuat data stok...';
      listContainer.append(ph);
      return;
    }
    if (model.state === 'disabled') {
      const ph = documentRef.createElement('div');
      ph.className = 'loading-placeholder';
      ph.textContent = SAFE_UI_MESSAGES.disabled;
      listContainer.append(ph);
      return;
    }
    if (model.state === 'signed-out') {
      const ph = documentRef.createElement('div');
      ph.className = 'loading-placeholder';
      ph.textContent = SAFE_UI_MESSAGES['signed-out'];
      listContainer.append(ph);
      return;
    }
    if (!model.visibleItems.length) {
      const empty = documentRef.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = model.items.length ? 'Tidak ada produk yang cocok dengan filter.' : SAFE_UI_MESSAGES.empty;
      listContainer.append(empty);
      return;
    }
    model.visibleItems.forEach((item) => {
      const row = documentRef.createElement('div');
      row.className = 'inventory-item' + (item.productId === model.selectedProductId ? ' is-selected' : '');
      row.dataset.inventoryProductId = item.productId;
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-pressed', String(item.productId === model.selectedProductId));

      const nameEl = documentRef.createElement('span');
      nameEl.className = 'inventory-item-name';
      nameEl.textContent = item.name;

      const metaEl = documentRef.createElement('span');
      metaEl.className = 'inventory-item-meta';
      metaEl.textContent = [
        item.sku ? `SKU ${item.sku}` : null,
        item.categoryName,
      ].filter(Boolean).join(' • ') || '—';

      const qty = item.quantityOnHand;
      const balanceEl = documentRef.createElement('span');
      balanceEl.className = 'inventory-item-balance';
      balanceEl.dataset.balance = qty > 0 ? 'positive' : qty < 0 ? 'negative' : 'zero';
      balanceEl.textContent = String(qty);
      balanceEl.setAttribute('aria-label', `Stok: ${qty}`);

      row.append(nameEl, metaEl, balanceEl);

      if (model.canWrite && item.productId === model.selectedProductId) {
        const addBtn = documentRef.createElement('button');
        addBtn.className = 'inventory-item-btn';
        addBtn.type = 'button';
        addBtn.textContent = 'Tambah pergerakan';
        addBtn.dataset.inventoryAction = 'open-modal';
        addBtn.dataset.inventoryProductId = item.productId;
        addBtn.disabled = model.submitting;
        row.append(addBtn);
      }

      listContainer.append(row);
    });
  }

  function renderDetail(model) {
    if (!detailContainer) return;
    detailContainer.replaceChildren();
    const selected = model.selectedProductId
      ? model.items.find((item) => item.productId === model.selectedProductId)
      : null;
    if (!selected) {
      const ph = documentRef.createElement('div');
      ph.className = 'no-selection';
      ph.textContent = 'Pilih produk dari daftar untuk melihat detail dan riwayat stok.';
      detailContainer.append(ph);
      return;
    }

    const qty = selected.quantityOnHand;
    const header = documentRef.createElement('div');
    header.className = 'detail-header';
    const title = documentRef.createElement('h3');
    title.className = 'detail-title';
    title.textContent = selected.name;
    header.append(title);

    const strip = documentRef.createElement('dl');
    strip.className = 'detail-balance-strip';
    const qtyDt = documentRef.createElement('div');
    qtyDt.className = 'balance-stat';
    const dtLabel = documentRef.createElement('dt');
    dtLabel.textContent = 'Stok saat ini';
    const ddValue = documentRef.createElement('dd');
    ddValue.textContent = String(qty);
    ddValue.dataset.balance = qty > 0 ? 'positive' : qty < 0 ? 'negative' : 'zero';
    qtyDt.append(dtLabel, ddValue);
    strip.append(qtyDt);

    const heading = documentRef.createElement('h4');
    heading.className = 'movement-history-heading';
    heading.textContent = 'Riwayat pergerakan';

    const movList = documentRef.createElement('ul');
    movList.className = 'movement-list';
    movList.setAttribute('aria-label', 'Riwayat pergerakan stok');

    if (!model.movements.length) {
      const emptyEl = documentRef.createElement('p');
      emptyEl.className = 'movement-empty';
      emptyEl.textContent = 'Belum ada pergerakan stok untuk produk ini.';
      detailContainer.append(header, strip, heading, emptyEl);
      return;
    }

    const sorted = [...model.movements].sort((a, b) =>
      (b.createdAtLocal || '').localeCompare(a.createdAtLocal || ''));
    sorted.forEach((movement) => {
      const li = documentRef.createElement('li');
      li.className = 'movement-list-item';

      const typeEl = documentRef.createElement('span');
      typeEl.className = 'movement-type';
      typeEl.textContent = MOVEMENT_TYPE_LABELS[movement.movementType] || movement.movementType;

      const deltaEl = documentRef.createElement('span');
      deltaEl.className = 'movement-delta';
      deltaEl.dataset.sign = movement.quantityDelta > 0 ? 'positive' : 'negative';
      deltaEl.textContent = movement.quantityDelta > 0
        ? `+${movement.quantityDelta}`
        : String(movement.quantityDelta);

      const dateEl = documentRef.createElement('span');
      dateEl.className = 'movement-date';
      dateEl.textContent = formatDate(movement.createdAtLocal);

      li.append(typeEl, deltaEl, dateEl);

      if (movement.reason) {
        const reasonEl = documentRef.createElement('span');
        reasonEl.className = 'movement-reason';
        reasonEl.textContent = movement.reason;
        li.append(reasonEl);
      }

      movList.append(li);
    });

    detailContainer.append(header, strip, heading, movList);
  }

  function renderModal(model) {
    if (!modalOverlay) return;
    modalOverlay.hidden = !model.modalOpen;
    if (movementForm) {
      movementForm.dataset.productId = model.selectedProductId || '';
      if (model.modalOpen) {
        movementForm.reset?.();
        setHidden(adjustmentOnlyGroup, true);
      }
    }
  }

  function render(model) {
    if (statusEl) {
      setText(statusEl, model.message);
      statusEl.setAttribute('aria-busy', String(['auth-loading', 'loading'].includes(model.state)));
      if (model.focusStatus) statusEl.focus?.({ preventScroll: true });
    }
    renderList(model);
    renderDetail(model);
    renderModal(model);
  }

  function bind(callbacks) {
    add(root, 'click', (event) => {
      const target = event.target?.closest?.('[data-inventory-action], [data-inventory-product-id]:not([data-inventory-action])');
      if (!target) return;
      const action = target.dataset.inventoryAction;
      const productId = target.dataset.inventoryProductId;
      if (action === 'open-modal') {
        callbacks.openModal();
        return;
      }
      if (productId && !action) {
        void callbacks.selectProduct(productId).catch(() => {});
      }
    });

    add(root, 'keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target?.closest?.('[data-inventory-product-id][role="button"]');
      if (!target) return;
      event.preventDefault();
      void callbacks.selectProduct(target.dataset.inventoryProductId).catch(() => {});
    });

    add(modalOverlay, 'click', (event) => {
      if (event.target === modalOverlay) callbacks.closeModal();
    });
    const closeBtn = modalOverlay?.querySelector('.modal-close');
    const cancelBtn = modalOverlay?.querySelector('#modal-cancel');
    add(closeBtn, 'click', () => callbacks.closeModal());
    add(cancelBtn, 'click', () => callbacks.closeModal());

    add(movementForm, 'change', (event) => {
      if (event.target?.name !== 'movement-type') return;
      setHidden(adjustmentOnlyGroup, event.target.value !== 'adjustment');
    });

    add(movementForm, 'submit', (event) => {
      event.preventDefault();
      const els = movementForm.elements;
      const typeInput = [...(els['movement-type'] || [])].find((r) => r.checked);
      const selectedProductId = movementForm.dataset.productId;
      if (!selectedProductId || !typeInput) return;
      void callbacks.recordMovement(selectedProductId, {
        movementType: typeInput.value,
        quantity: els.quantity?.value || '',
        reason: els.reason?.value || '',
      }).catch(() => {});
    });

    const search = root.querySelector('#search-input');
    const categoryFilter = root.querySelector('#category-filter');
    const statusFilter = root.querySelector('#status-filter');
    const balanceFilter = root.querySelector('#balance-filter');
    const filter = () => callbacks.updateFilters({
      query: search?.value || '',
      categoryId: categoryFilter?.value || 'all',
      active: statusFilter?.value || 'all',
      balance: balanceFilter?.value || 'all',
    });
    add(search, 'input', filter);
    add(categoryFilter, 'change', filter);
    add(statusFilter, 'change', filter);
    add(balanceFilter, 'change', filter);
  }

  return Object.freeze({
    bind,
    render,
    destroy() {
      listeners.splice(0).forEach(([element, type, listener]) => element?.removeEventListener(type, listener));
    },
  });
}

export function initInventoryManagementPage({
  documentRef = document,
  mandiriState = getMandiriFeatureState(),
  nusakasirState = getNusaKasirFeatureState(),
  ...dependencies
} = {}) {
  const root = documentRef.querySelector('#root');
  if (!root) throw storageError('data_invalid');
  return createInventoryManagementController({
    contract: getNusaKasirFeatureContract({ mandiriState, nusakasirState }),
    view: createInventoryManagementView(root, documentRef),
    ...dependencies,
  });
}

if (typeof document !== 'undefined') {
  const boot = () => { initInventoryManagementPage(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
