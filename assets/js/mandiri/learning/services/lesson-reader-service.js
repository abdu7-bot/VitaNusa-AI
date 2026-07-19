import { evaluateAnswer } from '../engine/answer-evaluator.js';
import {
  deepFreezeLearningValue,
  normalizeContentId,
  normalizeSafeInteger,
} from '../domain/learning-validation.js';
import { learningContentError } from '../data/content-loader-errors.js';

function sequenceChoices(exercise) {
  const choices = [...exercise.choices];
  const choiceIds = choices.map((choice) => choice.choiceId);
  const startsCorrect = choiceIds.length === exercise.correctAnswer.length
    && choiceIds.every((choiceId, index) => choiceId === exercise.correctAnswer[index]);
  if (startsCorrect && choices.length > 1) {
    return [...choices.slice(1), choices[0]];
  }
  return choices;
}

export function createPublicExerciseView(exercise) {
  const choices = exercise.type === 'sequence'
    ? sequenceChoices(exercise)
    : exercise.choices;
  return deepFreezeLearningValue({
    exerciseId: exercise.exerciseId,
    type: exercise.type,
    prompt: exercise.prompt,
    choices: choices.map((choice) => ({
      choiceId: choice.choiceId,
      label: choice.label,
    })),
    maxAttempts: exercise.maxAttempts,
  });
}

function createPublicActivityView(activity) {
  return {
    activityId: activity.activityId,
    type: activity.type,
    prompt: activity.prompt,
    items: activity.items.map((item) => ({ itemId: item.itemId, label: item.label })),
    explanation: activity.explanation,
  };
}

function createLessonView(loadedPackage, lesson) {
  const { index } = loadedPackage;
  const module = index.getModule(lesson.moduleId);
  const course = index.getCourse(module.courseId);
  const program = index.getProgram(course.programId);
  const lessonIndex = module.lessonIds.indexOf(lesson.lessonId);
  const previousId = lessonIndex > 0 ? module.lessonIds[lessonIndex - 1] : null;
  const nextId = lessonIndex + 1 < module.lessonIds.length
    ? module.lessonIds[lessonIndex + 1]
    : null;
  const quiz = nextId === null
    ? loadedPackage.graph.quizzes.find((candidate) => candidate.moduleId === module.moduleId)
    : null;

  return deepFreezeLearningValue({
    package: {
      title: loadedPackage.manifest.title,
      contentVersion: loadedPackage.manifest.contentVersion,
      locale: loadedPackage.manifest.locale,
    },
    program: { programId: program.programId, title: program.title },
    course: { courseId: course.courseId, title: course.title },
    module: { moduleId: module.moduleId, title: module.title },
    lesson: {
      lessonId: lesson.lessonId,
      title: lesson.title,
      summary: lesson.summary,
      learningObjective: lesson.learningObjective,
      estimatedMinutes: lesson.estimatedMinutes,
      blocks: lesson.blocks.map((block) => ({
        blockId: block.blockId,
        type: block.type,
        text: block.text,
        items: [...block.items],
      })),
      activities: lesson.activityIds.map((activityId) => (
        createPublicActivityView(index.getActivity(activityId))
      )),
      exercises: lesson.exerciseIds.map((exerciseId) => (
        createPublicExerciseView(index.getExercise(exerciseId))
      )),
    },
    quiz: quiz ? {
      quizId: quiz.quizId,
      passingThresholdBasisPoints: quiz.passingThresholdBasisPoints,
      exercises: quiz.exerciseIds.map((exerciseId) => (
        createPublicExerciseView(index.getExercise(exerciseId))
      )),
    } : null,
    navigation: {
      previousLessonId: previousId,
      nextLessonId: nextId,
    },
    localOnlyNotice: 'Jawaban hanya berada di memori halaman ini dan belum menjadi progres tersimpan.',
  });
}

export function isControlledNonNegativeIntegerAnswer(value) {
  if (Number.isSafeInteger(value)) return value >= 0;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)$/u.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 0;
}

export function createLessonReaderService({
  catalogLoader,
  packageLoader,
  evaluator = evaluateAnswer,
} = {}) {
  if (
    typeof catalogLoader?.loadCatalog !== 'function'
    || typeof packageLoader?.loadPackage !== 'function'
    || typeof evaluator !== 'function'
  ) {
    throw new TypeError('Lesson reader service membutuhkan dependency yang valid.');
  }

  let snapshotPromise = null;
  let activeExercises = new Map();

  async function loadSnapshot() {
    const catalogResult = await catalogLoader.loadCatalog();
    const packages = [];
    for (const entry of catalogResult.entries) {
      packages.push(await packageLoader.loadPackage(entry, {
        catalogUrl: catalogResult.catalogUrl,
      }));
    }
    return Object.freeze({ catalogResult, packages: Object.freeze(packages) });
  }

  function getSnapshot({ force = false } = {}) {
    if (force || !snapshotPromise) {
      snapshotPromise = loadSnapshot().catch((error) => {
        snapshotPromise = null;
        throw error;
      });
    }
    return snapshotPromise;
  }

  async function getLessonView(lessonId, options) {
    const safeLessonId = normalizeContentId(lessonId, 'lesson', 'lessonId');
    const snapshot = await getSnapshot(options);
    for (const loadedPackage of snapshot.packages) {
      const lesson = loadedPackage.index.getLesson(safeLessonId);
      if (!lesson) continue;
      activeExercises = new Map(lesson.exerciseIds.map((exerciseId) => (
        [exerciseId, loadedPackage.index.getExercise(exerciseId)]
      )));
      const view = createLessonView(loadedPackage, lesson);
      for (const exercise of view.quiz?.exercises ?? []) {
        activeExercises.set(exercise.exerciseId, loadedPackage.index.getExercise(exercise.exerciseId));
      }
      return view;
    }
    activeExercises = new Map();
    throw learningContentError('lesson_not_found');
  }

  function evaluateExercise(
    exerciseId,
    submittedAnswer,
    { submissionCount = 0 } = {},
  ) {
    const safeExerciseId = normalizeContentId(exerciseId, 'exercise', 'exerciseId');
    const priorCount = normalizeSafeInteger(submissionCount, {
      path: 'submissionCount',
      min: 0,
      max: 100000,
    });
    const exercise = activeExercises.get(safeExerciseId);
    if (!exercise) throw learningContentError('exercise_not_found');

    if (exercise.maxAttempts !== null && priorCount >= exercise.maxAttempts) {
      return deepFreezeLearningValue({
        correct: false,
        feedbackCode: 'review_example',
        explanation: exercise.explanation,
        submissionCount: priorCount,
        attemptsRemaining: 0,
      });
    }

    const evaluated = (
      exercise.type === 'numeric_input'
      && !isControlledNonNegativeIntegerAnswer(submittedAnswer)
    ) ? { correct: false, feedbackCode: 'invalid_answer' }
      : evaluator(exercise, submittedAnswer);
    const countsAsSubmission = evaluated.feedbackCode !== 'invalid_answer';
    const nextCount = priorCount + (countsAsSubmission ? 1 : 0);
    const attemptsRemaining = exercise.maxAttempts === null
      ? null
      : Math.max(0, exercise.maxAttempts - nextCount);
    const feedbackCode = (
      !evaluated.correct
      && evaluated.feedbackCode !== 'invalid_answer'
      && attemptsRemaining === 0
    ) ? 'review_example' : evaluated.feedbackCode;

    return deepFreezeLearningValue({
      correct: evaluated.correct,
      feedbackCode,
      explanation: exercise.explanation,
      submissionCount: nextCount,
      attemptsRemaining,
    });
  }

  function destroy() {
    activeExercises = new Map();
    snapshotPromise = null;
  }

  return Object.freeze({ destroy, evaluateExercise, getLessonView });
}
