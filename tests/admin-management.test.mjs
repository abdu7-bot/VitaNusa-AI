import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canDeleteAdmin,
  canEditAdmin,
  canOpenAdminManagement,
  mapAdminManagementError,
  normalizeAdminRecord,
  sortAdminRecords,
  validateAdminInput
} from "../admin/admin-management.js";

const OWNER = Object.freeze({
  uid: "owner-test-uid",
  email: "owner@example.test",
  role: "owner",
  status: "active"
});

const ADMIN = Object.freeze({
  uid: "admin-test-uid",
  email: "admin@example.test",
  role: "admin",
  status: "active"
});

test("owner active dapat membuka panel", () => {
  assert.equal(canOpenAdminManagement({ role: "owner", status: "active" }), true);
});

test("admin active tidak dapat membuka panel", () => {
  assert.equal(canOpenAdminManagement({ role: "admin", status: "active" }), false);
});

test("owner inactive tidak dapat membuka panel", () => {
  assert.equal(canOpenAdminManagement({ role: "owner", status: "inactive" }), false);
});

test("role tidak dikenal tidak dapat membuka panel", () => {
  assert.equal(canOpenAdminManagement({ role: "superadmin", status: "active" }), false);
});

test("input admin valid diterima", () => {
  const result = validateAdminInput({
    uid: "new-admin-test-uid",
    email: "new-admin@example.test",
    role: "admin",
    status: "inactive"
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test("UID kosong ditolak", () => {
  const result = validateAdminInput({
    uid: " ",
    email: "admin@example.test",
    role: "admin",
    status: "inactive"
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.uid, /wajib/i);
});

test("email tidak valid ditolak", () => {
  const result = validateAdminInput({
    uid: "admin-test-uid",
    email: "bukan-email",
    role: "admin",
    status: "inactive"
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.email, /valid/i);
});

test("role tidak valid ditolak", () => {
  const result = validateAdminInput({
    uid: "admin-test-uid",
    email: "admin@example.test",
    role: "administrator",
    status: "inactive"
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.role, /owner atau admin/i);
});

test("status tidak valid ditolak", () => {
  const result = validateAdminInput({
    uid: "admin-test-uid",
    email: "admin@example.test",
    role: "admin",
    status: "Active"
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.status, /active atau inactive/i);
});

test("default role adalah admin", () => {
  const result = normalizeAdminRecord({
    uid: "admin-test-uid",
    email: "admin@example.test"
  });

  assert.equal(result.role, "admin");
});

test("default status adalah inactive", () => {
  const result = normalizeAdminRecord({
    uid: "admin-test-uid",
    email: "admin@example.test"
  });

  assert.equal(result.status, "inactive");
});

test("whitespace dinormalisasi dan email disimpan lowercase", () => {
  const result = normalizeAdminRecord({
    uid: "  admin-test-uid  ",
    email: "  Admin@Example.Test  ",
    role: " admin ",
    status: " inactive "
  });

  assert.deepEqual(result, {
    uid: "admin-test-uid",
    email: "admin@example.test",
    role: "admin",
    status: "inactive"
  });
});

test("owner tidak dapat mengedit dirinya menjadi admin", () => {
  assert.equal(canEditAdmin(OWNER, OWNER, { role: "admin" }), false);
});

test("owner tidak dapat menonaktifkan dirinya", () => {
  assert.equal(canEditAdmin(OWNER, OWNER, { status: "inactive" }), false);
});

test("owner tidak dapat menghapus dirinya", () => {
  assert.equal(canDeleteAdmin(OWNER, OWNER), false);
});

test("owner dapat mengedit admin lain", () => {
  assert.equal(canEditAdmin(OWNER, ADMIN, { role: "owner" }), true);
});

test("owner dapat menonaktifkan admin lain", () => {
  assert.equal(canEditAdmin(OWNER, ADMIN, { status: "inactive" }), true);
});

test("owner dapat menghapus admin lain", () => {
  assert.equal(canDeleteAdmin(OWNER, ADMIN), true);
});

test("permission-denied dipetakan dengan benar", () => {
  const result = mapAdminManagementError({ code: "firestore/permission-denied" });

  assert.equal(result.code, "permission-denied");
  assert.equal(result.title, "Permission denied");
  assert.match(result.message, /Firestore Rules/);
});

test("network error dipetakan dengan benar", () => {
  const unavailable = mapAdminManagementError({ code: "firestore/unavailable" });
  const browserNetwork = mapAdminManagementError({ name: "TypeError", message: "Failed to fetch" });

  assert.equal(unavailable.code, "unavailable");
  assert.equal(browserNetwork.code, "unavailable");
  assert.match(unavailable.message, /koneksi internet/i);
});

test("deadline-exceeded dipetakan sebagai timeout jaringan", () => {
  const result = mapAdminManagementError({ code: "firestore/deadline-exceeded" });

  assert.equal(result.code, "deadline-exceeded");
  assert.match(result.message, /belum merespons/i);
});

test("already-exists dipetakan dengan benar", () => {
  const result = mapAdminManagementError({ code: "firestore/already-exists" });

  assert.equal(result.code, "already-exists");
  assert.equal(result.title, "Akun sudah tersedia");
  assert.match(result.message, /fitur edit/i);
});

test("unknown error tidak membocorkan data mentah", () => {
  const result = mapAdminManagementError({
    code: "firestore/kejadian-rahasia",
    message: "token=not-a-real-token owner@example.test"
  });
  const rendered = JSON.stringify(result);

  assert.equal(result.code, "unknown");
  assert.doesNotMatch(rendered, /not-a-real-token|owner@example\.test/);
});

test("UID dengan garis miring ditolak agar tidak menjadi path dokumen", () => {
  const result = validateAdminInput({
    uid: "admin/test/uid",
    email: "admin@example.test",
    role: "admin",
    status: "inactive"
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.uid, /garis miring/i);
});

test("daftar admin diurutkan owner active, admin active, lalu inactive", () => {
  const result = sortAdminRecords([
    { uid: "inactive-test-uid", email: "z@example.test", role: "admin", status: "inactive" },
    { uid: "admin-test-uid", email: "a@example.test", role: "admin", status: "active" },
    { uid: "owner-test-uid", email: "o@example.test", role: "owner", status: "active" }
  ]);

  assert.deepEqual(result.map((record) => record.uid), [
    "owner-test-uid",
    "admin-test-uid",
    "inactive-test-uid"
  ]);
});

test("dashboard menandai menu dan panel Kelola Admin sebagai owner-only", async () => {
  const html = await readFile(new URL("../admin/index.html", import.meta.url), "utf8");

  assert.match(html, /data-admin-section="admin-management"[\s\S]{0,180}data-owner-admin-management-nav/);
  assert.match(html, /data-admin-panel="admin-management" data-owner-only="true"/);
  assert.ok(html.indexOf("admin-management.js") < html.indexOf("firebase-auth.js"));
});

test("navigasi menolak panel owner saat canManageAdmins bukan true", async () => {
  const source = await readFile(new URL("../admin/admin.js", import.meta.url), "utf8");

  assert.match(source, /activePanel\.dataset\.ownerOnly === 'true'/);
  assert.match(source, /document\.body\.dataset\.canManageAdmins !== 'true'/);
});

test("create memakai pemeriksaan server dan transaksi tanpa setDoc overwrite", async () => {
  const source = await readFile(new URL("../admin/admin-management.js", import.meta.url), "utf8");

  assert.match(source, /getDocFromServer\(adminRef\)/);
  assert.match(source, /runTransaction\(state\.db/);
  assert.match(source, /transaction\.get\(adminRef\)/);
  assert.doesNotMatch(source, /\bsetDoc\s*\(/);
});

test("konfirmasi admin tidak memakai window.confirm", async () => {
  const source = await readFile(new URL("../admin/admin-management.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /window\.confirm\s*\(/);
  assert.match(source, /showModal/);
  assert.match(source, /Hapus akses admin/);
});
