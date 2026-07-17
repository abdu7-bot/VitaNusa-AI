import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createMandiriShellModel,
  initMandiriDashboardNavigation,
  MANDIRI_MODULES,
  MANDIRI_MODULE_STATUSES,
} from '../../../assets/js/mandiri/shell/app-shell.js';

const rootUrl = new URL('../../../', import.meta.url);
const html = await readFile(new URL('mandiri/index.html', rootUrl), 'utf8');
const css = await readFile(new URL('assets/css/vitanusa-mandiri.css', rootUrl), 'utf8');
const appShellSource = await readFile(
  new URL('assets/js/mandiri/shell/app-shell.js', rootUrl),
  'utf8',
);

function createEventTarget(properties = {}) {
  const listeners = new Map();
  return Object.assign(properties, {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.forEach((listener) => listener(event));
    },
  });
}

function createNavigationFixture() {
  const attributes = new Map();
  const focused = [];
  const firstLink = createEventTarget({
    hidden: false,
    focus() { focused.push('first'); },
  });
  const lastLink = createEventTarget({
    hidden: false,
    focus() { focused.push('last'); },
  });
  const closeButton = createEventTarget({
    hidden: false,
    focus() { focused.push('close'); },
  });
  const sidebar = createEventTarget({
    inert: false,
    setAttribute(name, value) { attributes.set(`sidebar:${name}`, value); },
    querySelectorAll(selector) {
      if (selector === 'a[href]') return [firstLink, lastLink];
      return [closeButton, firstLink, lastLink];
    },
  });
  const toggle = createEventTarget({
    setAttribute(name, value) { attributes.set(`toggle:${name}`, value); },
    focus() { focused.push('toggle'); },
  });
  const overlay = createEventTarget({
    hidden: true,
    setAttribute(name, value) { attributes.set(`overlay:${name}`, value); },
  });
  const root = { dataset: {} };
  const classNames = new Set();
  const body = {
    classList: {
      toggle(name, enabled) {
        if (enabled) classNames.add(name);
        else classNames.delete(name);
      },
    },
  };
  const documentRef = createEventTarget({
    body,
    activeElement: null,
    querySelector(selector) {
      return ({
        '[data-mandiri-root]': root,
        '[data-mandiri-sidebar]': sidebar,
        '[data-mandiri-sidebar-toggle]': toggle,
        '[data-mandiri-sidebar-close]': closeButton,
        '[data-mandiri-sidebar-overlay]': overlay,
      })[selector] || null;
    },
  });
  const mediaQuery = createEventTarget({ matches: true });
  const windowRef = { matchMedia: () => mediaQuery };

  return {
    attributes,
    classNames,
    closeButton,
    documentRef,
    firstLink,
    focused,
    lastLink,
    mediaQuery,
    overlay,
    root,
    toggle,
    windowRef,
  };
}

test('dashboard internal dirender dengan satu modul aktif dan tiga modul planned', () => {
  const model = createMandiriShellModel('internal');
  assert.equal(model.view, 'internal-shell');
  assert.equal(model.activeModuleCount, 1);
  assert.equal(model.modules.length, 4);
  assert.deepEqual(
    MANDIRI_MODULES.map(({ name, status }) => [name, status]),
    [
      ['Tanya Nusa', MANDIRI_MODULE_STATUSES.ACTIVE],
      ['NusaKasir', MANDIRI_MODULE_STATUSES.PLANNED],
      ['NusaBelajar', MANDIRI_MODULE_STATUSES.PLANNED],
      ['VitaSheet', MANDIRI_MODULE_STATUSES.PLANNED],
    ],
  );
});

test('markup menampilkan status modul secara jujur dan tidak memberi aksi palsu', () => {
  assert.equal((html.match(/data-module-status="active"/g) || []).length, 1);
  assert.equal((html.match(/data-module-status="planned"/g) || []).length, 3);
  assert.equal((html.match(/>Direncanakan</g) || []).length, 3);
  assert.equal((html.match(/>Belum tersedia pada Fase 1</g) || []).length, 3);
  assert.match(html, /data-mandiri-module="tanya-nusa"[\s\S]*href="\.\.\/index\.html"[\s\S]*>Buka modul</);
  assert.doesNotMatch(html, /data-mandiri-module="(?:nusakasir|nusabelajar|vitasheet)"[\s\S]{0,500}<a\b/i);
});

test('status local-only, backup scope, checksum, dan preview-only terlihat', () => {
  assert.match(html, /Mandiri • Local-only/);
  assert.match(html, /Sistem lokal aktif/);
  assert.match(html, /account dan workspace aktif/i);
  assert.match(html, /Checksum SHA-256/);
  assert.match(html, /Preview-only/);
  assert.match(html, /Restore preview tidak menulis atau mengganti data/);
  assert.doesNotMatch(html, /cloud sync aktif|tersinkron ke cloud|restore selesai/i);
});

test('navigasi memakai landmark semantik, link relatif, dan fokus keyboard yang terlihat', () => {
  assert.match(html, /<aside[\s\S]*data-mandiri-sidebar/);
  assert.match(html, /<nav[^>]*aria-label="Menu utama Mandiri"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /data-mandiri-sidebar-toggle[\s\S]*aria-expanded="false"/);
  assert.match(css, /:focus-visible/);
  assert.match(appShellSource, /event\.key === 'Escape'/);
  assert.match(appShellSource, /event\.key !== 'Tab'/);
});

test('drawer mobile dapat dibuka, ditutup dengan Escape, dan mengembalikan fokus', () => {
  const fixture = createNavigationFixture();
  const controller = initMandiriDashboardNavigation({
    documentRef: fixture.documentRef,
    windowRef: fixture.windowRef,
  });

  assert.ok(controller);
  assert.equal(controller.isOpen(), false);
  controller.open();
  assert.equal(controller.isOpen(), true);
  assert.equal(fixture.root.dataset.sidebarOpen, 'true');
  assert.equal(fixture.overlay.hidden, false);
  assert.equal(fixture.attributes.get('toggle:aria-expanded'), 'true');
  assert.ok(fixture.classNames.has('vn-mandiri-sidebar-open'));

  let prevented = false;
  fixture.documentRef.dispatch('keydown', {
    key: 'Escape',
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(controller.isOpen(), false);
  assert.equal(fixture.root.dataset.sidebarOpen, 'false');
  assert.equal(fixture.focused.at(-1), 'toggle');

  controller.open();
  fixture.firstLink.dispatch('click');
  assert.equal(controller.isOpen(), false);
  assert.equal(fixture.focused.at(-1), 'toggle');

  controller.destroy();
});

test('focus trap drawer menjaga Tab tetap berada di navigasi mobile', () => {
  const fixture = createNavigationFixture();
  const controller = initMandiriDashboardNavigation({
    documentRef: fixture.documentRef,
    windowRef: fixture.windowRef,
  });
  controller.open();

  fixture.documentRef.activeElement = fixture.lastLink;
  let prevented = false;
  fixture.documentRef.dispatch('keydown', {
    key: 'Tab',
    shiftKey: false,
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(fixture.focused.at(-1), 'close');
  controller.destroy();
});

test('layout mengikuti empat, dua, lalu satu kolom tanpa horizontal scrolling', () => {
  assert.match(css, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*1180px\)[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*820px\)[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('dashboard tidak membuka jalur backend, cloud, atau HTML tidak tepercaya', () => {
  assert.doesNotMatch(appShellSource, /dangerouslySetInnerHTML|innerHTML\s*=|fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(appShellSource, /firestore|backend\//i);
  assert.match(html, /Data tidak boleh dicampur antar-account atau antar-workspace/);
});
