import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLesson } from '../../../assets/js/mandiri/learning/domain/lesson.js';

function validLesson(overrides = {}) {
  return {
    lessonId: 'lesson-membaca-harga',
    moduleId: 'module-nilai-uang',
    contentVersion: 1,
    locale: 'id-ID',
    title: 'Membaca Harga',
    summary: 'Membaca harga dari contoh sederhana.',
    learningObjective: 'Mengenali angka yang menunjukkan harga.',
    estimatedMinutes: 8,
    blocks: [{
      blockId: 'block-pengantar',
      type: 'paragraph',
      text: 'Harga menunjukkan jumlah uang yang perlu dibayar.',
      items: [],
    }],
    activityIds: ['activity-contoh-harga'],
    exerciseIds: ['exercise-pilih-harga'],
    quizId: 'quiz-membaca-harga',
    status: 'published',
    ...overrides,
  };
}

test('lesson valid diterima dan nested output immutable', () => {
  const input = validLesson();
  const snapshot = structuredClone(input);
  const lesson = normalizeLesson(input);
  assert.equal(lesson.estimatedMinutes, 8);
  assert.equal(Object.isFrozen(lesson.blocks), true);
  assert.equal(Object.isFrozen(lesson.blocks[0]), true);
  assert.deepEqual(input, snapshot);
});

test('lesson menolak estimatedMinutes di bawah dan di atas batas', () => {
  assert.throws(() => normalizeLesson(validLesson({ estimatedMinutes: 0 })), {
    code: 'invalid_integer',
  });
  assert.throws(() => normalizeLesson(validLesson({ estimatedMinutes: 61 })), {
    code: 'invalid_integer',
  });
});

for (const [label, text, code] of [
  ['raw HTML', '<strong>Harga</strong>', 'raw_html_forbidden'],
  ['script', '<script>alert(1)</script>', 'raw_html_forbidden'],
  ['event handler', 'onclick=alert(1)', 'event_handler_forbidden'],
]) {
  test(`lesson menolak ${label}`, () => {
    const blocks = structuredClone(validLesson().blocks);
    blocks[0].text = text;
    assert.throws(() => normalizeLesson(validLesson({ blocks })), { code });
  });
}

test('lesson menolak duplicate block ID', () => {
  const block = validLesson().blocks[0];
  assert.throws(() => normalizeLesson(validLesson({ blocks: [block, { ...block }] })), {
    code: 'duplicate_id',
  });
});

test('lesson menolak unknown block type', () => {
  const blocks = structuredClone(validLesson().blocks);
  blocks[0].type = 'raw_html';
  assert.throws(() => normalizeLesson(validLesson({ blocks })), { code: 'unknown_block_type' });
});

test('simple_list hanya menerima items plain text', () => {
  const lesson = normalizeLesson(validLesson({
    blocks: [{
      blockId: 'block-daftar',
      type: 'simple_list',
      text: null,
      items: ['Baca harga.', 'Periksa jumlah uang.'],
    }],
  }));
  assert.equal(lesson.blocks[0].items.length, 2);
  assert.throws(() => normalizeLesson(validLesson({
    blocks: [{
      blockId: 'block-daftar', type: 'simple_list', text: 'Tidak boleh', items: ['Satu'],
    }],
  })), { code: 'invalid_block_shape' });
});
