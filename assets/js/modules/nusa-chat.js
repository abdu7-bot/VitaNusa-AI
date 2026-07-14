import { getNusaReply } from './nusa-knowledge.js?v=20260712-product-claim-v1';

const ROUTE_OVERRIDES = Object.freeze({
  '#vitacheck': 'vitacheck.html',
  '#faq': 'faq.html',
  '#kontak': 'contact.html',
});

const SAFE_FALLBACK_TEXT = [
  'Saya belum mempunyai informasi yang cukup untuk menjawab pertanyaan itu secara aman.',
  '',
  'Yang bisa dilakukan:',
  '',
  '- tulis pertanyaan lebih spesifik',
  '- berikan konteks umum tanpa data pribadi sensitif',
  '- pilih topik VitaCheck, artikel, produk amanah, atau kebiasaan sehat',
  '',
  'Untuk keluhan berat atau darurat, segera cari bantuan medis.',
].join('\n');

const SAFE_FALLBACK_REPLY = Object.freeze({
  text: SAFE_FALLBACK_TEXT,
  actions: [],
});

const BACKEND_INTENT_ALIASES = Object.freeze({
  product_claim: 'product-claim',
});

// Ganti ke URL Render nanti lewat window.VITANUSA_BACKEND_ASK_URL, meta,
// atau .env Vite: VITE_NUSA_BACKEND_ASK_URL=https://nama-backend.onrender.com/ask
const DEFAULT_LOCAL_BACKENDS = Object.freeze([
  'http://127.0.0.1:8000/ask',
  'http://localhost:8000/ask',
]);

const ACTIVE_BACKEND_STORAGE_KEY = 'VITANUSA_ACTIVE_BACKEND_ASK_URL';
const CHAT_SESSION_STORAGE_KEY = 'VITANUSA_CHAT_SESSION_ID';
const BACKEND_TIMEOUT_MS = 7000;
const BLOCKED_DETAIL_SELECTOR = 'script, iframe, object, embed, link, meta, style';
const URL_DETAIL_ATTRIBUTES = new Set(['href', 'src', 'srcdoc', 'xlink:href']);
const UNORDERED_LIST_PATTERN = /^-\s+(.+)$/;
const ORDERED_LIST_PATTERN = /^\d+\.\s+(.+)$/;

function getActionHref(action) {
  return ROUTE_OVERRIDES[action.href] || action.href;
}

function getContextActions(reply) {
  return reply.actions || [];
}

function scrollLogToBottom(log) {
  if (!log) return;

  window.requestAnimationFrame(() => {
    log.scrollTop = log.scrollHeight;
  });
}

function focusInputWithoutPageScroll(input) {
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

function resizeChatInput(input) {
  if (!(input instanceof HTMLTextAreaElement)) return;

  const maxHeight = 144;

  input.style.height = 'auto';

  const nextHeight = Math.min(input.scrollHeight, maxHeight);

  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function createRouteLink(action) {
  const link = document.createElement('a');
  link.className = 'nusa-route-link';
  link.href = getActionHref(action);
  link.textContent = action.label;
  return link;
}

function appendPlainText(container, text) {
  const paragraph = document.createElement('p');
  paragraph.textContent = String(text || '');
  container.append(paragraph);
}

function appendParagraph(container, lines) {
  const text = lines.join(' ').trim();
  if (!text) return;

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  container.append(paragraph);
}

function appendListItem(list, text) {
  const item = document.createElement('li');
  item.textContent = text.trim();
  list.append(item);
}

function appendFormattedText(container, text) {
  const formatted = document.createElement('div');
  formatted.className = 'nusa-formatted-response';

  const lines = String(text || '').split(/\r?\n/);
  let paragraphLines = [];
  let activeList = null;
  let activeListType = '';

  const flushParagraph = () => {
    appendParagraph(formatted, paragraphLines);
    paragraphLines = [];
  };

  const closeList = () => {
    activeList = null;
    activeListType = '';
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const unorderedMatch = trimmed.match(UNORDERED_LIST_PATTERN);
    const orderedMatch = trimmed.match(ORDERED_LIST_PATTERN);
    const listMatch = unorderedMatch || orderedMatch;

    if (listMatch) {
      const listType = unorderedMatch ? 'ul' : 'ol';
      flushParagraph();

      if (!activeList || activeListType !== listType) {
        activeList = document.createElement(listType);
        activeListType = listType;
        formatted.append(activeList);
      }

      appendListItem(activeList, listMatch[1]);
      continue;
    }

    closeList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();

  if (!formatted.hasChildNodes()) {
    appendPlainText(formatted, '');
  }

  container.append(formatted);
}

function isUnsafeUrlAttribute(name, value) {
  return URL_DETAIL_ATTRIBUTES.has(name) && value.trim().toLowerCase().startsWith('javascript:');
}

function sanitizeDetailDocument(doc) {
  doc.body.querySelectorAll(BLOCKED_DETAIL_SELECTOR).forEach((node) => node.remove());
  doc.body.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '');
      if (name.startsWith('on') || isUnsafeUrlAttribute(name, value)) {
        node.removeAttribute(attr.name);
      }
    });
  });
}

function appendKnowledgeDetail(container, html) {
  if (!html) return;

  const detailDoc = new DOMParser().parseFromString(String(html), 'text/html');
  sanitizeDetailDocument(detailDoc);

  if (!detailDoc.body.childNodes.length) return;

  const detail = document.createElement('div');
  detail.className = 'nusa-knowledge-detail';
  detail.append(...detailDoc.body.childNodes);
  container.append(detail);
}

function appendMessage(log, role, text, actions = [], html = '') {
  const message = document.createElement('article');
  message.className = `nusa-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'nusa-bubble';

  if (role === 'assistant') {
    appendFormattedText(bubble, text);
  } else {
    appendPlainText(bubble, text);
  }

  appendKnowledgeDetail(bubble, html);

  if (actions.length) {
    const actionRow = document.createElement('div');
    actionRow.className = 'nusa-route-actions';
    actionRow.append(...actions.map(createRouteLink));
    bubble.append(actionRow);
  }

  message.append(bubble);
  log.append(message);
  log.hidden = false;
  scrollLogToBottom(log);
}

function renderReply(log, reply) {
  appendMessage(log, 'assistant', reply.text, getContextActions(reply), reply.html || '');
  scrollLogToBottom(log);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeAskUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  if (withoutTrailingSlash.endsWith('/ask')) return withoutTrailingSlash;

  return `${withoutTrailingSlash}/ask`;
}

function pushUniqueUrl(list, value) {
  const normalized = normalizeAskUrl(value);
  if (normalized && !list.includes(normalized)) {
    list.push(normalized);
  }
}

function getBackendAskUrls() {
  const urls = [];

  pushUniqueUrl(urls, window.VITANUSA_BACKEND_ASK_URL);

  const metaUrl = document
    .querySelector('meta[name="vitanusa-backend-ask-url"]')
    ?.getAttribute('content');
  pushUniqueUrl(urls, metaUrl);

  const envUrl = import.meta.env?.VITE_NUSA_BACKEND_ASK_URL;
  pushUniqueUrl(urls, envUrl);

  try {
    pushUniqueUrl(urls, window.sessionStorage?.getItem(ACTIVE_BACKEND_STORAGE_KEY));
  } catch {
    // sessionStorage bisa tidak tersedia pada mode privasi tertentu.
  }

  DEFAULT_LOCAL_BACKENDS.forEach((url) => pushUniqueUrl(urls, url));

  return urls;
}

function rememberActiveBackendUrl(url) {
  try {
    window.sessionStorage?.setItem(ACTIVE_BACKEND_STORAGE_KEY, url);
  } catch {
    // Abaikan bila browser membatasi sessionStorage.
  }
}

function createSessionId() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    // Lanjut ke fallback di bawah.
  }
  return `nusa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Sesi obrolan (dan konteks percakapan yang diingat backend) dipetakan ke id
// ini, disimpan per-tab lewat sessionStorage supaya percakapan multi-giliran
// tetap nyambung selama tab terbuka, tapi otomatis "lupa" saat tab ditutup
// atau pengguna menekan tombol "Chat Baru" (lihat resetChatSession()).
function getOrCreateChatSessionId() {
  try {
    const existing = window.sessionStorage?.getItem(CHAT_SESSION_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // sessionStorage bisa tidak tersedia pada mode privasi tertentu.
  }

  const created = createSessionId();
  try {
    window.sessionStorage?.setItem(CHAT_SESSION_STORAGE_KEY, created);
  } catch {
    // Abaikan bila browser membatasi sessionStorage; sesi hanya berlaku di memori.
  }
  return created;
}

function resetChatSession() {
  try {
    window.sessionStorage?.removeItem(CHAT_SESSION_STORAGE_KEY);
  } catch {
    // Abaikan bila browser membatasi sessionStorage.
  }
}

function rememberChatSessionId(sessionId) {
  if (!sessionId) return;
  try {
    window.sessionStorage?.setItem(CHAT_SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Abaikan bila browser membatasi sessionStorage.
  }
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildBackendReflectionHtml(data) {
  const reflection = data?.quranicReflection;
  if (!reflection?.text) return '';

  const note = reflection.note
    ? `<small>${escapeHtml(reflection.note)}</small>`
    : '';

  return `
    <section class="nusa-knowledge-section">
      <strong>Refleksi Qur'ani</strong>
      <p>${escapeHtml(reflection.text)}</p>
      ${note}
    </section>
  `;
}

function mapBackendAnswer(data) {
  const backendIntent = String(data.intent || 'answer').trim();
  const normalizedIntent = BACKEND_INTENT_ALIASES[backendIntent] || backendIntent || 'answer';

  return {
    id: `backend-${normalizedIntent}`,
    text: data.answer || 'Maaf, backend belum memberikan jawaban.',
    html: buildBackendReflectionHtml(data),
    actions: Array.isArray(data.actions) ? data.actions : [],
  };
}

export function initNusaChat({ rootSelector = '[data-nusa-chat]' } = {}) {
  const root = document.querySelector(rootSelector);
  if (!root) return null;

  const log = root.querySelector('[data-nusa-chat-log]');
  const form = root.querySelector('[data-nusa-chat-form]');
  const input = root.querySelector('[data-nusa-chat-input]');
  const resetButton = root.querySelector('[data-nusa-chat-reset]');

  if (!log || !form || !input) return null;

  const state = { requestId: 0 };

  log.replaceChildren();
  log.hidden = true;

  input.addEventListener('input', () => {
    resizeChatInput(input);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (event.isComposing) return;
    if (event.shiftKey) return;

    event.preventDefault();
    form.requestSubmit();
  });

  resizeChatInput(input);

  function resetChat({ focus = true } = {}) {
    state.requestId += 1;
    log.replaceChildren();
    log.hidden = true;
    input.value = '';
    resizeChatInput(input);
    // "Chat Baru" juga memulai sesi backend yang baru: percakapan lama tidak
    // lagi diingat, konsisten dengan tampilan yang dikosongkan di sini.
    resetChatSession();
    if (focus) {
      focusInputWithoutPageScroll(input);
    }
  }

  function handleQuestion(value) {
    const question = value.trim();
    if (!question) return;

    const requestId = ++state.requestId;
    appendMessage(log, 'user', question);
    input.value = '';
    resizeChatInput(input);
    scrollLogToBottom(log);

    setTimeout(async () => {
      if (requestId !== state.requestId) return;
      try {
        let reply;

        try {
          reply = await getNusaBackendReply(question);
        } catch (backendError) {
          console.warn('Backend belum bisa dipakai, pakai jawaban lokal:', backendError);
          reply = await getNusaReply(question);
        }

        if (requestId !== state.requestId) return;
        renderReply(log, reply || SAFE_FALLBACK_REPLY);
      } catch (error) {
        if (requestId !== state.requestId) return;
        console.warn('Nusa reply failed:', error);
        renderReply(log, SAFE_FALLBACK_REPLY);
      }
    }, 120);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleQuestion(input.value);
  });

  resetButton?.addEventListener('click', () => {
    resetChat();
  });

  root.addEventListener('click', (event) => {
    const button = event.target instanceof Element
      ? event.target.closest('[data-nusa-prompt]')
      : null;

    if (!button || !root.contains(button)) return;

    handleQuestion(button.dataset.nusaPrompt || button.textContent || '');
    focusInputWithoutPageScroll(input);
  });

  return {
    ask: handleQuestion,
    reset: resetChat,
  };
}

function updateNusaSession(session, question, reply) {
  session.turnCount += 1;
  session.lastUserMessage = question;
  session.lastAssistantReply = reply;
  session.lastIntent = reply?.id || '';
  session.lastActions = reply?.actions || [];

  if (reply?.id?.includes('product') || question.toLowerCase().includes('produk')) {
    session.lastTopic = 'product';
  }

  if (question.toLowerCase().includes('vitacheck')) {
    session.lastTopic = 'vitacheck';
  }

  if (question.toLowerCase().includes('artikel')) {
    session.lastTopic = 'article';
  }

  if (
    question.toLowerCase().includes('prinsip amanah') ||
    question.toLowerCase().includes('produk bukan obat') ||
    question.toLowerCase().includes('testimoni bukan bukti')
  ) {
    session.productEducationSeen = true;
  }
}

async function getNusaBackendReply(question) {
  const urls = getBackendAskUrls();
  const sessionId = getOrCreateChatSessionId();
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetchJsonWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          includeQuranicReflection: false,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error ${response.status} dari ${url}`);
      }

      const data = await response.json();
      rememberActiveBackendUrl(url);
      rememberChatSessionId(data.sessionId);
      return mapBackendAnswer(data);
    } catch (error) {
      lastError = error;
      console.warn('Backend candidate gagal:', url, error);
    }
  }

  throw lastError || new Error('Tidak ada URL backend yang bisa dipakai.');
}
