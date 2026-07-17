export const CONTENT_GRAPH_FIELDS = Object.freeze([
  'schemaVersion',
  'programs',
  'courses',
  'modules',
  'lessons',
  'activities',
  'exercises',
  'quizzes',
]);

export const CONTENT_GRAPH_LIMITS = Object.freeze({
  programs: 10,
  courses: 100,
  modules: 500,
  lessons: 2000,
  activities: 5000,
  exercises: 10000,
  quizzes: 2000,
  blocksPerLesson: 50,
  choicesPerExercise: 20,
  maxDepth: 20,
  maxNodes: 100000,
});

export const CONTENT_COLLECTION_DEFINITIONS = Object.freeze([
  Object.freeze({ collection: 'programs', idField: 'programId', type: 'program' }),
  Object.freeze({ collection: 'courses', idField: 'courseId', type: 'course' }),
  Object.freeze({ collection: 'modules', idField: 'moduleId', type: 'module' }),
  Object.freeze({ collection: 'lessons', idField: 'lessonId', type: 'lesson' }),
  Object.freeze({ collection: 'activities', idField: 'activityId', type: 'activity' }),
  Object.freeze({ collection: 'exercises', idField: 'exerciseId', type: 'exercise' }),
  Object.freeze({ collection: 'quizzes', idField: 'quizId', type: 'quiz' }),
]);
