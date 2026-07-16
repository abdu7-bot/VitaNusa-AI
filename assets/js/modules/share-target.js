import { getVitaNusaBaseUrl } from './pwa-install.js?v=20260716-android-pwa-v1';

const SHARE_LIMITS = Object.freeze({
  title: 200,
  text: 4000,
  url: 2048,
});
const SAFE_SHARE_PROTOCOLS = new Set(['http:', 'https:']);

function readParam(params, key) {
  if (typeof params?.get === 'function') return params.get(key) || '';
  return params?.[key] || '';
}

function normalizePlainText(value, maxLength, { collapse = false } = {}) {
  const normalized = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  const safe = collapse ? normalized.replace(/\s+/g, ' ') : normalized;
  return safe.slice(0, maxLength);
}

export function normalizeSharedUrl(value) {
  const candidate = normalizePlainText(value, SHARE_LIMITS.url, { collapse: true });
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    return SAFE_SHARE_PROTOCOLS.has(url.protocol) ? url.href.slice(0, SHARE_LIMITS.url) : '';
  } catch {
    return '';
  }
}

export function normalizeShareTarget(params = {}) {
  const draft = {
    title: normalizePlainText(readParam(params, 'title'), SHARE_LIMITS.title, { collapse: true }),
    text: normalizePlainText(readParam(params, 'text'), SHARE_LIMITS.text),
    url: normalizeSharedUrl(readParam(params, 'url')),
  };
  return {
    ...draft,
    hasContent: Boolean(draft.title || draft.text || draft.url),
  };
}

export function formatShareDraft(draft = {}) {
  return [
    draft.title ? `Judul: ${draft.title}` : '',
    draft.text ? `Teks yang dibagikan:\n${draft.text}` : '',
    draft.url ? `Tautan: ${draft.url}` : '',
    '',
    'Bantu saya meninjau informasi ini secara edukatif dan amanah. Jangan memastikan isi tautan tanpa sumber yang dapat diverifikasi.',
  ].filter(Boolean).join('\n\n').slice(0, 6200);
}

export function createShareDraftState(draft) {
  let confirmed = false;
  return {
    getState: () => ({ draft, confirmed }),
    confirm() {
      confirmed = true;
      return formatShareDraft(draft);
    },
  };
}

export function setPlainText(element, value) {
  if (!element) return;
  element.textContent = String(value || '');
}

function renderDraft(documentRef, draft) {
  const fields = [
    ['[data-share-title]', draft.title, '[data-share-title-row]'],
    ['[data-share-text]', draft.text, '[data-share-text-row]'],
    ['[data-share-url]', draft.url, '[data-share-url-row]'],
  ];

  fields.forEach(([selector, value, rowSelector]) => {
    const row = documentRef.querySelector(rowSelector);
    setPlainText(documentRef.querySelector(selector), value);
    if (row) row.hidden = !value;
  });

  const empty = documentRef.querySelector('[data-share-empty]');
  if (empty) empty.hidden = draft.hasContent;
}

export async function initShareTargetPage(documentRef = document) {
  const root = documentRef.querySelector('[data-share-target-page]');
  if (!root || root.dataset.shareTargetReady === 'true') return null;
  root.dataset.shareTargetReady = 'true';

  const windowRef = documentRef.defaultView || window;
  const draft = normalizeShareTarget(new URL(windowRef.location.href).searchParams);
  const state = createShareDraftState(draft);
  const sendButton = documentRef.querySelector('[data-share-send]');
  const cancelButton = documentRef.querySelector('[data-share-cancel]');
  const status = documentRef.querySelector('[data-share-status]');

  renderDraft(documentRef, draft);
  if (sendButton) sendButton.disabled = !draft.hasContent;
  setPlainText(
    status,
    draft.hasContent
      ? 'Draft siap ditinjau. Belum ada data yang dikirim.'
      : 'Tidak ada teks atau tautan yang dapat digunakan.',
  );

  const cleanUrl = `${windowRef.location.pathname}${windowRef.location.hash}`;
  windowRef.history.replaceState(windowRef.history.state, '', cleanUrl);

  sendButton?.addEventListener('click', async () => {
    sendButton.disabled = true;
    setPlainText(status, 'Membuka Nusa Agent dengan draft. Draft belum dikirim.');
    const questionDraft = state.confirm();

    try {
      const { openNusaAgent } = await import('./nusa-agent.js?v=20260716-android-pwa-v1');
      await openNusaAgent({
        documentRef,
        draft: questionDraft,
        trigger: sendButton,
      });
    } catch {
      setPlainText(status, 'Nusa Agent belum dapat dibuka. Konten yang dibagikan tidak dikirim.');
    } finally {
      sendButton.disabled = false;
    }
  });

  cancelButton?.addEventListener('click', () => {
    windowRef.location.assign(new URL('index.html', getVitaNusaBaseUrl(import.meta.url)).href);
  });

  return { draft, state };
}

if (typeof document !== 'undefined') {
  initShareTargetPage(document).catch(() => {
    // Halaman tetap menampilkan penjelasan statis bila JavaScript gagal.
  });
}
