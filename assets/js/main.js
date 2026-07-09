import { initNusaUiShell } from './modules/nusa-ui-shell.js?v=20260704-vitanusa-master-map-v1';
import { initNusaChat } from './modules/nusa-chat.js?v=20260704-vitanusa-master-map-v1';
import { initChatViewportController } from './modules/chat-viewport.js?v=20260709-keyboard-chat-v1';
import { initVitaCheck } from './modules/vitacheck.js?v=20260704-vitanusa-master-map-v1';

const modules = [
  ['VitaNusa UI Shell', initNusaUiShell],
  ['Nusa Chat', initNusaChat],
  ['Chat Viewport', initChatViewportController],
  ['VitaCheck', initVitaCheck],
];

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
