import { NusaBelajarDomainError } from '../domain/learning-errors.js';
import {
  LEARNING_LOCALE,
  assertLearningExactFields,
  assertSafeDataStructure,
  deepFreezeLearningValue,
  normalizeSafeInteger,
} from '../domain/learning-validation.js';
import {
  assertLearningPackageReviewGate,
  normalizeLearningPackageId,
  normalizeLearningPackageManifest,
  normalizeLearningPackageReviewStatus,
} from './package-manifest.js';

export const LEARNING_CATALOG_FORMAT = 'vitanusa-learning-catalog';
export const LEARNING_CATALOG_VERSION = 1;
export const LEARNING_CATALOG_FIELDS = Object.freeze([
  'catalogFormat',
  'catalogVersion',
  'packages',
]);
export const LEARNING_CATALOG_ENTRY_FIELDS = Object.freeze([
  'packageId',
  'manifestPath',
  'locale',
  'status',
  'reviewStatus',
]);

function fail(code, path, message) {
  throw new NusaBelajarDomainError(code, message, path);
}

export function normalizeCatalogManifestPath(value, packageId, path = 'manifestPath') {
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || value.length > 240
    || value.startsWith('/')
    || value.includes('\\')
    || value.includes(':')
  ) {
    fail('unsafe_manifest_path', path, 'manifestPath harus path relatif repository');
  }
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    fail('unsafe_manifest_path', path, 'manifestPath tidak boleh memiliki segment traversal');
  }
  const expected = `packages/${packageId}/manifest.json`;
  if (value !== expected) {
    fail('manifest_path_mismatch', path, `manifestPath harus ${expected}`);
  }
  return value;
}

function normalizeCatalogStatus(value, path) {
  if (!['draft', 'published', 'retired'].includes(value)) {
    fail('unknown_package_status', path, 'status catalog tidak dikenal');
  }
  return value;
}

function getManifestByPath(manifestsByPath, manifestPath) {
  if (manifestsByPath instanceof Map) return manifestsByPath.get(manifestPath);
  if (
    manifestsByPath
    && Object.getPrototypeOf(manifestsByPath) === null
    && Object.hasOwn(manifestsByPath, manifestPath)
  ) {
    return manifestsByPath[manifestPath];
  }
  return undefined;
}

export function normalizeLearningPackageCatalog(
  input,
  { path = 'catalog', manifestsByPath = null } = {},
) {
  assertSafeDataStructure(input, { path, maxDepth: 8, maxNodes: 1000 });
  assertLearningExactFields(input, LEARNING_CATALOG_FIELDS, { path });
  if (input.catalogFormat !== LEARNING_CATALOG_FORMAT) {
    fail('catalog_format_unknown', `${path}.catalogFormat`, 'catalogFormat tidak didukung');
  }
  normalizeSafeInteger(input.catalogVersion, {
    path: `${path}.catalogVersion`,
    min: LEARNING_CATALOG_VERSION,
    max: LEARNING_CATALOG_VERSION,
  });
  if (!Array.isArray(input.packages) || input.packages.length < 1 || input.packages.length > 100) {
    fail('invalid_catalog_packages', `${path}.packages`, 'catalog harus memiliki 1–100 package');
  }

  const packages = input.packages.map((entry, index) => {
    const entryPath = `${path}.packages[${index}]`;
    assertLearningExactFields(entry, LEARNING_CATALOG_ENTRY_FIELDS, { path: entryPath });
    const packageId = normalizeLearningPackageId(entry.packageId, `${entryPath}.packageId`);
    const manifestPath = normalizeCatalogManifestPath(
      entry.manifestPath,
      packageId,
      `${entryPath}.manifestPath`,
    );
    if (entry.locale !== LEARNING_LOCALE) {
      fail('unsupported_locale', `${entryPath}.locale`, `locale harus ${LEARNING_LOCALE}`);
    }
    const normalized = {
      packageId,
      manifestPath,
      locale: entry.locale,
      status: normalizeCatalogStatus(entry.status, `${entryPath}.status`),
      reviewStatus: normalizeLearningPackageReviewStatus(
        entry.reviewStatus,
        `${entryPath}.reviewStatus`,
      ),
    };
    assertLearningPackageReviewGate(normalized.status, normalized.reviewStatus, entryPath);

    if (manifestsByPath !== null) {
      const rawManifest = getManifestByPath(manifestsByPath, manifestPath);
      if (rawManifest === undefined) {
        fail('manifest_missing', `${entryPath}.manifestPath`, 'manifest package tidak ditemukan');
      }
      const manifest = normalizeLearningPackageManifest(rawManifest, {
        path: `${entryPath}.manifest`,
      });
      for (const field of ['packageId', 'locale', 'status', 'reviewStatus']) {
        if (normalized[field] !== manifest[field]) {
          fail(
            'catalog_manifest_mismatch',
            `${entryPath}.${field}`,
            `field ${field} tidak sama dengan manifest`,
          );
        }
      }
    }
    return normalized;
  });

  const packageIds = packages.map((entry) => entry.packageId);
  if (new Set(packageIds).size !== packageIds.length) {
    fail('duplicate_package_id', `${path}.packages`, 'packageId catalog harus unik');
  }

  return deepFreezeLearningValue({
    catalogFormat: input.catalogFormat,
    catalogVersion: input.catalogVersion,
    packages,
  });
}

export function validateLearningPackageCatalog(input, options) {
  normalizeLearningPackageCatalog(input, options);
  return true;
}
