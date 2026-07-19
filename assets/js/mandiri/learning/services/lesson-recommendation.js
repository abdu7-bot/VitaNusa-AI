import { deepFreezeLearningValue } from '../domain/learning-validation.js';

export const LESSON_RECOMMENDATION_LABELS = Object.freeze({
  start: 'Mulai dari pelajaran ini',
  continue: 'Lanjutkan dari pelajaran ini',
  practice: 'Latihan kembali dari pelajaran ini',
  complete: 'Semua pelajaran pada modul ini sudah ditinjau',
});

export function recommendLesson({ lessons, progressRecords, contentVersion } = {}) {
  if (!Array.isArray(lessons) || !Array.isArray(progressRecords)) {
    throw new TypeError('Rekomendasi lesson membutuhkan lessons dan progressRecords.');
  }
  const lessonIds = lessons.map((lesson) => lesson.lessonId);
  const relevant = progressRecords.filter((progress) => (
    lessonIds.includes(progress.lessonId) && progress.contentVersion === contentVersion
  ));
  if (relevant.length === 0) {
    return deepFreezeLearningValue({
      lessonId: lessonIds[0] ?? null,
      reason: lessonIds.length ? 'start' : 'complete',
      label: lessonIds.length
        ? LESSON_RECOMMENDATION_LABELS.start
        : LESSON_RECOMMENDATION_LABELS.complete,
    });
  }

  const newest = [...relevant].sort((left, right) => (
    right.lastPracticedAtLocal.localeCompare(left.lastPracticedAtLocal)
    || left.lessonId.localeCompare(right.lessonId)
  ))[0];
  const currentIndex = lessonIds.indexOf(newest.lessonId);
  if (newest.state === 'needs_practice') {
    return deepFreezeLearningValue({
      lessonId: newest.lessonId,
      reason: 'practice',
      label: LESSON_RECOMMENDATION_LABELS.practice,
    });
  }
  const nextLessonId = lessonIds[currentIndex + 1] ?? null;
  return deepFreezeLearningValue({
    lessonId: nextLessonId,
    reason: nextLessonId ? 'continue' : 'complete',
    label: nextLessonId
      ? LESSON_RECOMMENDATION_LABELS.continue
      : LESSON_RECOMMENDATION_LABELS.complete,
  });
}

export async function applyCatalogRecommendations(catalog, progressLoader) {
  if (typeof progressLoader !== 'function') throw new TypeError('progressLoader wajib tersedia.');
  const packages = [];
  for (const learningPackage of catalog.packages) {
    const programs = [];
    for (const program of learningPackage.programs) {
      const courses = [];
      for (const course of program.courses) {
        const progressRecords = await progressLoader(course.courseId);
        const modules = course.modules.map((module) => ({
          ...module,
          recommendation: recommendLesson({
            lessons: module.lessons,
            progressRecords: progressRecords.filter((progress) => progress.moduleId === module.moduleId),
            contentVersion: learningPackage.contentVersion,
          }),
        }));
        courses.push({ ...course, modules });
      }
      programs.push({ ...program, courses });
    }
    packages.push({ ...learningPackage, programs });
  }
  return deepFreezeLearningValue({ ...catalog, packages });
}
