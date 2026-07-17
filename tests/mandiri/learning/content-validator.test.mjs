import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentPackageGraph } from '../../../assets/js/mandiri/learning/content/content-validator.js';

function makeUnit(suffix, prerequisiteCourseIds = []) {
  const courseId = `course-${suffix}`;
  const moduleId = `module-${suffix}`;
  const lessonId = `lesson-${suffix}`;
  const activityId = `activity-${suffix}`;
  const exerciseId = `exercise-${suffix}`;
  const quizId = `quiz-${suffix}`;
  return {
    course: {
      courseId,
      programId: 'program-dasar',
      contentVersion: 1,
      locale: 'id-ID',
      title: `Course ${suffix.toUpperCase()}`,
      summary: 'Belajar satu keterampilan sederhana.',
      learningObjective: 'Mengikuti satu langkah dengan contoh yang jelas.',
      moduleIds: [moduleId],
      prerequisiteCourseIds,
      status: 'published',
    },
    module: {
      moduleId,
      courseId,
      contentVersion: 1,
      locale: 'id-ID',
      title: `Module ${suffix.toUpperCase()}`,
      summary: 'Satu kelompok pelajaran singkat.',
      learningObjective: 'Mengenali langkah dasar.',
      lessonIds: [lessonId],
      status: 'published',
    },
    lesson: {
      lessonId,
      moduleId,
      contentVersion: 1,
      locale: 'id-ID',
      title: `Lesson ${suffix.toUpperCase()}`,
      summary: 'Penjelasan pendek dengan contoh.',
      learningObjective: 'Mencoba satu contoh sederhana.',
      estimatedMinutes: 5,
      blocks: [{
        blockId: `block-${suffix}`,
        type: 'paragraph',
        text: 'Perhatikan contoh, lalu coba jawab pertanyaan.',
        items: [],
      }],
      activityIds: [activityId],
      exerciseIds: [exerciseId],
      quizId,
      status: 'published',
    },
    activity: {
      activityId,
      lessonId,
      contentVersion: 1,
      locale: 'id-ID',
      type: 'read_example',
      prompt: 'Baca contoh berikut.',
      items: [],
      explanation: 'Contoh membantu melihat urutan langkah.',
      status: 'published',
    },
    exercise: {
      exerciseId,
      lessonId,
      contentVersion: 1,
      locale: 'id-ID',
      type: 'single_choice',
      prompt: 'Pilih jawaban yang sesuai contoh.',
      choices: [
        { choiceId: `choice-${suffix}-satu`, label: 'Pilihan satu' },
        { choiceId: `choice-${suffix}-dua`, label: 'Pilihan dua' },
      ],
      correctAnswer: `choice-${suffix}-satu`,
      explanation: 'Pilihan satu mengikuti contoh.',
      maxAttempts: null,
      status: 'published',
    },
    quiz: {
      quizId,
      moduleId: null,
      lessonId,
      contentVersion: 1,
      locale: 'id-ID',
      exerciseIds: [exerciseId],
      passingThresholdBasisPoints: 7500,
      status: 'published',
    },
  };
}

function validGraph({ suffixes = ['a'], prerequisites = {} } = {}) {
  const units = suffixes.map((suffix) => makeUnit(suffix, prerequisites[suffix] ?? []));
  return {
    programs: [{
      programId: 'program-dasar',
      contentVersion: 1,
      locale: 'id-ID',
      title: 'Keterampilan Dasar',
      summary: 'Pelajaran singkat untuk kegiatan sehari-hari.',
      courseIds: units.map((unit) => unit.course.courseId),
      status: 'published',
    }],
    courses: units.map((unit) => unit.course),
    modules: units.map((unit) => unit.module),
    lessons: units.map((unit) => unit.lesson),
    activities: units.map((unit) => unit.activity),
    exercises: units.map((unit) => unit.exercise),
    quizzes: units.map((unit) => unit.quiz),
  };
}

test('content graph valid dinormalisasi tanpa mutasi dan menjadi immutable', () => {
  const input = validGraph();
  const snapshot = structuredClone(input);
  const graph = validateContentPackageGraph(input);
  assert.equal(graph.schemaVersion, 1);
  assert.equal(graph.programs.length, 1);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.lessons[0].blocks[0]), true);
  assert.deepEqual(input, snapshot);
  assert.notEqual(graph.programs, input.programs);
});

test('duplicate global ID ditolak', () => {
  const graph = validGraph();
  graph.exercises.push(structuredClone(graph.exercises[0]));
  assert.throws(() => validateContentPackageGraph(graph), { code: 'duplicate_global_id' });
});

test('missing reference ditolak dengan error path jelas', () => {
  const graph = validGraph();
  graph.courses[0].moduleIds[0] = 'module-tidak-ada';
  assert.throws(
    () => validateContentPackageGraph(graph),
    (error) => error.code === 'missing_reference'
      && error.path === 'courses[0].moduleIds[0]'
      && /module "module-tidak-ada" tidak ditemukan/.test(error.message),
  );
});

test('circular prerequisite ditolak', () => {
  const graph = validGraph({
    suffixes: ['a', 'b'],
    prerequisites: {
      a: ['course-b'],
      b: ['course-a'],
    },
  });
  assert.throws(() => validateContentPackageGraph(graph), { code: 'circular_prerequisite' });
});

test('published entity tidak boleh mengacu entity draft', () => {
  const graph = validGraph();
  graph.exercises[0].status = 'draft';
  assert.throws(() => validateContentPackageGraph(graph), {
    code: 'published_references_unpublished',
  });
});

test('content version mismatch ditolak', () => {
  const graph = validGraph();
  graph.exercises[0].contentVersion = 2;
  assert.throws(() => validateContentPackageGraph(graph), {
    code: 'content_version_mismatch',
  });
});

test('locale selain locale MVP ditolak', () => {
  const graph = validGraph();
  graph.lessons[0].locale = 'en-US';
  assert.throws(() => validateContentPackageGraph(graph), { code: 'unsupported_locale' });
});

test('graph terlalu besar ditolak sebelum membuat graph parsial', () => {
  const graph = validGraph();
  graph.programs = Array.from({ length: 11 }, (_, index) => ({
    ...structuredClone(graph.programs[0]),
    programId: `program-extra-${index}`,
  }));
  assert.throws(() => validateContentPackageGraph(graph), { code: 'collection_too_large' });
});

test('excessive nesting ditolak', () => {
  const graph = validGraph();
  let nested = 'teks';
  for (let index = 0; index < 25; index += 1) nested = { child: nested };
  graph.programs[0].title = nested;
  assert.throws(() => validateContentPackageGraph(graph), { code: 'excessive_nesting' });
});

test('unknown root field dan dangerous key ditolak', () => {
  assert.throws(() => validateContentPackageGraph({ ...validGraph(), ownerUid: 'private' }), {
    code: 'unknown_field',
  });
  const graph = validGraph();
  Object.defineProperty(graph, 'constructor', { enumerable: true, value: 'unsafe' });
  assert.throws(() => validateContentPackageGraph(graph), { code: 'dangerous_key' });
});

test('raw HTML dan dangerous URL ditolak', () => {
  const htmlGraph = validGraph();
  htmlGraph.lessons[0].blocks[0].text = '<iframe src="x"></iframe>';
  assert.throws(() => validateContentPackageGraph(htmlGraph), { code: 'raw_html_forbidden' });

  const urlGraph = validGraph();
  urlGraph.lessons[0].summary = 'Buka javascript:alert(1).';
  assert.throws(() => validateContentPackageGraph(urlGraph), { code: 'dangerous_url' });
});

test('content safety lint menjadi bagian validasi graph', () => {
  const graph = validGraph();
  graph.lessons[0].learningObjective = 'Membuktikan bahwa kamu bodoh.';
  assert.throws(() => validateContentPackageGraph(graph), { code: 'degrading_language' });
});
