# 15 — Test Strategy

Status: **Proposed**. Test names and paths are planned until each implementation PR creates them.

## Test pyramid

1. **Unit/domain tests (terbanyak):** pure functions, schemas, state machines, conflict resolvers, and sanitizers.
2. **Repository/component tests:** IndexedDB transaction, migration, UI states, content package, export snapshot.
3. **Security/integration tests:** Firestore Emulator, authenticated command boundary, cross-tenant, replay, partial failure.
4. **End-to-end/manual physical device (terpilih):** Android offline/update/shared account/accessibility/pilot journeys.

Fixtures memakai UUID/email/workspace palsu seperti `workspace-test-a`, `owner@example.test`, dan integer money. Tidak memakai data produksi atau copy database pengguna.

## Unit test minimum

| Domain | Kasus inti |
| --- | --- |
| Money arithmetic | safe integer, add/multiply, overflow, IDR formatting isolation, basis-points rounding |
| Sale calculation | line/subtotal/discount/grand total, empty cart, snapshot price |
| Payment/change | exact, overpayment/change, underpayment reject, split deferred |
| Inventory | opening/in/sale/adjustment/reversal, balance rebuild, insufficient stock |
| Cash session/movement | open/close state, signed sale/expense/in/out/reversal, expected/count/difference, append-only movement, immutable close |
| Gross-profit estimate | complete/missing cost, void, disclaimer metadata |
| Learning progress | state transition, best score same version, reset explicit, no raw counter merge |
| Quiz scoring | integer basis points, zero items reject, version binding |
| Spreadsheet sanitization | all formula prefixes, control chars, Unicode, safe numeric cells |
| Sync operation | operation ID, hash match/mismatch, retry classification, acknowledgement |
| Conflict resolution | product field conflict, price conflict, immutable sale, progress merge |
| Agent action | allowlist, missing source, nonce expiry/reuse, role change, deterministic recompute |

Property-style loops tanpa dependency baru dapat menguji kombinasi integer boundary, quantity, discount, dan payment. Fuzz parser file menggunakan fixture bounded dan tidak menulis filesystem di luar temp test.

## Firestore Rules/API security tests

Gunakan daftar 56 scenario pada [07-firestore-architecture.md](07-firestore-architecture.md), ditambah:

- exact field allowlist dan tipe untuk setiap entity;
- tenant ID mismatch di path vs payload;
- stale/forged membership cache;
- suspended workspace;
- platform owner/admin bypass denial;
- owner self-protection dan transfer atomik;
- learning self-access dan mentor scope/expiry/revoke;
- admin/mentor/workspace denial pada VitaCheck;
- sale/movement update/delete denial;
- operation receipt replay dan payload mismatch;
- export/import job owner binding;
- unknown path default deny.

Jika financial command memakai backend privileged credential, test API integration wajib menjalankan actor matrix yang sama; Emulator saja tidak membuktikan server isolation.

## Offline and sync tests

1. Create sale offline, restart, dan pastikan sale/line/payment/movement/outbox tetap ada.
2. Kirim operation, timeout setelah server apply, retry, dan pastikan satu sale.
3. Simulasikan partial local acknowledgement dan recover.
4. Ubah product pada dua device; price conflict tidak auto-merge.
5. Buat stock movement concurrent; balance direkonsiliasi.
6. Expire auth; state `blocked_auth`, tidak retry loop.
7. Revoke membership; next sync denied tanpa menghapus local record.
8. Permission denied/schema mismatch masuk terminal state dengan export option.
9. Jam perangkat maju/mundur; server order tetap benar.
10. Kill app saat IndexedDB transaction/migration; atomicity/recovery.
11. Quota exceeded; tidak menghapus sale/outbox.
12. Account switch/logout; tidak ada data scope lama di UI/query.

Background Sync tidak menjadi prerequisite; test berjalan dengan explicit sync trigger.

## Spreadsheet tests

- file/workbook dapat dibuka oleh parser independen;
- sepuluh nama sheet dan urutan tepat;
- header, freeze panes, filter, format tanggal/uang;
- totals cocok dengan domain snapshot;
- dataset kosong dan missing purchase cost;
- large dataset mendekati batas tanpa truncate;
- Unicode Indonesia dan control characters;
- formula-injection corpus `= + - @ tab CR LF`;
- voided sales/reversal tidak double count;
- CSV delimiter/newline/quote;
- invalid import, duplicate SKU, wrong schema/version;
- cross-tenant rows tidak pernah masuk output.

## Accessibility and low-literacy tests

- seluruh tindakan inti keyboard dan focus order;
- landmark, label, status live, dialog semantics, error association;
- screen reader mengumumkan total, pending sync, quiz feedback, dan confirmation;
- touch target sekitar 44 px;
- zoom 200%, text resize, contrast, dan no color-only state;
- viewport 360×800, 390×844, tablet, dan desktop;
- instruksi pendek melalui content review dengan pengguna sasaran;
- offline/error tidak menyalahkan pengguna dan memiliki tindakan pemulihan.

Automated accessibility scan membantu tetapi tidak mengganti screen reader dan usability review.

## Safety tests

- NusaAgent tidak dapat memanggil repository tanpa confirmation pipeline;
- generic “ya/oke” tidak mengeksekusi;
- forged/expired/reused nonce ditolak;
- output AI tidak dapat mengganti integer amount/domain result;
- product text prompt injection diperlakukan sebagai data;
- medical emergency tetap dominan pada prompt campuran kasir/kesehatan;
- halal/BPOM/manfaat unknown tidak diarang;
- Agent failure meninggalkan form manual dan data lokal intact;
- audit tidak merekam prompt/payload penuh.

## Regression suite existing

Setiap PR Mandiri tetap menjalankan build Vite, admin auth/management, user auth, VitaCheck history, Android PWA/NusaAgent, Firestore Rules existing, backend policy/router tests, suspicious Unicode scanner, merge-marker check, dan `git diff --check`. Mandiri test ditambahkan; cakupan lama tidak dikurangi.

## Acceptance matrix per fase

| Fase | Required automated gate | Required manual/operational gate |
| --- | --- | --- |
| 1 Foundation | feature flag off regression; DB wrapper/migration/repository/money/ID/audit units | Android storage/restart/account-switch smoke |
| 2 NusaBelajar | content schema, scoring/progress, package integrity, offline queue | low-literacy, screen reader, 360 px, content review |
| 3 NusaKasir local | money/sale/inventory/cash/void atomic tests | full trading day simulation, restart/quota/backup |
| 4 VitaSheet | CSV/JSON/XLSX PoC, formula injection, reconciliation | open files on common Android/desktop spreadsheet apps |
| 5 Cloud workspace | >=56 Rules, API actor matrix, idempotency/conflict/chaos | two-account/two-device, revoke, recovery exercise |
| 6 Agent actions | draft/nonce/permission/replay/safety tests | preview comprehension and accidental-confirm study |
| 7 Hardening | migration matrix, backup restore, deletion, incident drills | physical device chaos and security review |
| 8 Pilot | all regression + release candidate | consented pilot checklist, support/rollback readiness |

## Test data and observability

No test logs should serialize entire fixtures where not needed. Seed builders create deterministic IDs and can reset emulator/local DB. Test outcome reports counts and reason codes, not credentials. Screenshots from pilot require separate consent and are not committed.

## Exit rule

A failed tenant-isolation, immutable-sale, idempotency, money, migration, privacy, or Agent-confirmation test blocks the phase. A flaky test in these areas is treated as a product defect until root cause is known, not simply retried to green.
