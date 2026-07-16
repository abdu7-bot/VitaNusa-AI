# 20 — Phase 1 Backlog

Status: **Calon issue; jangan dibuat otomatis di GitHub**. Urutan mengikuti dependency. Fase 1 local-only dan tidak menambah Firestore collection, Rules, backend endpoint, atau fitur kasir/belajar lengkap.

## VM-F1-001 — Feature flag VitaNusa Mandiri

- **Goal:** boundary off-by-default yang dapat mematikan seluruh entry Mandiri.
- **Scope:** flag build/runtime lokal, route guard, documented states `off|internal`.
- **Files likely affected:** planned config/module flag, minimal public entry, tests; exact files setelah audit PR.
- **Dependencies:** ADR-001 review.
- **Acceptance criteria:** flag off tidak menambah nav/route/network/storage; invalid state defaults off; no admin page effect.
- **Tests:** unit resolution, build with flag off/on, regression shell/admin.
- **Security notes:** flag bukan permission; jangan masukkan secret.
- **Out of scope:** remote rollout service, analytics, Mandiri feature UI.
- **Complexity:** Small.

## VM-F1-002 — Mandiri application shell

- **Goal:** shell mobile/desktop minimal untuk modul planned tanpa redesign VitaNusa core.
- **Scope:** route placeholder, layout, active nav, offline/update status hooks, accessibility landmarks.
- **Files likely affected:** planned Mandiri HTML/CSS/shell JS, Vite entry, targeted tests.
- **Dependencies:** VM-F1-001.
- **Acceptance criteria:** only visible under flag; 360 px no overflow; keyboard/screen reader; Nusa Agent singleton not duplicated.
- **Tests:** route/flag, DOM logic, build, manual viewports.
- **Security notes:** no user/tenant data in shell or Cache API.
- **Out of scope:** workspace creation form, POS, learning.
- **Complexity:** Medium.

## VM-F1-003 — Workspace domain types

- **Goal:** pure schema/validators for Workspace and WorkspaceMember.
- **Scope:** enums, exact-field validation, lifecycle invariants, owner count/transfer preconditions as pure functions.
- **Files likely affected:** planned `mandiri/domain/workspace*`, unit tests.
- **Dependencies:** ADR-002/006; independent of DB after VM-F1-001.
- **Acceptance criteria:** unknown fields/roles/status denied; owner last-access invariant represented; no Firebase dependency.
- **Tests:** valid/invalid fixtures, self-promotion, last owner, suspended state.
- **Security notes:** platform roles absent from workspace permission evaluator.
- **Out of scope:** invitations/cloud Rules/UI.
- **Complexity:** Medium.

## VM-F1-004 — IndexedDB database wrapper

- **Goal:** small promise-based wrapper with explicit transactions and account scope.
- **Scope:** open/close, transaction helper, typed error mapping, test adapter, initial stores metadata/workspace/membership.
- **Files likely affected:** planned `mandiri/storage/db.js`, tests.
- **Dependencies:** ADR-003, VM-F1-001.
- **Acceptance criteria:** transaction abort propagates; blocked/versionchange handled; no localStorage fallback for domain data.
- **Tests:** open/read/write/abort/close/versionchange using browser-compatible harness chosen in PR.
- **Security notes:** accountScope required; never log records/tokens.
- **Out of scope:** all domain repositories and sync.
- **Complexity:** Large.

## VM-F1-005 — IndexedDB schema migration

- **Goal:** deterministic, recoverable schema version transitions.
- **Scope:** migration registry, metadata checkpoint, unsupported-newer-schema read-only outcome, fixture upgrade.
- **Files likely affected:** planned `mandiri/storage/migrations/*`, DB tests.
- **Dependencies:** VM-F1-004.
- **Acceptance criteria:** upgrade repeat safe; interrupted migration does not expose partial version; no destructive cleanup in first migration.
- **Tests:** v0→v1, retry, failure/quarantine, newer version reject.
- **Security notes:** migration never crosses accountScope or performs network.
- **Out of scope:** production data migration or downgrade writes.
- **Complexity:** Medium.

## VM-F1-006 — Local repository abstraction

- **Goal:** ports so domain/application code does not call IndexedDB directly.
- **Scope:** repository interfaces, unit-of-work, scoped query methods, in-memory fake.
- **Files likely affected:** planned `mandiri/repositories/*`, tests.
- **Dependencies:** VM-F1-003, VM-F1-004/005.
- **Acceptance criteria:** every method requires actor/account/workspace scope; fake and IndexedDB adapters pass same contract.
- **Tests:** contract suite, transaction rollback, cross-scope denial.
- **Security notes:** no unscoped `getAll()` exposed to UI.
- **Out of scope:** Firestore/cloud adapter.
- **Complexity:** Large.

## VM-F1-007 — Workspace creation local-only

- **Goal:** create one local workspace and initial merchant owner atomically.
- **Scope:** command/application service and minimal form under feature flag.
- **Files likely affected:** workspace service/UI, repository, tests.
- **Dependencies:** VM-F1-002/003/006, VM-F1-010 IDs, VM-F1-011 audit.
- **Acceptance criteria:** workspace + owner + audit committed together; duplicate submit one workspace; survives restart.
- **Tests:** valid/invalid name/timezone, abort, double submit, reload.
- **Security notes:** current actor becomes owner; no platform admin shortcut.
- **Out of scope:** cloud, invitations, multi-workspace dashboard polish.
- **Complexity:** Medium.

## VM-F1-008 — Membership model local-only

- **Goal:** evaluate owner/cashier permissions locally without pretending to be cloud authority.
- **Scope:** membership repository, permission function, cached-state label, inactive member.
- **Files likely affected:** workspace/membership domain and tests.
- **Dependencies:** VM-F1-003/006/007.
- **Acceptance criteria:** cashier cannot manage members/owner; last owner protected; UI labels local-only.
- **Tests:** full MVP action matrix and unknown role denial.
- **Security notes:** permission cache is UX guard; docs state cloud must recheck.
- **Out of scope:** invitation, mentor, manager/viewer UI, Firebase claims.
- **Complexity:** Medium.

## VM-F1-009 — Money utility

- **Goal:** one deterministic integer IDR utility used by later POS/reporting.
- **Scope:** parse controlled input, safe add/subtract/multiply/divide-round, basis points, format display.
- **Files likely affected:** planned `mandiri/domain/money.js`, tests.
- **Dependencies:** none besides architecture decision D06.
- **Acceptance criteria:** rejects float/string formatted source/overflow; display never feeds calculation.
- **Tests:** zero/boundary/overflow/discount/rounding/locale corpus.
- **Security notes:** no `eval`, no implicit numeric coercion.
- **Out of scope:** tax, currency conversion, accounting.
- **Complexity:** Small.

## VM-F1-010 — ID and idempotency utility

- **Goal:** safe client entity/operation IDs and local duplicate guard.
- **Scope:** Web Crypto UUID, canonical payload hash interface, operation guard/state helpers.
- **Files likely affected:** planned `mandiri/domain/ids.js`, tests.
- **Dependencies:** browser support decision; no npm dependency.
- **Acceptance criteria:** no `Math.random()` fallback for security IDs; invalid IDs rejected; same operation guarded.
- **Tests:** format, fallback `getRandomValues`, duplicate/concurrent invocation, canonicalization.
- **Security notes:** hash is mismatch detection, not authorization.
- **Out of scope:** server receipt implementation.
- **Complexity:** Small.

## VM-F1-011 — Audit event model

- **Goal:** minimal allowlisted event object and local append repository.
- **Scope:** schema, event builder, redaction guard, action/result/reason enums.
- **Files likely affected:** planned `mandiri/domain/audit.js`, repository/store migration, tests.
- **Dependencies:** VM-F1-005/006/010.
- **Acceptance criteria:** required IDs/result; unknown/full payload fields rejected; immutable repository API.
- **Tests:** schema, redaction, duplicate operation association, append-only behavior.
- **Security notes:** no prompt, token, note, full transaction, or health data.
- **Out of scope:** cloud audit viewer/retention job.
- **Complexity:** Medium.

## VM-F1-012 — Offline status UI

- **Goal:** honest local/network/sync status primitive shared by later modules.
- **Scope:** states `local-only|offline|online-unverified|pending|blocked|conflict`, aria-live, retry hook contract.
- **Files likely affected:** Mandiri shell/status JS/CSS/tests.
- **Dependencies:** VM-F1-002; sync state remains stub until later.
- **Acceptance criteria:** online browser does not claim backend synced; no polling; usable at 360 px.
- **Tests:** state reducer/render text, online/offline events, a11y labels.
- **Security notes:** messages do not expose workspace existence/error payload.
- **Out of scope:** sync engine/background sync.
- **Complexity:** Small.

## VM-F1-013 — Data export backup skeleton

- **Goal:** versioned local backup contract before real financial data exists.
- **Scope:** manifest/schema/checksum interface, empty workspace export, restore preview-only.
- **Files likely affected:** planned `mandiri/export/backup.js`, tests/docs.
- **Dependencies:** VM-F1-006/007/009/010/011.
- **Acceptance criteria:** exact schema; no auth token; workspace scope; modified/unknown version rejected before write.
- **Tests:** empty/valid/tampered/cross-scope/Unicode fixtures.
- **Security notes:** sanitize filename; downloaded file sensitivity warning.
- **Out of scope:** committing restore, CSV/XLSX, production backup guarantee.
- **Complexity:** Medium.

## VM-F1-014 — Unit test foundation

- **Goal:** consistent Node built-in test layout and fixture builders for Mandiri pure modules.
- **Scope:** test helpers, fake clock/IDs/repository, aggregate npm script only if needed.
- **Files likely affected:** `tests/mandiri/*`, `package.json` only in implementation PR.
- **Dependencies:** can start with VM-F1-003/009/010.
- **Acceptance criteria:** deterministic tests, `.test` identities, no production data/dependency.
- **Tests:** self-test fixture isolation and aggregate command.
- **Security notes:** fixtures never include secrets; failure output bounded.
- **Out of scope:** DOM library, Emulator, browser E2E framework.
- **Complexity:** Small.

## VM-F1-015 — Security boundary tests

- **Goal:** prove platform/workspace/learning namespaces do not collapse in local application logic.
- **Scope:** actor/action matrix, accountScope repository denial, admin bypass negative cases, unsafe field test.
- **Files likely affected:** Mandiri tests and permission/repository modules.
- **Dependencies:** VM-F1-003/006/008/011/014.
- **Acceptance criteria:** all unknown/default cases deny; cross-account/workspace reads unavailable through public API.
- **Tests:** table-driven role/action/scope cases and malicious fixtures.
- **Security notes:** these tests do not replace future Firestore Rules.
- **Out of scope:** production pentest/cloud API.
- **Complexity:** Medium.

## VM-F1-016 — Documentation and rollback

- **Goal:** operator/developer guidance matching actual Fase 1 implementation.
- **Scope:** enable/disable flag, DB schema, backup/recovery, known limitations, test commands, rollback.
- **Files likely affected:** Mandiri docs only plus links approved in implementation PR.
- **Dependencies:** all Fase 1 PRs.
- **Acceptance criteria:** no claim cloud/POS/learning built; rollback preserves local data; paths/test results accurate.
- **Tests:** link/path checks, scope diff, manual recovery rehearsal.
- **Security notes:** no production identifiers/screenshots/credentials.
- **Out of scope:** deployment or Rules publication.
- **Complexity:** Small.

## Dependency order

```text
001 → 002
001 → 003, 004, 009, 010, 014
004 → 005 → 006
003 + 006 + 010 + 011 → 007 → 008
002 → 012
006 + 007 + 009 + 010 + 011 → 013
003 + 006 + 008 + 011 + 014 → 015
all → 016
```

## Safe PR grouping

| PR | Items | Boundary/rollback |
| --- | --- | --- |
| PR 1 — Feature flag + shell | 001, 002, 012 | Flag off reverts UX; no DB |
| PR 2 — Domain types, money, dan IDs | 003, 009, 010, part of 014 | Pure modules; no storage atau user-facing data |
| PR 3 — IndexedDB foundation | 004, 005, 006 | No user-facing domain; revert before real data or keep read-only migration |
| PR 4 — Audit dan workspace local | 011, 007, 008 | Local-only; atomic workspace/owner/audit; flag off dan export recovery |
| PR 5 — Backup, boundary, integration docs | 013, 015, remainder 014, 016 | No cloud/deploy; phase acceptance and recovery |

Urutan PR mengikuti dependency: PR 4 tidak dimulai sebelum ID/repository tersedia dari PR 2–3. Jika sebuah PR menjadi terlalu besar, split per item terdaftar, bukan menggabungkan PR 2–4. No PR may add Firestore Rules, backend endpoint, complete cashier/learning UI, or dependency as an incidental step.

## Fase 1 exit criteria

- exactly documented feature flag and rollback;
- local workspace + initial owner persists atomically;
- account/workspace scope enforced through repository API;
- migration and backup skeleton proven;
- integer money and UUID utilities pass boundaries;
- audit schema minimizes data;
- existing VitaNusa build/tests remain green;
- implementation status remains local foundation, not “VitaNusa Mandiri complete”.
