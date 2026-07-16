import { getVitaNusaBaseUrl } from './pwa-install.js?v=20260716-android-pwa-v1';

const AGENT_CONTROLLERS = new WeakMap();
const SAFE_CONTEXT_FIELDS = Object.freeze([
  'routeKey',
  'pageTitle',
  'pageType',
  'slug',
  'isVitaCheck',
]);
const SAFE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isAdminPath(pathname = '') {
  const normalized = `/${String(pathname).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/`;
  return /\/admin(?:\/|$)/i.test(normalized);
}

export function shouldOpenAgentFromUrl(value) {
  try {
    return new URL(value, 'https://vitanusa.example/').searchParams.get('agent') === 'open';
  } catch {
    return false;
  }
}

function normalizeSlug(value) {
  const slug = String(value || '').trim().toLowerCase().slice(0, 120);
  return SAFE_SLUG_PATTERN.test(slug) ? slug : '';
}

function getPageType(pathname) {
  const path = String(pathname || '').toLowerCase();
  if (path.includes('/articles/')) return 'article';
  if (path.includes('/products/')) return 'product';
  if (path.endsWith('/vitacheck.html')) return 'vitacheck';
  if (path.endsWith('/account.html')) return 'account';
  if (path.endsWith('/settings.html')) return 'settings';
  if (path.endsWith('/share-target.html')) return 'share-target';
  if (path.endsWith('/offline.html')) return 'offline';
  if (path.endsWith('/') || path.endsWith('/index.html')) return 'home';
  return 'public';
}

function getRouteKey(pageType) {
  const keys = {
    home: 'home',
    vitacheck: 'vitacheck',
    article: 'education',
    product: 'products',
    account: 'account',
    settings: 'settings',
    'share-target': 'share-target',
    offline: 'offline',
  };
  return keys[pageType] || 'public';
}

function getPathSlug(url, pageType) {
  const querySlug = normalizeSlug(url.searchParams.get('slug'));
  if (querySlug) return querySlug;
  if (!['article', 'product'].includes(pageType)) return '';

  const fileName = url.pathname.split('/').filter(Boolean).at(-1) || '';
  const pathSlug = normalizeSlug(fileName.replace(/\.html$/i, ''));
  return pathSlug === 'index' || pathSlug === 'detail' ? '' : pathSlug;
}

export function buildSafePageContext({ url, title = '' } = {}) {
  const pageUrl = new URL(url || 'https://vitanusa.example/');
  const pageType = getPageType(pageUrl.pathname);
  const context = {
    routeKey: getRouteKey(pageType),
    pageTitle: String(title || 'VitaNusa AI').split('|')[0].trim().slice(0, 160) || 'VitaNusa AI',
    pageType,
    isVitaCheck: pageType === 'vitacheck',
  };
  const slug = getPathSlug(pageUrl, pageType);
  if (slug) context.slug = slug;
  return context;
}

export function hasOnlySafePageContextFields(context) {
  return Object.keys(context || {}).every((key) => SAFE_CONTEXT_FIELDS.includes(key));
}

export function resolveAgentConnectionStatus({
  online = true,
  backendState = 'unknown',
} = {}) {
  if (!online || backendState === 'offline') {
    return { key: 'offline', label: 'Offline — jawaban lokal terbatas' };
  }
  if (backendState === 'online') {
    return { key: 'online', label: 'Online' };
  }
  if (backendState === 'checking') {
    return { key: 'checking', label: 'Menghubungi backend…' };
  }
  if (backendState === 'unavailable') {
    return { key: 'unavailable', label: 'Backend belum tersedia' };
  }
  return { key: 'unknown', label: 'Koneksi backend belum diperiksa' };
}

export function getOrCreateAgentSingleton(registry, key, factory) {
  if (registry.has(key)) return registry.get(key);
  const value = factory();
  registry.set(key, value);
  return value;
}

export function getAgentCloseHistoryAction({
  hasAgentState = false,
  initialShortcut = false,
} = {}) {
  if (initialShortcut) return 'replace';
  if (hasAgentState) return 'back';
  return 'replace';
}

function getBaseUrl() {
  return getVitaNusaBaseUrl(import.meta.url);
}

function ensureStyles(documentRef) {
  const baseUrl = getBaseUrl();
  const styles = [
    ['vn-android-pwa-css', 'assets/css/android-pwa.css'],
    ['vn-nusa-agent-css', 'assets/css/nusa-agent.css'],
  ];

  styles.forEach(([id, path]) => {
    if (documentRef.getElementById(id)) return;
    const link = documentRef.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = new URL(path, baseUrl).href;
    documentRef.head.append(link);
  });
}

function createIcon(documentRef, value) {
  const icon = documentRef.createElement('span');
  icon.className = 'vn-mobile-nav-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = value;
  return icon;
}

function createNavLink(documentRef, { label, icon, href, active }) {
  const link = documentRef.createElement('a');
  link.className = 'vn-mobile-nav-item';
  link.href = href;
  if (active) link.setAttribute('aria-current', 'page');
  link.append(createIcon(documentRef, icon));

  const text = documentRef.createElement('span');
  text.textContent = label;
  link.append(text);
  return link;
}

function buildMobileNavigation(documentRef, context, openAgent) {
  const existing = documentRef.querySelector('[data-vn-mobile-nav]');
  if (existing) return existing;

  const baseUrl = getBaseUrl();
  const nav = documentRef.createElement('nav');
  nav.className = 'vn-mobile-nav';
  nav.setAttribute('data-vn-mobile-nav', '');
  nav.setAttribute('aria-label', 'Navigasi utama VitaNusa');

  nav.append(createNavLink(documentRef, {
    label: 'Beranda',
    icon: '⌂',
    href: new URL('index.html', baseUrl).href,
    active: context.routeKey === 'home',
  }));
  nav.append(createNavLink(documentRef, {
    label: 'VitaCheck',
    icon: '✓',
    href: new URL('vitacheck.html', baseUrl).href,
    active: context.routeKey === 'vitacheck',
  }));

  const agentButton = documentRef.createElement('button');
  agentButton.type = 'button';
  agentButton.className = 'vn-mobile-nav-item vn-mobile-nav-agent';
  agentButton.setAttribute('data-vn-open-agent', '');
  agentButton.setAttribute('aria-label', 'Buka Nusa Agent');
  agentButton.append(createIcon(documentRef, 'N'));
  const agentLabel = documentRef.createElement('span');
  agentLabel.textContent = 'Tanya Nusa';
  agentButton.append(agentLabel);
  agentButton.addEventListener('click', () => openAgent({ trigger: agentButton }));
  nav.append(agentButton);

  nav.append(createNavLink(documentRef, {
    label: 'Akun',
    icon: '○',
    href: new URL('account.html', baseUrl).href,
    active: context.routeKey === 'account',
  }));

  documentRef.body.append(nav);
  documentRef.body.classList.add('vn-has-mobile-nav');
  return nav;
}

function appendQuickAction(documentRef, container, action) {
  const element = action.href
    ? documentRef.createElement('a')
    : documentRef.createElement('button');
  element.className = 'nusa-agent-quick-action';
  element.textContent = action.label;

  if (action.href) {
    element.href = new URL(action.href, getBaseUrl()).href;
  } else {
    element.type = 'button';
    element.dataset.nusaPrompt = action.prompt;
  }
  container.append(element);
}

function buildAgentDialog(documentRef, context) {
  const dialog = documentRef.createElement('section');
  dialog.id = 'nusaAgentDialog';
  dialog.className = 'nusa-agent';
  dialog.hidden = true;
  dialog.setAttribute('data-nusa-agent', '');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'nusaAgentTitle');

  const backdrop = documentRef.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'nusa-agent-backdrop';
  backdrop.setAttribute('data-nusa-agent-close', '');
  backdrop.setAttribute('aria-label', 'Tutup Nusa Agent');

  const panel = documentRef.createElement('div');
  panel.className = 'nusa-agent-panel';

  const header = documentRef.createElement('header');
  header.className = 'nusa-agent-header';
  const heading = documentRef.createElement('div');
  const title = documentRef.createElement('h2');
  title.id = 'nusaAgentTitle';
  title.textContent = 'Nusa Agent';
  const contextLabel = documentRef.createElement('p');
  contextLabel.className = 'nusa-agent-context';
  contextLabel.textContent = `Konteks: ${context.pageTitle}`;
  heading.append(title, contextLabel);

  const headerActions = documentRef.createElement('div');
  headerActions.className = 'nusa-agent-header-actions';
  const reset = documentRef.createElement('button');
  reset.type = 'button';
  reset.className = 'nusa-agent-reset';
  reset.textContent = 'Chat baru';
  reset.setAttribute('data-nusa-chat-reset', '');
  const close = documentRef.createElement('button');
  close.type = 'button';
  close.className = 'nusa-agent-close';
  close.textContent = '×';
  close.setAttribute('data-nusa-agent-close', '');
  close.setAttribute('aria-label', 'Tutup Nusa Agent');
  headerActions.append(reset, close);
  header.append(heading, headerActions);

  const status = documentRef.createElement('p');
  status.className = 'nusa-agent-status';
  status.setAttribute('data-nusa-agent-status', '');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Koneksi backend belum diperiksa';

  const quickActions = documentRef.createElement('div');
  quickActions.className = 'nusa-agent-quick-actions';
  quickActions.setAttribute('data-nusa-agent-quick-actions', '');
  quickActions.setAttribute('aria-label', 'Tindakan cepat Nusa Agent');
  [
    { label: 'Mulai VitaCheck', href: 'vitacheck.html' },
    { label: 'Cari artikel kebiasaan sehat', href: 'articles/' },
    { label: 'Tanya tentang tidur', prompt: 'Bagaimana merapikan kebiasaan tidur secara bertahap?' },
    { label: 'Tanya tentang pola makan', prompt: 'Bagaimana merapikan pola makan secara bertahap?' },
    { label: 'Lihat Prinsip Amanah', href: 'prinsip-amanah.html' },
  ].forEach((action) => appendQuickAction(documentRef, quickActions, action));

  const chat = documentRef.createElement('div');
  chat.className = 'nusa-agent-chat';
  chat.setAttribute('data-nusa-chat', '');
  chat.setAttribute('data-nusa-agent-chat', '');
  chat.setAttribute('aria-busy', 'false');

  const log = documentRef.createElement('div');
  log.className = 'nusa-chat-window';
  log.setAttribute('data-nusa-chat-log', '');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-relevant', 'additions');
  log.hidden = true;

  const form = documentRef.createElement('form');
  form.className = 'nusa-chat-form';
  form.setAttribute('data-nusa-chat-form', '');
  const label = documentRef.createElement('label');
  label.className = 'sr-only';
  label.htmlFor = 'nusaAgentInput';
  label.textContent = 'Tulis pertanyaan untuk Nusa Agent';
  const input = documentRef.createElement('textarea');
  input.id = 'nusaAgentInput';
  input.rows = 1;
  input.autocomplete = 'off';
  input.placeholder = 'Tulis pertanyaanmu di sini…';
  input.setAttribute('data-nusa-chat-input', '');
  input.setAttribute('aria-label', 'Tulis pertanyaan untuk Nusa Agent');
  const submit = documentRef.createElement('button');
  submit.type = 'submit';
  submit.className = 'nusa-chat-submit';
  submit.setAttribute('aria-label', 'Kirim pertanyaan');
  submit.textContent = '↑';
  form.append(label, input, submit);

  const note = documentRef.createElement('p');
  note.className = 'nusa-agent-note';
  note.textContent = 'Nusa Agent bersifat edukatif. Bukan diagnosis, resep, fatwa final, atau pengganti tenaga profesional.';

  chat.append(log, form);
  panel.append(header, status, quickActions, chat, note);
  dialog.append(backdrop, panel);
  return { dialog, panel, chat, input, quickActions, status, reset };
}

function updateConnectionStatus(statusNode, backendState, navigatorRef) {
  const status = resolveAgentConnectionStatus({
    online: navigatorRef.onLine !== false,
    backendState,
  });
  statusNode.dataset.connection = status.key;
  statusNode.textContent = status.label;
}

function cleanAgentUrl(windowRef) {
  const url = new URL(windowRef.location.href);
  url.searchParams.delete('agent');
  return `${url.pathname}${url.search}${url.hash}`;
}

function withAgentUrl(windowRef) {
  const url = new URL(windowRef.location.href);
  url.searchParams.set('agent', 'open');
  return `${url.pathname}${url.search}${url.hash}`;
}

function withoutAgentHistoryState(state) {
  const nextState = { ...(state || {}) };
  delete nextState.vnNusaAgent;
  delete nextState.vnNusaAgentInitial;
  return nextState;
}

function getFocusable(panel) {
  return [...panel.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && !element.closest('[hidden]'));
}

async function createOverlayController(documentRef, windowRef, context) {
  const ui = buildAgentDialog(documentRef, context);
  documentRef.body.append(ui.dialog);

  const [{ initNusaChat }, { initChatViewportController }] = await Promise.all([
    import('./nusa-chat.js?v=20260716-android-pwa-v1'),
    import('./chat-viewport.js?v=20260716-android-pwa-v1'),
  ]);
  const chatController = initNusaChat({
    rootElement: ui.chat,
    resetElement: ui.reset,
  });
  const viewportController = initChatViewportController({ rootElement: ui.chat });

  let isOpen = false;
  let triggerElement = null;
  let backendState = 'unknown';

  const closeVisual = ({ returnFocus = true } = {}) => {
    if (!isOpen) return;
    isOpen = false;
    ui.dialog.hidden = true;
    documentRef.body.classList.remove('nusa-agent-open');
    triggerElement?.setAttribute('aria-expanded', 'false');
    viewportController?.refresh();
    if (returnFocus && triggerElement?.isConnected) {
      triggerElement.focus({ preventScroll: true });
    }
  };

  const openVisual = ({ draft = '', trigger = null, historyMode = 'push' } = {}) => {
    if (trigger && trigger !== triggerElement) {
      triggerElement?.setAttribute('aria-expanded', 'false');
      triggerElement = trigger;
    }
    triggerElement?.setAttribute('aria-expanded', 'true');
    if (draft) chatController?.setDraft(draft, { focus: false });

    if (!isOpen) {
      isOpen = true;
      ui.dialog.hidden = false;
      documentRef.body.classList.add('nusa-agent-open');

      if (historyMode === 'push') {
        windowRef.history.pushState({
          ...withoutAgentHistoryState(windowRef.history.state),
          vnNusaAgent: true,
        }, '', withAgentUrl(windowRef));
      } else if (historyMode === 'replace') {
        windowRef.history.replaceState({
          ...withoutAgentHistoryState(windowRef.history.state),
          vnNusaAgent: true,
          vnNusaAgentInitial: true,
        }, '', withAgentUrl(windowRef));
      }
    }

    updateConnectionStatus(ui.status, backendState, windowRef.navigator);
    viewportController?.refresh();
    windowRef.requestAnimationFrame(() => ui.input.focus({ preventScroll: true }));
  };

  const requestClose = () => {
    if (!isOpen) return;
    const currentState = windowRef.history.state || {};
    const action = getAgentCloseHistoryAction({
      hasAgentState: Boolean(currentState.vnNusaAgent),
      initialShortcut: Boolean(currentState.vnNusaAgentInitial),
    });

    if (action === 'back') {
      windowRef.history.back();
      return;
    }

    windowRef.history.replaceState(
      withoutAgentHistoryState(windowRef.history.state),
      '',
      cleanAgentUrl(windowRef),
    );
    closeVisual();
  };

  ui.dialog.querySelectorAll('[data-nusa-agent-close]').forEach((button) => {
    button.addEventListener('click', requestClose);
  });

  ui.dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = getFocusable(ui.panel);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && documentRef.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && documentRef.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  ui.chat.addEventListener('nusa-chat-state', (event) => {
    backendState = event.detail?.backendState || backendState;
    ui.quickActions.hidden = Boolean(event.detail?.hasConversation);
    ui.chat.setAttribute('aria-busy', String(Boolean(event.detail?.busy)));
    updateConnectionStatus(ui.status, backendState, windowRef.navigator);
  });

  ui.quickActions.addEventListener('click', (event) => {
    const prompt = event.target instanceof windowRef.Element
      ? event.target.closest('[data-nusa-prompt]')
      : null;
    if (!prompt || !ui.quickActions.contains(prompt)) return;
    chatController?.ask(prompt.dataset.nusaPrompt || '');
    ui.input.focus({ preventScroll: true });
  });

  ui.dialog.addEventListener('click', (event) => {
    const route = event.target instanceof windowRef.Element
      ? event.target.closest('a[href]')
      : null;
    if (!route || !ui.dialog.contains(route)) return;
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || route.target === '_blank'
      || route.hasAttribute('download')
    ) return;

    event.preventDefault();
    windowRef.history.replaceState(
      withoutAgentHistoryState(windowRef.history.state),
      '',
      cleanAgentUrl(windowRef),
    );
    closeVisual({ returnFocus: false });
    windowRef.location.replace(route.href);
  });

  windowRef.addEventListener('popstate', () => {
    if (shouldOpenAgentFromUrl(windowRef.location.href)) {
      openVisual({ historyMode: 'none' });
    } else {
      closeVisual();
    }
  });
  windowRef.addEventListener('offline', () => updateConnectionStatus(ui.status, 'offline', windowRef.navigator));
  windowRef.addEventListener('online', () => {
    if (backendState === 'offline') backendState = 'unknown';
    updateConnectionStatus(ui.status, backendState, windowRef.navigator);
  });

  return {
    open: openVisual,
    close: requestClose,
    isOpen: () => isOpen,
    setDraft: (draft) => chatController?.setDraft(draft),
  };
}

async function createInlineChatController(documentRef, windowRef, chatRoot) {
  const [{ initNusaChat }, { initChatViewportController }] = await Promise.all([
    import('./nusa-chat.js?v=20260716-android-pwa-v1'),
    import('./chat-viewport.js?v=20260716-android-pwa-v1'),
  ]);
  const chatController = initNusaChat({ rootElement: chatRoot });
  initChatViewportController({ rootElement: chatRoot });
  const input = chatRoot.querySelector('[data-nusa-chat-input]');
  const status = documentRef.querySelector('[data-nusa-agent-status]');
  const quickActions = documentRef.querySelector('.nusa-prompt-grid');
  let backendState = chatController?.getState().backendState || 'unknown';

  if (status) updateConnectionStatus(status, backendState, windowRef.navigator);
  chatRoot.addEventListener('nusa-chat-state', (event) => {
    backendState = event.detail?.backendState || backendState;
    if (quickActions) quickActions.hidden = Boolean(event.detail?.hasConversation);
    if (status) updateConnectionStatus(status, backendState, windowRef.navigator);
  });
  windowRef.addEventListener('offline', () => {
    if (status) updateConnectionStatus(status, 'offline', windowRef.navigator);
  });
  windowRef.addEventListener('online', () => {
    if (backendState === 'offline') backendState = 'unknown';
    if (status) updateConnectionStatus(status, backendState, windowRef.navigator);
  });

  return {
    open({ draft = '', trigger = null } = {}) {
      if (draft) chatController?.setDraft(draft, { focus: false });
      input?.focus({ preventScroll: true });
      if (shouldOpenAgentFromUrl(windowRef.location.href)) {
        windowRef.history.replaceState(
          withoutAgentHistoryState(windowRef.history.state),
          '',
          cleanAgentUrl(windowRef),
        );
      }
    },
    close() {},
    isOpen: () => true,
    setDraft: (draft) => chatController?.setDraft(draft),
  };
}

async function createController(documentRef) {
  const windowRef = documentRef.defaultView || window;
  if (isAdminPath(windowRef.location.pathname)) return null;

  ensureStyles(documentRef);
  const context = buildSafePageContext({
    url: windowRef.location.href,
    title: documentRef.title,
  });
  const primaryChat = documentRef.querySelector('[data-nusa-chat]:not([data-nusa-agent-chat])');
  const controller = primaryChat
    ? await createInlineChatController(documentRef, windowRef, primaryChat)
    : await createOverlayController(documentRef, windowRef, context);

  buildMobileNavigation(documentRef, context, (options) => controller.open(options));

  documentRef.querySelectorAll('[data-nusa-open-agent]').forEach((button) => {
    if (!primaryChat) {
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'nusaAgentDialog');
      button.setAttribute('aria-expanded', 'false');
    }
    if (button.closest('[data-vn-mobile-nav]')) return;
    button.addEventListener('click', () => controller.open({ trigger: button }));
  });

  if (shouldOpenAgentFromUrl(windowRef.location.href)) {
    controller.open({ historyMode: primaryChat ? 'none' : 'replace' });
  }
  return controller;
}

export function initNusaAgent(documentRef = document) {
  return getOrCreateAgentSingleton(
    AGENT_CONTROLLERS,
    documentRef,
    () => createController(documentRef).catch((error) => {
      AGENT_CONTROLLERS.delete(documentRef);
      throw error;
    }),
  );
}

export async function openNusaAgent({
  documentRef = document,
  draft = '',
  trigger = null,
} = {}) {
  const controller = await initNusaAgent(documentRef);
  controller?.open({ draft, trigger });
  return controller;
}
