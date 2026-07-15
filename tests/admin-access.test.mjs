import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateAdminAccess,
  getAdminRetryAction,
  getFirebaseConfigError,
  normalizeFirebaseErrorCode
} from "../admin/admin-access.js";

const TEST_USER = Object.freeze({ uid: "test-user-uid" });

test("admin aktif diizinkan", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    exists: true,
    data: { status: "active", role: "admin" }
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "active");
});

test("role owner tetap diizinkan bila status tepat active", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    exists: true,
    data: { status: "active", role: "owner" }
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "active");
});

test("dokumen admin yang hilang ditolak secara khusus", () => {
  const result = evaluateAdminAccess({ user: TEST_USER, exists: false, data: null });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "missing-admin-document");
});

test("status inactive ditolak", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    exists: true,
    data: { status: "inactive" }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "inactive-admin");
  assert.equal(result.documentStatus, "inactive");
});

test("status aktif berbahasa Indonesia tidak diubah menjadi active", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    exists: true,
    data: { status: "aktif" }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "inactive-admin");
  assert.equal(result.documentStatus, "aktif");
});

test("varian status non-string dan kapital tidak diubah menjadi active", () => {
  for (const status of [true, 1, "Active", "ACTIVE"]) {
    const result = evaluateAdminAccess({
      user: TEST_USER,
      exists: true,
      data: { status }
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reason, "inactive-admin");
  }
});

test("status kosong ditolak sebagai dokumen admin tidak aktif", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    exists: true,
    data: {}
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "inactive-admin");
  assert.equal(result.documentStatus, null);
});

test("permission denied tidak dianggap sebagai dokumen hilang", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    errorCode: "permission-denied"
  });

  assert.equal(result.reason, "permission-denied");
  assert.equal(result.errorCode, "firestore/permission-denied");
});

test("Firestore unavailable diklasifikasikan sebagai gangguan jaringan", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    errorCode: "firestore/unavailable"
  });

  assert.equal(result.reason, "network-unavailable");
});

test("deadline exceeded diklasifikasikan sebagai timeout", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    errorCode: "deadline-exceeded"
  });

  assert.equal(result.reason, "request-timeout");
  assert.equal(result.errorCode, "firestore/deadline-exceeded");
});

test("kode error tidak dikenal tetap ditolak", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    errorCode: "firestore/unexpected-condition"
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "unknown-error");
});

test("tanpa user menghasilkan no-user", () => {
  const result = evaluateAdminAccess({ user: null });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "no-user");
});

test("kesalahan konfigurasi didahulukan walau auth belum tersedia", () => {
  const result = evaluateAdminAccess({ user: null, errorCode: "firebase-config-error" });

  assert.equal(result.reason, "firebase-config-error");
});

test("validasi konfigurasi menolak project Firebase yang berbeda", () => {
  const expected = {
    projectId: "vitanusa-ai",
    authDomain: "vitanusa-ai.firebaseapp.com"
  };

  assert.equal(getFirebaseConfigError(expected, expected), null);
  assert.equal(
    getFirebaseConfigError(
      { projectId: "contoh-project-lain", authDomain: expected.authDomain },
      expected
    ),
    "firebase-config-error"
  );
});

test("kode error yang tidak aman tidak diteruskan ke UI", () => {
  assert.equal(normalizeFirebaseErrorCode("permission-denied\nsecret=value"), "unknown-error");
});

test("retry hanya tersedia pada percobaan pertama", () => {
  assert.equal(getAdminRetryAction("permission-denied", 1), "refresh-token");
  assert.equal(getAdminRetryAction("network-unavailable", 1), "retry-server");
  assert.equal(getAdminRetryAction("request-timeout", 1), "retry-server");
  assert.equal(getAdminRetryAction("permission-denied", 2), "none");
  assert.equal(getAdminRetryAction("network-unavailable", 2), "none");
  assert.equal(getAdminRetryAction("inactive-admin", 1), "none");
});

test("pemeriksaan admin memakai server Firestore dan tidak memakai getDoc cache", async () => {
  const authSource = await readFile(new URL("../admin/firebase-auth.js", import.meta.url), "utf8");

  assert.match(authSource, /getDocFromServer\(adminRef\)/);
  assert.doesNotMatch(authSource, /\bgetDoc\(adminRef\)/);
});

test("service worker membuat path admin network-only tanpa menghapus PWA publik", async () => {
  const worker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

  assert.match(worker, /const APP_SHELL = \[/);
  assert.match(worker, /const ADMIN_PATH = `\$\{BASE_PATH}\/?admin`;/);
  assert.match(worker, /if \(isAdminRequest\(request\)\) \{\s*event\.respondWith\(networkOnly\(request\)\);/);
  assert.doesNotMatch(worker, /APP_SHELL[\s\S]{0,1200}admin\/login\.html/);
});

test("Rules hanya membuka get dokumen admin milik sendiri, bukan list atau write", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");

  assert.match(rules, /function isOwnAdminDocument\(uid\)\s*{\s*return signedIn\(\) && request\.auth\.uid == uid;\s*}/);
  assert.match(rules, /allow get: if isOwnAdminDocument\(uid\) \|\| isActiveAdmin\(\);/);
  assert.match(rules, /allow list: if isActiveAdmin\(\);/);
  assert.match(rules, /allow create, update, delete: if isActiveAdmin\(\);/);
  assert.doesNotMatch(rules, /allow\s+read\s*,?\s*write\s*:\s*if\s+true/);
});
