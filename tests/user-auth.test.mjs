import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPublicUserState,
  createUserAuthStore,
  isLikelyMobileAuthEnvironment,
  mapUserAuthError,
  shouldFallbackToRedirect,
} from '../assets/js/modules/user-auth.js';

test('state pengguna belum login tidak memuat profil', () => {
  const state = createPublicUserState(null);
  assert.equal(state.status, 'signed-out');
  assert.equal(state.isAuthenticated, false);
  assert.equal(state.user, null);
});

test('state pengguna login hanya memuat profil publik yang disanitasi', () => {
  const state = createPublicUserState({
    uid: 'user-auth-test-uid',
    displayName: '  Pengguna Test  ',
    email: 'user@example.test',
    photoURL: 'https://example.test/photo.png',
    accessToken: 'credential-value-for-test',
    refreshToken: 'refresh-value-for-test',
  });

  assert.equal(state.status, 'signed-in');
  assert.equal(state.user.uid, 'user-auth-test-uid');
  assert.equal(state.user.displayName, 'Pengguna Test');
  assert.deepEqual(Object.keys(state.user), ['uid', 'displayName', 'email', 'photoURL']);
});

test('popup blocked dipetakan ke pesan aman dan mendukung redirect', () => {
  const mapped = mapUserAuthError({ code: 'auth/popup-blocked' });
  assert.equal(mapped.code, 'auth/popup-blocked');
  assert.match(mapped.title, /Popup/i);
  assert.equal(shouldFallbackToRedirect(mapped.code), true);
});

test('popup closed dipetakan sebagai pembatalan tanpa redirect otomatis', () => {
  const mapped = mapUserAuthError({ code: 'auth/popup-closed-by-user' });
  assert.equal(mapped.code, 'auth/popup-closed-by-user');
  assert.match(mapped.title, /dibatalkan/i);
  assert.equal(shouldFallbackToRedirect(mapped.code), false);
});

test('network failure memberi petunjuk koneksi', () => {
  const mapped = mapUserAuthError({ code: 'auth/network-request-failed' });
  assert.equal(mapped.code, 'auth/network-request-failed');
  assert.match(mapped.message, /koneksi internet/i);
});

test('unauthorized domain memberi pesan konfigurasi domain', () => {
  const mapped = mapUserAuthError({ code: 'auth/unauthorized-domain' });
  assert.equal(mapped.code, 'auth/unauthorized-domain');
  assert.match(mapped.message, /domain/i);
});

test('logout membersihkan state yang diterima UI', () => {
  const store = createUserAuthStore({
    uid: 'logout-test-uid',
    email: 'logout@example.test',
  });
  const observed = [];
  store.subscribe((state) => observed.push(state.status));

  const state = store.clear();
  assert.equal(state.status, 'signed-out');
  assert.equal(state.user, null);
  assert.deepEqual(observed, ['signed-in', 'signed-out']);
});

test('error tidak membocorkan credential atau pesan mentah', () => {
  const mapped = mapUserAuthError({
    code: 'auth/internal-error',
    message: 'raw-credential-test-value',
  });
  const serialized = JSON.stringify(mapped);
  assert.doesNotMatch(serialized, /raw-credential-test-value/);
  assert.doesNotMatch(serialized, /stack/i);
});

test('lingkungan mobile memilih alur redirect', () => {
  assert.equal(isLikelyMobileAuthEnvironment({
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile)',
    maxTouchPoints: 5,
    viewportWidth: 390,
  }), true);
});
