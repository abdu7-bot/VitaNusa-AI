import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isContentSafetyClean,
  lintContentSafety,
} from '../../../assets/js/mandiri/learning/content/content-safety.js';

test('lint mendeteksi bahasa merendahkan dengan path', () => {
  const findings = lintContentSafety({ title: 'Kamu bodoh dan tidak mampu.' }, { path: 'lesson' });
  assert.equal(findings.some((finding) => finding.code === 'degrading_language'), true);
  assert.equal(findings[0].path, 'lesson.title');
});

test('kalimat netral tentang kegagalan teknis tidak false positive', () => {
  assert.equal(isContentSafetyClean({ text: 'Jika koneksi gagal, coba lagi.' }), true);
});

test('lint mendeteksi klaim sekolah', () => {
  const findings = lintContentSafety({ text: 'Program ini pengganti sekolah dan pasti lulus.' });
  assert.equal(findings.some((finding) => finding.code === 'formal_education_claim'), true);
});

test('lint mendeteksi klaim kesehatan', () => {
  const findings = lintContentSafety({ text: 'Cara ini pasti sembuh dan 100% aman.' });
  assert.equal(findings.some((finding) => finding.code === 'health_claim'), true);
});

test('lint mendeteksi klaim keuntungan', () => {
  const findings = lintContentSafety({ text: 'Ikuti langkah ini, laba dijamin.' });
  assert.equal(findings.some((finding) => finding.code === 'business_claim'), true);
});

test('lint tidak memodifikasi input dan hasil immutable', () => {
  const input = { sections: [{ text: 'Belajar satu langkah pada satu waktu.' }] };
  const snapshot = structuredClone(input);
  const findings = lintContentSafety(input);
  assert.deepEqual(input, snapshot);
  assert.equal(Object.isFrozen(findings), true);
});

test('lint menolak struktur terlalu dalam dan dangerous key', () => {
  let nested = { text: 'aman' };
  for (let index = 0; index < 22; index += 1) nested = { child: nested };
  assert.throws(() => lintContentSafety(nested), { code: 'excessive_nesting' });
  const dangerous = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => lintContentSafety(dangerous), { code: 'dangerous_key' });
});
