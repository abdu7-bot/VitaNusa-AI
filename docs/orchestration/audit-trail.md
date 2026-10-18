# VitaNusa-AI Audit Trail Specification

**Versi:** 1.0
**Tanggal:** 2026-10-17
**Status:** Draft — untuk review

---

## 1. Tujuan

Menyediakan audit trail append-only untuk setiap autonomous task agar:
- Setiap transisi state task tercatat dengan bukti
- Investigasi kegagalan/blocker memiliki jejak lengkap
- Compliance terhadap governance tanpa menyimpan data sensitif

---

## 2. Arsitektur

```
┌─────────────────────┐
│  Agent/Task Runner  │
└──────────┬──────────┘
           │ append_event()
           ▼
┌─────────────────────┐
│ task_audit_log.py   │  (scripts/tool)
│  - validasi schema  │
│  - redaction secret │
│  - atomic write     │
│  - checksum + hash  │
└──────────┬──────────┘
           │ append to file
           ▼
┌─────────────────────┐
│ ~/.local/state/     │  (default)
│ vitanusa-agent/     │
│ audit/audit.log     │
└─────────────────────┘
```

---

## 3. Schema Event

### 3.1 Field Wajib

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `event_type` | string | Enum: `task_claimed`, `task_started`, `validation_result`, `review_result`, `blocked`, `failure`, `commit_ref`, `completion` |
| `task_id` | string | ID task (contoh: `T005`) |
| `actor` | string | Identitas agent/user (`kilo`, `copilot`, `human`) |
| `timestamp` | string | UTC ISO 8601 dengan `Z` suffix (contoh: `2026-10-17T10:00:00Z`) |
| `state_transition` | string | Transisi state (contoh: `READY -> ACTIVE`) |
| `result` | string | Hasil (contoh: `success`, `failed`, `blocked`) |
| `reason` | string | Alasan singkat (max 500 char) |
| `reference` | string | Referensi unik: commit SHA, PR URL, task ID, dll |
| `metadata` | object | Opsional, akan diredaksi secret |

### 3.2 Field Internal (dihitung otomatis)

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `checksum` | string | SHA256 dari event dict (tanpa `checksum` & `cumulative_hash`) |
| `cumulative_hash` | string | Hash kumulatif: SHA256(prev_hash + checksum) |

### 3.3 Contoh Event

```json
{
  "event_type": "task_claimed",
  "task_id": "T005",
  "actor": "kilo",
  "timestamp": "2026-10-17T10:00:00Z",
  "state_transition": "READY -> ACTIVE",
  "result": "success",
  "reason": "task claimed by implementer",
  "reference": "T005-claim-001",
  "metadata": {},
  "checksum": "a1b2c3d4...",
  "cumulative_hash": "e5f6g7h8..."
}
```

---

## 4. Redaksi Secret

### 4.1 Pola yang Diredact

Field/key yang mengandung (case-insensitive):
- `secret`, `token`, `password`, `passwd`
- `apikey`, `api_key`, `apiKey`
- `private_key`, `private-key`
- `access_token`, `refresh_token`, `bearer_token`
- `auth`, `credential`
- `health_query`, `health_check`
- `key` (generic, word-boundary match)

### 4.2 Perilaku

- Cek pada **key** DAN **value** (string)
- Rekursif ke nested dict/list
- Ganti dengan `[REDACTED]`
- Field non-string tidak diredact

### 4.3 Contoh

```json
// Input metadata
{
  "api_key": "sk-12345",
  "config": {"token": "abc123"},
  "safe": "value"
}

// Output metadata (tersimpan di log)
{
  "api_key": "[REDACTED]",
  "config": {"token": "[REDACTED]"},
  "safe": "value"
}
```

> ⚠️ **Batasan:** Redaksi berbasis regex pada key/value string. Bisa miss edge case (contoh: secret di dalam string panjang tanpa pola key). Review manual tetap diperlukan untuk data sensitif kritis.

---

## 5. Integritas & Verifikasi

### 5.1 Checksum Per-Event

`checksum = SHA256(JSON(event tanpa checksum & cumulative_hash))`

### 5.2 Hash Kumulatif

`cumulative_hash[i] = SHA256(cumulative_hash[i-1] + checksum[i])`
`cumulative_hash[0] = SHA256(checksum[0])`

### 5.3 Verifikasi

`verify_integrity(store)` mengembalikan `(ok, errors[])`:
- Setiap baris: checksum cocok
- Setiap baris: cumulative_hash cocok dengan chain sebelumnya
- JSON valid per baris

---

## 6. Idempotensi

- Event dengan `reference` duplikat **diabaikan** (first write wins)
- Return existing event saat duplicate
- Log warning (stderr) saat duplicate detected

---

## 7. Fail-Safe Write

1. Tulis ke temp file (`.audit-XXXXXX.tmp`) di direktori yang sama
2. `os.replace(tmp, target)` — atomic pada POSIX
3. Jika gagal di tengah: temp file dihapus, file original tidak tersentuh
3. `os.replace` atomic pada POSIX, best-effort di Windows

---

## 8. Storage & Retention

### 8.1 Lokasi Default

`~/.local/state/vitanusa-agent/audit/audit.log`

Override via:
- Argumen `store` pada API
- Env `VITANUSA_AUDIT_DIR`

### 8.2 Retention

- Default: **90 hari**
- Rotasi log: **belum diimplementasikan** (follow-up task terpisah)
- Export manual: copy `audit.log` ke lokasi backup

### 8.3 Permission

Direktori: `0o700` (owner only)
File log: `0o600` (owner read/write)

---

## 9. API Reference

### `append_event(...) -> AuditEvent`
Tambah event, return event dengan checksum.

### `read_log(store, limit=None) -> list[AuditEvent]`
Baca log (terbaru dulu jika `limit` diset). Skip baris corrupt.

### `verify_integrity(store) -> (bool, list[str])`
Verifikasi checksum & cumulative hash. Return `(ok, errors[])`.

### `find_by_reference(reference, store) -> AuditEvent | None`
Cari event by reference (untuk idempotency check).

### CLI

```bash
# Append
python3 scripts/task_audit_log.py append \
  --event-type task_claimed \
  --task-id T005 \
  --actor kilo \
  --state-transition "READY -> ACTIVE" \
  --result success \
  --reason "claim" \
  --reference T005-claim-001 \
  --store ~/.local/state/vitanusa-agent/audit

# Read
python3 scripts/task_audit_log.py read --store ~/.local/state/vitanusa-agent/audit --limit 10

# Verify
python3 scripts/task_audit_log.py verify --store ~/.local/state/vitanusa-agent/audit

# Find by reference
python3 scripts/task_audit_log.py find T005-claim-001
```

---

## 10. Redaction Boundaries (Batasan)

| Keadaan | Perilaku |
|---------|----------|
| Secret di value string tanpa pola key | **Diredact** (value dicek) |
| Secret di dalam string panjang tanpa delimiter | **Tidak diredact** |
| Secret di binary/bytes | **Tidak diredact** (hanya string) |
| Key dengan typo (contoh: `apikey` vs `api_key`) | Diredact jika match pola |
| Nested dict/list | Diredact rekursif |

> **Rekomendasi:** Untuk data sensitif kritis, jangan masukkan ke metadata. Gunakan referensi ke secret manager terpisah.

---

## 11. Integrasi T005 ke T010–T014

| Task | Integrasi |
|------|-----------|
| T010 (parser) | `append_event(task_claimed)` saat task di-claim |
| T011 (dependency) | `append_event(validation_result)` saat dependency check |
| T012 (test gate) | `append_event(validation_result)` saat test gate |
| T013 (failure) | `append_event(blocked/failure)` saat blocked/failure |
| T014 (stop) | `append_event(completion/stop)` saat stop condition |

Reference standar: `task_id` + action + sequence (contoh: `T010-claim-001`)

---

## 12. Testing

### Unit Test Coverage

| Kategori | Test Case |
|----------|-----------|
| Basic | append, read, verify clean log |
| Idempotency | duplicate reference ignored, find_by_reference |
| Redaction | secret in metadata, nested, various patterns |
| Fail-safe | read-only file, atomic write, corrupted log |
| Schema | invalid event_type, empty fields, invalid timestamp |
| CLI | append, read, verify, find |
| Filesystem | disk full simulation, corrupted log read, permission error |
| Custom store | custom path, env var |
| Export/Retention | file location, manual export |

Jalankan: `python3 tests/governance/test_task_audit_log.py`

---

## 13. Follow-up (Out of Scope)

- [ ] Log rotation & compression (retention policy enforcement)
- [ ] Centralized audit server / SIEM integration
- [ ] Structured query / search API
- [ ] Real-time alerting pada event `blocked`/`failure`
- [ ] Cryptographic signing (non-repudiation)
- [ ] GDPR/PDPA compliance automation

---

## 14. T003 Manual Audit Reference Contract (Preserved)

The following contract from T003 (Multi-Agent Workspace & Orchestration Foundation) remains in effect and is preserved here for traceability. This manual audit reference requirement predates the automatic audit trail (T005) and continues to apply to all task records.

### 14.1 Minimum Audit Reference Fields

Before persistence automation exists, every task record **must** contain an `**Audit reference:**` field. Its contents are a manually traceable summary:

| Content | Verification Source |
|---|---|
| Task ID | Task record and commit message |
| Commit SHA | `git log` and `**Commit:**` field |
| Reviewer name | Review section on task record |
| Validation result | Validation command summary on task record |
| Approval if required | `**Approval:**` field |
| Contract reference | `docs/orchestration/audit-trail.md` |

This minimum requirement is currently binding. The field is required by `task-registry-and-locking.md` §2 and must exist on every task record, including T003 itself. The audit reference is not an automatic audit log: no programmatic entries, no persistence, and no CI integration. Automatic persistence is the scope of T005.

### 14.2 Storage Decision (from T003)

| Option | Status | Reason |
|---|---|---|
| JSON Lines append-only per task, e.g. `tasks/audit/<TASK-ID>.jsonl` | Contract, not yet created | No added dependency, easy to read/audit, consistent with `.agents/WORKFLOW.md` §4 that claim is recorded on task file not external system |
| Orchestration database | Rejected | No proven need; adds risk surface without evidence |
| Git branch or tag for audit | Rejected | Audit is not code history; Git history is not action trail |

Storage rules that apply once persistence is created:

1. Append-only. Entries are not edited or deleted; corrections are written as new entries with same `action` and a `note` explaining the correction.
2. One file per task, referenced explicitly from task file.
3. Entries written by the actor performing the action, not by another agent.
4. Every entry recorded on task file must be re-verifiable against Git: commit SHA must exist and task ID must appear on commit message.
5. Audit storage must not contain secrets. Credential values must not enter audit entries (`.agents/RULES.md` §Secrets).
6. Automatic audit log is T005. T003 only specifies the schema.

### 14.3 Current Verification (Without Persistence)

Without persistence, audit trail is already verifiable from Git and task files:

| Question | Verification Source |
|---|---|
| Is an actor working? | `**Owner:**` on task file |
| Is reviewer separate? | Review section on task file |
| Was validation run? | Validation result summary on task file |
| Is approval present and before changes? | `**Approval:**` field |
| Is commit traceable? | Commit message and `**Commit:**` |
| Do changes match scope? | `git diff --name-only` vs `**Claimed files:**` |

Honest limitation: this verification depends on task file contents. An agent lying about these fields cannot be detected by Git. Automation to check consistency is future work and not claimed as existing capability.

### 14.4 Separation from T005

| Included in T003 | Not in T003 (T005 scope) |
|---|---|
| Minimum field list and enums | Automatic entry writing by runtime |
| Example schema | Audit storage and file rotation |
| Storage decision and rationale | Audit viewer in UI (`tasks/BACKLOG.md` Phase H) |
| Append-only rules and Git verification | CI integration of audit |
