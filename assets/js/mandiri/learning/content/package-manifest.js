import { NusaBelajarDomainError } from '../domain/learning-errors.js';
import {
  CONTENT_STATUSES,
  LEARNING_LOCALE,
  LEARNING_SCHEMA_VERSION,
  assertLearningExactFields,
  assertSafeDataStructure,
  deepFreezeLearningValue,
  normalizeContentId,
  normalizeContentVersion,
  normalizePlainText,
  normalizeSafeInteger,
} from '../domain/learning-validation.js';

export const LEARNING_PACKAGE_FORMAT = 'vitanusa-learning-package';
export const LEARNING_PACKAGE_FORMAT_VERSION = 1;
export const LEARNING_PACKAGE_REVIEW_STATUSES = Object.freeze([
  'pending_human_review',
  'approved',
]);

export const LEARNING_PACKAGE_MANIFEST_FIELDS = Object.freeze([
  'packageFormat',
  'packageFormatVersion',
  'packageId',
  'schemaVersion',
  'contentVersion',
  'locale',
  'status',
  'reviewStatus',
  'title',
  'summary',
  'contentFile',
  'contentSha256',
  'contentBytes',
  'programIds',
]);

const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function fail(code, path, message) {
  throw new NusaBelajarDomainError(code, message, path);
}

export function normalizeLearningPackageId(value, path = 'packageId') {
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || value.length > 120
    || !PACKAGE_ID_PATTERN.test(value)
  ) {
    fail('invalid_package_id', path, 'packageId harus safe slug non-kosong');
  }
  return value;
}

export function normalizeLearningPackageReviewStatus(value, path = 'reviewStatus') {
  if (!LEARNING_PACKAGE_REVIEW_STATUSES.includes(value)) {
    fail('unknown_review_status', path, 'reviewStatus paket tidak dikenal');
  }
  return value;
}

function normalizePackageStatus(value, path) {
  if (!CONTENT_STATUSES.includes(value)) {
    fail('unknown_package_status', path, 'status paket tidak dikenal');
  }
  return value;
}

export function assertLearningPackageReviewGate(status, reviewStatus, path = 'package') {
  const valid = (
    (status === 'draft' && reviewStatus === 'pending_human_review')
    || (status === 'published' && reviewStatus === 'approved')
    || (status === 'retired' && reviewStatus === 'approved')
  );
  if (!valid) {
    fail(
      'review_gate_mismatch',
      path,
      'status paket dan reviewStatus tidak memenuhi gate review manusia',
    );
  }
}

export function normalizeLearningPackageManifest(input, { path = 'manifest' } = {}) {
  assertSafeDataStructure(input, { path, maxDepth: 8, maxNodes: 500 });
  assertLearningExactFields(input, LEARNING_PACKAGE_MANIFEST_FIELDS, { path });

  if (input.packageFormat !== LEARNING_PACKAGE_FORMAT) {
    fail('package_format_unknown', `${path}.packageFormat`, 'packageFormat tidak didukung');
  }
  if (input.packageFormatVersion !== LEARNING_PACKAGE_FORMAT_VERSION) {
    fail(
      'package_format_version_unsupported',
      `${path}.packageFormatVersion`,
      `packageFormatVersion harus ${LEARNING_PACKAGE_FORMAT_VERSION}`,
    );
  }
  if (input.schemaVersion !== LEARNING_SCHEMA_VERSION) {
    fail(
      'schema_version_unsupported',
      `${path}.schemaVersion`,
      `schemaVersion harus ${LEARNING_SCHEMA_VERSION}`,
    );
  }
  if (input.locale !== LEARNING_LOCALE) {
    fail('unsupported_locale', `${path}.locale`, `locale harus ${LEARNING_LOCALE}`);
  }
  if (input.contentFile !== 'content.json') {
    fail('invalid_content_file', `${path}.contentFile`, 'contentFile harus content.json');
  }
  if (typeof input.contentSha256 !== 'string' || !SHA256_PATTERN.test(input.contentSha256)) {
    fail(
      'invalid_content_checksum',
      `${path}.contentSha256`,
      'contentSha256 harus sha256 diikuti 64 karakter hex lowercase',
    );
  }
  if (!Array.isArray(input.programIds) || input.programIds.length < 1 || input.programIds.length > 10) {
    fail('invalid_program_ids', `${path}.programIds`, 'programIds harus memiliki 1–10 ID');
  }

  const programIds = input.programIds.map((programId, index) => normalizeContentId(
    programId,
    'program',
    `${path}.programIds[${index}]`,
  ));
  if (new Set(programIds).size !== programIds.length) {
    fail('duplicate_program_id', `${path}.programIds`, 'programIds harus unik');
  }

  const status = normalizePackageStatus(input.status, `${path}.status`);
  const reviewStatus = normalizeLearningPackageReviewStatus(
    input.reviewStatus,
    `${path}.reviewStatus`,
  );
  assertLearningPackageReviewGate(status, reviewStatus, path);

  return deepFreezeLearningValue({
    packageFormat: input.packageFormat,
    packageFormatVersion: input.packageFormatVersion,
    packageId: normalizeLearningPackageId(input.packageId, `${path}.packageId`),
    schemaVersion: input.schemaVersion,
    contentVersion: normalizeContentVersion(input.contentVersion, `${path}.contentVersion`),
    locale: input.locale,
    status,
    reviewStatus,
    title: normalizePlainText(input.title, { path: `${path}.title`, maxLength: 120 }),
    summary: normalizePlainText(input.summary, { path: `${path}.summary`, maxLength: 320 }),
    contentFile: input.contentFile,
    contentSha256: input.contentSha256,
    contentBytes: normalizeSafeInteger(input.contentBytes, {
      path: `${path}.contentBytes`,
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    }),
    programIds,
  });
}

export function validateLearningPackageManifest(input, options) {
  normalizeLearningPackageManifest(input, options);
  return true;
}
