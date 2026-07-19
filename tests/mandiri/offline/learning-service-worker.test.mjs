import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../../service-worker.js', import.meta.url), 'utf8');

function createWorkerHarness() {
  const handlers = new Map();
  const stores = new Map();
  const normalizeKey = (value) => typeof value === 'string' ? value : value.url;
  const cachesApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async add(value) {
          entries.set(normalizeKey(value), new Response(`cached:${normalizeKey(value)}`));
        },
        async match(value) {
          return entries.get(normalizeKey(value))?.clone() ?? undefined;
        },
        async put(value, response) { entries.set(normalizeKey(value), response.clone()); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    registration: { scope: 'https://example.test/VitaNusa-AI/' },
    location: { origin: 'https://example.test' },
    clients: { async claim() {} },
    async skipWaiting() {},
    addEventListener(type, handler) { handlers.set(type, handler); },
  };
  const context = {
    self,
    caches: cachesApi,
    URL,
    Response,
    fetch: async () => { throw new Error('offline'); },
    console: { log() {}, warn() {}, error() {} },
    Set,
    Object,
    Promise,
  };
  vm.runInNewContext(source, context, { filename: 'service-worker.js' });

  async function dispatch(type, input = {}) {
    let waited;
    let response;
    const event = {
      ...input,
      waitUntil(promise) { waited = Promise.resolve(promise); },
      respondWith(promise) { response = Promise.resolve(promise); },
    };
    handlers.get(type)(event);
    await waited;
    return response ? response : null;
  }
  return { dispatch, stores };
}

test('install mem-precache halaman, catalog, manifest, paket untuk first load offline dan return visit', async () => {
  const worker = createWorkerHarness();
  await worker.dispatch('install');
  const urls = [
    'https://example.test/VitaNusa-AI/mandiri/belajar/index.html',
    'https://example.test/VitaNusa-AI/mandiri/belajar/lesson.html',
    'https://example.test/VitaNusa-AI/content/mandiri/learning/catalog.json',
    'https://example.test/VitaNusa-AI/content/mandiri/learning/packages/money-basics-id-v1/manifest.json',
    'https://example.test/VitaNusa-AI/content/mandiri/learning/packages/money-basics-id-v1/content.json',
  ];
  const cache = [...worker.stores.values()][0];
  for (const url of urls) assert.equal(cache.has(url), true, url);

  const request = new Request(urls[4]);
  const first = await worker.dispatch('fetch', { request });
  assert.equal((await first).status, 200);
  const returnVisit = await worker.dispatch('fetch', { request });
  assert.equal(await (await returnVisit).text(), `cached:${urls[4]}`);
});

test('activate membersihkan cache VitaNusa lama secara terkontrol', async () => {
  const worker = createWorkerHarness();
  worker.stores.set('vitanusa-ai-pwa-v15-old', new Map());
  worker.stores.set('unrelated-cache', new Map());
  await worker.dispatch('install');
  await worker.dispatch('activate');
  assert.equal(worker.stores.has('vitanusa-ai-pwa-v15-old'), false);
  assert.equal(worker.stores.has('unrelated-cache'), true);
  assert.equal(worker.stores.has('vitanusa-ai-pwa-v16-nusabelajar-phase2-exit'), true);
});

test('jawaban, learner data, request non-GET, dan JSON non-allowlist tidak dicache', async () => {
  const worker = createWorkerHarness();
  await worker.dispatch('install');
  const before = [...worker.stores.values()][0].size;
  assert.equal(await worker.dispatch('fetch', {
    request: new Request('https://example.test/VitaNusa-AI/content/mandiri/learning/answer.json'),
  }), null);
  assert.equal(await worker.dispatch('fetch', {
    request: new Request('https://example.test/VitaNusa-AI/feedback', {
      method: 'POST', body: JSON.stringify({ answer: 'private' }),
    }),
  }), null);
  assert.equal([...worker.stores.values()][0].size, before);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|correctAnswer/u);
});
