# 12 — NusaAgent Action Safety

Status: **Proposed**. Nusa Agent existing adalah UI/chat informasional; action layer di dokumen ini belum diimplementasikan.

## Tiga mode

### Informational

Contoh: “Bagaimana menambah stok?”, “Apa arti estimasi laba kotor?”, atau “Bantu jelaskan perkalian.” Mode ini tidak membuat draft atau mengubah data. Pertanyaan kesehatan tetap melewati Intent Router, Medical Safety, dan Policy Engine existing.

### Draft

Contoh: “Buat draft produk Beras 5 kg”, “Buat draft pengeluaran listrik”, atau “Buat latihan menghitung kembalian.” Agent menghasilkan objek terstruktur yang dianggap **untrusted**. Nilai yang tidak disebut tidak boleh dikarang; field wajib yang hilang ditandai `needs_input`.

### Execute-after-confirmation

Hanya command allowlist berisiko rendah yang kelak dapat dieksekusi. Eksekusi memerlukan draft aktif, preview, konfirmasi spesifik, confirmation nonce/token lokal berumur pendek, fresh auth/membership check, domain validation, operation ID, dan receipt. “ya”, “oke”, atau “lanjut” di chat tidak cukup tanpa draft aktif dan UI confirmation control.

## Action flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as NusaAgent
    participant D as Draft validator
    participant UI as Confirmation UI
    participant S as Domain service
    participant R as Repository/Audit

    U->>A: Natural-language request
    A->>D: Structured candidate (untrusted)
    D-->>UI: Valid draft or missing fields
    UI-->>U: Human-readable preview + source values
    U->>UI: Explicit confirm button
    UI->>S: Draft ID + nonce + operation ID
    S->>S: Fresh auth, role, schema, version, domain checks
    alt valid and unused
        S->>R: Execute once + audit atomically
        R-->>U: Receipt
    else denied/conflict/expired
        S-->>U: Safe reason; no mutation
    end
```

Model berhenti sebelum trusted boundary. Domain service menghitung ulang nilai dan repository menerapkan satu kali.

## Contoh schema

Data contoh palsu:

```json
{
  "actionType": "create_expense_draft",
  "workspaceId": "workspace-id",
  "payload": {
    "category": "listrik",
    "amountMinor": 150000,
    "note": ""
  },
  "requiresConfirmation": true
}
```

Envelope planned menambah `draftId`, `schemaVersion`, `actorUid`, `createdAt`, `expiresAt`, `sourceFields`, `status`, dan `allowedCommand`. `actorUid` berasal dari auth context, bukan output model. `workspaceId` harus cocok dengan workspace aktif yang dipilih UI; model tidak dapat memilih tenant lain.

## Client validation

- allowlist action type dan exact keys;
- batas panjang/string/plain text;
- integer safe untuk uang, quantity fixed-point bila diaktifkan;
- enum category/status/method;
- field source menunjukkan `user_input`, `selected_entity`, atau `domain_default`;
- preview selalu menampilkan workspace, entity target, nilai, dan dampak;
- tombol confirm disabled bila data berubah sejak preview atau draft expired;
- draft tidak dipersist lama dan dibersihkan saat logout/account switch.

Client validation membantu UX dan tidak memberi otorisasi.

## Trusted validation

Boundary tepercaya mengulang:

1. Firebase auth/re-auth bila risk level memerlukan;
2. membership terbaru dan workspace status;
3. action allowlist untuk role;
4. exact schema dan payload version;
5. entity/base version;
6. kalkulasi uang/stok dengan domain code;
7. draft expiry dan confirmation nonce hash;
8. operation ID/idempotency receipt;
9. transaction atomik dan audit outcome.

Prompt, model confidence, chat session ID, route, hidden button, atau claim dari client tidak dapat mengganti pemeriksaan ini.

## Tindakan terlarang otomatis

NusaAgent tidak boleh otomatis menghapus transaksi, menutup kas, mengubah role, menambah owner, menghapus workspace, mengubah banyak harga, mengimpor file, menghapus progres belajar, mengirim laporan, melakukan tindakan medis, membeli produk, atau mengirim pembayaran.

Untuk MVP, daftar execute bahkan setelah konfirmasi direkomendasikan sangat sempit: create draft dapat berakhir pada user membuka form terisi; actual save tetap tombol domain biasa. `create_expense` atau `create_product` execution baru dipertimbangkan setelah command tests, audit, dan pilot. Sale finalize, void, cash close, membership, import commit, dan deletion tetap manual-only.

## Prompt injection dan data boundary

Nama produk, note, CSV, lesson, atau URL dapat berisi instruksi seperti “abaikan aturan”. Semuanya diperlakukan sebagai data quoted, bukan system instruction. Agent tidak menerima seluruh database atau spreadsheet; retrieval scoped dan field-minimized. Free text tidak masuk audit payload penuh.

Agent tidak boleh mengarang harga, stock, payment status, role, halal, BPOM, manfaat, atau score. Jika nilai tidak tersedia, preview menyatakan field belum lengkap. Semua arithmetic final diulang kode deterministik.

## Failure modes

| Kondisi | Perilaku |
| --- | --- |
| Model unavailable | Form manual tetap tersedia; tidak ada mutation |
| Draft invalid | Tampilkan field yang perlu dilengkapi |
| Permission changed | Deny saat execute; preview tidak memberi grandfathering |
| Entity changed | Conflict/review ulang |
| Double confirm | Receipt operation ID yang sama |
| Nonce expired/reused | Deny dan minta preview baru |
| Offline | Draft lokal boleh; execution mengikuti local domain rule dan outbox hanya untuk allowlist yang disetujui |
| Medical emergency | Emergency response mendominasi; action bisnis tidak dipromosikan |

## Audit

Event `agent_draft_created` mencatat action type, actor, target IDs, schema, dan result tanpa full prompt/payload. `agent_action_confirmed` mencatat draft/operation ID, permission result, confirmation time, dan domain receipt. Gagal/denied juga dicatat dengan reason code minimal. Audit bukan alasan menyimpan chat atau data kesehatan.

## Acceptance safety

- Tidak ada repository call dari parser/model adapter.
- Tidak ada generic `execute(actionJson)` tanpa registry/schema per action.
- “Ya” di chat tidak mengeksekusi.
- Nilai preview dan executed command cocok atau meminta reconfirm.
- Permission revoke sebelum confirm menghasilkan deny.
- Replay/parallel confirm menghasilkan satu mutation.
- Emergency, medical boundary, halal, dan product claim policy existing tetap diuji.
