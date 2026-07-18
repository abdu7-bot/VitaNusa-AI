import { learningContentError } from '../data/content-loader-errors.js';

function elementWithText(documentRef, tagName, text, className) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

export function renderLessonBlock(documentRef, block) {
  if (!documentRef?.createElement || !block) throw learningContentError('content_graph_invalid');
  if (block.type === 'heading') {
    return elementWithText(documentRef, 'h2', block.text, 'vn-learning-block-heading');
  }
  if (block.type === 'paragraph') {
    return elementWithText(documentRef, 'p', block.text, 'vn-learning-block-paragraph');
  }
  if (block.type === 'simple_list') {
    const list = documentRef.createElement('ul');
    list.className = 'vn-learning-block-list';
    block.items.forEach((item) => list.append(elementWithText(documentRef, 'li', item)));
    return list;
  }
  if (['example', 'tip', 'warning'].includes(block.type)) {
    const callout = documentRef.createElement(block.type === 'example' ? 'section' : 'aside');
    callout.className = `vn-learning-callout vn-learning-callout-${block.type}`;
    const labels = { example: 'Contoh', tip: 'Perhatikan', warning: 'Peringatan' };
    callout.append(
      elementWithText(documentRef, 'strong', labels[block.type]),
      elementWithText(documentRef, 'p', block.text),
    );
    return callout;
  }
  throw learningContentError('content_graph_invalid');
}

export function renderLessonBlocks(documentRef, blocks) {
  const fragment = documentRef.createDocumentFragment();
  blocks.forEach((block) => fragment.append(renderLessonBlock(documentRef, block)));
  return fragment;
}
