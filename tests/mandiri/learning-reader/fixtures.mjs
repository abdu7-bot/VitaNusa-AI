import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createLearningCatalogLoader } from '../../../assets/js/mandiri/learning/data/catalog-loader.js';
import { createLearningPackageLoader } from '../../../assets/js/mandiri/learning/data/package-loader.js';

export const repositoryRoot = new URL('../../../', import.meta.url);
export const catalogFileUrl = new URL(
  'content/mandiri/learning/catalog.json',
  repositoryRoot,
);
export const manifestFileUrl = new URL(
  'content/mandiri/learning/packages/money-basics-id-v1/manifest.json',
  repositoryRoot,
);
export const contentFileUrl = new URL(
  'content/mandiri/learning/packages/money-basics-id-v1/content.json',
  repositoryRoot,
);

export const runtimeCatalogUrl = 'https://example.test/VitaNusa-AI/content/mandiri/learning/catalog.json';
export const runtimeManifestUrl = 'https://example.test/VitaNusa-AI/content/mandiri/learning/packages/money-basics-id-v1/manifest.json';
export const runtimeContentUrl = 'https://example.test/VitaNusa-AI/content/mandiri/learning/packages/money-basics-id-v1/content.json';

export const catalogBytes = new Uint8Array(await readFile(catalogFileUrl));
export const manifestBytes = new Uint8Array(await readFile(manifestFileUrl));
export const contentBytes = new Uint8Array(await readFile(contentFileUrl));
export const catalogInput = JSON.parse(new TextDecoder().decode(catalogBytes));
export const manifestInput = JSON.parse(new TextDecoder().decode(manifestBytes));
export const contentInput = JSON.parse(new TextDecoder().decode(contentBytes));

export function clone(value) {
  return structuredClone(value);
}

function copyBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function byteResponse(bytes, { ok = true, declaredLength = bytes.byteLength } = {}) {
  const safeBytes = new Uint8Array(bytes);
  return {
    ok,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-length' && declaredLength !== null
          ? String(declaredLength)
          : null;
      },
    },
    async arrayBuffer() { return copyBuffer(safeBytes); },
  };
}

export function createStaticFetch({
  catalog = catalogBytes,
  manifest = manifestBytes,
  content = contentBytes,
  overrides = new Map(),
  calls = [],
} = {}) {
  const defaults = new Map([
    [runtimeCatalogUrl, byteResponse(catalog)],
    [runtimeManifestUrl, byteResponse(manifest)],
    [runtimeContentUrl, byteResponse(content)],
  ]);
  return async (url, options) => {
    calls.push({ url, options });
    const value = overrides.has(url) ? overrides.get(url) : defaults.get(url);
    if (!value) throw new Error('unexpected-url');
    return typeof value === 'function' ? value(url, options) : value;
  };
}

export function createPublishedLoaders(options = {}) {
  const fetchImpl = options.fetchImpl || createStaticFetch(options);
  return {
    catalogLoader: createLearningCatalogLoader({
      fetchImpl,
      catalogUrl: runtimeCatalogUrl,
      maxBytes: options.maxCatalogBytes,
    }),
    packageLoader: createLearningPackageLoader({
      fetchImpl,
      digestFactory: (bytes) => import('../../../assets/js/mandiri/learning/data/browser-checksum.js')
        .then(({ createBrowserSha256 }) => createBrowserSha256(bytes, webcrypto)),
      maxManifestBytes: options.maxManifestBytes,
      maxContentBytes: options.maxContentBytes,
    }),
    fetchImpl,
  };
}

export class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName === '#fragment' ? '#FRAGMENT' : tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.type = '';
    this.name = '';
    this.href = '';
    this._textContent = '';
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent || '').join('');
  }

  set textContent(value) {
    this._textContent = String(value ?? '');
    this.children = [];
  }

  append(...nodes) {
    for (const value of nodes) {
      if (value === null || value === undefined) continue;
      if (value.tagName === '#FRAGMENT') {
        this.append(...value.children);
        value.children = [];
        continue;
      }
      const node = typeof value === 'string' ? new FakeText(value) : value;
      node.parentNode = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this._textContent = '';
    this.append(...nodes);
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  async dispatch(type, properties = {}) {
    const event = {
      type,
      target: this,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...properties,
    };
    for (const handler of this.listeners.get(type) || []) await handler(event);
    return event;
  }
  focus() { this.focused = true; }
  reset() {
    for (const node of findAll(this, () => true)) {
      if (node.tagName === 'INPUT') {
        node.checked = false;
        node.value = '';
      }
    }
  }
}

class FakeText extends FakeElement {
  constructor(value) {
    super('#text');
    this._textContent = value;
  }
}

export class FakeDocument {
  constructor(selectors = {}) {
    this.selectors = selectors;
    this.defaultView = null;
  }
  createElement(tagName) { return new FakeElement(tagName); }
  createDocumentFragment() { return new FakeElement('#fragment'); }
  querySelector(selector) { return this.selectors[selector] || null; }
}

export function findAll(root, predicate) {
  const found = [];
  const visit = (node) => {
    if (predicate(node)) found.push(node);
    node.children?.forEach(visit);
  };
  visit(root);
  return found;
}

export function collectText(root) {
  return root.textContent;
}

export function createSpyView() {
  const models = [];
  let callbacks = null;
  let destroyed = false;
  let evaluator = null;
  return {
    models,
    bind(value) { callbacks = value; },
    configure(value) { evaluator = value.evaluator; },
    render(model) { models.push(model); },
    destroy() { destroyed = true; },
    get callbacks() { return callbacks; },
    get destroyed() { return destroyed; },
    get evaluator() { return evaluator; },
  };
}
