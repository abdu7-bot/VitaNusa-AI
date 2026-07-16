import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccountScopeFromUser,
  createLocalScopesFromUser,
  createUserScopeFromUser,
} from '../../../assets/js/mandiri/services/account-scope.js';
import { isValidScope } from '../../../assets/js/mandiri/domain/validation.js';

test('UID valid menghasilkan accountScope dan userScope stabil', async () => {
  const first = await createLocalScopesFromUser({ uid: 'public-user-01' });
  const second = await createLocalScopesFromUser({ uid: 'public-user-01' });

  assert.deepEqual(first, second);
  assert.match(first.accountScope, /^account:[0-9a-f]{64}$/);
  assert.match(first.userScope, /^user:[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(first), true);
});

test('UID berbeda menghasilkan scope berbeda', async () => {
  const first = await createLocalScopesFromUser({ uid: 'public-user-01' });
  const second = await createLocalScopesFromUser({ uid: 'public-user-02' });

  assert.notEqual(first.accountScope, second.accountScope);
  assert.notEqual(first.userScope, second.userScope);
});

test('helper account dan user memakai identitas lokal yang sama', async () => {
  const user = { uid: 'public-user-03' };
  const accountScope = await createAccountScopeFromUser(user);
  const userScope = await createUserScopeFromUser(user);

  assert.equal(accountScope.slice('account:'.length), userScope.slice('user:'.length));
});

test('UID kosong dan UID berbentuk email ditolak', async () => {
  await assert.rejects(() => createLocalScopesFromUser({ uid: '   ' }), /UID/);
  await assert.rejects(() => createLocalScopesFromUser({ uid: 'user@example.test' }), /UID/);
});

test('email tidak digunakan untuk membentuk scope', async () => {
  const first = await createLocalScopesFromUser({
    uid: 'stable-public-user',
    email: 'first@example.test',
  });
  const second = await createLocalScopesFromUser({
    uid: 'stable-public-user',
    email: 'changed@example.test',
  });

  assert.deepEqual(first, second);
  assert.doesNotMatch(JSON.stringify(first), /example\.test/);
});

test('field kredensial tidak diterima', async () => {
  await assert.rejects(
    () => createLocalScopesFromUser({ uid: 'public-user', accessToken: 'not-a-real-token' }),
    /kredensial/,
  );
  await assert.rejects(
    () => createLocalScopesFromUser({ uid: 'public-user', refresh_token: 'not-a-real-token' }),
    /kredensial/,
  );
});

test('input user tidak dimutasi', async () => {
  const input = Object.freeze({
    uid: ' public-user-04 ',
    email: 'ignored@example.test',
    displayName: 'Informasi UI saja',
  });
  const before = structuredClone(input);

  await createLocalScopesFromUser(input);

  assert.deepEqual(input, before);
});

test('output kompatibel dengan validator scope domain', async () => {
  const scopes = await createLocalScopesFromUser({ uid: 'public-user-05' });

  assert.equal(isValidScope(scopes.accountScope), true);
  assert.equal(isValidScope(scopes.userScope), true);
});

test('digest scope wajib memakai format SHA-256 canonical', async () => {
  await assert.rejects(
    () => createLocalScopesFromUser(
      { uid: 'public-user-06' },
      { digest: async () => 'weak-digest' },
    ),
    /digest scope tidak valid/,
  );
});
