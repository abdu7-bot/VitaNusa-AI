import { normalizeActivity } from '../domain/activity.js';
import { normalizeCourse } from '../domain/course.js';
import { normalizeExercise } from '../domain/exercise.js';
import { NusaBelajarDomainError } from '../domain/learning-errors.js';
import {
  assertLearningExactFields,
  assertSafeDataStructure,
  deepFreezeLearningValue,
  normalizeSchemaVersion,
} from '../domain/learning-validation.js';
import { normalizeLesson } from '../domain/lesson.js';
import { normalizeModule } from '../domain/module.js';
import { normalizeProgram } from '../domain/program.js';
import { normalizeQuiz } from '../domain/quiz.js';
import {
  CONTENT_COLLECTION_DEFINITIONS,
  CONTENT_GRAPH_FIELDS,
  CONTENT_GRAPH_LIMITS,
} from './content-schema.js';
import { lintContentSafety } from './content-safety.js';

const NORMALIZERS = Object.freeze({
  programs: normalizeProgram,
  courses: normalizeCourse,
  modules: normalizeModule,
  lessons: normalizeLesson,
  activities: normalizeActivity,
  exercises: normalizeExercise,
  quizzes: normalizeQuiz,
});

function fail(code, path, message) {
  throw new NusaBelajarDomainError(code, message, path);
}

function normalizeCollection(input, collection) {
  const path = collection;
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) {
    fail('invalid_collection', path, `${collection} harus berupa array biasa`);
  }
  if (input.length > CONTENT_GRAPH_LIMITS[collection]) {
    fail(
      'collection_too_large',
      path,
      `${collection} melampaui batas ${CONTENT_GRAPH_LIMITS[collection]}`,
    );
  }
  return input.map((entity, index) => NORMALIZERS[collection](entity, {
    path: `${collection}[${index}]`,
  }));
}

function buildIndexes(graph) {
  const indexes = {};
  const globalIds = new Map();
  for (const definition of CONTENT_COLLECTION_DEFINITIONS) {
    const map = new Map();
    graph[definition.collection].forEach((entity, index) => {
      const id = entity[definition.idField];
      const path = `${definition.collection}[${index}].${definition.idField}`;
      if (globalIds.has(id)) {
        fail('duplicate_global_id', path, `ID "${id}" sudah digunakan pada ${globalIds.get(id)}`);
      }
      globalIds.set(id, path);
      map.set(id, { entity, index });
    });
    indexes[definition.collection] = map;
  }
  return indexes;
}

function getReferenced(index, id, path, entityType) {
  const found = index.get(id);
  if (!found) fail('missing_reference', path, `${entityType} "${id}" tidak ditemukan`);
  return found.entity;
}

function assertCompatibleReference(source, target, path) {
  if (source.contentVersion !== target.contentVersion) {
    fail('content_version_mismatch', path, 'referensi memakai contentVersion berbeda');
  }
  if (source.locale !== target.locale) {
    fail('locale_mismatch', path, 'referensi memakai locale berbeda');
  }
  if (source.status === 'published' && target.status !== 'published') {
    fail('published_references_unpublished', path, 'konten published hanya boleh merujuk konten published');
  }
}

function assertSingleVersionAndLocale(graph) {
  let expectedVersion;
  let expectedLocale;
  for (const definition of CONTENT_COLLECTION_DEFINITIONS) {
    graph[definition.collection].forEach((entity, index) => {
      const basePath = `${definition.collection}[${index}]`;
      if (expectedVersion === undefined) {
        expectedVersion = entity.contentVersion;
        expectedLocale = entity.locale;
      }
      if (entity.contentVersion !== expectedVersion) {
        fail('content_version_mismatch', `${basePath}.contentVersion`, 'graph harus memakai satu contentVersion');
      }
      if (entity.locale !== expectedLocale) {
        fail('locale_mismatch', `${basePath}.locale`, 'graph harus memakai satu locale');
      }
    });
  }
}

function assertProgramRelations(graph, indexes) {
  graph.programs.forEach((program, programIndex) => {
    program.courseIds.forEach((courseId, courseIndex) => {
      const path = `programs[${programIndex}].courseIds[${courseIndex}]`;
      const course = getReferenced(indexes.courses, courseId, path, 'course');
      if (course.programId !== program.programId) {
        fail('relation_mismatch', path, 'course merujuk program lain');
      }
      assertCompatibleReference(program, course, path);
    });
  });

  graph.courses.forEach((course, index) => {
    const parent = getReferenced(
      indexes.programs,
      course.programId,
      `courses[${index}].programId`,
      'program',
    );
    if (!parent.courseIds.includes(course.courseId)) {
      fail('reverse_reference_missing', `courses[${index}].programId`, 'program tidak memuat course ini');
    }
  });
}

function assertCourseRelations(graph, indexes) {
  graph.courses.forEach((course, courseIndex) => {
    course.moduleIds.forEach((moduleId, moduleIndex) => {
      const path = `courses[${courseIndex}].moduleIds[${moduleIndex}]`;
      const module = getReferenced(indexes.modules, moduleId, path, 'module');
      if (module.courseId !== course.courseId) fail('relation_mismatch', path, 'module merujuk course lain');
      assertCompatibleReference(course, module, path);
    });
    course.prerequisiteCourseIds.forEach((courseId, prerequisiteIndex) => {
      const path = `courses[${courseIndex}].prerequisiteCourseIds[${prerequisiteIndex}]`;
      const prerequisite = getReferenced(indexes.courses, courseId, path, 'course');
      assertCompatibleReference(course, prerequisite, path);
    });
  });
  graph.modules.forEach((module, index) => {
    const parent = getReferenced(indexes.courses, module.courseId, `modules[${index}].courseId`, 'course');
    if (!parent.moduleIds.includes(module.moduleId)) {
      fail('reverse_reference_missing', `modules[${index}].courseId`, 'course tidak memuat module ini');
    }
  });
}

function assertNoCircularPrerequisites(graph, indexes) {
  const visiting = new Set();
  const visited = new Set();
  function visit(courseId, path) {
    if (visiting.has(courseId)) fail('circular_prerequisite', path, 'circular prerequisite terdeteksi');
    if (visited.has(courseId)) return;
    visiting.add(courseId);
    const { entity: course, index } = indexes.courses.get(courseId);
    course.prerequisiteCourseIds.forEach((prerequisiteId, prerequisiteIndex) => {
      visit(prerequisiteId, `courses[${index}].prerequisiteCourseIds[${prerequisiteIndex}]`);
    });
    visiting.delete(courseId);
    visited.add(courseId);
  }
  graph.courses.forEach((course, index) => visit(course.courseId, `courses[${index}].courseId`));
}

function assertModuleRelations(graph, indexes) {
  graph.modules.forEach((module, moduleIndex) => {
    module.lessonIds.forEach((lessonId, lessonIndex) => {
      const path = `modules[${moduleIndex}].lessonIds[${lessonIndex}]`;
      const lesson = getReferenced(indexes.lessons, lessonId, path, 'lesson');
      if (lesson.moduleId !== module.moduleId) fail('relation_mismatch', path, 'lesson merujuk module lain');
      assertCompatibleReference(module, lesson, path);
    });
  });
  graph.lessons.forEach((lesson, index) => {
    const parent = getReferenced(indexes.modules, lesson.moduleId, `lessons[${index}].moduleId`, 'module');
    if (!parent.lessonIds.includes(lesson.lessonId)) {
      fail('reverse_reference_missing', `lessons[${index}].moduleId`, 'module tidak memuat lesson ini');
    }
  });
}

function assertLessonRelations(graph, indexes) {
  graph.lessons.forEach((lesson, lessonIndex) => {
    lesson.activityIds.forEach((activityId, activityIndex) => {
      const path = `lessons[${lessonIndex}].activityIds[${activityIndex}]`;
      const activity = getReferenced(indexes.activities, activityId, path, 'activity');
      if (activity.lessonId !== lesson.lessonId) fail('relation_mismatch', path, 'activity merujuk lesson lain');
      assertCompatibleReference(lesson, activity, path);
    });
    lesson.exerciseIds.forEach((exerciseId, exerciseIndex) => {
      const path = `lessons[${lessonIndex}].exerciseIds[${exerciseIndex}]`;
      const exercise = getReferenced(indexes.exercises, exerciseId, path, 'exercise');
      if (exercise.lessonId !== lesson.lessonId) fail('relation_mismatch', path, 'exercise merujuk lesson lain');
      assertCompatibleReference(lesson, exercise, path);
    });
    if (lesson.quizId !== null) {
      const quiz = getReferenced(indexes.quizzes, lesson.quizId, `lessons[${lessonIndex}].quizId`, 'quiz');
      if (quiz.lessonId !== lesson.lessonId || quiz.moduleId !== null) {
        fail('relation_mismatch', `lessons[${lessonIndex}].quizId`, 'quiz merujuk scope lain');
      }
      assertCompatibleReference(lesson, quiz, `lessons[${lessonIndex}].quizId`);
    }
  });

  graph.activities.forEach((activity, index) => {
    const lesson = getReferenced(indexes.lessons, activity.lessonId, `activities[${index}].lessonId`, 'lesson');
    if (!lesson.activityIds.includes(activity.activityId)) {
      fail('reverse_reference_missing', `activities[${index}].lessonId`, 'lesson tidak memuat activity ini');
    }
  });
  graph.exercises.forEach((exercise, index) => {
    const lesson = getReferenced(indexes.lessons, exercise.lessonId, `exercises[${index}].lessonId`, 'lesson');
    if (!lesson.exerciseIds.includes(exercise.exerciseId)) {
      fail('reverse_reference_missing', `exercises[${index}].lessonId`, 'lesson tidak memuat exercise ini');
    }
  });
}

function assertQuizRelations(graph, indexes) {
  graph.quizzes.forEach((quiz, quizIndex) => {
    let owner;
    if (quiz.lessonId !== null) {
      owner = getReferenced(indexes.lessons, quiz.lessonId, `quizzes[${quizIndex}].lessonId`, 'lesson');
      if (owner.quizId !== quiz.quizId) {
        fail('reverse_reference_missing', `quizzes[${quizIndex}].lessonId`, 'lesson tidak memuat quiz ini');
      }
    } else {
      owner = getReferenced(indexes.modules, quiz.moduleId, `quizzes[${quizIndex}].moduleId`, 'module');
    }
    assertCompatibleReference(owner, quiz, `quizzes[${quizIndex}]`);

    quiz.exerciseIds.forEach((exerciseId, exerciseIndex) => {
      const path = `quizzes[${quizIndex}].exerciseIds[${exerciseIndex}]`;
      const exercise = getReferenced(indexes.exercises, exerciseId, path, 'exercise');
      assertCompatibleReference(quiz, exercise, path);
      if (quiz.lessonId !== null && exercise.lessonId !== quiz.lessonId) {
        fail('relation_mismatch', path, 'exercise quiz berasal dari lesson lain');
      }
      if (quiz.moduleId !== null) {
        const lesson = indexes.lessons.get(exercise.lessonId)?.entity;
        if (!lesson || lesson.moduleId !== quiz.moduleId) {
          fail('relation_mismatch', path, 'exercise quiz berasal dari module lain');
        }
      }
    });
  });
}

export function validateContentPackageGraph(input) {
  assertSafeDataStructure(input, {
    path: 'content',
    maxDepth: CONTENT_GRAPH_LIMITS.maxDepth,
    maxNodes: CONTENT_GRAPH_LIMITS.maxNodes,
  });
  assertLearningExactFields(input, CONTENT_GRAPH_FIELDS, {
    requiredFields: CONTENT_GRAPH_FIELDS.filter((field) => field !== 'schemaVersion'),
    path: 'content',
  });

  const graph = {
    schemaVersion: normalizeSchemaVersion(input.schemaVersion, 'content.schemaVersion'),
  };
  for (const definition of CONTENT_COLLECTION_DEFINITIONS) {
    graph[definition.collection] = normalizeCollection(
      input[definition.collection],
      definition.collection,
    );
  }
  if (graph.programs.length === 0) {
    fail('empty_content_graph', 'programs', 'graph harus memiliki minimal satu program');
  }

  const indexes = buildIndexes(graph);
  assertSingleVersionAndLocale(graph);
  assertProgramRelations(graph, indexes);
  assertCourseRelations(graph, indexes);
  assertNoCircularPrerequisites(graph, indexes);
  assertModuleRelations(graph, indexes);
  assertLessonRelations(graph, indexes);
  assertQuizRelations(graph, indexes);

  const findings = lintContentSafety(graph, { path: 'content' });
  if (findings.length > 0) {
    const finding = findings[0];
    fail(finding.code, finding.path, finding.message);
  }
  return deepFreezeLearningValue(graph);
}

export function validateContentGraph(input) {
  validateContentPackageGraph(input);
  return true;
}
