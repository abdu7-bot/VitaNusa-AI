import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSafePageContext,
  getAgentCloseHistoryAction,
  getOrCreateAgentSingleton,
  hasOnlySafePageContextFields,
  isAdminPath,
  resolveAgentConnectionStatus,
  shouldOpenAgentFromUrl,
} from '../assets/js/modules/nusa-agent.js';

const agentCss = await readFile(new URL('../assets/css/nusa-agent.css', import.meta.url), 'utf8');
const pwaCss = await readFile(new URL('../assets/css/android-pwa.css', import.meta.url), 'utf8');

test('halaman admin dikecualikan', () => {
  assert.equal(isAdminPath('/VitaNusa-AI/admin/'), true);
  assert.equal(isAdminPath('/admin/login.html'), true);
  assert.equal(isAdminPath('/VitaNusa-AI/account.html'), false);
});

test('query agent=open dikenali', () => {
  assert.equal(shouldOpenAgentFromUrl('https://example.test/?agent=open'), true);
  assert.equal(shouldOpenAgentFromUrl('https://example.test/?agent=closed'), false);
});

test('singleton mencegah agent diinisialisasi dua kali', () => {
  const registry = new Map();
  const key = {};
  let calls = 0;
  const first = getOrCreateAgentSingleton(registry, key, () => ({ id: ++calls }));
  const second = getOrCreateAgentSingleton(registry, key, () => ({ id: ++calls }));
  assert.equal(first, second);
  assert.equal(calls, 1);
});

test('konteks artikel hanya berisi field yang diizinkan', () => {
  const context = buildSafePageContext({
    url: 'https://example.test/VitaNusa-AI/articles/detail.html?slug=tidur-dan-energi-harian',
    title: 'Tidur dan Energi Harian | VitaNusa AI',
  });
  assert.deepEqual(context, {
    routeKey: 'education',
    pageTitle: 'Tidur dan Energi Harian',
    pageType: 'article',
    isVitaCheck: false,
    slug: 'tidur-dan-energi-harian',
  });
  assert.equal(hasOnlySafePageContextFields(context), true);
});

test('data form tidak dapat masuk ke konteks halaman', () => {
  const context = buildSafePageContext({
    url: 'https://example.test/account.html',
    title: 'Akun VitaNusa',
    email: 'private@example.test',
    formData: { complaint: 'rahasia' },
  });
  assert.equal('email' in context, false);
  assert.equal('formData' in context, false);
});

test('hasil VitaCheck tidak masuk ke konteks halaman', () => {
  const context = buildSafePageContext({
    url: 'https://example.test/vitacheck.html',
    title: 'VitaCheck',
    score: 42,
    answers: ['private'],
  });
  assert.equal(context.isVitaCheck, true);
  assert.equal('score' in context, false);
  assert.equal('answers' in context, false);
});

test('close state shortcut membersihkan URL dengan replace', () => {
  assert.equal(getAgentCloseHistoryAction({ hasAgentState: true, initialShortcut: true }), 'replace');
});

test('close state hasil tombol memakai history back', () => {
  assert.equal(getAgentCloseHistoryAction({ hasAgentState: true }), 'back');
});

test('status offline tidak mengklaim backend online', () => {
  assert.deepEqual(resolveAgentConnectionStatus({ online: false, backendState: 'online' }), {
    key: 'offline',
    label: 'Offline — jawaban lokal terbatas',
  });
});

test('status Online hanya berasal dari backendState online', () => {
  assert.equal(resolveAgentConnectionStatus({ online: true, backendState: 'unknown' }).key, 'unknown');
  assert.equal(resolveAgentConnectionStatus({ online: true, backendState: 'checking' }).key, 'checking');
  assert.equal(resolveAgentConnectionStatus({ online: true, backendState: 'online' }).key, 'online');
  assert.equal(resolveAgentConnectionStatus({ online: true, backendState: 'unavailable' }).key, 'unavailable');
});

test('Agent mobile memakai visual viewport, dynamic viewport, dan safe area', () => {
  assert.match(agentCss, /height:\s*var\(--nusa-viewport-height, 100dvh\)/);
  assert.match(agentCss, /min-height:\s*100svh/);
  assert.match(agentCss, /padding-top:\s*env\(safe-area-inset-top\)/);
  assert.match(agentCss, /padding-bottom:\s*env\(safe-area-inset-bottom\)/);
});

test('navigasi bawah memakai empat kolom aman dan target sentuh minimum', () => {
  assert.match(pwaCss, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(pwaCss, /\.vn-mobile-nav-item\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(pwaCss, /safe-area-inset-bottom/);
});
