import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderLearningActivity } from '../../../assets/js/mandiri/learning/ui/activity-renderer.js';
import { FakeDocument, collectText, findAll, repositoryRoot } from './fixtures.mjs';

function activity(type) {
  return {
    activityId: `activity-${type}-id`,
    type,
    prompt: 'Perhatikan contoh berikut.',
    items: [{ itemId: 'item-one-id', label: 'Langkah satu' }],
    explanation: 'Aktivitas ini tidak mempunyai nilai.',
  };
}

for (const [type, label] of [
  ['read_example', 'Tandai sudah dibaca'],
  ['observe_sequence', 'Tandai sudah dipahami'],
]) {
  test(`${type} dirender tanpa score dan state hanya di elemen sesi`, async () => {
    const controller = renderLearningActivity(new FakeDocument(), activity(type));
    assert.match(collectText(controller.element), new RegExp(label));
    assert.doesNotMatch(collectText(controller.element), /score|nilai akhir|mastery/iu);
    const button = findAll(controller.element, (node) => node.tagName === 'BUTTON')[0];
    await button.dispatch('click');
    assert.equal(button.disabled, true);
    assert.match(collectText(controller.element), /sesi halaman ini saja/u);
    controller.destroy();
    assert.equal(button.listeners.get('click').size, 0);
  });
}

test('activity type tidak didukung gagal aman', () => {
  assert.throws(
    () => renderLearningActivity(new FakeDocument(), activity('match_concept')),
    { code: 'unsupported_activity' },
  );
});

test('activity renderer tidak menggunakan storage atau network', async () => {
  const source = await readFile(
    new URL('assets/js/mandiri/learning/ui/activity-renderer.js', repositoryRoot),
    'utf8',
  );
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|fetch\s*\(|score/u);
});
