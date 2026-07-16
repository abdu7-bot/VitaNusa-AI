import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));

function isRelativeAppUrl(value) {
  return typeof value === 'string'
    && !value.startsWith('/')
    && !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

async function readPngSize(path) {
  const bytes = await readFile(new URL(path.replace(/^\.\//, ''), root));
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test('manifest adalah JSON valid dengan identitas VitaNusa', () => {
  assert.equal(manifest.name, 'VitaNusa AI');
  assert.equal(manifest.short_name, 'VitaNusa');
  assert.equal(manifest.lang, 'id');
});

test('id, start_url, dan scope tersedia serta relatif', () => {
  assert.equal(manifest.id, './');
  assert.equal(isRelativeAppUrl(manifest.start_url), true);
  assert.equal(isRelativeAppUrl(manifest.scope), true);
});

test('PWA dibuka standalone dengan orientasi portrait', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'portrait');
});

test('icon 192 tersedia dengan ukuran PNG yang benar', async () => {
  const icon = manifest.icons.find((item) => item.sizes === '192x192');
  assert.ok(icon);
  assert.deepEqual(await readPngSize(icon.src), { width: 192, height: 192 });
  assert.equal(icon.purpose, 'any');
});

test('icon 512 tersedia dengan ukuran PNG yang benar', async () => {
  const icon = manifest.icons.find((item) => item.sizes === '512x512');
  assert.ok(icon);
  assert.deepEqual(await readPngSize(icon.src), { width: 512, height: 512 });
  assert.equal(icon.purpose, 'any');
});

test('empat shortcut aplikasi tersedia', () => {
  assert.deepEqual(
    manifest.shortcuts.map((item) => item.name),
    ['Tanya Nusa', 'Mulai VitaCheck', 'Buka Akun', 'Baca Edukasi'],
  );
});

test('semua shortcut memakai URL relatif', () => {
  assert.equal(manifest.shortcuts.every((item) => isRelativeAppUrl(item.url)), true);
});

test('Share Target tersedia dengan metode GET dan action relatif', () => {
  assert.equal(manifest.share_target.method, 'GET');
  assert.equal(manifest.share_target.enctype, 'application/x-www-form-urlencoded');
  assert.equal(isRelativeAppUrl(manifest.share_target.action), true);
  assert.deepEqual(manifest.share_target.params, {
    title: 'title',
    text: 'text',
    url: 'url',
  });
});

test('manifest tidak mengunci domain atau base path repository', () => {
  const source = JSON.stringify(manifest);
  assert.doesNotMatch(source, /https?:\/\//i);
  assert.doesNotMatch(source, /\/VitaNusa-AI\//i);
});

test('deskripsi menyatakan batas non-diagnostik', () => {
  assert.match(manifest.description, /Bukan pengganti dokter atau tenaga kesehatan\./);
});
