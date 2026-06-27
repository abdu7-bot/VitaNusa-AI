import { getNusaReply } from './nusa-knowledge.js?v=20260626-content-library-metadata-v1';

const ROUTE_OVERRIDES = Object.freeze({
  '#vitacheck': 'vitacheck.html',
  '#faq': 'faq.html',
  '#kontak': 'contact.html',
});

const SENSITIVE_NO_ARTICLE_PRODUCT_INTENTS = Object.freeze([
  'serious' + '-' + 'complaint',
  'diag' + 'nosis',
  'fat' + 'wa',
  'product' + '-' + 'suitability',
]);

const SAFE_FALLBACK_REPLY = Object.freeze({
  text: 'Saya belum menangkap maksudnya dengan jelas. Coba tulis sedikit lebih spesifik: apakah ingin membahas kebiasaan sehat, VitaCheck, artikel edukasi, klaim produk, Prinsip Amanah, atau kontak admin?',
  actions: [],
});

function getActionHref(action) {
  return ROUTE_OVERRIDES[action.href] || action.href;
}

function isSensitiveNoArticleProductReply(reply) {
  const replyId = String(reply?.id || '');
  return SENSITIVE_NO_ARTICLE_PRODUCT_INTENTS.some((intentId) => replyId === intentId || replyId.startsWith(`${intentId}-`));
}

function isArticleOrProductAction(action) {
  const label = String(action?.label || '').toLowerCase();
  const href = String(action?.href || '').toLowerCase();

  return (
    label.includes('artikel') ||
    label.includes('katalog ' + 'produk') ||
    label.includes('produk ' + 'bukan') ||
    href.startsWith('articles/') ||
    href.includes('/articles/') ||
    href.startsWith('products/') ||
    href.includes('/products/')
  );
}

function getContextActions(reply) {
  const actions = reply.actions || [];
  if (!isSensitiveNoArticleProductReply(reply)) return actions;
  return actions.filter((action) => !isArticleOrProductAction(action));
}

function createRouteLink(action) {
  const link = document.createElement('a');
  link.className = 'nusa-route-link';
  link.href = getActionHref(action);
  link.textContent = action.label;
  return link;
}

function appendMessage(log, role, text, actions = []) {
  const message = document.createElement('article');
  message.className = `nusa-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'nusa-bubble';

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  bubble.append(paragraph);

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
  appendMessage(log, 'assistant', reply.text, getContextActions(reply));
}

export function initNusaChat({ rootSelector = '[data-nusa-chat]' } = {}) {
  const root = document.querySelector(rootSelector);
  if (!root) return null;

  const log = root.querySelector('[data-nusa-chat-log]');
  const form = root.querySelector('[data-nusa-chat-form]');
  const input = root.querySelector('[data-nusa-chat-input]');

  if (!log || !form || !input) return null;

  log.replaceChildren();
  log.hidden = true;

  function handleQuestion(value) {
    const question = value.trim();
    if (!question) return;

    appendMessage(log, 'user', question);
    input.value = '';

    setTimeout(async () => {
      try {
        const reply = await getNusaReply(question);
        renderReply(log, reply || SAFE_FALLBACK_REPLY);
      } catch (error) {
        console.warn('Nusa reply failed:', error);
        renderReply(log, SAFE_FALLBACK_REPLY);
      }
    }, 120);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleQuestion(input.value);
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
  };
}
