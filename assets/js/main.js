import { initNusaUiShell } from './modules/nusa-ui-shell.js?v=20260704-vitanusa-master-map-v1';
import { initNusaChat } from './modules/nusa-chat.js?v=20260709-keyboard-hard-lock-v1';
import { initChatViewportController } from './modules/chat-viewport.js?v=20260709-pwa-chat-refine-v1';
import { initVitaCheck } from './modules/vitacheck.js?v=20260704-vitanusa-master-map-v1';

const modules = [
  ['VitaNusa UI Shell', initNusaUiShell],
  ['Nusa Chat', initNusaChat],
  ['Chat Viewport', initChatViewportController],
  ['VitaCheck', initVitaCheck],
];

function injectNusaChatBalanceStyles() {
  if (document.getElementById('nusa-chat-balance-styles')) return;

  const style = document.createElement('style');
  style.id = 'nusa-chat-balance-styles';
  style.textContent = `
    @media (max-width: 860px) {
      .nusa-chat-window {
        width: 100% !important;
        max-width: 620px !important;
        margin: 0 auto !important;
        padding-inline: 14px !important;
        box-sizing: border-box !important;
      }

      .nusa-message {
        width: 100% !important;
        max-width: 100% !important;
        padding-inline: 0 !important;
      }

      .nusa-message.assistant {
        justify-content: flex-start !important;
      }

      .nusa-message.assistant .nusa-bubble {
        max-width: calc(100% - 14px) !important;
        margin-left: 0 !important;
        margin-right: auto !important;
      }

      .nusa-message.user {
        justify-content: flex-end !important;
      }

      .nusa-message.user .nusa-bubble {
        max-width: min(82%, 520px) !important;
        margin-left: auto !important;
        margin-right: 8px !important;
      }

      .nusa-chat-form {
        width: calc(100% - 28px) !important;
        max-width: 620px !important;
        margin: 8px auto 0 !important;
        box-sizing: border-box !important;
      }
    }

    @media (max-width: 380px) {
      .nusa-chat-window {
        padding-inline: 12px !important;
      }

      .nusa-message.user .nusa-bubble {
        max-width: calc(100% - 34px) !important;
        margin-right: 6px !important;
      }

      .nusa-message.assistant .nusa-bubble {
        max-width: calc(100% - 10px) !important;
      }

      .nusa-chat-form {
        width: calc(100% - 24px) !important;
      }
    }
  `;

  document.head.append(style);
}

function registerVitaNusaServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/VitaNusa-AI/service-worker.js')
      .catch((error) => {
        console.warn('Service worker VitaNusa gagal aktif:', error);
      });
  });
}

function bootVitaNusa() {
  document.documentElement.classList.add('js-ready');
  injectNusaChatBalanceStyles();

  for (const [name, init] of modules) {
    try {
      init();
    } catch (error) {
      console.warn('VitaNusa module failed:', name, error);
    }
  }

  registerVitaNusaServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootVitaNusa, { once: true });
} else {
  bootVitaNusa();
}
