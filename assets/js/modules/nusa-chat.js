import { getNusaReply } from './nusa-knowledge.js?v=20260626-nusa-brain-v3-1';

const ROUTE_OVERRIDES = Object.freeze({
  '#vitacheck': 'vitacheck.html',
  '#faq': 'faq.html',
  '#kontak': 'contact.html',
});

function getActionHref(action) {
  return ROUTE_OVERRIDES[action.href] || action.href;
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
  appendMessage(log, 'assistant', reply.text, reply.actions || []);
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

    setTimeout(() => {
      renderReply(log, getNusaReply(question));
    }, 120);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleQuestion(input.value);
  });

  return {
    ask: handleQuestion,
  };
}
