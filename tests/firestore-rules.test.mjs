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
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";

const PROJECT_ID = "demo-vitanusa-rules";
const OWNER_UID = "owner-test-uid";
const ADMIN_UID = "admin-test-uid";
const INACTIVE_UID = "inactive-test-uid";
const UNKNOWN_ROLE_UID = "unknown-role-test-uid";
const USER_UID = "user-test-uid";
const USER_A_UID = "user-a-test-uid";
const USER_B_UID = "user-b-test-uid";
const HISTORY_RESULT_ID = "vc2-rules-history-test";

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

function validVitaCheckHistory(overrides = {}) {
  return {
    version: 2,
    score: 68,
    resultBand: "medium",
    focusIds: ["tidur", "gerak"],
    attentionIds: ["pencernaan"],
    recommendationSlugs: ["tidur-dan-energi-harian"],
    source: "vitacheck-v2",
    createdAt: serverTimestamp(),
    ...overrides
  };
}

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
      }),
      setDoc(doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID), {
        version: 2,
        score: 68,
        resultBand: "medium",
        focusIds: ["tidur", "gerak"],
        attentionIds: ["pencernaan"],
        recommendationSlugs: ["tidur-dan-energi-harian"],
        source: "vitacheck-v2",
        createdAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z"))
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

test("pengguna belum login tidak dapat membuat riwayat VitaCheck", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-unauth-test-result"),
    validVitaCheckHistory()
  ));
});

test("pengguna dapat membuat riwayat VitaCheck miliknya", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertSucceeds(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-own-create-test"),
    validVitaCheckHistory()
  ));
});

test("pengguna dapat membaca riwayat VitaCheck miliknya", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertSucceeds(getDoc(doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID)));
});

test("pengguna dapat list riwayat VitaCheck miliknya", async () => {
  const db = authenticatedDb(USER_A_UID);
  const snapshot = await assertSucceeds(getDocs(collection(db, "users", USER_A_UID, "vitaCheckHistory")));
  assert.equal(snapshot.size, 1);
});

test("pengguna tidak dapat membaca riwayat pengguna lain", async () => {
  const db = authenticatedDb(USER_B_UID);
  await assertFails(getDoc(doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID)));
});

test("pengguna tidak dapat menulis riwayat ke UID lain", async () => {
  const db = authenticatedDb(USER_B_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-cross-write-test"),
    validVitaCheckHistory()
  ));
});

test("admin tidak dapat membaca riwayat VitaCheck pengguna", async () => {
  const db = authenticatedDb(ADMIN_UID);
  await assertFails(getDoc(doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID)));
});

test("owner tidak dapat membaca riwayat VitaCheck pengguna", async () => {
  const db = authenticatedDb(OWNER_UID);
  await assertFails(getDoc(doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID)));
});

test("score VitaCheck di bawah nol ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-low-score-test"),
    validVitaCheckHistory({ score: -1 })
  ));
});

test("score VitaCheck di atas seratus ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-high-score-test"),
    validVitaCheckHistory({ score: 101 })
  ));
});

test("resultBand VitaCheck tidak dikenal ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-band-test"),
    validVitaCheckHistory({ resultBand: "healthy" })
  ));
});

test("source VitaCheck yang salah ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-source-test"),
    validVitaCheckHistory({ source: "manual" })
  ));
});

test("field tambahan pada riwayat VitaCheck ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-extra-field-test"),
    validVitaCheckHistory({ privateNote: "data-test" })
  ));
});

test("field answers pada riwayat VitaCheck ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-answers-test"),
    validVitaCheckHistory({ answers: [{ questionId: "tidur", value: 0 }] })
  ));
});

test("field symptoms pada riwayat VitaCheck ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-symptoms-test"),
    validVitaCheckHistory({ symptoms: ["contoh-test"] })
  ));
});

test("array kategori VitaCheck yang terlalu panjang ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-array-limit-test"),
    validVitaCheckHistory({ focusIds: ["tidur", "air", "makan", "gerak", "energi"] })
  ));
});

test("update dokumen riwayat VitaCheck lama ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(updateDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID),
    { score: 70 }
  ));
});

test("pengguna dapat menghapus hasil VitaCheck miliknya", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertSucceeds(deleteDoc(doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID)));
});

test("pengguna tidak dapat menghapus hasil VitaCheck orang lain", async () => {
  const db = authenticatedDb(USER_B_UID);
  await assertFails(deleteDoc(doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID)));
});

test("default deny tetap menolak path privat yang tidak dikenal", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(doc(db, "users", USER_A_UID, "privateNotes", "note-test"), {
    note: "data-test"
  }));
});

test("pengguna belum login tidak dapat membaca riwayat VitaCheck", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "users", USER_A_UID, "vitaCheckHistory", HISTORY_RESULT_ID)));
});

test("admin dan owner tidak dapat list riwayat VitaCheck pengguna lain", async () => {
  for (const uid of [ADMIN_UID, OWNER_UID]) {
    const db = authenticatedDb(uid);
    await assertFails(getDocs(collection(db, "users", USER_A_UID, "vitaCheckHistory")));
  }
});

test("version VitaCheck yang tidak didukung ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-version-test"),
    validVitaCheckHistory({ version: 3 })
  ));
});

test("kategori VitaCheck yang tidak dikenal ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-category-test"),
    validVitaCheckHistory({ attentionIds: ["unknown-category"] })
  ));
});

test("slug rekomendasi VitaCheck yang tidak aman ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-slug-test"),
    validVitaCheckHistory({ recommendationSlugs: ["Unsafe Slug"] })
  ));
});

test("createdAt dari client dan bukan server timestamp ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-client-time-test"),
    validVitaCheckHistory({
      createdAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z"))
    })
  ));
});

test("field diagnosis dan freeText pada riwayat VitaCheck ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-private-text-test"),
    validVitaCheckHistory({
      diagnosis: "data-test",
      freeText: "data-test"
    })
  ));
});

test("field wajib riwayat VitaCheck yang hilang ditolak", async () => {
  const db = authenticatedDb(USER_A_UID);
  const payload = validVitaCheckHistory();
  delete payload.attentionIds;
  await assertFails(setDoc(
    doc(db, "users", USER_A_UID, "vitaCheckHistory", "vc2-missing-field-test"),
    payload
  ));
});
