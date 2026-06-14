import { initMobileNavigation } from './modules/nav.js';
import { initVitaCheck } from './modules/vitacheck.js';

function bootVitaNusa() {
  document.documentElement.classList.add('js-ready');

  initMobileNavigation();
  initVitaCheck();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootVitaNusa, { once: true });
} else {
  bootVitaNusa();
}
