import { deepFreezeLearningValue } from '../domain/learning-validation.js';

function createLessonSummary(lesson) {
  return {
    lessonId: lesson.lessonId,
    title: lesson.title,
    summary: lesson.summary,
    learningObjective: lesson.learningObjective,
    estimatedMinutes: lesson.estimatedMinutes,
  };
}

function createPackageCatalogView(loadedPackage) {
  const { index, manifest } = loadedPackage;
  const programs = manifest.programIds.map((programId) => {
    const program = index.getProgram(programId);
    return {
      programId: program.programId,
      title: program.title,
      summary: program.summary,
      courses: program.courseIds.map((courseId) => {
        const course = index.getCourse(courseId);
        return {
          courseId: course.courseId,
          title: course.title,
          summary: course.summary,
          learningObjective: course.learningObjective,
          modules: course.moduleIds.map((moduleId) => {
            const module = index.getModule(moduleId);
            return {
              moduleId: module.moduleId,
              title: module.title,
              summary: module.summary,
              learningObjective: module.learningObjective,
              lessons: module.lessonIds.map((lessonId) => (
                createLessonSummary(index.getLesson(lessonId))
              )),
            };
          }),
        };
      }),
    };
  });
  return {
    packageId: manifest.packageId,
    title: manifest.title,
    summary: manifest.summary,
    contentVersion: manifest.contentVersion,
    locale: manifest.locale,
    programs,
  };
}

export function createLearningCatalogService({ catalogLoader, packageLoader } = {}) {
  if (
    typeof catalogLoader?.loadCatalog !== 'function'
    || typeof packageLoader?.loadPackage !== 'function'
  ) {
    throw new TypeError('Learning catalog service membutuhkan loader yang valid.');
  }

  let snapshotPromise = null;

  async function loadSnapshot() {
    const catalogResult = await catalogLoader.loadCatalog();
    const packages = [];
    for (const entry of catalogResult.entries) {
      packages.push(await packageLoader.loadPackage(entry, {
        catalogUrl: catalogResult.catalogUrl,
      }));
    }
    return deepFreezeLearningValue({ catalogResult, packages });
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

  async function getCatalogView(options) {
    const snapshot = await getSnapshot(options);
    return deepFreezeLearningValue({
      modeLabel: 'Mode Internal',
      localOnlyNotice: 'Jawaban latihan belum disimpan. Muat ulang halaman untuk memulai kembali.',
      packages: snapshot.packages.map(createPackageCatalogView),
    });
  }

  return Object.freeze({ getCatalogView });
}
