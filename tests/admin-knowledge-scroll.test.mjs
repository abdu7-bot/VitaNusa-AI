import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const adminSource = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const knowledgeSource = readFileSync(new URL('../admin/knowledge.js', import.meta.url), 'utf8');
const knowledgeCss = readFileSync(new URL('../admin/knowledge-mobile-fix.css', import.meta.url), 'utf8');

function getFunctionBlock(source, name) {
  const patterns = [`async function ${name}(`, `function ${name}(`];
  const start = patterns.map((pattern) => source.indexOf(pattern)).find((index) => index >= 0);
  assert.notEqual(start, undefined, `${name} must exist`);

  const openingBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not read ${name}`);
}

class MockClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(value) {
    this.values.add(value);
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class MockElement {
  constructor({ adminSection = '', adminPanel = '', rectTop = 0, classes = [] } = {}) {
    this.dataset = {};
    if (adminSection) this.dataset.adminSection = adminSection;
    if (adminPanel) this.dataset.adminPanel = adminPanel;
    this.hidden = false;
    this.disabled = false;
    this.classList = new MockClassList(classes);
    this.listeners = new Map();
    this.rectTop = rectTop;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute() {}

  matches(selector) {
    return selector === '[data-admin-section]' && Boolean(this.dataset.adminSection);
  }

  getBoundingClientRect() {
    return { top: this.rectTop };
  }
}

function runAdminScript() {
  const knowledgeLink = new MockElement({ adminSection: 'knowledge' });
  const dashboardPanel = new MockElement({ adminPanel: 'dashboard' });
  const knowledgePanel = new MockElement({ adminPanel: 'knowledge', rectTop: 0 });
  knowledgePanel.hidden = true;
  const scrollCalls = [];
  const windowListeners = new Map();
  const documentListeners = new Map();

  const document = {
    body: { classList: new MockClassList(), dataset: {} },
    head: { appendChild() {} },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === '[data-admin-section]') return [knowledgeLink];
      if (selector === '[data-admin-panel]') return [dashboardPanel, knowledgePanel];
      return [];
    },
    createElement() { return { id: '', textContent: '' }; },
    addEventListener(type, listener) { documentListeners.set(type, listener); }
  };

  const window = {
    history: { scrollRestoration: 'auto' },
    scrollX: 0,
    scrollY: 640,
    matchMedia() { return { matches: false, addEventListener() {} }; },
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    dispatchEvent() {},
    scrollTo(first, second) {
      const left = typeof first === 'object' ? first.left ?? 0 : first ?? 0;
      const top = typeof first === 'object' ? first.top ?? 0 : second ?? 0;
      this.scrollX = left;
      this.scrollY = top;
      scrollCalls.push({ left, top });
    },
    alert() {}
  };

  class MockTextArea extends MockElement {}
  class MockEvent {
    constructor(type, options = {}) {
      this.type = type;
      Object.assign(this, options);
    }
  }
  class MockCustomEvent extends MockEvent {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  }

  vm.runInNewContext(adminSource, {
    Array,
    Boolean,
    CustomEvent: MockCustomEvent,
    document,
    Element: MockElement,
    Event: MockEvent,
    HTMLTextAreaElement: MockTextArea,
    Math,
    queueMicrotask,
    requestAnimationFrame(callback) { callback(); },
    setTimeout,
    String,
    WeakMap,
    window
  });

  return { dashboardPanel, knowledgeLink, knowledgePanel, scrollCalls, window };
}

test('admin initialization only resets to the document start and disables browser restoration', () => {
  const harness = runAdminScript();
  assert.equal(harness.window.history.scrollRestoration, 'manual');
  assert.ok(harness.scrollCalls.length >= 2);
  assert.ok(harness.scrollCalls.every((call) => call.top === 0));
});

test('user navigation to Knowledge opens the panel at its start', () => {
  const harness = runAdminScript();
  harness.scrollCalls.length = 0;
  harness.window.scrollY = 900;
  harness.knowledgePanel.rectTop = -780;

  harness.knowledgeLink.listeners.get('click')();

  assert.equal(harness.dashboardPanel.hidden, true);
  assert.equal(harness.knowledgePanel.hidden, false);
  assert.deepEqual(harness.scrollCalls, [{ left: 0, top: 120 }]);
});

test('Knowledge init and async rendering contain no focus or downward scroll side effects', () => {
  for (const name of ['initKnowledgeCrud', 'injectKnowledgeImportBlock', 'loadKnowledge', 'renderKnowledge', 'resetKnowledgeForm']) {
    const block = getFunctionBlock(knowledgeSource, name);
    assert.doesNotMatch(block, /\.focus\s*\(|scrollIntoView\s*\(|window\.scrollTo\s*\(/, `${name} must not move focus or scroll`);
  }
});

test('only the explicit edit path scrolls to the Knowledge form', () => {
  const fillBlock = getFunctionBlock(knowledgeSource, 'fillKnowledgeForm');
  const actionBlock = getFunctionBlock(knowledgeSource, 'handleKnowledgeListAction');
  assert.match(fillBlock, /form\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(actionBlock, /knowledgeAction === 'edit'\) fillKnowledgeForm\(item\)/);
});

test('Knowledge initialization is idempotent and CRUD bindings remain present', () => {
  const initBlock = getFunctionBlock(knowledgeSource, 'initKnowledgeCrud');
  assert.match(initBlock, /if \(state\.initialized\) return;/);
  assert.match(initBlock, /state\.initialized = true;/);
  assert.match(initBlock, /addEventListener\('submit', handleSaveKnowledge\)/);
  assert.match(initBlock, /addEventListener\('click', handleKnowledgeListAction\)/);
  for (const functionName of ['handleSaveKnowledge', 'publishKnowledge', 'archiveKnowledge', 'deleteKnowledge', 'loadKnowledge']) {
    assert.match(knowledgeSource, new RegExp(`(?:async )?function ${functionName}\\(`));
  }
});

test('Knowledge subtree opts out of browser scroll anchoring during DOM height changes', () => {
  assert.match(
    knowledgeCss,
    /\.admin-panel\[data-admin-panel="knowledge"\]\s*\{[^}]*overflow-anchor:\s*none;/s
  );
});
