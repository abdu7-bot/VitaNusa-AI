import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canManageAdmins,
  evaluateAdminAccess,
  getAdminRetryAction,
  getFirebaseConfigError,
  inspectAdminDocumentShape,
  normalizeFirebaseErrorCode
} from "../admin/admin-access.js";

const TEST_USER = Object.freeze({ uid: "test-user-uid" });

test("diagnostik struktur hanya mengembalikan metadata aman", () => {
  const diagnostic = inspectAdminDocumentShape({
    email: "private@example.test",
    role: "admin",
    status: "active"
  }, {
    projectId: "vitanusa-ai",
    databaseId: "(default)"
  });

  assert.deepEqual(Object.keys(diagnostic), [
    "documentExists",
    "hasStatusField",
    "hasRoleField",
    "statusType",
    "roleType",
    "projectId",
    "databaseId",
    "fieldDescriptors"
  ]);
  assert.equal(diagnostic.documentExists, true);
  assert.equal(diagnostic.hasStatusField, true);
  assert.equal(diagnostic.hasRoleField, true);
  assert.equal(diagnostic.statusType, "string");
  assert.equal(diagnostic.roleType, "string");
  assert.deepEqual(diagnostic.fieldDescriptors.map((field) => field.classification), [
    "expected:email",
    "expected:role",
    "expected:status"
  ]);
  assert.doesNotMatch(JSON.stringify(diagnostic), /private@example\.test|\"active\"|\"admin\"/);
});

test("diagnostik memakai own property dan membatasi tipe yang ditampilkan", () => {
  const inherited = Object.create({ status: "active", role: "admin" });
  inherited.email = null;
  const diagnostic = inspectAdminDocumentShape(inherited, {});

  assert.equal(diagnostic.hasStatusField, false);
  assert.equal(diagnostic.hasRoleField, false);
  assert.equal(diagnostic.statusType, "undefined");
  assert.equal(diagnostic.roleType, "undefined");
  assert.equal(diagnostic.fieldDescriptors.length, 1);

  const typed = inspectAdminDocumentShape({ status: null, role: [] });
  assert.equal(typed.statusType, "null");
  assert.equal(typed.roleType, "array");

  const unknown = inspectAdminDocumentShape({ status: Symbol("hidden"), role() {} });
  assert.equal(unknown.statusType, "unknown");
  assert.equal(unknown.roleType, "unknown");
});

test("diagnostik menyamarkan field asing dan menunjukkan Unicode code point", () => {
  const diagnostic = inspectAdminDocumentShape({
    "status\u200B": "active",
    "role\u00A0": "admin",
    Status: "active",
    "st\u0430tus": "active",
    rule: "admin",
    profile: { status: "active", role: "admin" }
  });

  assert.equal(diagnostic.hasStatusField, false);
  assert.equal(diagnostic.hasRoleField, false);
  assert.ok(diagnostic.fieldDescriptors.every((field) => field.classification === "unexpected"));
  assert.ok(diagnostic.fieldDescriptors.every((field) => field.maskedName === "[masked]"));
  assert.equal(diagnostic.fieldDescriptors[0].nameLength, 7);
  assert.match(diagnostic.fieldDescriptors[0].unicodeCodePoints, /U\+200B/);
  assert.match(diagnostic.fieldDescriptors[1].unicodeCodePoints, /U\+00A0/);
  assert.match(diagnostic.fieldDescriptors[3].unicodeCodePoints, /U\+0430/);

  const rendered = JSON.stringify(diagnostic);
  assert.doesNotMatch(rendered, /\"active\"|\"admin\"/);
});

test("diagnostik dokumen hilang tidak mengarang field", () => {
  const diagnostic = inspectAdminDocumentShape(null, {
    projectId: "vitanusa-ai",
    databaseId: "(default)"
  });

  assert.equal(diagnostic.documentExists, false);
  assert.equal(diagnostic.hasStatusField, false);
  assert.equal(diagnostic.hasRoleField, false);
  assert.equal(diagnostic.statusType, "undefined");
  assert.equal(diagnostic.roleType, "undefined");
  assert.deepEqual(diagnostic.fieldDescriptors, []);
});

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
  assert.equal(result.documentRole, "owner");
});

test("role tidak dikenal ditolak walau status active", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    exists: true,
    data: { status: "active", role: "editor" }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "invalid-admin-role");
  assert.equal(result.documentRole, "editor");
});

test("role yang hilang ditolak walau status active", () => {
  const result = evaluateAdminAccess({
    user: TEST_USER,
    exists: true,
    data: { status: "active" }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "invalid-admin-role");
  assert.equal(result.documentRole, null);
});

test("canManageAdmins hanya true untuk owner active", () => {
  assert.equal(canManageAdmins({ status: "active", role: "owner" }), true);
  assert.equal(canManageAdmins({ status: "active", role: "admin" }), false);
  assert.equal(canManageAdmins({ status: "inactive", role: "owner" }), false);
  assert.equal(canManageAdmins({ status: "active", role: "editor" }), false);
  assert.equal(canManageAdmins(null), false);
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

test("diagnostik diintegrasikan setelah server read tanpa memengaruhi evaluasi akses", async () => {
  const authSource = await readFile(new URL("../admin/firebase-auth.js", import.meta.url), "utf8");

  assert.ok(authSource.indexOf("getDocFromServer(adminRef)") < authSource.indexOf("inspectAdminDocumentShape(adminData"));
  assert.match(authSource, /const FIRESTORE_DATABASE_ID = "\(default\)";/);
  assert.match(authSource, /if \(!result\.allowed\) return \{ \.\.\.result, documentDiagnostic \};/);
  assert.match(authSource, /target\.textContent = value/);
  assert.doesNotMatch(authSource, /innerHTML|insertAdjacentHTML/);
  assert.match(authSource, /admin-access\.js\?v=20260718-admin-document-diagnostic-v1/);
});

test("login dan dashboard memuat diagnostik hidden dengan cache version baru", async () => {
  const [loginHtml, dashboardHtml] = await Promise.all([
    readFile(new URL("../admin/login.html", import.meta.url), "utf8"),
    readFile(new URL("../admin/index.html", import.meta.url), "utf8")
  ]);

  for (const html of [loginHtml, dashboardHtml]) {
    assert.match(html, /data-admin-document-diagnostics hidden/);
    assert.match(html, /data-admin-document-diagnostic="documentExists"/);
    assert.match(html, /data-admin-document-diagnostic="fieldDescriptors"/);
    assert.match(html, /firebase-auth\.js\?v=20260718-admin-document-diagnostic-v1/);
  }
});

test("service worker membuat path admin network-only tanpa menghapus PWA publik", async () => {
  const worker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

  assert.match(worker, /const APP_SHELL = \[/);
  assert.match(worker, /const ADMIN_PATH = `\$\{BASE_PATH}\/?admin`;/);
  assert.match(worker, /if \(isAdminRequest\(request\)\) \{\s*event\.respondWith\(networkOnly\(request\)\);/);
  assert.doesNotMatch(worker, /APP_SHELL[\s\S]{0,1200}admin\/login\.html/);
});

test("Rules memisahkan self-read, owner management, dan content admin", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");

  assert.match(rules, /function isOwnAdminDocument\(uid\)\s*{\s*return signedIn\(\) && request\.auth\.uid == uid;\s*}/);
  assert.match(rules, /function isActiveOwner\(\)/);
  assert.match(rules, /allow get: if isOwnAdminDocument\(uid\) \|\| isActiveOwner\(\);/);
  assert.match(rules, /allow list: if isActiveOwner\(\);/);
  assert.match(rules, /allow create: if isActiveOwner\(\)/);
  assert.match(rules, /allow update: if isActiveOwner\(\)/);
  assert.match(rules, /allow delete: if isActiveOwner\(\)/);
  assert.match(rules, /request\.auth\.uid != uid/);
  assert.match(rules, /adminData\.keys\(\)\.hasAll\(\["email", "role", "status"\]\)/);
  assert.match(rules, /adminData\.keys\(\)\.hasOnly\(\["email", "role", "status"\]\)/);
  assert.doesNotMatch(rules, /allow\s+read\s*,?\s*write\s*:\s*if\s+true/);
});

test("Storage content write juga mensyaratkan role admin yang valid", async () => {
  const rules = await readFile(new URL("../storage.rules", import.meta.url), "utf8");

  assert.match(rules, /function hasValidAdminRole\(adminData\)/);
  assert.match(rules, /hasValidAdminRole\(\s*firestore\.get/);
  assert.doesNotMatch(rules, /allow\s+read\s*,?\s*write\s*:\s*if\s+true/);
});

test("otorisasi owner tidak memakai daftar email hardcoded", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");

  assert.doesNotMatch(rules, /request\.auth\.token\.email/);
  assert.doesNotMatch(rules, /@(?:gmail|googlemail)\.com/i);
});
