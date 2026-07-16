import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildVitaCheckHistoryPayload,
  createDocumentOperationGuard,
  createSafeLocalVitaCheckResult,
  mapVitaCheckHistoryError,
  normalizeVitaCheckHistoryRecord,
  readLocalVitaCheckResult,
  validateVitaCheckHistoryPayload,
} from '../assets/js/modules/vitacheck-history.js';

const VALID_INPUT = Object.freeze({
  resultId: 'vc2-history-test-result',
  version: 2,
  score: 68,
  resultBand: 'medium',
  focusIds: ['tidur', 'gerak'],
  attentionIds: ['pencernaan'],
  recommendationSlugs: ['tidur-dan-energi-harian'],
  source: 'vitacheck-v2',
});

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: (key) => values.get(key),
  };
}

test('payload VitaCheck valid diterima', () => {
  const payload = buildVitaCheckHistoryPayload(VALID_INPUT, {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  assert.equal(validateVitaCheckHistoryPayload(payload).valid, true);
  assert.deepEqual(Object.keys(payload), [
    'version', 'score', 'resultBand', 'focusIds', 'attentionIds',
    'recommendationSlugs', 'source', 'createdAt',
  ]);
});

test('score string integer dinormalisasi dengan aman', () => {
  const payload = buildVitaCheckHistoryPayload({ ...VALID_INPUT, score: ' 68 ' });
  assert.equal(payload.score, 68);
});

test('score invalid ditolak', () => {
  assert.throws(
    () => buildVitaCheckHistoryPayload({ ...VALID_INPUT, score: '68.5' }),
    (error) => error.code === 'invalid-argument',
  );
});

test('raw answers tidak ikut payload cloud', () => {
  const payload = buildVitaCheckHistoryPayload({
    ...VALID_INPUT,
    answers: [{ questionId: 'tidur', value: 0, label: 'contoh' }],
  });
  assert.equal(Object.hasOwn(payload, 'answers'), false);
});

test('free text tidak ikut payload cloud', () => {
  const payload = buildVitaCheckHistoryPayload({
    ...VALID_INPUT,
    freeText: 'catatan pribadi untuk test',
    symptoms: ['contoh'],
  });
  assert.equal(Object.hasOwn(payload, 'freeText'), false);
  assert.equal(Object.hasOwn(payload, 'symptoms'), false);
});

test('result band valid diterima', () => {
  for (const resultBand of ['strong', 'medium', 'low']) {
    const payload = buildVitaCheckHistoryPayload({ ...VALID_INPUT, resultBand });
    assert.equal(payload.resultBand, resultBand);
  }
});

test('result band invalid ditolak', () => {
  assert.throws(
    () => buildVitaCheckHistoryPayload({ ...VALID_INPUT, resultBand: 'healthy' }),
    (error) => error.code === 'invalid-argument',
  );
});

test('focusIds hanya menerima kategori yang dikenal', () => {
  const payload = buildVitaCheckHistoryPayload({ ...VALID_INPUT, focusIds: ['tidur', 'air'] });
  assert.deepEqual(payload.focusIds, ['tidur', 'air']);
  assert.throws(
    () => buildVitaCheckHistoryPayload({ ...VALID_INPUT, focusIds: ['unknown-category'] }),
    (error) => error.code === 'invalid-argument',
  );
});

test('attentionIds hanya menerima kategori yang dikenal', () => {
  assert.throws(
    () => buildVitaCheckHistoryPayload({ ...VALID_INPUT, attentionIds: ['diagnosis'] }),
    (error) => error.code === 'invalid-argument',
  );
});

test('rekomendasi dinormalisasi unik dan dibatasi tiga', () => {
  const payload = buildVitaCheckHistoryPayload({
    ...VALID_INPUT,
    recommendationSlugs: ['artikel-satu', 'artikel-satu', 'artikel-dua', 'artikel-tiga', 'artikel-empat'],
  });
  assert.deepEqual(payload.recommendationSlugs, ['artikel-satu', 'artikel-dua', 'artikel-tiga']);
});

test('duplicate result ID yang sedang diproses ditolak', async () => {
  const guard = createDocumentOperationGuard();
  let release;
  const first = guard.run('vc2-duplicate-test', () => new Promise((resolve) => {
    release = resolve;
  }));

  await assert.rejects(
    guard.run('vc2-duplicate-test', async () => 'should-not-run'),
    (error) => error.code === 'operation-in-progress',
  );
  release('done');
  assert.equal(await first, 'done');
});

test('data localStorage lama dibaca dan dimigrasikan tanpa jawaban mentah', () => {
  const storage = memoryStorage({
    'vitanusa-vitacheck-v2-result': JSON.stringify({
      version: 2,
      score: 50,
      answers: [
        { questionId: 'tidur', value: 0, label: 'contoh' },
        { questionId: 'gerak', value: 1, label: 'contoh' },
      ],
      articles: [{ slug: 'tidur-dan-energi-harian' }],
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  });
  const result = readLocalVitaCheckResult(storage);
  assert.equal(result.score, 50);
  assert.deepEqual(result.focusIds, ['tidur']);
  assert.deepEqual(result.attentionIds, ['tidur']);
  assert.equal(Object.hasOwn(result, 'answers'), false);
  assert.doesNotMatch(storage.dump('vitanusa-vitacheck-v2-result'), /answers|label/);
});

test('JSON localStorage rusak tidak membuat aplikasi crash', () => {
  const storage = memoryStorage({
    'vitanusa-vitacheck-v2-result': '{not-json',
  });
  assert.equal(readLocalVitaCheckResult(storage), null);
});

test('permission denied dipetakan dengan benar', () => {
  const mapped = mapVitaCheckHistoryError({ code: 'firestore/permission-denied' });
  assert.equal(mapped.code, 'permission-denied');
  assert.match(mapped.message, /Firestore Rules/i);
});

test('error jaringan dipetakan dengan benar', () => {
  for (const code of ['unavailable', 'deadline-exceeded']) {
    const mapped = mapVitaCheckHistoryError({ code });
    assert.equal(mapped.code, code);
    assert.match(mapped.message, /Firestore|koneksi/i);
  }
});

test('pengguna belum login ditangani tanpa detail mentah', () => {
  const mapped = mapVitaCheckHistoryError({
    code: 'unauthenticated',
    message: 'internal-auth-test-detail',
  });
  assert.equal(mapped.code, 'unauthenticated');
  assert.match(mapped.message, /login/i);
  assert.doesNotMatch(JSON.stringify(mapped), /internal-auth-test-detail/);
});

test('hasil lokal aman tidak memuat field pribadi tambahan', () => {
  const localResult = createSafeLocalVitaCheckResult({
    ...VALID_INPUT,
    answers: [{ questionId: 'tidur', value: 0 }],
    freeText: 'data-test',
    diagnosis: 'data-test',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(Object.hasOwn(localResult, 'answers'), false);
  assert.equal(Object.hasOwn(localResult, 'freeText'), false);
  assert.equal(Object.hasOwn(localResult, 'diagnosis'), false);
});

test('normalisasi dapat menurunkan ID kategori dari payload lama', () => {
  const normalized = normalizeVitaCheckHistoryRecord({
    version: 2,
    score: 40,
    answers: [
      { questionId: 'makan', value: 0 },
      { questionId: 'air', value: 1 },
    ],
  });
  assert.deepEqual(normalized.focusIds, ['makan']);
  assert.deepEqual(normalized.attentionIds, ['makan']);
});

test('create cloud memakai transaction dan menolak overwrite resultId lama', async () => {
  const source = await readFile(
    new URL('../assets/js/modules/vitacheck-history.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /runTransaction\(runtime\.db/);
  assert.match(source, /existing\.exists\(\)/);
  assert.match(source, /createHistoryError\('already-exists'/);
  assert.doesNotMatch(source, /setDoc\(/);
});
