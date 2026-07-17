import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCatalogPageController,
  renderCatalogHierarchy,
} from '../../../assets/js/mandiri/learning/ui/catalog-page.js';
import { learningContentError } from '../../../assets/js/mandiri/learning/data/content-loader-errors.js';
import { FakeDocument, collectText, createSpyView, findAll } from './fixtures.mjs';

const catalogView = Object.freeze({
  localOnlyNotice: 'Jawaban belum disimpan.',
  packages: Object.freeze([{
    packageId: 'money-basics-id-v1',
    title: 'Menghitung Uang Sederhana',
    programs: [{
      title: 'Keterampilan Dasar Sehari-hari',
      summary: 'Ringkasan program.',
      courses: [{
        title: 'Menghitung Uang Sederhana',
        summary: 'Ringkasan course.',
        modules: [{
          title: 'Belanja dan Kembalian',
          summary: 'Ringkasan module.',
          lessons: [
            { lessonId: 'lesson-read-prices-id', title: 'Membaca Harga', summary: 'Satu', estimatedMinutes: 6 },
            { lessonId: 'lesson-add-prices-id', title: 'Menjumlahkan Dua Harga', summary: 'Dua', estimatedMinutes: 8 },
            { lessonId: 'lesson-calculate-change-id', title: 'Menghitung Kembalian Sederhana', summary: 'Tiga', estimatedMinutes: 8 },
          ],
        }],
      }],
    }],
  }]),
});

test('disabled tidak memanggil service dan tidak bind listener', async () => {
  const view = createSpyView();
  let calls = 0;
  const controller = createCatalogPageController({
    contract: { enabled: false },
    view,
    serviceFactory() { calls += 1; },
  });
  await controller.whenSettled();
  assert.equal(controller.getState().state, 'disabled');
  assert.equal(calls, 0);
  assert.equal(view.callbacks, null);
});

test('loading menjadi ready dengan catalog public model', async () => {
  const view = createSpyView();
  const controller = createCatalogPageController({
    contract: { enabled: true },
    view,
    serviceFactory: () => ({ async getCatalogView() { return catalogView; } }),
  });
  await controller.whenSettled();
  assert.deepEqual(view.models.map((model) => model.state), ['loading', 'loading', 'ready']);
  assert.equal(controller.getState().data, catalogView);
});

test('catalog kosong menghasilkan empty', async () => {
  const controller = createCatalogPageController({
    contract: { enabled: true },
    view: createSpyView(),
    serviceFactory: () => ({ async getCatalogView() { return { packages: [] }; } }),
  });
  await controller.whenSettled();
  assert.equal(controller.getState().state, 'empty');
});

test('checksum error aman dan retry dapat berhasil', async () => {
  let calls = 0;
  const controller = createCatalogPageController({
    contract: { enabled: true },
    view: createSpyView(),
    serviceFactory: () => ({
      async getCatalogView() {
        calls += 1;
        if (calls === 1) throw learningContentError('checksum_mismatch');
        return catalogView;
      },
    }),
  });
  await controller.whenSettled();
  assert.equal(controller.getState().state, 'error');
  assert.doesNotMatch(controller.getState().message, /sha256:|content\.json/u);
  await controller.retry();
  assert.equal(controller.getState().state, 'ready');
});

test('error asing tidak membocorkan URL atau payload mentah', async () => {
  const controller = createCatalogPageController({
    contract: { enabled: true },
    view: createSpyView(),
    serviceFactory: () => ({
      async getCatalogView() {
        throw new Error('https://evil.test/secret?answer=3000');
      },
    }),
  });
  await controller.whenSettled();
  assert.equal(controller.getState().state, 'error');
  assert.doesNotMatch(controller.getState().message, /evil|secret|3000/u);
});

test('destroy melepas view listener', async () => {
  const view = createSpyView();
  const controller = createCatalogPageController({
    contract: { enabled: true },
    view,
    serviceFactory: () => ({ async getCatalogView() { return catalogView; } }),
  });
  await controller.whenSettled();
  controller.destroy();
  assert.equal(view.destroyed, true);
});

test('catalog hierarchy menampilkan tiga lesson dan link relatif aman', () => {
  const fragment = renderCatalogHierarchy(new FakeDocument(), catalogView);
  const text = collectText(fragment);
  assert.match(text, /Keterampilan Dasar Sehari-hari/u);
  assert.match(text, /Belanja dan Kembalian/u);
  assert.equal((text.match(/Buka pelajaran/gu) || []).length, 3);
  const links = findAll(fragment, (node) => node.tagName === 'A');
  assert.ok(links.every((link) => link.href.startsWith('./lesson.html?lesson=lesson-')));
  assert.doesNotMatch(text, /correctAnswer|raw JSON/u);
});
