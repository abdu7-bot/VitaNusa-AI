import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInstallPromptSession,
  detectStandalone,
  getVitaNusaBaseUrl,
  hasUnsavedPwaInteraction,
  isInstallDismissalActive,
} from '../assets/js/modules/pwa-install.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('mode standalone terdeteksi dari display-mode', () => {
  assert.equal(detectStandalone({ displayModeStandalone: true }), true);
});

test('browser biasa tidak dianggap standalone', () => {
  assert.equal(detectStandalone({}), false);
});

test('event install ditangkap tanpa memanggil prompt otomatis', () => {
  let promptCalls = 0;
  let prevented = 0;
  const session = createInstallPromptSession();
  session.capture({
    preventDefault: () => { prevented += 1; },
    prompt: async () => { promptCalls += 1; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  assert.equal(prevented, 1);
  assert.equal(promptCalls, 0);
  assert.equal(session.getState().available, true);
});

test('prompt hanya dipanggil setelah tindakan requestInstall', async () => {
  let promptCalls = 0;
  const session = createInstallPromptSession();
  session.capture({
    preventDefault() {},
    prompt: async () => { promptCalls += 1; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  const result = await session.requestInstall();
  assert.equal(promptCalls, 1);
  assert.equal(result.status, 'accepted');
});

test('dismissal disimpan sementara tanpa identitas pengguna', async () => {
  const storage = createStorage();
  const now = 1_000_000;
  const session = createInstallPromptSession({ storage, now: () => now });
  session.capture({
    preventDefault() {},
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome: 'dismissed' }),
  });
  assert.equal((await session.requestInstall()).status, 'dismissed');
  assert.equal(isInstallDismissalActive(storage, now + 1000), true);
});

test('appinstalled membersihkan prompt dan dismissal', () => {
  const storage = createStorage();
  storage.setItem('VITANUSA_PWA_INSTALL_DISMISSED_AT', '1000');
  const session = createInstallPromptSession({ storage, now: () => 1000 });
  session.markInstalled();
  assert.deepEqual(session.getState(), {
    installed: true,
    available: false,
    promptInProgress: false,
    dismissedRecently: false,
  });
});

test('browser tanpa beforeinstallprompt tidak crash', async () => {
  const session = createInstallPromptSession();
  assert.deepEqual(await session.requestInstall(), { status: 'unavailable' });
});

test('base URL diturunkan dari lokasi modul, bukan domain hardcoded', () => {
  const base = getVitaNusaBaseUrl('https://example.test/VitaNusa-AI/assets/js/modules/pwa-install.js');
  assert.equal(base.href, 'https://example.test/VitaNusa-AI/');
  const builtBase = getVitaNusaBaseUrl('https://example.test/VitaNusa-AI/assets/pwa-install-abc123.js');
  assert.equal(builtBase.href, 'https://example.test/VitaNusa-AI/');
});

test('isian chat dan VitaCheck menahan reload pembaruan', () => {
  const documentRef = {
    querySelectorAll(selector) {
      if (selector === '[data-nusa-chat-input]') return [{ value: 'sedang mengetik' }];
      return [];
    },
    querySelector() { return null; },
  };
  assert.equal(hasUnsavedPwaInteraction(documentRef), true);
});
