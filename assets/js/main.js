import { initNusaUiShell } from './modules/nusa-ui-shell.js?v=20260716-android-pwa-v1';
import { registerVitaNusaServiceWorker as registerPwaWorker } from './modules/pwa-install.js?v=20260716-android-pwa-v1';
import { initVitaCheck } from './modules/vitacheck.js?v=20260704-vitanusa-master-map-v1';

const modules = [
  ['VitaNusa UI Shell', initNusaUiShell],
  ['VitaCheck', initVitaCheck],
];

export function registerVitaNusaServiceWorker() {
  return registerPwaWorker();
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
