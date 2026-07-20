import { getMandiriFeatureState } from '../../config/feature-flags.js';
import { createEntityId, createOperationId } from '../../domain/ids.js';
import { canPerformWorkspaceAction } from '../../domain/permissions.js';
import { formatMoney, parseControlledMoneyInput } from '../../domain/money.js';
import { createLocalScopesFromUser } from '../../services/account-scope.js';
import { openMandiriDatabase } from '../../storage/database.js';
import { getSafeStorageMessage, storageError } from '../../storage/storage-errors.js';
import { subscribeUserAuth } from '../../../modules/user-auth.js';
import { getNusaKasirFeatureContract, getNusaKasirFeatureState } from '../config/nusakasir-flags.js';
import { createCategoryId } from '../domain/category.js';
import { createProductId } from '../domain/product.js';
import { createRepositoryContext } from '../../repositories/repository-context.js';
import { createProductPersistenceService } from '../services/product-persistence-service.js';

export const PRODUCT_PAGE_STATES = Object.freeze([
  'disabled', 'auth-loading', 'signed-out', 'loading', 'empty', 'ready', 'error',
]);

const SAFE_UI_MESSAGES = Object.freeze({
  disabled: 'NusaKasir belum tersedia pada build ini.',
  'auth-loading': 'Memeriksa sesi akun VitaNusa.',
  'signed-out': 'Login diperlukan melalui halaman akun sebelum membuka data NusaKasir lokal.',
  loading: 'Memuat kategori dan produk lokal.',
  empty: 'Belum ada kategori atau produk pada workspace ini.',
  ready: 'Data kategori dan produk lokal siap dikelola.',
  permission_denied: 'Role workspace aktif hanya dapat melihat data dan tidak dapat mengubahnya.',
  duplicate_sku: 'SKU sudah digunakan oleh produk lain pada workspace ini.',
  version_conflict: 'Data telah berubah. Daftar dimuat ulang; periksa data terbaru sebelum mencoba lagi.',
  invalid_reference: 'Kategori pilihan tidak lagi tersedia. Daftar telah dimuat ulang.',
  invalid_money_input: 'Harga harus berupa rupiah bulat, misalnya 15000 atau Rp15.000.',
  success_category: 'Kategori berhasil disimpan secara lokal.',
  success_product: 'Produk berhasil disimpan secara lokal.',
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

export function filterProductRecords(products, {
  query = '', categoryId = 'all', active = 'all',
} = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase('id-ID');
  return Object.freeze(products.filter((product) => {
    const searchable = `${product.name}\n${product.sku || ''}`.toLocaleLowerCase('id-ID');
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (categoryId === 'all' || product.categoryId === categoryId)
      && (active === 'all' || product.active === (active === 'active'));
  }));
}

export function normalizeCategoryForm(input, { workspaceId, existing, cryptoRef } = {}) {
  return Object.freeze({
    version: existing ? existing.version + 1 : 1,
    categoryId: existing?.categoryId || createCategoryId(cryptoRef),
    workspaceId,
    name: input?.name,
    active: input?.active === true,
  });
}

export function normalizeProductForm(input, { workspaceId, existing, cryptoRef } = {}) {
  const purchaseValue = typeof input?.purchasePrice === 'string'
    ? input.purchasePrice.trim()
    : input?.purchasePrice;
  return Object.freeze({
    version: existing ? existing.version + 1 : 1,
    productId: existing?.productId || createProductId(cryptoRef),
    workspaceId,
    name: input?.name,
    sku: typeof input?.sku === 'string' && input.sku.trim() ? input.sku : null,
    categoryId: input?.categoryId && input.categoryId !== 'none' ? input.categoryId : null,
    sellingPriceMinor: parseControlledMoneyInput(input?.sellingPrice),
    purchasePriceMinor: purchaseValue === '' || purchaseValue === null || purchaseValue === undefined
      ? null
      : parseControlledMoneyInput(purchaseValue),
    stockTracking: input?.stockTracking === true,
    active: input?.active === true,
  });
}

function pageModel(state, values = {}) {
  const categories = Object.freeze([...(values.categories || [])]);
  const products = Object.freeze([...(values.products || [])]);
  const filters = Object.freeze({
    query: values.filters?.query || '',
    categoryId: values.filters?.categoryId || 'all',
    active: values.filters?.active || 'all',
  });
  return Object.freeze({
    state,
    message: values.message || SAFE_UI_MESSAGES[state] || SAFE_UI_MESSAGES.storage_error,
    categories,
    products,
    visibleProducts: filterProductRecords(products, filters),
    filters,
    canWrite: values.canWrite === true,
    submitting: values.submitting === true,
    editingCategory: values.editingCategory || null,
    editingProduct: values.editingProduct || null,
    focusStatus: values.focusStatus === true,
  });
}

export function createProductManagementController({
  contract,
  view,
  subscribeAuth = subscribeUserAuth,
  createScopes = createLocalScopesFromUser,
  openDatabase = openMandiriDatabase,
  createContext = createRepositoryContext,
  createPersistence = createProductPersistenceService,
  now = () => new Date().toISOString(),
  cryptoRef = globalThis.crypto,
} = {}) {
  if (!view || typeof view.render !== 'function') throw storageError('data_invalid');
  let model = pageModel(contract?.enabled ? 'auth-loading' : 'disabled');
  let unsubscribe = () => {};
  let connection = null;
  let context = null;
  let persistence = null;
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
    return context.run(['categories', 'products'], 'readonly', async (repositories) => {
      const [categories, products] = await Promise.all([
        repositories.categoryRepository.list(scopes.accountScope, workspace.workspaceId),
        repositories.productRepository.list(scopes.accountScope, workspace.workspaceId),
      ]);
      return { categories, products };
    });
  }

  async function reload({ message, focusStatus = false } = {}) {
    const records = await readAll();
    const state = records.categories.length || records.products.length ? 'ready' : 'empty';
    return render(pageModel(state, {
      ...records,
      canWrite: membership?.role === 'merchant_owner',
      filters: model.filters,
      message: message || SAFE_UI_MESSAGES[state],
      focusStatus,
    }));
  }

  async function handleAuth(authState) {
    const current = ++generation;
    let nextConnection = null;
    connection?.close?.();
    connection = null;
    context = null;
    persistence = null;
    scopes = null;
    workspace = null;
    membership = null;
    if (!authState?.isAuthenticated || !authState.user) {
      render(pageModel('signed-out'));
      return;
    }
    render(pageModel('loading'));
    try {
      const nextScopes = await createScopes(authState.user);
      nextConnection = await openDatabase();
      if (destroyed || current !== generation) return nextConnection.close?.();
      const nextContext = createContext(nextConnection);
      const access = await nextContext.run(['workspaces', 'memberships'], 'readonly', async (repositories) => {
        const workspaces = await repositories.workspaceRepository.listByStatus(
          nextScopes.accountScope,
          'active',
        );
        if (workspaces.length !== 1) throw storageError('record_not_found');
        const selected = workspaces[0];
        const member = await repositories.membershipRepository.getByUserScope(
          nextScopes.accountScope,
          selected.workspaceId,
          nextScopes.userScope,
        );
        return { workspace: selected, membership: member };
      });
      if (!access.membership || !canPerformWorkspaceAction(
        actorFromMembership(access.membership),
        'product.read',
        { accountScope: nextScopes.accountScope, workspaceId: access.workspace.workspaceId },
      )) throw storageError('permission_denied');
      if (destroyed || current !== generation) return nextConnection.close?.();
      connection = nextConnection;
      nextConnection = null;
      context = nextContext;
      persistence = createPersistence({ repositoryContext: nextContext });
      scopes = nextScopes;
      workspace = access.workspace;
      membership = access.membership;
      await reload();
    } catch (error) {
      nextConnection?.close?.();
      if (destroyed || current !== generation) return;
      connection?.close?.();
      connection = null;
      render(pageModel('error', { message: safeMessage(error?.code), focusStatus: true }));
    }
  }

  function updateFilters(filters) {
    return render(pageModel(model.state, { ...model, filters: { ...model.filters, ...filters } }));
  }

  function edit(kind, id) {
    const values = kind === 'category' ? model.categories : model.products;
    const key = kind === 'category' ? 'categoryId' : 'productId';
    const selected = values.find((value) => value[key] === id) || null;
    return render(pageModel(model.state, {
      ...model,
      editingCategory: kind === 'category' ? selected : model.editingCategory,
      editingProduct: kind === 'product' ? selected : model.editingProduct,
    }));
  }

  function cancelEdit(kind) {
    return render(pageModel(model.state, {
      ...model,
      editingCategory: kind === 'category' ? null : model.editingCategory,
      editingProduct: kind === 'product' ? null : model.editingProduct,
    }));
  }

  function submit(kind, input) {
    if (!contract?.enabled) return Promise.reject(storageError('permission_denied'));
    if (submitPromise) return submitPromise;
    if (!membership || !persistence || membership.role !== 'merchant_owner') {
      const error = storageError('permission_denied');
      render(pageModel('error', { ...model, message: safeMessage(error.code), focusStatus: true }));
      return Promise.reject(error);
    }
    let entity;
    let operationType;
    let existing;
    try {
      existing = kind === 'category' ? model.editingCategory : model.editingProduct;
      entity = kind === 'category'
        ? normalizeCategoryForm(input, { workspaceId: workspace.workspaceId, existing, cryptoRef })
        : normalizeProductForm(input, { workspaceId: workspace.workspaceId, existing, cryptoRef });
      operationType = `${kind}_${existing ? 'update' : 'create'}`;
    } catch (error) {
      render(pageModel('error', { ...model, message: safeMessage(error?.code), focusStatus: true }));
      return Promise.reject(error);
    }
    const command = Object.freeze({
      schemaVersion: 1,
      accountScope: scopes.accountScope,
      workspaceId: workspace.workspaceId,
      actorScope: scopes.userScope,
      actorRole: membership.role,
      operationId: createOperationId(cryptoRef),
      eventId: createEntityId('audit', cryptoRef),
      operationType,
      ...(existing ? { expectedVersion: existing.version } : {}),
      createdAtLocal: now(),
      entity,
    });
    render(pageModel(model.state, { ...model, submitting: true }));
    const operation = persistence.execute(command)
      .then(async (result) => {
        cancelEdit(kind);
        await reload({
          message: kind === 'category'
            ? SAFE_UI_MESSAGES.success_category
            : SAFE_UI_MESSAGES.success_product,
        });
        return result;
      })
      .catch(async (error) => {
        if (['version_conflict', 'invalid_reference'].includes(error?.code)) {
          await reload({ message: safeMessage(error.code), focusStatus: true });
        } else {
          render(pageModel('error', { ...model, message: safeMessage(error?.code), focusStatus: true }));
        }
        throw error;
      })
      .finally(() => { if (submitPromise === operation) submitPromise = null; });
    submitPromise = operation;
    return operation;
  }

  function toggle(kind, id) {
    const source = kind === 'category'
      ? model.categories.find((value) => value.categoryId === id)
      : model.products.find((value) => value.productId === id);
    if (!source) return Promise.reject(storageError('record_not_found'));
    edit(kind, id);
    return submit(kind, { ...source, active: !source.active,
      ...(kind === 'product' ? {
        sellingPrice: String(source.sellingPriceMinor),
        purchasePrice: source.purchasePriceMinor === null ? '' : String(source.purchasePriceMinor),
      } : {}),
    });
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
    view.bind?.({ submit, toggle, edit, cancelEdit, updateFilters, reload });
    unsubscribe = subscribeAuth((state) => { void handleAuth(state); });
  }
  return Object.freeze({ destroy, getState: () => model, reload, submit, toggle, edit, cancelEdit, updateFilters });
}

function setHidden(element, hidden) { if (element) element.hidden = hidden; }
function setText(element, value) { if (element) element.textContent = value; }

function option(documentRef, value, label) {
  const element = documentRef.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

function actionButton(documentRef, label, action, id) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.posAction = action;
  button.dataset.posId = id;
  return button;
}

export function createProductManagementView(root, documentRef = root?.ownerDocument) {
  if (!root || !documentRef) throw storageError('data_invalid');
  const status = root.querySelector('[data-pos-status]');
  const categoryList = root.querySelector('[data-pos-category-list]');
  const productList = root.querySelector('[data-pos-product-list]');
  const categoryForm = root.querySelector('[data-pos-category-form]');
  const productForm = root.querySelector('[data-pos-product-form]');
  const listeners = [];

  function render(model) {
    root.dataset.posState = model.state;
    root.setAttribute('aria-busy', String(['auth-loading', 'loading'].includes(model.state)));
    setText(status, model.message);
    if (model.focusStatus) status?.focus?.({ preventScroll: true });
    setHidden(root.querySelector('[data-pos-disabled]'), model.state !== 'disabled');
    setHidden(root.querySelector('[data-pos-signed-out]'), model.state !== 'signed-out');
    setHidden(root.querySelector('[data-pos-loading]'), !['auth-loading', 'loading'].includes(model.state));
    setHidden(root.querySelector('[data-pos-content]'), !['ready', 'empty', 'error'].includes(model.state));
    setHidden(root.querySelector('[data-pos-write-note]'), model.canWrite);
    setHidden(categoryForm, !model.canWrite);
    setHidden(productForm, !model.canWrite);
    root.querySelectorAll('fieldset').forEach((fieldset) => { fieldset.disabled = model.submitting; });

    const categoryFilter = root.querySelector('[data-pos-category-filter]');
    const productCategory = productForm?.elements?.categoryId;
    for (const select of [categoryFilter, productCategory]) {
      if (!select) continue;
      const selected = select === categoryFilter ? model.filters.categoryId : (model.editingProduct?.categoryId || 'none');
      select.replaceChildren(option(documentRef, select === categoryFilter ? 'all' : 'none', select === categoryFilter ? 'Semua kategori' : 'Tanpa kategori'));
      model.categories.filter((value) => value.active).forEach((value) => select.append(option(documentRef, value.categoryId, value.name)));
      select.value = selected;
    }

    categoryList?.replaceChildren();
    model.categories.forEach((category) => {
      const item = documentRef.createElement('li');
      const name = documentRef.createElement('strong');
      const state = documentRef.createElement('span');
      name.textContent = category.name;
      state.textContent = category.active ? 'Aktif' : 'Nonaktif';
      item.append(name, state);
      if (model.canWrite) item.append(
        actionButton(documentRef, 'Edit', 'edit-category', category.categoryId),
        actionButton(documentRef, category.active ? 'Nonaktifkan' : 'Aktifkan', 'toggle-category', category.categoryId),
      );
      categoryList.append(item);
    });

    productList?.replaceChildren();
    const categoryNames = new Map(model.categories.map((value) => [value.categoryId, value.name]));
    model.visibleProducts.forEach((product) => {
      const item = documentRef.createElement('li');
      const heading = documentRef.createElement('strong');
      const details = documentRef.createElement('p');
      const state = documentRef.createElement('span');
      heading.textContent = product.name;
      details.textContent = [
        product.sku ? `SKU ${product.sku}` : 'Tanpa SKU',
        categoryNames.get(product.categoryId) || 'Tanpa kategori',
        formatMoney(product.sellingPriceMinor),
      ].join(' • ');
      state.textContent = product.active ? 'Aktif' : 'Nonaktif';
      item.append(heading, details, state);
      if (model.canWrite) item.append(
        actionButton(documentRef, 'Edit', 'edit-product', product.productId),
        actionButton(documentRef, product.active ? 'Nonaktifkan' : 'Aktifkan', 'toggle-product', product.productId),
      );
      productList.append(item);
    });

    if (categoryForm) {
      categoryForm.elements.name.value = model.editingCategory?.name || '';
      categoryForm.elements.active.checked = model.editingCategory?.active ?? true;
      setText(categoryForm.querySelector('[data-pos-form-title]'), model.editingCategory ? 'Edit kategori' : 'Tambah kategori');
    }
    if (productForm) {
      const value = model.editingProduct;
      productForm.elements.name.value = value?.name || '';
      productForm.elements.sku.value = value?.sku || '';
      productForm.elements.sellingPrice.value = value ? String(value.sellingPriceMinor) : '';
      productForm.elements.purchasePrice.value = value?.purchasePriceMinor === null || !value ? '' : String(value.purchasePriceMinor);
      productForm.elements.stockTracking.checked = value?.stockTracking ?? false;
      productForm.elements.active.checked = value?.active ?? true;
      setText(productForm.querySelector('[data-pos-form-title]'), value ? 'Edit produk' : 'Tambah produk');
    }
  }

  function bind(callbacks) {
    const add = (element, type, listener) => {
      element?.addEventListener(type, listener);
      listeners.push([element, type, listener]);
    };
    add(categoryForm, 'submit', (event) => {
      event.preventDefault();
      void callbacks.submit('category', {
        name: categoryForm.elements.name.value,
        active: categoryForm.elements.active.checked,
      }).catch(() => {});
    });
    add(productForm, 'submit', (event) => {
      event.preventDefault();
      void callbacks.submit('product', {
        name: productForm.elements.name.value,
        sku: productForm.elements.sku.value,
        categoryId: productForm.elements.categoryId.value,
        sellingPrice: productForm.elements.sellingPrice.value,
        purchasePrice: productForm.elements.purchasePrice.value,
        stockTracking: productForm.elements.stockTracking.checked,
        active: productForm.elements.active.checked,
      }).catch(() => {});
    });
    add(root, 'click', (event) => {
      const target = event.target?.closest?.('[data-pos-action]');
      if (!target) return;
      const [action, kind] = target.dataset.posAction.split('-');
      if (action === 'edit') callbacks.edit(kind, target.dataset.posId);
      if (action === 'toggle') void callbacks.toggle(kind, target.dataset.posId).catch(() => {});
      if (action === 'cancel') callbacks.cancelEdit(kind);
      if (action === 'reload') void callbacks.reload().catch(() => {});
    });
    const search = root.querySelector('[data-pos-search]');
    const categoryFilter = root.querySelector('[data-pos-category-filter]');
    const activeFilter = root.querySelector('[data-pos-active-filter]');
    const filter = () => callbacks.updateFilters({
      query: search?.value || '',
      categoryId: categoryFilter?.value || 'all',
      active: activeFilter?.value || 'all',
    });
    add(search, 'input', filter);
    add(categoryFilter, 'change', filter);
    add(activeFilter, 'change', filter);
  }

  return Object.freeze({
    bind,
    render,
    destroy() { listeners.splice(0).forEach(([element, type, listener]) => element?.removeEventListener(type, listener)); },
  });
}

export function initProductManagementPage({
  documentRef = document,
  mandiriState = getMandiriFeatureState(),
  nusakasirState = getNusaKasirFeatureState(),
  ...dependencies
} = {}) {
  const root = documentRef.querySelector('[data-pos-root]');
  if (!root) throw storageError('data_invalid');
  return createProductManagementController({
    contract: getNusaKasirFeatureContract({ mandiriState, nusakasirState }),
    view: createProductManagementView(root, documentRef),
    ...dependencies,
  });
}

if (typeof document !== 'undefined') {
  const boot = () => { initProductManagementPage(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
