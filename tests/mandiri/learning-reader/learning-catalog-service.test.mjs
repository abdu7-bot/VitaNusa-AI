import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningCatalogService } from '../../../assets/js/mandiri/learning/services/learning-catalog-service.js';
import { createPublishedLoaders } from './fixtures.mjs';

test('catalog service mempertahankan urutan Program, Course, Module, dan tiga Lesson', async () => {
  const service = createLearningCatalogService(createPublishedLoaders());
  const view = await service.getCatalogView();
  assert.equal(view.packages.length, 1);
  const [program] = view.packages[0].programs;
  assert.equal(program.title, 'Keterampilan Dasar Sehari-hari');
  const [course] = program.courses;
  assert.equal(course.title, 'Menghitung Uang Sederhana');
  const [module] = course.modules;
  assert.equal(module.title, 'Belanja dan Kembalian');
  assert.deepEqual(module.lessons.map((lesson) => lesson.title), [
    'Membaca Harga',
    'Menjumlahkan Dua Harga',
    'Menghitung Kembalian Sederhana',
  ]);
});

test('catalog public model tidak memuat jawaban benar atau entity draft', async () => {
  const service = createLearningCatalogService(createPublishedLoaders());
  const view = await service.getCatalogView();
  assert.doesNotMatch(JSON.stringify(view), /correctAnswer|"draft"/u);
  assert.match(view.localOnlyNotice, /belum disimpan/u);
});

test('catalog output immutable dan snapshot loader dicache per instance', async () => {
  const loaders = createPublishedLoaders();
  let catalogCalls = 0;
  const original = loaders.catalogLoader.loadCatalog;
  const service = createLearningCatalogService({
    ...loaders,
    catalogLoader: {
      async loadCatalog() { catalogCalls += 1; return original(); },
    },
  });
  const first = await service.getCatalogView();
  const second = await service.getCatalogView();
  assert.equal(catalogCalls, 1);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.packages), true);
  assert.deepEqual(first, second);
  assert.throws(() => { first.packages.push({}); }, TypeError);
});
