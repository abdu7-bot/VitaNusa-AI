import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getMandiriStatus,
  initMandiriOfflineStatus,
  normalizeMandiriStatusState,
  resolveMandiriConnectionState,
} from '../../assets/js/mandiri/shell/offline-status.js';

const source = await readFile(
  new URL('../../assets/js/mandiri/shell/offline-status.js', import.meta.url),
  'utf8',
);

function createStatusNode() {
  const attributes = new Map();
  return {
    dataset: {},
    textContent: '',
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name);
    },
  };
}

function createStatusEnvironment(online = true) {
  const localNode = createStatusNode();
  const connectionNode = createStatusNode();
  const listeners = new Map();
  const documentRef = {
    querySelector(selector) {
      if (selector === '[data-mandiri-local-status]') return localNode;
      if (selector === '[data-mandiri-connection-status]') return connectionNode;
      return null;
    },
  };
  const windowRef = {
    document: documentRef,
    navigator: { onLine: online },
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  return { connectionNode, documentRef, listeners, localNode, windowRef };
}

test('offline menghasilkan state offline', () => {
  assert.equal(resolveMandiriConnectionState(false), 'offline');
  assert.deepEqual(getMandiriStatus('offline'), {
    state: 'offline',
    label: 'Offline',
    message: 'Perangkat sedang offline. Fondasi lokal tetap dapat dibuka.',
  });
});

test('online menghasilkan state online-unverified', () => {
  assert.equal(resolveMandiriConnectionState(true), 'online-unverified');
  assert.match(getMandiriStatus('online-unverified').message, /masih berjalan lokal/);
});

test('local-only tidak berubah menjadi synced', () => {
  const environment = createStatusEnvironment(true);
  initMandiriOfflineStatus(environment);

  assert.equal(environment.localNode.dataset.mandiriStatus, 'local-only');
  assert.match(environment.localNode.textContent, /belum disinkronkan ke cloud/i);
  environment.listeners.get('offline')();
  environment.listeners.get('online')();
  assert.equal(environment.localNode.dataset.mandiriStatus, 'local-only');
  assert.doesNotMatch(environment.localNode.textContent, /sudah disinkronkan|tersinkron/i);
});

test('state tidak dikenal memakai fallback blocked', () => {
  assert.equal(normalizeMandiriStatusState('synced'), 'blocked');
  assert.equal(getMandiriStatus('synced').state, 'blocked');
  assert.match(getMandiriStatus('synced').message, /Tidak ada data yang dikirim/);
});

test('pesan status tidak membocorkan payload', () => {
  const payload = 'credential-private-test-value';
  const status = getMandiriStatus({ payload });
  assert.equal(status.state, 'blocked');
  assert.doesNotMatch(JSON.stringify(status), new RegExp(payload));
});

test('controller memakai event online dan offline tanpa polling', () => {
  const environment = createStatusEnvironment(false);
  const controller = initMandiriOfflineStatus(environment);

  assert.equal(environment.connectionNode.dataset.mandiriStatus, 'offline');
  environment.listeners.get('online')();
  assert.equal(environment.connectionNode.dataset.mandiriStatus, 'online-unverified');
  environment.listeners.get('offline')();
  assert.equal(environment.connectionNode.dataset.mandiriStatus, 'offline');
  assert.equal(environment.connectionNode.getAttribute('aria-label').startsWith('Offline:'), true);

  controller.destroy();
  assert.equal(environment.listeners.has('online'), false);
  assert.equal(environment.listeners.has('offline'), false);
  assert.match(source, /addEventListener\('online'/);
  assert.match(source, /addEventListener\('offline'/);
  assert.doesNotMatch(source, /\bsetInterval\b|\bsetTimeout\b|\brequestAnimationFrame\b/);
});
