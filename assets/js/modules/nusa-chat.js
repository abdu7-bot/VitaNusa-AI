import { getNusaReply, NUSA_INITIAL_REPLY } from './nusa-knowledge.js?v=20260625-active-chatbot';

function createRouteLink(action) {
  const link = document.createElement('a');
  link.className = 'nusa-route-link';
  link.href = action.href;
  link.textContent = action.label;

  if (action.href.startsWith('http')) {
    link.rel = 'noopener noreferrer';
  }

  return link;
}

function createQuickReplyButton(reply) {
  const button = document.createElement('button');
  button.className = 'nusa-chip';
  button.type = 'button';
  button.dataset.nusaPrompt = reply.prompt || reply.label;
  button.textContent = reply.label;
  return button;
}

function createQuickReplies(replies) {
  const row = document.createElement('div');
  row.className = 'nusa-quick-replies';
  row.setAttribute('aria-label', 'Pilihan cepat Nusa AI');
  row.append(...replies.map(createQuickReplyButton));
  return row;
}

function appendMessage(log, role, text, actions = [], quickReplies = []) {
  const message = document.createElement('article');
  message.className = `nusa-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'nusa-bubble';

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  bubble.append(paragraph);

  if (quickReplies.length) {
    bubble.append(createQuickReplies(quickReplies));
  }

  if (actions.length) {
    const actionRow = document.createElement('div');
    actionRow.className = 'nusa-route-actions';
    actionRow.append(...actions.map(createRouteLink));
    bubble.append(actionRow);
  }

  message.append(bubble);
  log.append(message);
  log.scrollTop = log.scrollHeight;
}

function renderReply(log, reply) {
  appendMessage(log, 'assistant', reply.text, reply.actions || [], reply.quickReplies || []);
}

export function initNusaChat({ rootSelector = '[data-nusa-chat]' } = {}) {
  const root = document.querySelector(rootSelector);
  if (!root) return null;

  const log = root.querySelector('[data-nusa-chat-log]');
  const form = root.querySelector('[data-nusa-chat-form]');
  const input = root.querySelector('[data-nusa-chat-input]');

  if (!log || !form || !input) return null;

  log.replaceChildren();
  renderReply(log, NUSA_INITIAL_REPLY);

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
