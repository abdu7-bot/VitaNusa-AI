import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModule } from '../../../assets/js/mandiri/learning/domain/module.js';

function validModule(overrides = {}) {
  return {
    moduleId: 'module-nilai-uang',
    courseId: 'course-menghitung-uang',
    contentVersion: 1,
    locale: 'id-ID',
    title: 'Mengenal Nilai Uang',
    summary: 'Mengenali nilai uang dalam contoh sehari-hari.',
    learningObjective: 'Membaca nilai uang dengan tepat.',
    lessonIds: ['lesson-membaca-harga'],
    status: 'published',
    ...overrides,
  };
}

test('module valid diterima dan hasil tidak berbagi array input', () => {
  const input = validModule();
  const module = normalizeModule(input);
  assert.equal(module.moduleId, input.moduleId);
  assert.notEqual(module.lessonIds, input.lessonIds);
  assert.equal(Object.isFrozen(module.lessonIds), true);
});

test('module menolak lessonIds kosong dan duplicate', () => {
  assert.throws(() => normalizeModule(validModule({ lessonIds: [] })), { code: 'array_too_short' });
  assert.throws(() => normalizeModule(validModule({
    lessonIds: ['lesson-membaca-harga', 'lesson-membaca-harga'],
  })), { code: 'duplicate_id' });
});

test('module menolak field tidak dikenal', () => {
  assert.throws(() => normalizeModule(validModule({ ownerUid: 'user-secret' })), {
    code: 'unknown_field',
  });
});
