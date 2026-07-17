import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { lintContentSafety } from '../../../assets/js/mandiri/learning/content/content-safety.js';
import { validateContentPackageGraph } from '../../../assets/js/mandiri/learning/content/content-validator.js';
import {
  normalizeLearningPackageCatalog,
} from '../../../assets/js/mandiri/learning/content/package-catalog.js';
import {
  normalizeLearningPackageManifest,
} from '../../../assets/js/mandiri/learning/content/package-manifest.js';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../../..');
export const DEFAULT_LEARNING_CATALOG_PATH = resolve(
  REPOSITORY_ROOT,
  'content/mandiri/learning/catalog.json',
);

export class LearningPackageVerificationError extends Error {
  constructor(code, message, path = '') {
    super(message);
    this.name = 'LearningPackageVerificationError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, message, path = '') {
  throw new LearningPackageVerificationError(code, message, path);
}

async function readBytes(filePath, label) {
  let bytes;
  try {
    bytes = await readFile(filePath);
  } catch {
    fail('file_read_failed', `${label} tidak dapat dibaca`, filePath);
  }
  return bytes;
}

function parseJsonBytes(bytes, filePath, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('json_invalid', `${label} bukan JSON valid`, filePath);
  }
  return { bytes, value };
}

async function readJsonBytes(filePath, label) {
  return parseJsonBytes(await readBytes(filePath, label), filePath, label);
}

function resolveContainedPath(rootDirectory, relativePath, label) {
  if (isAbsolute(relativePath)) {
    fail('unsafe_path', `${label} harus berupa path relatif`, relativePath);
  }
  const resolved = resolve(rootDirectory, relativePath);
  const fromRoot = relative(rootDirectory, resolved);
  if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    fail('unsafe_path', `${label} keluar dari folder package`, relativePath);
  }
  return resolved;
}

export function createContentSha256(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    fail('invalid_content_bytes', 'checksum membutuhkan byte UTF-8');
  }
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function assertManifestMatchesGraph(manifest, graph, path) {
  if (graph.schemaVersion !== manifest.schemaVersion) {
    fail('schema_version_mismatch', 'schemaVersion content berbeda dari manifest', path);
  }
  const collections = [
    graph.programs,
    graph.courses,
    graph.modules,
    graph.lessons,
    graph.activities,
    graph.exercises,
    graph.quizzes,
  ];
  for (const collection of collections) {
    for (const entity of collection) {
      if (entity.contentVersion !== manifest.contentVersion) {
        fail('content_version_mismatch', 'contentVersion entity berbeda dari manifest', path);
      }
      if (entity.locale !== manifest.locale) {
        fail('locale_mismatch', 'locale entity berbeda dari manifest', path);
      }
      if (entity.status !== manifest.status) {
        fail('content_status_mismatch', 'status entity berbeda dari status package', path);
      }
    }
  }
  const graphProgramIds = graph.programs.map((program) => program.programId);
  if (
    graphProgramIds.length !== manifest.programIds.length
    || graphProgramIds.some((programId, index) => programId !== manifest.programIds[index])
  ) {
    fail('program_ids_mismatch', 'programIds manifest berbeda dari content graph', path);
  }
}

export async function verifyLearningPackages({
  catalogPath = DEFAULT_LEARNING_CATALOG_PATH,
  quiet = false,
} = {}) {
  const absoluteCatalogPath = resolve(catalogPath);
  const catalogDirectory = dirname(absoluteCatalogPath);
  const catalogFile = await readJsonBytes(absoluteCatalogPath, 'catalog');
  const catalog = normalizeLearningPackageCatalog(catalogFile.value);
  const manifestsByPath = new Map();
  const packages = [];

  for (const entry of catalog.packages) {
    const manifestPath = resolveContainedPath(
      catalogDirectory,
      entry.manifestPath,
      'manifestPath',
    );
    const manifestFile = await readJsonBytes(manifestPath, 'manifest');
    const manifest = normalizeLearningPackageManifest(manifestFile.value);
    manifestsByPath.set(entry.manifestPath, manifestFile.value);

    const contentPath = resolveContainedPath(
      dirname(manifestPath),
      manifest.contentFile,
      'contentFile',
    );
    const contentBytes = await readBytes(contentPath, 'content');
    if (contentBytes.byteLength !== manifest.contentBytes) {
      fail('content_bytes_mismatch', 'ukuran byte content tidak cocok dengan manifest', contentPath);
    }
    const actualSha256 = createContentSha256(contentBytes);
    if (actualSha256 !== manifest.contentSha256) {
      fail('content_checksum_mismatch', 'checksum content tidak cocok dengan manifest', contentPath);
    }

    const contentFile = parseJsonBytes(contentBytes, contentPath, 'content');
    const graph = validateContentPackageGraph(contentFile.value);
    const safetyFindings = lintContentSafety(graph, { path: 'content' });
    if (safetyFindings.length > 0) {
      fail('content_safety_failed', 'content safety lint menemukan masalah', contentPath);
    }
    assertManifestMatchesGraph(manifest, graph, contentPath);

    const verifiedPackage = Object.freeze({
      entry,
      manifest,
      graph,
      manifestPath,
      contentPath,
      contentBytes: contentBytes.byteLength,
      contentSha256: actualSha256,
      safetyFindings,
    });
    packages.push(verifiedPackage);
    if (!quiet) {
      console.log(
        `OK ${manifest.packageId}: ${manifest.status}/${manifest.reviewStatus}, `
        + `${graph.lessons.length} lesson, ${graph.exercises.length} exercise, ${actualSha256}`,
      );
    }
  }

  normalizeLearningPackageCatalog(catalogFile.value, { manifestsByPath });
  return Object.freeze({ catalog, packages: Object.freeze(packages) });
}

function isMainModule() {
  return process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  const catalogPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_LEARNING_CATALOG_PATH;
  verifyLearningPackages({ catalogPath }).catch((error) => {
    const code = typeof error?.code === 'string' ? error.code : 'verification_failed';
    const path = typeof error?.path === 'string' && error.path ? ` (${error.path})` : '';
    console.error(`ERROR ${code}${path}: ${error?.message ?? 'verifikasi paket gagal'}`);
    process.exitCode = 1;
  });
}
