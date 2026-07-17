import test from 'node:test';
import assert from 'node:assert/strict';
import { lintContentSafety } from '../../../assets/js/mandiri/learning/content/content-safety.js';
import { normalizeCourse } from '../../../assets/js/mandiri/learning/domain/course.js';

function validCourse(overrides = {}) {
  return {
    courseId: 'course-menghitung-uang',
    programId: 'program-keterampilan-dasar',
    contentVersion: 1,
    locale: 'id-ID',
    title: 'Menghitung Uang',
    summary: 'Pelajaran singkat untuk menghitung uang.',
    learningObjective: 'Mengenali nilai dan menjumlahkan uang sederhana.',
    moduleIds: ['module-nilai-uang'],
    prerequisiteCourseIds: [],
    status: 'published',
    ...overrides,
  };
}

test('course valid diterima tanpa memutasi input', () => {
  const input = validCourse();
  const snapshot = structuredClone(input);
  const course = normalizeCourse(input);
  assert.equal(course.courseId, input.courseId);
  assert.equal(Object.isFrozen(course), true);
  assert.deepEqual(input, snapshot);
});

test('course menolak self prerequisite dan moduleIds duplicate', () => {
  assert.throws(() => normalizeCourse(validCourse({
    prerequisiteCourseIds: ['course-menghitung-uang'],
  })), { code: 'self_prerequisite' });
  assert.throws(() => normalizeCourse(validCourse({
    moduleIds: ['module-nilai-uang', 'module-nilai-uang'],
  })), { code: 'duplicate_id' });
});

test('course menolak field tambahan', () => {
  assert.throws(() => normalizeCourse(validCourse({ workspaceId: 'workspace-other' })), {
    code: 'unknown_field',
  });
});

test('lint mendeteksi klaim kesetaraan sekolah pada objective', () => {
  const findings = lintContentSafety(validCourse({
    learningObjective: 'Program ini setara SD dan pasti lulus.',
  }), { path: 'course' });
  assert.equal(findings.some((finding) => finding.code === 'formal_education_claim'), true);
});
