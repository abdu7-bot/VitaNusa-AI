import { initMobileNavigation } from './modules/nav.js?v=20260614-audit-1';
import { initPremiumUI } from './modules/premium-ui.js?v=20260614-audit-1';
import { initVitaCheck } from './modules/vitacheck.js?v=20260623-vitacheck-v2';

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
      console.warn(`[VitaNusa AI] Module ${name} gagal dimuat:`, error);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootVitaNusa, { once: true });
} else {
  bootVitaNusa();
}
