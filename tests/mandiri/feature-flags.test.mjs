import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getMandiriFeatureContract,
  getMandiriFeatureState,
  MANDIRI_FEATURE_ENV_KEY,
  resolveMandiriFeatureState,
  shouldStartMandiriStorage,
} from '../../assets/js/mandiri/config/feature-flags.js';

const source = await readFile(
  new URL('../../assets/js/mandiri/config/feature-flags.js', import.meta.url),
  'utf8',
);

test('feature flag undefined menjadi off', () => {
  assert.equal(resolveMandiriFeatureState(undefined), 'off');
  assert.equal(getMandiriFeatureState({}), 'off');
});

test('feature flag string kosong menjadi off', () => {
  assert.equal(resolveMandiriFeatureState(''), 'off');
  assert.equal(getMandiriFeatureState({ [MANDIRI_FEATURE_ENV_KEY]: '' }), 'off');
});

test('feature flag tidak dikenal menjadi off', () => {
  assert.equal(resolveMandiriFeatureState('preview'), 'off');
  assert.equal(getMandiriFeatureState({ [MANDIRI_FEATURE_ENV_KEY]: 'enabled' }), 'off');
});

test('feature flag off tetap off', () => {
  assert.equal(resolveMandiriFeatureState('off'), 'off');
});

test('feature flag internal diterima', () => {
  assert.equal(resolveMandiriFeatureState('internal'), 'internal');
  assert.equal(getMandiriFeatureState({ [MANDIRI_FEATURE_ENV_KEY]: 'internal' }), 'internal');
});

test('feature flag tidak dianggap sebagai permission', () => {
  const contract = getMandiriFeatureContract('internal');
  assert.equal(contract.grantsPermission, false);
  assert.equal(contract.visibleInNavigation, true);
  assert.equal(contract.shellAvailable, true);
});

test('feature flag hanya membaca state build yang tidak sensitif', () => {
  assert.deepEqual(
    Object.keys(getMandiriFeatureContract('internal')).sort(),
    ['grantsPermission', 'shellAvailable', 'startsStorage', 'state', 'visibleInNavigation'],
  );
  assert.match(source, /VITE_VITANUSA_MANDIRI_STATE/);
  assert.doesNotMatch(source, /\b(?:accessToken|refreshToken|uid|email|role|secret)\b/i);
});

test('mode off tidak memulai storage', () => {
  assert.equal(getMandiriFeatureContract('off').startsStorage, false);
  assert.equal(shouldStartMandiriStorage('off'), false);
  assert.doesNotMatch(source, /\b(?:indexedDB|localStorage|fetch)\b/);
});
