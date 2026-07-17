import test from 'node:test';
import assert from 'node:assert/strict';
import { backupError } from '../../../assets/js/mandiri/export/backup-errors.js';
import {
  createRecoveryPageController,
  createRecoveryPageModel,
  renderRecoveryPage,
} from '../../../assets/js/mandiri/shell/recovery-page.js';
import { ACCOUNT_A } from '../export/fixtures.mjs';

const PREVIEW = Object.freeze({
  workspaceName: '<script>tetap teks</script>',
  timezone: 'Asia/Jakarta',
  currencyCode: 'IDR',
  workspaceStatus: 'active',
  membershipCount: 1,
  auditEventCount: 1,
  operationReceiptCount: 1,
  createdAt: '2026-07-17T01:00:00.000Z',
  formatVersion: 1,
  databaseSchemaVersion: 1,
  checksumStatus: 'valid',
  scopeStatus: 'matched',
});

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function viewFixture() {
  const models = [];
  let handlers;
  let cleared = 0;
  return {
    models,
    render(model) { models.push(model); },
    bind(value) { handlers = value; },
    clearFile() { cleared += 1; },
    destroy() {},
    get handlers() { return handlers; },
    get cleared() { return cleared; },
  };
}

test('feature off memblokir input tanpa subscribe auth atau membuka database', () => {
  const view = viewFixture();
  let subscriptions = 0;
  const controller = createRecoveryPageController({
    featureState: 'off',
    view,
    subscribeAuth() { subscriptions += 1; },
    signIn() {},
  });
  assert.equal(controller.getState().state, 'feature-off');
  assert.equal(subscriptions, 0);
  assert.equal(view.handlers, undefined);
});

test('signed out meminta login lalu signed in mengaktifkan file input state', async () => {
  const view = viewFixture();
  let listener;
  const controller = createRecoveryPageController({
    featureState: 'internal',
    view,
    subscribeAuth(next) { listener = next; return () => {}; },
    signIn: async () => {},
    createScope: async () => ACCOUNT_A,
  });
  listener({ isAuthenticated: false, user: null });
  assert.equal(controller.getState().state, 'signed-out');
  listener({ isAuthenticated: true, user: { uid: 'uid-a' } });
  await flush();
  assert.equal(controller.getState().state, 'ready');
});

test('file belum dipilih tidak dapat diperiksa', async () => {
  const view = viewFixture();
  let listener;
  const controller = createRecoveryPageController({
    featureState: 'internal',
    view,
    subscribeAuth(next) { listener = next; return () => {}; },
    signIn: async () => {},
    createScope: async () => ACCOUNT_A,
  });
  listener({ isAuthenticated: true, user: { uid: 'uid-a' } });
  await flush();
  await assert.rejects(controller.check(null), { code: 'backup_invalid' });
});

test('processing memakai busy state dan preview valid tampil', async () => {
  const view = viewFixture();
  let listener;
  let resolvePreview;
  const controller = createRecoveryPageController({
    featureState: 'internal',
    view,
    subscribeAuth(next) { listener = next; return () => {}; },
    signIn: async () => {},
    createScope: async () => ACCOUNT_A,
    previewFile: () => new Promise((resolve) => { resolvePreview = resolve; }),
  });
  listener({ isAuthenticated: true, user: { uid: 'uid-a' } });
  await flush();
  controller.fileSelected(true);
  const operation = controller.check({ size: 1 });
  assert.equal(controller.getState().state, 'processing');
  await Promise.resolve();
  resolvePreview(PREVIEW);
  await operation;
  assert.equal(controller.getState().state, 'preview');
  assert.equal(controller.getState().preview.workspaceName, PREVIEW.workspaceName);
});

test('checksum error dan scope mismatch ditampilkan sebagai pesan aman', async () => {
  for (const code of ['checksum_mismatch', 'scope_mismatch']) {
    const view = viewFixture();
    let listener;
    const controller = createRecoveryPageController({
      featureState: 'internal',
      view,
      subscribeAuth(next) { listener = next; return () => {}; },
      signIn: async () => {},
      createScope: async () => ACCOUNT_A,
      previewFile: async () => { throw backupError(code); },
    });
    listener({ isAuthenticated: true, user: { uid: 'uid-a' } });
    await flush();
    await assert.rejects(controller.check({ size: 1 }), { code });
    assert.equal(controller.getState().state, 'error');
    assert.doesNotMatch(JSON.stringify(controller.getState()), /account:[0-9a-f]|raw JSON|operationId/);
  }
});

test('nama workspace dirender melalui textContent dan raw JSON tidak ditampilkan', () => {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { hidden: false, disabled: false, textContent: '', dataset: {} });
    return elements.get(selector);
  };
  const root = {
    dataset: {},
    setAttribute() {},
    querySelector(selector) { return element(selector); },
  };
  renderRecoveryPage(root, createRecoveryPageModel('preview', { hasFile: true, preview: PREVIEW }));
  assert.equal(element('[data-preview-workspace-name]').textContent, PREVIEW.workspaceName);
  assert.equal('innerHTML' in element('[data-preview-workspace-name]'), false);
  assert.doesNotMatch(JSON.stringify([...elements.values()]), /accountScope|operationId|payloadDigest/);
});

test('auth berubah membersihkan preview lama dan hasil async lama diabaikan', async () => {
  const view = viewFixture();
  let listener;
  let resolveOld;
  const controller = createRecoveryPageController({
    featureState: 'internal',
    view,
    subscribeAuth(next) { listener = next; return () => {}; },
    signIn: async () => {},
    createScope: async () => ACCOUNT_A,
    previewFile: () => new Promise((resolve) => { resolveOld = resolve; }),
  });
  listener({ isAuthenticated: true, user: { uid: 'uid-a' } });
  await flush();
  const operation = controller.check({ size: 1 });
  await Promise.resolve();
  listener({ isAuthenticated: false, user: null });
  resolveOld(PREVIEW);
  assert.equal(await operation, null);
  assert.equal(controller.getState().state, 'signed-out');
  assert.ok(view.cleared >= 2);
});

test('destroy melepas auth listener dan HTML tidak mempunyai tombol restore', async () => {
  const view = viewFixture();
  let unsubscribed = 0;
  const controller = createRecoveryPageController({
    featureState: 'internal',
    view,
    subscribeAuth() { return () => { unsubscribed += 1; }; },
    signIn: async () => {},
  });
  controller.destroy();
  assert.equal(unsubscribed, 1);
  const html = await import('node:fs/promises').then((fs) => fs.readFile(
    new URL('../../../mandiri/recovery.html', import.meta.url),
    'utf8',
  ));
  assert.doesNotMatch(html, /<button[^>]*>\s*(?:Pulihkan|Import|Ganti data|Hapus data)/i);
  assert.doesNotMatch(html, /data-(?:restore|import|write)/i);
});

test('recovery mempertahankan viewport mobile, safe area, target tombol, dan aria-live', async () => {
  const fs = await import('node:fs/promises');
  const [html, css] = await Promise.all([
    fs.readFile(new URL('../../../mandiri/recovery.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../../assets/css/vitanusa-mandiri.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /data-recovery-status[^>]*aria-live="polite"/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.vn-mandiri-button\s*\{[\s\S]*min-height:\s*46px/);
  assert.match(css, /@media \(max-width:\s*420px\)/);
});
