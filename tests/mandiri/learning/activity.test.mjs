import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeActivity } from '../../../assets/js/mandiri/learning/domain/activity.js';

function validActivity(overrides = {}) {
  return {
    activityId: 'activity-contoh-harga',
    lessonId: 'lesson-membaca-harga',
    contentVersion: 1,
    locale: 'id-ID',
    type: 'read_example',
    prompt: 'Perhatikan contoh harga berikut.',
    items: [],
    explanation: 'Angka setelah tanda rupiah menunjukkan harga.',
    status: 'published',
    ...overrides,
  };
}

test('activity valid diterima dan tidak memiliki score', () => {
  const activity = normalizeActivity(validActivity());
  assert.equal(activity.type, 'read_example');
  assert.equal(Object.hasOwn(activity, 'scoreBasisPoints'), false);
});

test('activity interaktif menerima item terstruktur', () => {
  const activity = normalizeActivity(validActivity({
    type: 'observe_sequence',
    items: [
      { itemId: 'item-satu', label: 'Baca harga.' },
      { itemId: 'item-dua', label: 'Siapkan uang.' },
    ],
  }));
  assert.equal(activity.items.length, 2);
  assert.equal(Object.isFrozen(activity.items[0]), true);
});

test('activity menolak unknown type', () => {
  assert.throws(() => normalizeActivity(validActivity({ type: 'graded_activity' })), {
    code: 'unknown_activity_type',
  });
});

test('activity menolak field score sebagai unknown field', () => {
  assert.throws(() => normalizeActivity(validActivity({ scoreBasisPoints: 10000 })), {
    code: 'unknown_field',
  });
});
