import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProgram } from '../../../assets/js/mandiri/learning/domain/program.js';

function validProgram(overrides = {}) {
  return {
    programId: 'program-keterampilan-dasar',
    contentVersion: 1,
    locale: 'id-ID',
    title: 'Keterampilan Dasar',
    summary: 'Belajar keterampilan sehari-hari secara bertahap.',
    courseIds: ['course-menghitung-uang'],
    status: 'published',
    ...overrides,
  };
}

test('program valid diterima, dinormalisasi, dan immutable', () => {
  const input = validProgram({ title: '  Keterampilan Dasar  ' });
  const snapshot = structuredClone(input);
  const program = normalizeProgram(input);
  assert.equal(program.title, 'Keterampilan Dasar');
  assert.equal(program.schemaVersion, 1);
  assert.equal(Object.isFrozen(program), true);
  assert.equal(Object.isFrozen(program.courseIds), true);
  assert.deepEqual(input, snapshot);
  assert.notEqual(program.courseIds, input.courseIds);
});

test('program menolak courseIds duplicate dan kosong', () => {
  assert.throws(() => normalizeProgram(validProgram({
    courseIds: ['course-menghitung-uang', 'course-menghitung-uang'],
  })), { code: 'duplicate_id' });
  assert.throws(() => normalizeProgram(validProgram({ courseIds: [] })), { code: 'array_too_short' });
});

test('program menolak title kosong, contentVersion invalid, locale, dan status invalid', () => {
  assert.throws(() => normalizeProgram(validProgram({ title: ' ' })), { code: 'string_too_short' });
  assert.throws(() => normalizeProgram(validProgram({ contentVersion: 1.5 })), {
    code: 'invalid_content_version',
  });
  assert.throws(() => normalizeProgram(validProgram({ locale: 'en-US' })), {
    code: 'unsupported_locale',
  });
  assert.throws(() => normalizeProgram(validProgram({ status: 'active' })), {
    code: 'unknown_content_status',
  });
});

test('program menolak unknown field dan dangerous key', () => {
  assert.throws(() => normalizeProgram(validProgram({ token: 'not-a-real-token' })), {
    code: 'unknown_field',
  });
  const dangerous = JSON.parse(JSON.stringify(validProgram()));
  Object.defineProperty(dangerous, '__proto__', { enumerable: true, value: {} });
  assert.throws(() => normalizeProgram(dangerous), { code: 'dangerous_key' });
});
