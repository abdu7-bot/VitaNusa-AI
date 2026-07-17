import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  LEARNING_PACKAGE_FORMAT,
  LEARNING_PACKAGE_FORMAT_VERSION,
  normalizeLearningPackageManifest,
  validateLearningPackageManifest,
} from '../../../assets/js/mandiri/learning/content/package-manifest.js';

const manifestPath = new URL(
  '../../../content/mandiri/learning/packages/money-basics-id-v1/manifest.json',
  import.meta.url,
);

async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

test('manifest kandidat valid, normalized, dan immutable', async () => {
  const input = await loadManifest();
  const before = clone(input);
  const manifest = normalizeLearningPackageManifest(input);

  assert.equal(validateLearningPackageManifest(input), true);
  assert.equal(manifest.packageFormat, LEARNING_PACKAGE_FORMAT);
  assert.equal(manifest.packageFormatVersion, LEARNING_PACKAGE_FORMAT_VERSION);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.programIds), true);
  assert.deepEqual(input, before);
});

test('manifest menolak unknown field dan dangerous key', async () => {
  const unknown = await loadManifest();
  unknown.token = 'bukan-token-nyata';
  assert.throws(() => normalizeLearningPackageManifest(unknown), { code: 'unknown_field' });

  const dangerous = JSON.parse(JSON.stringify(await loadManifest()).replace(
    /"packageFormat"/,
    '"__proto__":{},"packageFormat"',
  ));
  assert.throws(() => normalizeLearningPackageManifest(dangerous), { code: 'dangerous_key' });
});

test('manifest menolak packageFormat dan version yang tidak didukung', async () => {
  const wrongFormat = await loadManifest();
  wrongFormat.packageFormat = 'unknown-package';
  assert.throws(() => normalizeLearningPackageManifest(wrongFormat), {
    code: 'package_format_unknown',
  });

  const wrongVersion = await loadManifest();
  wrongVersion.packageFormatVersion = 2;
  assert.throws(() => normalizeLearningPackageManifest(wrongVersion), {
    code: 'package_format_version_unsupported',
  });
});

test('manifest menolak locale dan status tidak dikenal', async () => {
  const wrongLocale = await loadManifest();
  wrongLocale.locale = 'en-US';
  assert.throws(() => normalizeLearningPackageManifest(wrongLocale), { code: 'unsupported_locale' });

  const wrongStatus = await loadManifest();
  wrongStatus.status = 'active';
  assert.throws(() => normalizeLearningPackageManifest(wrongStatus), {
    code: 'unknown_package_status',
  });
});

test('manifest menolak reviewStatus tidak dikenal dan pasangan review gate invalid', async () => {
  const unknown = await loadManifest();
  unknown.reviewStatus = 'self_approved';
  assert.throws(() => normalizeLearningPackageManifest(unknown), {
    code: 'unknown_review_status',
  });

  const bypass = await loadManifest();
  bypass.reviewStatus = 'approved';
  assert.throws(() => normalizeLearningPackageManifest(bypass), {
    code: 'review_gate_mismatch',
  });
});

test('manifest menolak checksum invalid dan bukan hex lowercase', async () => {
  for (const checksum of ['sha256:abc', 'SHA256:a'.padEnd(71, 'a'), `sha256:${'A'.repeat(64)}`]) {
    const input = await loadManifest();
    input.contentSha256 = checksum;
    assert.throws(() => normalizeLearningPackageManifest(input), {
      code: 'invalid_content_checksum',
    });
  }
});

test('manifest menolak contentBytes non-integer dan programIds kosong', async () => {
  const bytes = await loadManifest();
  bytes.contentBytes = 1.5;
  assert.throws(() => normalizeLearningPackageManifest(bytes), { code: 'invalid_integer' });

  const noPrograms = await loadManifest();
  noPrograms.programIds = [];
  assert.throws(() => normalizeLearningPackageManifest(noPrograms), {
    code: 'invalid_program_ids',
  });
});

test('manifest hanya menerima content.json sebagai file content', async () => {
  for (const contentFile of ['../content.json', '/content.json', 'https://example.test/content.json']) {
    const input = await loadManifest();
    input.contentFile = contentFile;
    assert.throws(() => normalizeLearningPackageManifest(input), {
      code: 'invalid_content_file',
    });
  }
});
