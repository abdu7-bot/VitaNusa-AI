import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getNusaKasirFeatureContract,
  getNusaKasirFeatureState,
  NUSAKASIR_FEATURE_ENV_KEY,
  readNusaKasirFeatureState,
  resolveNusaKasirFeatureState,
} from '../../../assets/js/mandiri/pos/config/nusakasir-flags.js';

const source = await readFile(
  new URL('../../../assets/js/mandiri/pos/config/nusakasir-flags.js', import.meta.url),
  'utf8',
);

test('feature flag NusaKasir default off dan nilai asing gagal aman', () => {
  assert.equal(resolveNusaKasirFeatureState(undefined), 'off');
  assert.equal(resolveNusaKasirFeatureState('enabled'), 'off');
  assert.equal(readNusaKasirFeatureState(null), 'off');
  assert.equal(getNusaKasirFeatureState({}), 'off');
});

test('feature flag NusaKasir internal hanya aktif bersama Mandiri internal', () => {
  assert.equal(
    getNusaKasirFeatureState({ [NUSAKASIR_FEATURE_ENV_KEY]: 'internal' }),
    'internal',
  );
  assert.equal(getNusaKasirFeatureContract({
    mandiriState: 'off',
    nusakasirState: 'internal',
  }).enabled, false);
  const contract = getNusaKasirFeatureContract({
    mandiriState: 'internal',
    nusakasirState: 'internal',
  });
  assert.deepEqual(contract, {
    state: 'internal',
    mandiriState: 'internal',
    nusakasirState: 'internal',
    enabled: true,
    grantsPermission: false,
    startsStorage: false,
  });
  assert.equal(Object.isFrozen(contract), true);
});

test('feature flag tidak membuka storage, network, atau memberi permission', () => {
  assert.match(source, /VITE_NUSAKASIR_STATE/);
  assert.doesNotMatch(source, /indexedDB|localStorage|fetch\s*\(|Firestore/i);
  assert.match(source, /grantsPermission: false/);
  assert.match(source, /startsStorage: false/);
});
