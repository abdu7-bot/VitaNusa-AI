import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  renderLessonBlock,
  renderLessonBlocks,
} from '../../../assets/js/mandiri/learning/ui/lesson-block-renderer.js';
import { FakeDocument, collectText, findAll, repositoryRoot } from './fixtures.mjs';

const cases = [
  ['heading', 'H2'],
  ['paragraph', 'P'],
  ['example', 'SECTION'],
  ['tip', 'ASIDE'],
  ['warning', 'ASIDE'],
  ['simple_list', 'UL'],
];

for (const [type, tagName] of cases) {
  test(`block ${type} memakai elemen semantik`, () => {
    const block = {
      blockId: `block-${type}-id`,
      type,
      text: type === 'simple_list' ? '' : '<script>alert(1)</script>',
      items: type === 'simple_list' ? ['Satu', 'Dua'] : [],
    };
    const element = renderLessonBlock(new FakeDocument(), block);
    assert.equal(element.tagName, tagName);
    if (type !== 'simple_list') assert.match(collectText(element), /<script>alert\(1\)<\/script>/u);
    assert.equal(findAll(element, (node) => node.tagName === 'SCRIPT').length, 0);
  });
}

test('unknown block type gagal aman', () => {
  assert.throws(() => renderLessonBlock(new FakeDocument(), {
    type: 'raw_html', text: '<b>x</b>', items: [],
  }), { code: 'content_graph_invalid' });
});

test('renderer mempertahankan urutan block', () => {
  const fragment = renderLessonBlocks(new FakeDocument(), [
    { type: 'paragraph', text: 'Pertama', items: [] },
    { type: 'paragraph', text: 'Kedua', items: [] },
  ]);
  assert.equal(collectText(fragment), 'PertamaKedua');
});

test('renderer tidak memakai API HTML berbahaya', async () => {
  const source = await readFile(
    new URL('assets/js/mandiri/learning/ui/lesson-block-renderer.js', repositoryRoot),
    'utf8',
  );
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/u);
  assert.match(source, /textContent/u);
});
