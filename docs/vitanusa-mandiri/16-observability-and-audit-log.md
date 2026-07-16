# 16 — Observability and Audit Log

Status: **Proposed**. Existing `backend/app/audit_log.py` only covers `/ask` metadata and is not a tenant audit implementation.

## Tujuan

Audit menjawab siapa melakukan tindakan apa, pada resource mana, melalui operation mana, dan apa hasilnya—tanpa menyalin seluruh transaksi, chat, atau data pribadi. Observability membantu health sistem melalui metrik agregat; ia bukan jalur analytics pengguna baru.

## Event schema

| Field | Tipe/aturan |
| --- | --- |
| `eventId` | UUID v4, required |
| `schemaVersion` | int, required |
| `workspaceId` | UUID atau null untuk user/platform scope |
| `actorUid` | UID required; tidak diekspor ke log umum |
| `actorRole` | role pada saat tindakan, enum |
| `action` | allowlist event name |
| `entityType` | allowlist, required |
| `entityId` | bounded ID, required bila ada target |
| `timestamp` | server timestamp; local pending timestamp terpisah |
| `deviceIdPseudonymous` | random installation ID, bukan hardware/ad ID |
| `operationId` | UUID untuk korelasi/idempotency |
| `result` | `success/denied/conflict/failed` |
| `reasonCode` | enum aman; tidak memuat stack/payload |
| `beforeHash` | optional canonical selected-field hash |
| `afterHash` | optional canonical selected-field hash |
| `source` | `manual/import/sync/agent_confirmed/system_reconcile` |

Nilai optional tidak boleh diisi dengan placeholder yang mengandung payload. Hash hanya membantu deteksi perubahan; ia bukan bukti kriptografis lengkap atau pengganti backup.

## Event minimum

```text
workspace_created
member_invited
member_role_changed
ownership_transferred
product_created
product_price_changed
stock_adjusted
sale_created
sale_voided
expense_created
cash_movement_created
cash_session_opened
cash_session_closed
export_created
import_started
import_failed
sync_conflict
agent_draft_created
agent_action_confirmed
mentor_consent_granted
mentor_consent_revoked
deletion_started
deletion_completed
```

Denied security-relevant operations memakai action yang sama dengan `result=denied` atau event khusus yang dibatasi; jangan mencatat setiap salah klik sehingga log menjadi noise/DoS target.

## Atomicity dan offline queue

- Domain event finansial lokal ditulis dalam IndexedDB transaction yang sama dengan entity dan outbox. Bila audit record wajib gagal, command abort.
- Cloud acknowledgement mengikat event ke server timestamp dan receipt; retry operation ID tidak membuat success event ganda.
- Denied server command dicatat server-side dengan metadata minimal bila aman.
- Offline queue tidak mengubah event timestamp local menjadi fakta server; keduanya tersedia.
- Telemetry non-kritis boleh fail-open, tetapi audit finansial/role/void/confirm harus fail-closed atau masuk durable outbox yang sama sebelum UI success.

## Akses

| Aktor | Akses proposed |
| --- | --- |
| Merchant owner | Read audit workspace dengan pagination/redaksi; export terbatas |
| Manager | Not in MVP; kelak scope operasional |
| Cashier | Receipt/status operasi sendiri; bukan list audit penuh |
| Viewer | Not in MVP |
| Platform owner/admin | Deny kecuali workspace membership terpisah; tidak ada support bypass |
| Learner | Consent/deletion events sendiri, bukan workspace audit |
| Mentor | Tidak membaca audit learner |

Audit update/delete client ditolak. Retention expiry dilakukan oleh controlled job dengan completion metadata, bukan tombol umum.

## Redaction dan larangan

Jangan simpan full SaleLine, nominal semua transaksi dalam log terpusat, note pengeluaran, nama produk, email, token, raw invitation, chat prompt, jawaban VitaCheck, quiz answers, IP penuh, user-agent penuh, atau file export/import. `beforeHash/afterHash` dibentuk dari canonical allowlist field; nominal tertentu hanya dicatat bila dibutuhkan untuk audit perubahan harga dan tetap tenant-private.

Error UI/log menggunakan reason code seperti `permission_denied`, `version_conflict`, `idempotency_mismatch`, `schema_unsupported`, `storage_quota`, dan `network_unavailable`. Stack trace hanya di environment developer yang terkontrol dan tanpa payload.

## Tamper resistance

- Rules menolak update/delete event oleh client.
- Server timestamp dan operation receipt mengurangi manipulasi jam.
- Event append-only dan optional previous-event hash per stream dapat divalidasi; hash chain masih dapat dipotong oleh principal privileged dan tidak disebut tamper-proof.
- Periodic export/checkpoint checksum disimpan terpisah bila threat/cost review menyetujuinya.
- Privileged maintenance event juga diaudit dan memerlukan least privilege.

## Retention dan cost

Proposed audit retention 12 bulan, tetapi `Needs validation` terhadap kebutuhan bisnis/hukum, volume, biaya, dan deletion rights. Security denial detail dapat memiliki retention lebih pendek. Aggregated health metrics tidak boleh memungkinkan rekonstruksi user/workspace kecil.

## Metrics proposed

- pending outbox count/age bucket per device (lokal, ditampilkan user);
- sync success/retry/conflict counts agregat;
- migration success/failure by schema version;
- export/import result counts;
- Agent draft-to-confirm aggregate tanpa prompt/amount;
- Rules/API denial reason counts tanpa resource IDs pada telemetry global.

Tidak ada continuous polling. Health check tidak menyatakan data tersinkron hanya karena backend online.

## Failure handling

| Failure | Tindakan |
| --- | --- |
| Local audit store abort | Abort financial command; tampilkan penyimpanan gagal |
| Cloud audit unavailable after local success | Keep outbox; status pending |
| Event schema unknown | Quarantine/dead-letter; jangan drop |
| Duplicate operation | Reuse receipt; no duplicate success event |
| Audit query unavailable | Domain operation tetap sesuai durability policy; owner diberi status |
| Retention job partial | Checkpoint/retry; no cross-workspace continuation bug |

## Review checklist

- Apakah event diperlukan untuk accountability atau hanya “menarik”?
- Apakah field dapat dikurangi menjadi ID/hash/reason?
- Apakah platform staff memperoleh akses baru?
- Apakah event atomik dengan command?
- Apakah retry menggandakan event?
- Apakah retention dan deletion terdokumentasi?
- Apakah test memastikan prompt/token/payload tidak tercatat?
