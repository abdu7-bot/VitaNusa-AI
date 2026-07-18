import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLessonPageController,
  renderLessonReader,
} from '../../../assets/js/mandiri/learning/ui/lesson-page.js';
import { FakeDocument, collectText, createSpyView } from './fixtures.mjs';

const lessonView = Object.freeze({
  package: { title: 'Menghitung Uang Sederhana', contentVersion: 1, locale: 'id-ID' },
  program: { title: 'Keterampilan Dasar Sehari-hari' },
  course: { title: 'Menghitung Uang Sederhana' },
  module: { title: 'Belanja dan Kembalian' },
  lesson: {
    lessonId: 'lesson-read-prices-id',
    title: 'Membaca Harga',
    summary: 'Membaca harga rupiah.',
    learningObjective: 'Pengguna dapat membaca harga.',
    estimatedMinutes: 6,
    blocks: [{ blockId: 'block-one-id', type: 'paragraph', text: 'Materi aman.', items: [] }],
    activities: [],
    exercises: [],
  },
  navigation: { previousLessonId: null, nextLessonId: 'lesson-add-prices-id' },
  localOnlyNotice: 'Jawaban hanya berada di memori halaman ini.',
});

test('disabled tidak parse route atau membuat service', async () => {
  let calls = 0;
  const controller = createLessonPageController({
    contract: { enabled: false },
    view: createSpyView(),
    search: '?lesson=lesson-read-prices-id',
    serviceFactory() { calls += 1; },
  });
  await controller.whenSettled();
  assert.equal(controller.getState().state, 'disabled');
  assert.equal(calls, 0);
});

test('lesson valid menjadi ready dan evaluator privat dikonfigurasi', async () => {
  const view = createSpyView();
  const service = {
    async getLessonView() { return lessonView; },
    evaluateExercise() { return { correct: true }; },
    destroy() {},
  };
  const controller = createLessonPageController({
    contract: { enabled: true },
    view,
    search: '?lesson=lesson-read-prices-id',
    serviceFactory: () => service,
  });
  await controller.whenSettled();
  assert.equal(controller.getState().state, 'ready');
  assert.equal(typeof view.evaluator, 'function');
});

test('route invalid menjadi not_found tanpa membuat service', async () => {
  let calls = 0;
  const controller = createLessonPageController({
    contract: { enabled: true },
    view: createSpyView(),
    search: '?lesson=../../content.json',
    serviceFactory() { calls += 1; },
  });
  await controller.whenSettled();
  assert.equal(controller.getState().state, 'not_found');
  assert.equal(calls, 0);
});

test('reader menampilkan breadcrumb, objective, memory notice, dan navigation', () => {
  const rendered = renderLessonReader(new FakeDocument(), lessonView, {
    evaluateExercise: async () => ({}),
  });
  const text = collectText(rendered.fragment);
  assert.match(text, /Keterampilan Dasar Sehari-hari/u);
  assert.match(text, /Tujuan: Pengguna dapat membaca harga/u);
  assert.match(text, /Jawaban hanya berada di memori/u);
  assert.match(text, /Pelajaran berikutnya/u);
  assert.doesNotMatch(text, /correctAnswer|nilai akhir|mastery/u);
});

test('controller baru tidak memulihkan jawaban atau service instance lama', async () => {
  let instances = 0;
  const create = () => {
    instances += 1;
    return {
      async getLessonView() { return lessonView; },
      evaluateExercise() { return {}; },
      destroy() {},
    };
  };
  const first = createLessonPageController({
    contract: { enabled: true }, view: createSpyView(),
    search: '?lesson=lesson-read-prices-id', serviceFactory: create,
  });
  await first.whenSettled();
  first.destroy();
  const second = createLessonPageController({
    contract: { enabled: true }, view: createSpyView(),
    search: '?lesson=lesson-read-prices-id', serviceFactory: create,
  });
  await second.whenSettled();
  assert.equal(instances, 2);
});

test('destroy melepas view dan service', async () => {
  const view = createSpyView();
  let serviceDestroyed = false;
  const controller = createLessonPageController({
    contract: { enabled: true }, view,
    search: '?lesson=lesson-read-prices-id',
    serviceFactory: () => ({
      async getLessonView() { return lessonView; },
      evaluateExercise() {},
      destroy() { serviceDestroyed = true; },
    }),
  });
  await controller.whenSettled();
  controller.destroy();
  assert.equal(view.destroyed, true);
  assert.equal(serviceDestroyed, true);
});
