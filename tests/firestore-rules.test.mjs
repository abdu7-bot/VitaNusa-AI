import test, { after, before, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";

const PROJECT_ID = "demo-vitanusa-rules";
const OWNER_UID = "owner-test-uid";
const ADMIN_UID = "admin-test-uid";
const INACTIVE_UID = "inactive-test-uid";
const UNKNOWN_ROLE_UID = "unknown-role-test-uid";
const USER_UID = "user-test-uid";

const ADMIN_DOCUMENTS = Object.freeze({
  [OWNER_UID]: {
    email: "owner@example.test",
    role: "owner",
    status: "active"
  },
  [ADMIN_UID]: {
    email: "admin@example.test",
    role: "admin",
    status: "active"
  },
  [INACTIVE_UID]: {
    email: "inactive@example.test",
    role: "admin",
    status: "inactive"
  },
  [UNKNOWN_ROLE_UID]: {
    email: "unknown-role@example.test",
    role: "auditor",
    status: "active"
  },
  [USER_UID]: {
    email: "user@example.test",
    role: "admin",
    status: "inactive"
  }
});

let testEnv;

function getEmulatorAddress() {
  const address = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(address, "FIRESTORE_EMULATOR_HOST harus disediakan oleh Firebase Emulator");

  const separator = address.lastIndexOf(":");
  assert.notEqual(separator, -1, "Alamat Firestore Emulator harus memuat port");

  return {
    host: address.slice(0, separator),
    port: Number(address.slice(separator + 1))
  };
}

function authenticatedDb(uid) {
  return testEnv.authenticatedContext(uid, {
    email: ADMIN_DOCUMENTS[uid]?.email || `${uid}@example.test`
  }).firestore();
}

async function seedFirestore() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const writes = Object.entries(ADMIN_DOCUMENTS).map(([uid, data]) =>
      setDoc(doc(db, "admins", uid), data)
    );

    writes.push(
      setDoc(doc(db, "articles", "published-article"), {
        status: "published",
        title: "Artikel publik untuk pengujian"
      }),
      setDoc(doc(db, "articles", "private-draft"), {
        status: "draft",
        title: "Draft privat untuk pengujian"
      }),
      setDoc(doc(db, "siteSettings", "public"), {
        siteName: "VitaNusa AI"
      }),
      setDoc(doc(db, "siteSettings", "private"), {
        internalNote: "Data privat pengujian"
      })
    );

    await Promise.all(writes);
  });
}

before(async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  const { host, port } = getEmulatorAddress();

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port, rules }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

test("pengguna belum login tidak dapat membaca dokumen admin", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "admins", ADMIN_UID)));
});

test("pengguna login dapat membaca dokumen admin miliknya sendiri", async () => {
  const db = authenticatedDb(USER_UID);
  await assertSucceeds(getDoc(doc(db, "admins", USER_UID)));
});

test("pengguna login dapat memeriksa dokumen admin miliknya yang belum ada", async () => {
  const db = authenticatedDb("missing-self-test-uid");
  const snapshot = await assertSucceeds(getDoc(doc(db, "admins", "missing-self-test-uid")));
  assert.equal(snapshot.exists(), false);
});

test("admin aktif tidak dapat membaca dokumen admin lain", async () => {
  const db = authenticatedDb(ADMIN_UID);
  await assertFails(getDoc(doc(db, "admins", OWNER_UID)));
});

test("admin aktif tidak dapat melakukan list koleksi admin", async () => {
  const db = authenticatedDb(ADMIN_UID);
  await assertFails(getDocs(collection(db, "admins")));
});

test("owner aktif dapat membaca dokumen admin lain", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertSucceeds(getDoc(doc(db, "admins", ADMIN_UID)));
});

test("owner aktif dapat melakukan list koleksi admin", async () => {
  const db = authenticatedDb(OWNER_UID);
  const snapshot = await assertSucceeds(getDocs(collection(db, "admins")));
  assert.equal(snapshot.size, Object.keys(ADMIN_DOCUMENTS).length);
});

test("admin aktif tidak dapat membuat akun admin", async () => {
  const db = authenticatedDb(ADMIN_UID);
  await assertFails(setDoc(doc(db, "admins", "new-admin-test-uid"), {
    email: "new-admin@example.test",
    role: "admin",
    status: "active"
  }));
});

test("admin aktif tidak dapat mengubah akun admin", async () => {
  const db = authenticatedDb(ADMIN_UID);
  await assertFails(updateDoc(doc(db, "admins", INACTIVE_UID), { status: "active" }));
});

test("admin aktif tidak dapat menghapus akun admin", async () => {
  const db = authenticatedDb(ADMIN_UID);
  await assertFails(deleteDoc(doc(db, "admins", INACTIVE_UID)));
});

test("owner aktif dapat membuat admin baru dengan data valid", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertSucceeds(setDoc(doc(db, "admins", "new-admin-test-uid"), {
    email: "new-admin@example.test",
    role: "admin",
    status: "active"
  }));
});

test("owner tidak dapat membuat role yang tidak dikenal", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(setDoc(doc(db, "admins", "unknown-new-role-test-uid"), {
    email: "unknown-new-role@example.test",
    role: "editor",
    status: "active"
  }));
});

test("owner tidak dapat membuat status yang tidak dikenal", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(setDoc(doc(db, "admins", "unknown-status-test-uid"), {
    email: "unknown-status@example.test",
    role: "admin",
    status: "enabled"
  }));
});

test("owner tidak dapat mengubah admin ke role yang tidak dikenal", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(updateDoc(doc(db, "admins", ADMIN_UID), { role: "editor" }));
});

test("owner tidak dapat mengubah admin ke status yang tidak dikenal", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(updateDoc(doc(db, "admins", ADMIN_UID), { status: "enabled" }));
});

test("owner dapat menonaktifkan admin lain", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertSucceeds(updateDoc(doc(db, "admins", ADMIN_UID), { status: "inactive" }));
});

test("owner dapat mengubah admin lain menjadi owner", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertSucceeds(updateDoc(doc(db, "admins", ADMIN_UID), { role: "owner" }));
});

test("owner tidak dapat menonaktifkan dirinya sendiri", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(updateDoc(doc(db, "admins", OWNER_UID), { status: "inactive" }));
});

test("owner tidak dapat menurunkan role dirinya sendiri menjadi admin", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(updateDoc(doc(db, "admins", OWNER_UID), { role: "admin" }));
});

test("owner tidak dapat menghapus dokumen miliknya sendiri", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(deleteDoc(doc(db, "admins", OWNER_UID)));
});

test("admin aktif dapat menulis konten", async () => {
  const db = authenticatedDb(ADMIN_UID);
  await assertSucceeds(setDoc(doc(db, "articles", "admin-created"), {
    status: "published",
    title: "Konten dari admin aktif"
  }));
});

test("admin inactive tidak dapat menulis konten", async () => {
  const db = authenticatedDb(INACTIVE_UID);
  await assertFails(setDoc(doc(db, "articles", "inactive-created"), {
    status: "published",
    title: "Konten yang harus ditolak"
  }));
});

test("role tidak dikenal tidak dapat menulis konten", async () => {
  const db = authenticatedDb(UNKNOWN_ROLE_UID);
  await assertFails(setDoc(doc(db, "articles", "unknown-role-created"), {
    status: "published",
    title: "Konten yang harus ditolak"
  }));
});

test("public get untuk artikel published tetap diizinkan", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "articles", "published-article")));
});

test("public query yang dibatasi ke artikel published tetap diizinkan", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const publishedQuery = query(collection(db, "articles"), where("status", "==", "published"));
  const snapshot = await assertSucceeds(getDocs(publishedQuery));
  assert.equal(snapshot.size, 1);
});

test("draft privat tetap ditolak untuk publik", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "articles", "private-draft")));
});

test("query tanpa filter yang dapat memuat draft ditolak untuk publik", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(db, "articles")));
});

test("site settings public tetap dapat dibaca publik", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "siteSettings", "public")));
});

test("site settings privat tetap ditolak untuk publik", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "siteSettings", "private")));
});

test("owner tidak dapat membuat dokumen admin dengan field tambahan", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(setDoc(doc(db, "admins", "extra-field-test-uid"), {
    email: "extra-field@example.test",
    role: "admin",
    status: "active",
    token: "not-a-real-token"
  }));
});

test("owner tidak dapat menambahkan field admin melalui update", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(updateDoc(doc(db, "admins", ADMIN_UID), {
    secret: "not-a-real-secret"
  }));
});

test("owner tidak dapat membuat dokumen admin dengan field wajib hilang", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(setDoc(doc(db, "admins", "missing-field-test-uid"), {
    email: "missing-field@example.test",
    role: "admin"
  }));
});

test("owner tidak dapat membuat email admin non-string", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(setDoc(doc(db, "admins", "invalid-email-test-uid"), {
    email: 12345,
    role: "admin",
    status: "active"
  }));
});

test("owner dapat memperbarui email sendiri tanpa mengubah role dan status", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertSucceeds(updateDoc(doc(db, "admins", OWNER_UID), {
    email: "owner-updated@example.test"
  }));
});

test("owner dapat menghapus dokumen admin lain", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertSucceeds(deleteDoc(doc(db, "admins", ADMIN_UID)));
});

test("owner aktif dapat menulis konten", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertSucceeds(setDoc(doc(db, "articles", "owner-created"), {
    status: "published",
    title: "Konten dari owner aktif"
  }));
});

test("admin aktif dapat membaca draft untuk pengelolaan konten", async () => {
  const db = authenticatedDb(ADMIN_UID);
  await assertSucceeds(getDoc(doc(db, "articles", "private-draft")));
});
