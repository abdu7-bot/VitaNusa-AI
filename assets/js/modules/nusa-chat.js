import { getNusaReply } from './nusa-knowledge.js?v=20260624-nusa-knowledge-router';

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
  log.scrollTop = log.scrollHeight;
}

export function initNusaChat({ rootSelector = '[data-nusa-chat]' } = {}) {
  const root = document.querySelector(rootSelector);
  if (!root) return null;

  const log = root.querySelector('[data-nusa-chat-log]');
  const form = root.querySelector('[data-nusa-chat-form]');
  const input = root.querySelector('[data-nusa-chat-input]');
  const promptButtons = root.querySelectorAll('[data-nusa-prompt]');

  if (!log || !form || !input) return null;

  function handleQuestion(value) {
    const question = value.trim();
    if (!question) return;

    appendMessage(log, 'user', question);
    input.value = '';

    window.setTimeout(() => {
      const reply = getNusaReply(question);
      appendMessage(log, 'assistant', reply.text, reply.actions);
    }, 120);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleQuestion(input.value);
  });

  promptButtons.forEach((button) => {
    button.addEventListener('click', () => {
      handleQuestion(button.dataset.nusaPrompt || button.textContent || '');
      input.focus();
    });
  });

  return {
    ask: handleQuestion,
  };
}
