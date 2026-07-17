import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { validateContentPackageGraph } from '../../../assets/js/mandiri/learning/content/content-validator.js';

const contentPath = new URL(
  '../../../content/mandiri/learning/packages/money-basics-id-v1/content.json',
  import.meta.url,
);

async function loadContent() {
  return JSON.parse(await readFile(contentPath, 'utf8'));
}

function allEntities(graph) {
  return [
    ...graph.programs,
    ...graph.courses,
    ...graph.modules,
    ...graph.lessons,
    ...graph.activities,
    ...graph.exercises,
    ...graph.quizzes,
  ];
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
}

test('content graph published valid, tidak dimutasi, dan hasil frozen', async () => {
  const input = await loadContent();
  const before = structuredClone(input);
  const graph = validateContentPackageGraph(input);

  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.lessons), true);
  assert.equal(Object.isFrozen(graph.lessons[0].blocks), true);
});

test('paket tepat mempunyai satu Program, Course, Module, tiga Lesson, dan satu Quiz', async () => {
  const graph = validateContentPackageGraph(await loadContent());
  assert.equal(graph.programs.length, 1);
  assert.equal(graph.courses.length, 1);
  assert.equal(graph.modules.length, 1);
  assert.equal(graph.lessons.length, 3);
  assert.equal(graph.quizzes.length, 1);
  assert.equal(graph.programs[0].title, 'Keterampilan Dasar Sehari-hari');
  assert.equal(graph.courses[0].title, 'Menghitung Uang Sederhana');
  assert.equal(graph.modules[0].title, 'Belanja dan Kembalian');
});

test('seluruh entity published, contentVersion 1, locale id-ID, dan schemaVersion 1', async () => {
  const graph = validateContentPackageGraph(await loadContent());
  for (const entity of allEntities(graph)) {
    assert.equal(entity.status, 'published');
    assert.equal(entity.contentVersion, 1);
    assert.equal(entity.locale, 'id-ID');
    assert.equal(entity.schemaVersion, 1);
  }
});

test('setiap Lesson mempunyai objective, contoh, activity, dan minimal tiga exercise', async () => {
  const graph = validateContentPackageGraph(await loadContent());
  for (const lesson of graph.lessons) {
    assert.ok(lesson.learningObjective.length > 0);
    assert.ok(lesson.blocks.some((block) => block.type === 'example'));
    assert.ok(lesson.activityIds.length >= 1);
    assert.ok(lesson.exerciseIds.length >= 3);
  }
});

test('setiap exercise mempunyai explanation dan numeric answer berupa integer non-negatif', async () => {
  const graph = validateContentPackageGraph(await loadContent());
  for (const exercise of graph.exercises) {
    assert.ok(exercise.explanation.length > 0);
    if (exercise.type === 'numeric_input') {
      assert.equal(Number.isSafeInteger(exercise.correctAnswer), true);
      assert.ok(exercise.correctAnswer >= 0);
    }
  }
});

test('seluruh angka pada content graph adalah safe integer non-negatif', async () => {
  const content = await loadContent();
  function visit(value) {
    if (typeof value === 'number') {
      assert.equal(Number.isSafeInteger(value), true);
      assert.ok(value >= 0);
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  }
  visit(content);
});

test('seluruh entity, block, activity item, dan choice ID unik pada package', async () => {
  const graph = validateContentPackageGraph(await loadContent());
  const ids = [
    ...graph.programs.map((entity) => entity.programId),
    ...graph.courses.map((entity) => entity.courseId),
    ...graph.modules.map((entity) => entity.moduleId),
    ...graph.lessons.map((entity) => entity.lessonId),
    ...graph.activities.map((entity) => entity.activityId),
    ...graph.exercises.map((entity) => entity.exerciseId),
    ...graph.quizzes.map((entity) => entity.quizId),
  ];
  graph.lessons.forEach((lesson) => lesson.blocks.forEach((block) => ids.push(block.blockId)));
  graph.activities.forEach((activity) => activity.items.forEach((item) => ids.push(item.itemId)));
  graph.exercises.forEach((exercise) => exercise.choices.forEach((choice) => ids.push(choice.choiceId)));
  assert.equal(new Set(ids).size, ids.length);
});

test('quiz module memakai enam exercise valid dan threshold 7000', async () => {
  const graph = validateContentPackageGraph(await loadContent());
  const quiz = graph.quizzes[0];
  const exerciseIds = new Set(graph.exercises.map((exercise) => exercise.exerciseId));
  assert.equal(quiz.moduleId, 'module-shopping-change-id');
  assert.equal(quiz.lessonId, null);
  assert.equal(quiz.exerciseIds.length, 6);
  assert.equal(quiz.passingThresholdBasisPoints, 7000);
  quiz.exerciseIds.forEach((exerciseId) => assert.equal(exerciseIds.has(exerciseId), true));
  const lessonCounts = new Map();
  for (const exerciseId of quiz.exerciseIds) {
    const exercise = graph.exercises.find((item) => item.exerciseId === exerciseId);
    lessonCounts.set(exercise.lessonId, (lessonCounts.get(exercise.lessonId) ?? 0) + 1);
  }
  assert.deepEqual([...lessonCounts.values()], [2, 2, 2]);
});

test('paket tidak memuat topik, merek, URL, data pribadi, atau domain terlarang', async () => {
  const raw = await loadContent();
  const text = collectStrings(raw).join('\n');
  for (const pattern of [
    /\bpajak\b/iu,
    /\bhutang\b/iu,
    /\bdiskon\b/iu,
    /\bdiagnosis\b/iu,
    /\bvitacheck\b/iu,
    /\bworkspaceId\b/u,
    /\blearnerScope\b/u,
    /\baccountScope\b/u,
    /\buserScope\b/u,
    /\bemail\b/iu,
    /\btoken\b/iu,
    /https?:/iu,
    /file:/iu,
    /[®™©]/u,
  ]) {
    assert.doesNotMatch(text, pattern);
  }
});

test('content source memakai JSON deterministik dengan LF dan satu newline akhir', async () => {
  const source = await readFile(contentPath, 'utf8');
  assert.equal(source.endsWith('\n'), true);
  assert.equal(source.endsWith('\n\n'), false);
  assert.equal(source.includes('\r'), false);
  assert.equal(source.includes('8000.00'), false);
  assert.equal(source.includes('//'), false);
});
