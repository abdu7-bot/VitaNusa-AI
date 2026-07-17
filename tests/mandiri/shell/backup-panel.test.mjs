import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeMandiriApp } from '../../../assets/js/mandiri/shell/app-shell.js';
import {
  createBackupPanelController,
  createBackupPanelModel,
} from '../../../assets/js/mandiri/shell/backup-panel.js';
import { backupError } from '../../../assets/js/mandiri/export/backup-errors.js';
import { createValidBackup } from '../export/fixtures.mjs';

function viewFixture() {
  const models = [];
  let handler;
  return {
    models,
    render(model) { models.push(model); },
    bind(next) { handler = next; },
    destroy() {},
    click() { return handler?.(); },
  };
}

test('feature off tidak menginisialisasi workspace atau backup storage', async () => {
  let initialized = 0;
  const root = { dataset: {}, querySelector(selector) {
    if (selector === '[data-mandiri-root]') return this;
    if (selector === '[data-mandiri-unavailable]') return { hidden: true };
    if (selector === '[data-mandiri-shell]') return { hidden: false };
    return null;
  } };
  const result = await initializeMandiriApp({
    documentRef: root,
    windowRef: {},
    featureState: 'off',
    initializeWorkspacePanel: () => { initialized += 1; },
  });
  assert.equal(initialized, 0);
  assert.equal(result.workspaceController, null);
});

test('signed out atau workspace kosong membuat panel tetap tersembunyi', () => {
  const view = viewFixture();
  const controller = createBackupPanelController({ view, downloader() {} });
  assert.equal(controller.getState().visible, false);
  controller.clear();
  assert.equal(controller.getState().visible, false);
});

test('workspace ready menampilkan tombol melalui model idle', async () => {
  const view = viewFixture();
  const controller = createBackupPanelController({ view, downloader() {} });
  controller.setWorkspace({
    backupService: { async createWorkspaceBackup() { return {}; } },
    accountScope: 'account:hash',
    workspaceId: 'workspace:test',
    workspaceName: 'Warung',
  });
  assert.deepEqual(controller.getState(), createBackupPanelModel('idle', { visible: true }));
});

test('preparing mencegah double submit dan satu download saja', async () => {
  const { backup } = await createValidBackup();
  let resolveBackup;
  let creates = 0;
  let downloads = 0;
  const view = viewFixture();
  const controller = createBackupPanelController({
    view,
    downloader() { downloads += 1; return { filename: 'backup.json' }; },
  });
  controller.setWorkspace({
    backupService: {
      createWorkspaceBackup() {
        creates += 1;
        return new Promise((resolve) => { resolveBackup = resolve; });
      },
    },
    accountScope: backup.accountScope,
    workspaceId: backup.workspaceId,
    workspaceName: backup.data.workspaces[0].name,
  });
  const first = controller.download();
  const second = controller.download();
  assert.equal(first, second);
  assert.equal(controller.getState().state, 'preparing');
  await Promise.resolve();
  resolveBackup(backup);
  await first;
  assert.equal(creates, 1);
  assert.equal(downloads, 1);
  assert.equal(controller.getState().state, 'success');
});

test('error aman ditampilkan dan identifier internal tidak masuk model', async () => {
  const view = viewFixture();
  const controller = createBackupPanelController({ view, downloader() {} });
  controller.setWorkspace({
    backupService: { async createWorkspaceBackup() { throw backupError('checksum_failed'); } },
    accountScope: 'account:secret-scope',
    workspaceId: 'workspace_internal-id',
    workspaceName: 'Warung',
  });
  await assert.rejects(controller.download(), { code: 'checksum_failed' });
  const serialized = JSON.stringify(controller.getState());
  assert.match(serialized, /Checksum backup tidak dapat/);
  assert.doesNotMatch(serialized, /account:|workspace_internal|uid|token/i);
});

test('controller destroy melepas view dan tidak menyimpan backup di localStorage', async () => {
  let destroyed = 0;
  const view = { render() {}, bind() {}, destroy() { destroyed += 1; } };
  const controller = createBackupPanelController({ view, downloader() {} });
  controller.destroy();
  assert.equal(destroyed, 1);
  const source = await import('node:fs/promises').then((fs) => fs.readFile(
    new URL('../../../assets/js/mandiri/shell/backup-panel.js', import.meta.url),
    'utf8',
  ));
  assert.doesNotMatch(source, /localStorage/);
});
