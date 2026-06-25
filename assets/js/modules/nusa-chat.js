import { getNusaReply } from './nusa-knowledge.js?v=20260625-chat-only-final';

const ROUTE_OVERRIDES = Object.freeze({
  '#vitacheck': 'vitacheck.html',
  '#faq': 'faq.html',
  '#kontak': 'contact.html',
});

function getActionHref(action) {
  return ROUTE_OVERRIDES[action.href] || action.href;
}

function getContextActions(reply) {
  const actions = reply.actions || [];

  if (reply.id === 'product-suitability') {
    return actions.filter((action) => action.href !== 'products/index.html');
  }

  if (reply.id === 'serious-complaint') {
    return [];
  }

  return actions;
}

function createRouteLink(action) {
  const link = document.createElement('a');
  link.className = 'nusa-route-link';
  link.href = getActionHref(action);
  link.textContent = action.label;

  if (link.href.startsWith('http')) {
    link.rel = 'noopener noreferrer';
  }

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

    window.setTimeout(() => {
      renderReply(log, getNusaReply(question));
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
