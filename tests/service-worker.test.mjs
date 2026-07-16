import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const workerUrl = new URL('../service-worker.js', import.meta.url);
const source = await readFile(workerUrl, 'utf8');

test('service worker mempunyai syntax valid dan cache version', () => {
  const result = spawnSync(process.execPath, ['--check', workerUrl.pathname], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(source, /CACHE_NAME = `\$\{CACHE_PREFIX}v\d+-/);
});

test('base path berasal dari registration scope, bukan hanya /VitaNusa-AI', () => {
  assert.match(source, /new URL\(self\.registration\.scope\)/);
  assert.doesNotMatch(source, /BASE_PATH\s*=\s*['"]\/VitaNusa-AI/);
});

test('offline page tersedia dan menjadi fallback navigasi', async () => {
  await access(new URL('../offline.html', import.meta.url));
  assert.match(source, /const OFFLINE_URL = scopedUrl\('offline\.html'\)/);
  assert.match(source, /getOfflineResponse/);
});

test('ask, health, feedback, dan request non-GET tidak dicache', () => {
  assert.match(source, /API_PATH_PATTERN = \/\\\/\(\?:ask\|health\|feedback\)/);
  assert.match(source, /if \(request\.method !== 'GET'\) return true/);
});

test('Firebase Auth dan Firestore tidak dicache', () => {
  for (const host of [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebaseio.com',
  ]) {
    assert.match(source, new RegExp(host.replaceAll('.', '\\.')));
  }
  assert.match(source, /isExternalDataHost\(url\.hostname\)/);
});

test('halaman admin tetap network-only', () => {
  assert.match(source, /if \(isAdminRequest\(request\)\) \{\s*event\.respondWith\(networkOnly\(request\)\);/);
  assert.doesNotMatch(source, /APP_SHELL[\s\S]{0,2200}admin\/login\.html/);
});

test('query Share Target tidak menjadi cache key', () => {
  assert.match(source, /url\.pathname === SHARE_TARGET_PATH && url\.search\) return null/);
  assert.match(source, /const shareTargetShell = scopedUrl\('share-target\.html'\)/);
  assert.match(source, /networkFirst\(shareTargetShell, \{\s*cacheKey: shareTargetShell,/);
  assert.doesNotMatch(source, /isShareTargetRequest[\s\S]{0,360}networkFirst\(request,/);
});

test('worker baru menunggu perintah SKIP_WAITING', () => {
  const installBlock = source.match(/self\.addEventListener\('install'[\s\S]*?\n}\);/)?.[0] || '';
  assert.doesNotMatch(installBlock, /skipWaiting/);
  assert.match(source, /event\.data\?\.type === 'SKIP_WAITING'/);
  assert.match(source, /event\.waitUntil\(self\.skipWaiting\(\)\)/);
});
