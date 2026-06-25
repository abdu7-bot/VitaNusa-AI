import { initNusaChat } from './modules/nusa-chat.js?v=20260625-nusa-brain-v2';
import { initVitaCheck } from './modules/vitacheck.js?v=20260625-chat-only-final';

const modules = [
  ['Nusa Chat', initNusaChat],
  ['VitaCheck', initVitaCheck],
];

function bootVitaNusa() {
  document.documentElement.classList.add('js-ready');

  for (const [name, init] of modules) {
    try {
      init();
    } catch (error) {
      console.warn(`[VitaNusa AI] Module ${name} gagal dimuat:`, error);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootVitaNusa, { once: true });
} else {
  bootVitaNusa();
}
