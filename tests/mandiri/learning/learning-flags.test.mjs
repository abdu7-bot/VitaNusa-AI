import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNusaBelajarFeatureContract,
  readNusaBelajarFeatureState,
  resolveNusaBelajarFeatureState,
} from '../../../assets/js/mandiri/learning/config/learning-flags.js';

test('learning flag undefined, kosong, dan unknown menjadi off', () => {
  assert.equal(resolveNusaBelajarFeatureState(undefined), 'off');
  assert.equal(resolveNusaBelajarFeatureState(''), 'off');
  assert.equal(resolveNusaBelajarFeatureState('preview'), 'off');
});

test('learning flag menerima off dan internal', () => {
  assert.equal(resolveNusaBelajarFeatureState('off'), 'off');
  assert.equal(resolveNusaBelajarFeatureState('internal'), 'internal');
  assert.equal(readNusaBelajarFeatureState({ VITE_NUSABELAJAR_STATE: 'internal' }), 'internal');
});

test('Mandiri off membuat NusaBelajar off meski subfeature internal', () => {
  const contract = getNusaBelajarFeatureContract({
    mandiriState: 'off',
    learningState: 'internal',
  });
  assert.equal(contract.state, 'off');
  assert.equal(contract.enabled, false);
  assert.equal(contract.startsStorage, false);
});

test('dua flag internal mengaktifkan kontrak tanpa memberi permission', () => {
  const contract = getNusaBelajarFeatureContract({
    mandiriState: 'internal',
    learningState: 'internal',
  });
  assert.equal(contract.state, 'internal');
  assert.equal(contract.enabled, true);
  assert.equal(contract.grantsPermission, false);
  assert.equal(contract.startsStorage, true);
});
