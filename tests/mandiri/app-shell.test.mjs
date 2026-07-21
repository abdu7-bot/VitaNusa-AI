import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createMandiriShellModel,
  getOrCreateMandiriAppSingleton,
  initializeMandiriApp,
  MANDIRI_PLANNED_MODULES,
} from '../../assets/js/mandiri/shell/app-shell.js';
import { getNusaShellFeatures } from '../../assets/js/modules/nusa-ui-shell.js';
import {
  buildSafePageContext,
  isAdminPath,
} from '../../assets/js/modules/nusa-agent.js';

const root = new URL('../../', import.meta.url);
const html = await readFile(new URL('mandiri/index.html', root), 'utf8');
const css = await readFile(new URL('assets/css/vitanusa-mandiri.css', root), 'utf8');
const appShellSource = await readFile(
  new URL('assets/js/mandiri/shell/app-shell.js', root),
  'utf8',
);
const viteSource = await readFile(new URL('vite.config.js', root), 'utf8');

function createShellDocument() {
  const elements = {
    '[data-mandiri-root]': { dataset: {} },
    '[data-mandiri-unavailable]': { hidden: false },
    '[data-mandiri-shell]': { hidden: true },
    '[data-mandiri-feature-state]': { textContent: '' },
  };

  return {
    elements,
    querySelector(selector) {
      return elements[selector] || null;
    },
  };
}

test('mode off menampilkan pesan belum tersedia', async () => {
  const model = createMandiriShellModel('off');
  assert.equal(model.view, 'unavailable');
  assert.equal(model.title, 'VitaNusa Mandiri belum tersedia');

  const documentRef = createShellDocument();
  let sharedShellCalls = 0;
  let statusCalls = 0;
  await initializeMandiriApp({
    documentRef,
    windowRef: {},
    featureState: 'off',
    initializeSharedShell: async () => { sharedShellCalls += 1; },
    initializeStatus: () => { statusCalls += 1; },
  });

  assert.equal(documentRef.elements['[data-mandiri-unavailable]'].hidden, false);
  assert.equal(documentRef.elements['[data-mandiri-shell]'].hidden, true);
  assert.equal(sharedShellCalls, 0);
  assert.equal(statusCalls, 0);
  assert.match(html, /data-mandiri-unavailable/);
});

test('mode off tidak menampilkan fitur aktif', () => {
  const model = createMandiriShellModel('off');
  assert.equal(model.activeFeatures, false);
  assert.equal(model.startsStorage, false);
  assert.equal(model.modules.length, 0);
  assert.match(html, /data-mandiri-shell[^>]*hidden/);
});

test('mode internal menampilkan application shell', async () => {
  const model = createMandiriShellModel('internal');
  assert.equal(model.view, 'internal-shell');
  assert.equal(model.modeLabel, 'Mode fondasi lokal');
  assert.equal(model.startsStorage, false);

  const documentRef = createShellDocument();
  let sharedShellCalls = 0;
  let statusCalls = 0;
  await initializeMandiriApp({
    documentRef,
    windowRef: {},
    featureState: 'internal',
    initializeSharedShell: async () => { sharedShellCalls += 1; },
    initializeStatus: () => {
      statusCalls += 1;
      return { destroy() {} };
    },
  });

  assert.equal(documentRef.elements['[data-mandiri-unavailable]'].hidden, true);
  assert.equal(documentRef.elements['[data-mandiri-shell]'].hidden, false);
  assert.equal(sharedShellCalls, 1);
  assert.equal(statusCalls, 1);
});

test('entrypoint NusaKasir hanya aktif saat feature flag internal', () => {
  const disabled = createMandiriShellModel('internal', 'off', 'off');
  const enabled = createMandiriShellModel('internal', 'off', 'internal');
  const disabledModule = disabled.modules.find((module) => module.id === 'nusakasir');
  const enabledModule = enabled.modules.find((module) => module.id === 'nusakasir');

  assert.equal(disabledModule.status, 'planned');
  assert.equal(disabledModule.href, undefined);
  assert.equal(enabledModule.status, 'active');
  assert.equal(enabledModule.href, './kasir/products.html');
  assert.match(enabledModule.description, /produk, kategori, stok, dan riwayat lokal/u);
  assert.equal(enabled.activeFeatures, true);
  assert.match(
    disabledModule.description,
    /pengelolaan produk, kategori, stok, dan riwayat lokal/u,
  );
});

test('semua modul planned diberi label direncanakan', () => {
  assert.deepEqual(
    MANDIRI_PLANNED_MODULES.map((module) => [module.name, module.state]),
    [
      ['NusaBelajar', 'direncanakan'],
      ['NusaKasir', 'direncanakan'],
      ['VitaSheet', 'direncanakan'],
    ],
  );
  assert.equal((html.match(/Direncanakan/g) || []).length, 3);
  assert.equal((html.match(/Belum tersedia pada Fase 1/g) || []).length, 3);
});

test('shell tidak mengklaim kasir, laporan, atau belajar sudah aktif', () => {
  assert.doesNotMatch(
    html,
    /Mulai Kasir|Buka Laporan|Mulai Belajar|NusaKasir sudah selesai|siap dipakai untuk pembukuan resmi/i,
  );
  assert.match(html, /Belum ada kasir, transaksi, laporan, materi belajar, database, atau sinkronisasi cloud/);
});

test('Nusa Agent tidak diinisialisasi dua kali oleh shell Mandiri', () => {
  const registry = new Map();
  const key = {};
  let calls = 0;
  const factory = () => ({ id: ++calls });

  assert.equal(
    getOrCreateMandiriAppSingleton(registry, key, factory),
    getOrCreateMandiriAppSingleton(registry, key, factory),
  );
  assert.equal(calls, 1);
  assert.doesNotMatch(appShellSource, /from\s+['"][^'"]*nusa-agent/);
  assert.match(appShellSource, /initNusaUiShell/);
});

test('route admin tidak terpengaruh oleh entry Mandiri', () => {
  assert.equal(isAdminPath('/VitaNusa-AI/admin/'), true);
  assert.equal(isAdminPath('/VitaNusa-AI/mandiri/'), false);
  assert.match(viteSource, /admin:\s*resolve\(__dirname,\s*'admin\/index\.html'\)/);
  assert.match(viteSource, /mandiri:\s*resolve\(__dirname,\s*'mandiri\/index\.html'\)/);
  assert.doesNotMatch(appShellSource, /admin\/|firebase|firestore/i);
});

test('URL Mandiri relatif dan aman untuk Vite root maupun project path', () => {
  const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(references.length > 0);
  references.forEach((value) => {
    assert.doesNotMatch(value, /^[a-z][a-z0-9+.-]*:/i);
    assert.equal(value.startsWith('/'), false);
  });

  const context = buildSafePageContext({
    url: 'https://example.test/VitaNusa-AI/mandiri/index.html',
    title: 'VitaNusa Mandiri | Fondasi Lokal',
  });
  assert.equal(context.routeKey, 'mandiri');
  assert.equal(context.pageType, 'mandiri');
});

test('link navigasi Mandiri hanya ada pada flag internal', () => {
  assert.equal(
    getNusaShellFeatures('off').some(([title]) => title === 'VitaNusa Mandiri'),
    false,
  );
  assert.equal(
    getNusaShellFeatures('internal').some(([title, , href]) => (
      title === 'VitaNusa Mandiri' && href === 'mandiri/'
    )),
    true,
  );
  assert.equal(
    getNusaShellFeatures('invalid').some(([title]) => title === 'VitaNusa Mandiri'),
    false,
  );
});

test('layout mobile 360 piksel mencegah overflow dan menghormati safe area', () => {
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /min-width:\s*0/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media\s*\(max-width:\s*420px\)/);
});
