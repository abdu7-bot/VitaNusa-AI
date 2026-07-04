import { getNusaReply } from './nusa-knowledge.js?v=20260704-vitanusa-master-map-v1';

const ROUTE_OVERRIDES = Object.freeze({
  '#vitacheck': 'vitacheck.html',
  '#faq': 'faq.html',
  '#kontak': 'contact.html',
});

const SAFE_FALLBACK_REPLY = Object.freeze({
  text: 'Saya belum menangkap maksudnya dengan jelas. Coba tulis sedikit lebih spesifik: apakah ingin membahas kebiasaan sehat, VitaCheck, artikel edukasi, klaim produk, Prinsip Amanah, atau kontak admin?',
  actions: [],
});

function getActionHref(action) {
  return ROUTE_OVERRIDES[action.href] || action.href;
}

function getContextActions(reply) {
  return reply.actions || [];
}

function createRouteLink(action) {
  const link = document.createElement('a');
  link.className = 'nusa-route-link';
  link.href = getActionHref(action);
  link.textContent = action.label;
  return link;
}

function appendMessage(log, role, text, actions = [], html = '') {
  const message = document.createElement('article');
  message.className = `nusa-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'nusa-bubble';

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  bubble.append(paragraph);

  if (html) {
    const detail = document.createElement('div');
    detail.className = 'nusa-knowledge-detail';
    detail.innerHTML = html;
    bubble.append(detail);
  }

  if (actions.length) {
    const actionRow = document.createElement('div');
    actionRow.className = 'nusa-route-actions';
    actionRow.append(...actions.map(createRouteLink));
    bubble.append(actionRow);
  }

  message.append(bubble);
  log.append(message);
  log.hidden = false;
  log.scrollTop = log.scrollHeight;
}

function renderReply(log, reply) {
  appendMessage(log, 'assistant', reply.text, getContextActions(reply), reply.html || '');
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

  function resetChat({ focus = true } = {}) {
    state.requestId += 1;
    log.replaceChildren();
    log.hidden = true;
    input.value = '';
    if (focus) {
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    }
  }

  function handleQuestion(value) {
    const question = value.trim();
    if (!question) return;

    const requestId = ++state.requestId;
    appendMessage(log, 'user', question);
    input.value = '';

    setTimeout(async () => {
      if (requestId !== state.requestId) return;
      try {
        const reply = await getNusaReply(question);
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
    input.focus();
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
