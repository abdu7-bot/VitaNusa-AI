import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { lintContentSafety } from '../../../assets/js/mandiri/learning/content/content-safety.js';
import { validateContentPackageGraph } from '../../../assets/js/mandiri/learning/content/content-validator.js';

const contentPath = new URL(
  '../../../content/mandiri/learning/packages/money-basics-id-v1/content.json',
  import.meta.url,
);
const unsafeFixturePath = new URL('./fixtures/unsafe-content.json', import.meta.url);

async function loadContent() {
  return JSON.parse(await readFile(contentPath, 'utf8'));
}

test('package utama lulus content safety lint tanpa finding', async () => {
  const content = await loadContent();
  const before = structuredClone(content);
  const findings = lintContentSafety(content);
  assert.deepEqual(findings, []);
  assert.deepEqual(content, before);
});

test('negative fixture membuktikan seluruh kategori lint tetap bekerja', async () => {
  const fixture = JSON.parse(await readFile(unsafeFixturePath, 'utf8'));
  const findings = lintContentSafety(fixture, { path: 'fixture' });
  const codes = new Set(findings.map((finding) => finding.code));
  assert.deepEqual(codes, new Set([
    'degrading_language',
    'formal_education_claim',
    'health_claim',
    'business_claim',
  ]));
  findings.forEach((finding) => assert.match(finding.path, /^fixture\./));
});

test('raw HTML, script, event handler, dan URL berbahaya ditolak validator graph', async () => {
  const cases = [
    ['<strong>Harga</strong>', 'raw_html_forbidden'],
    ['<script>alert(1)</script>', 'raw_html_forbidden'],
    ['onclick=alert(1)', 'event_handler_forbidden'],
    ['javascript:alert(1)', 'dangerous_url'],
    ['data:text/html,unsafe', 'dangerous_url'],
    ['https://example.test/materi', 'arbitrary_url_forbidden'],
  ];
  for (const [text, code] of cases) {
    const content = await loadContent();
    content.lessons[0].blocks[0].text = text;
    assert.throws(() => validateContentPackageGraph(content), { code });
  }
});

test('dangerous object key ditolak sebelum graph diproses', async () => {
  const content = await loadContent();
  const source = JSON.stringify(content).replace(
    /"schemaVersion"/,
    '"constructor":{},"schemaVersion"',
  );
  assert.throws(() => validateContentPackageGraph(JSON.parse(source)), {
    code: 'dangerous_key',
  });
});

test('package utama tidak memuat bahasa, klaim, atau markup terlarang', async () => {
  const source = await readFile(contentPath, 'utf8');
  for (const pattern of [
    /\b(?:bodoh|gagal total|tidak mampu|tertinggal|malas|iq rendah)\b/iu,
    /\b(?:setara (?:sd|smp|sma)|pasti lulus|pengganti sekolah)\b/iu,
    /\b(?:diagnosis|pasti sembuh|100% aman|tanpa efek samping)\b/iu,
    /\b(?:pasti untung|laba dijamin|laporan pajak resmi)\b/iu,
    /<\s*script/iu,
    /\bon[a-z]+\s*=/iu,
    /\b(?:javascript|data|file|https?):/iu,
  ]) {
    assert.doesNotMatch(source, pattern);
  }
});

test('package statis tidak memuat scope, identitas, credential, atau data domain lain', async () => {
  const source = await readFile(contentPath, 'utf8');
  for (const term of [
    'learnerScope',
    'accountScope',
    'workspaceId',
    'userScope',
    'email',
    'uid',
    'token',
    'VitaCheck',
    'platform_admin',
    'merchant_owner',
  ]) {
    assert.equal(source.includes(term), false, term);
  }
});
