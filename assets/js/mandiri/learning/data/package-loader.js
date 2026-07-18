import { validateContentPackageGraph } from '../content/content-validator.js';
import { normalizeLearningPackageManifest } from '../content/package-manifest.js';
import { deepFreezeLearningValue } from '../domain/learning-validation.js';
import { createBrowserSha256 } from './browser-checksum.js';
import { learningContentError, mapLearningContentError } from './content-loader-errors.js';
import { resolveLearningContentUrl } from './safe-content-path.js';
import { fetchStaticContentBytes, parseStaticJson } from './static-content-fetch.js';

export const MAX_LEARNING_MANIFEST_BYTES = 64 * 1024;
export const MAX_LEARNING_CONTENT_BYTES = 1024 * 1024;

const COLLECTIONS = Object.freeze([
  ['programs', 'programId'],
  ['courses', 'courseId'],
  ['modules', 'moduleId'],
  ['lessons', 'lessonId'],
  ['activities', 'activityId'],
  ['exercises', 'exerciseId'],
  ['quizzes', 'quizId'],
]);

function assertEntryManifestMatch(entry, manifest) {
  for (const field of ['packageId', 'locale', 'status', 'reviewStatus']) {
    if (entry[field] !== manifest[field]) throw learningContentError('manifest_invalid');
  }
  if (manifest.status !== 'published' || manifest.reviewStatus !== 'approved') {
    throw learningContentError('package_not_published');
  }
}

function assertManifestGraphMatch(manifest, graph) {
  if (graph.schemaVersion !== manifest.schemaVersion) {
    throw learningContentError('content_graph_invalid');
  }
  for (const [collection] of COLLECTIONS) {
    for (const entity of graph[collection]) {
      if (
        entity.contentVersion !== manifest.contentVersion
        || entity.locale !== manifest.locale
        || entity.status !== 'published'
      ) {
        throw learningContentError('content_graph_invalid');
      }
    }
  }
  const programIds = graph.programs.map((program) => program.programId);
  if (
    programIds.length !== manifest.programIds.length
    || programIds.some((programId, index) => programId !== manifest.programIds[index])
  ) {
    throw learningContentError('content_graph_invalid');
  }
}

export function createImmutableContentIndex(graph) {
  const maps = Object.create(null);
  for (const [collection, idField] of COLLECTIONS) {
    maps[collection] = new Map(graph[collection].map((entity) => [entity[idField], entity]));
  }
  return Object.freeze({
    listPrograms: () => graph.programs,
    listCourses: () => graph.courses,
    listModules: () => graph.modules,
    listLessons: () => graph.lessons,
    getProgram: (id) => maps.programs.get(id) || null,
    getCourse: (id) => maps.courses.get(id) || null,
    getModule: (id) => maps.modules.get(id) || null,
    getLesson: (id) => maps.lessons.get(id) || null,
    getActivity: (id) => maps.activities.get(id) || null,
    getExercise: (id) => maps.exercises.get(id) || null,
    getQuiz: (id) => maps.quizzes.get(id) || null,
  });
}

export function createLearningPackageLoader({
  fetchImpl = globalThis.fetch,
  digestFactory = createBrowserSha256,
  maxManifestBytes = MAX_LEARNING_MANIFEST_BYTES,
  maxContentBytes = MAX_LEARNING_CONTENT_BYTES,
} = {}) {
  async function loadPackage(entry, { catalogUrl } = {}) {
    const manifestUrl = resolveLearningContentUrl(entry?.manifestPath, { catalogUrl });
    const manifestBytes = await fetchStaticContentBytes({
      fetchImpl,
      url: manifestUrl,
      maxBytes: maxManifestBytes,
      loadErrorCode: 'manifest_load_failed',
      tooLargeCode: 'manifest_too_large',
    });
    const manifestInput = parseStaticJson(manifestBytes, 'manifest_json_invalid');
    let manifest;
    try {
      manifest = normalizeLearningPackageManifest(manifestInput);
    } catch (error) {
      throw mapLearningContentError(error, 'manifest_invalid');
    }
    assertEntryManifestMatch(entry, manifest);
    if (manifest.contentBytes > maxContentBytes) throw learningContentError('content_too_large');

    const contentUrl = resolveLearningContentUrl(manifest.contentFile, {
      catalogUrl,
      baseUrl: manifestUrl,
    });
    const contentBytes = await fetchStaticContentBytes({
      fetchImpl,
      url: contentUrl,
      maxBytes: maxContentBytes,
      loadErrorCode: 'content_load_failed',
      tooLargeCode: 'content_too_large',
    });
    if (contentBytes.byteLength !== manifest.contentBytes) {
      throw learningContentError('content_size_mismatch');
    }
    const digest = await digestFactory(contentBytes);
    if (digest !== manifest.contentSha256) throw learningContentError('checksum_mismatch');

    const contentInput = parseStaticJson(contentBytes, 'content_json_invalid');
    let graph;
    try {
      graph = validateContentPackageGraph(contentInput);
      assertManifestGraphMatch(manifest, graph);
    } catch (error) {
      throw mapLearningContentError(error, 'content_graph_invalid');
    }

    return deepFreezeLearningValue({
      entry,
      manifest,
      graph,
      index: createImmutableContentIndex(graph),
      manifestUrl,
      contentUrl,
      contentByteLength: contentBytes.byteLength,
      checksum: digest,
    });
  }

  return Object.freeze({ loadPackage });
}
