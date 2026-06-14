import { initMobileNavigation } from './modules/nav.js';
import { initPremiumUI } from './modules/premium-ui.js';
import { initVitaCheck } from './modules/vitacheck.js';

const modules = [
  ['Premium UI', initPremiumUI],
  ['Mobile Navigation', initMobileNavigation],
  ['VitaCheck', initVitaCheck],
];

function bootVitaNusa() {
  document.documentElement.classList.add('js-ready');

  for (const [name, init] of modules) {
    try {
      init();
    } catch (error) {
      console.warn(`[VitaNusa AI] Modul ${name} gagal dimuat:`, error);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootVitaNusa, { once: true });
} else {
  bootVitaNusa();
}
