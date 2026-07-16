# 06 — Data Model

Status: **Proposed — logical model, belum membuat koleksi atau IndexedDB**.

## Konvensi umum

Semua entity memiliki `schemaVersion: int >= 1`. Entity mutable memiliki `version: int >= 1`, `updatedAtLocal`, dan setelah cloud tersedia `updatedAtServer`. Record tenant selalu membawa `workspaceId`; entity user-private membawa `ownerUid`. Field tidak dikenal ditolak pada command boundary dan tidak diteruskan ke export.

Notasi field: `R` wajib, `O` opsional. Timestamp lokal memakai ISO-8601 untuk display/queue; timestamp cloud berasal dari server. Enum disimpan lowercase ASCII.

## Katalog entity dan field

### Identity dan workspace

| Entity | Tujuan, ID, owner | Field utama dan validasi | Relasi/lifecycle |
| --- | --- | --- | --- |
| `UserProfile` | Preferensi Mandiri minimal; ID=`uid`; owner=user | `displayName:string O <=120`, `locale:string R=id-ID`, `timezone:string R` IANA, `schemaVersion:int R`; tanpa token/health/business aggregate | Created opt-in → active → deletion requested → deleted; auth source tetap Firebase Auth |
| `Workspace` | Batas satu usaha/toko; UUID; owner=workspace | `name:string R 1..120`, `currency:R "IDR"`, `timezone:R IANA`, `status:R active/suspended/deletion_pending`, `ownerCountHint:O int>=1`, `version:R` | Memiliki members/products/sales; active → suspended → deletion_pending → deleted. Hint bukan sumber invariant owner; membership transaction yang menentukan |
| `WorkspaceMember` | Mengikat UID dan role; ID=`uid` di workspace | `uid:R`, `role:R merchant_owner/manager/cashier/viewer`, `status:R invited/active/inactive`, `permissionVersion:R int`, `joinedAtServer:O` | Satu per user/workspace; owner terakhir dilindungi; invited → active → inactive/removed |
| `Invitation` | Undangan sekali pakai; UUID random; owner=workspace | `recipientHintHash:O`, `role:R` non-owner by default, `tokenHash:R`, `expiresAt:R`, `status:R pending/accepted/revoked/expired`, `attemptCount:R=0`; raw token tidak disimpan | Pending → accepted sekali/revoked/expired; token consumption atomik |

### Produk dan inventori

| Entity | Tujuan, ID, owner | Field utama dan validasi | Relasi/lifecycle |
| --- | --- | --- | --- |
| `ProductCategory` | Pengelompokan tenant; UUID; workspace | `name:R 1..80`, `active:R=true`, `sortKey:O`, `version:R` | active → inactive; tidak menghapus produk |
| `Product` | Master barang; UUID; workspace | `name:R 1..160`, `sku:O <=80 unique-normalized per workspace`, `categoryId:O`, `purchasePriceMinor:O int>=0`, `sellingPriceMinor:R int>=0`, `currency:R IDR`, `stockTracking:R bool`, `quantityScale:R 1 default`, `active:R=true`, `version:R` | draft/import_preview → active → inactive; harga lama hidup pada SaleLine |
| `InventoryBalance` | Snapshot percepatan query; ID=`productId`; workspace | `productId:R`, `quantityScaled:R int`, `quantityScale:R`, `throughMovementId:O`, `movementCount:R`, `version:R` | Rebuilt/verifiable; bukan sumber sinkron tunggal |
| `StockMovement` | Ledger perubahan stok; UUID; workspace | `productId:R`, `type:R opening/in/sale/adjustment/void_reversal`, `quantityDeltaScaled:R nonzero int`, `quantityScale:R`, `reasonCode:R`, `sourceEntityType:R`, `sourceEntityId:R`, `operationId:R`, timestamps | Append-only; reversal membuat movement baru; relasi ke sale/adjustment |

### Penjualan, pembayaran, dan kas

| Entity | Tujuan, ID, owner | Field utama dan validasi | Relasi/lifecycle |
| --- | --- | --- | --- |
| `Sale` | Header transaksi final; UUID client; workspace | `receiptNumber:R unique workspace`, `cashSessionId:R`, `status:R final`, `currency:R IDR`, `subtotalMinor:R`, `discountMinor:R`, `grandTotalMinor:R`, `amountPaidMinor:R`, `changeMinor:R`, `lineCount:R>0`, `operationId:R`, `finalizedAtLocal:R`, `finalizedAtServer:O`, `version:R=1` | Draft berada di UI, bukan Sale; selalu immutable; status void pada report diturunkan dari `SaleReversal` |
| `SaleLine` | Snapshot item saat sale; ID=`saleId:lineNo`; workspace | `saleId:R`, `lineNo:R int>0`, `productId:O`, `productNameSnapshot:R`, `skuSnapshot:O`, `quantityScaled:R>0`, `quantityScale:R`, `unitPriceMinor:R>=0`, `lineDiscountMinor:R>=0`, `lineSubtotalMinor:R>=0`, `purchasePriceSnapshotMinor:O` | Immutable dengan Sale; nama/harga produk berikutnya tidak mengubah line |
| `Payment` | Tender tercatat; UUID; workspace | `saleId:R`, `method:R cash` untuk MVP, `amountMinor:R>=grandTotal`, `changeMinor:R>=0`, `status:R recorded`, `operationId:R` | Immutable; dampak balik berasal dari `SaleReversal`; split/refund deferred |
| `SaleReversal` | Pembatalan sale final; UUID; workspace | `originalSaleId:R`, `reasonCode:R`, `reasonNote:O <=240`, `actorUid:R`, `reversedAmountMinor:R`, `operationId:R`, timestamps | Append-only; membuat stock movements/cash reversal; original tidak berubah |
| `Expense` | Pengeluaran tercatat; UUID; workspace | `cashSessionId:O`, `category:R 1..80 controlled`, `amountMinor:R>0`, `note:O <=240 plain text`, `status:R recorded`, `operationId:R`, timestamps | Immutable dalam MVP; pembatalan kelak memakai reversal terpisah, bukan overwrite |
| `CashMovement` | Ledger perubahan kas setelah sesi dibuka; UUID; workspace | `cashSessionId:R`, `type:R sale_cash/expense_cash/cash_in/cash_out/sale_reversal`, `amountDeltaMinor:R nonzero int`, `reasonCode:R`, `sourceEntityType:R`, `sourceEntityId:R`, `actorUid:R`, `operationId:R`, timestamps | Append-only; sale/expense/reversal dibuat atomik dengan sumber; cash_in/out manual owner-only pada MVP |
| `CashSession` | Siklus kas per workspace/device/actor; UUID | `openedByUid:R`, `openingCashMinor:R>=0`, `openedAtLocal:R`, `openedAtServer:O`, `status:R open/closed`, `closedByUid:O`, `expectedCashMinor:O`, `countedCashMinor:O`, `differenceMinor:O`, `closedAt*:O`, `version:R` | open → closed; expected berasal dari opening + movement; closed immutable, koreksi memakai workflow terpisah |
| `Receipt` | View/print snapshot; ID=`saleId`; workspace | `saleId:R`, `receiptNumber:R`, `workspaceNameSnapshot:R`, `lines:R reference/list safe`, `totals:R`, `issuedAt:R`, `templateVersion:R`, `disclaimer:O` | Generated from final Sale; regenerable; bukan bukti fiskal resmi |
| `Report` | Read model/snapshot deterministik; ID=query fingerprint + cut-off; owner=workspace | `reportType:R daily_sales/stock/cash`, `periodStart:R`, `periodEnd:R`, `timezone:R`, `sourceCutoff:R`, `filters:R structured allowlist`, `totals:R integer fields`, `generatedAtLocal:R`, `generatedAtServer:O`, `completeness:R complete/partial_with_reason`, `schemaVersion:R` | Diturunkan dari entity committed; tidak menjadi ledger; ephemeral → exported/expired |

### Audit, belajar, dan aksi

| Entity | Tujuan, ID, owner | Field utama dan validasi | Relasi/lifecycle |
| --- | --- | --- | --- |
| `AuditEvent` | Jejak minimal; UUID; workspace atau user scope | Field lengkap di dokumen 16; `action`, `entityType`, `entityId`, `operationId`, `result`, hashes opsional | Append-only; retained per policy; payload bisnis penuh dilarang |
| `LearningProfile` | Preferensi/progres summary; ID=`main`; owner=learner | `ownerUid:R`, `contentVersion:O`, `lastLessonId:O`, `syncConsent:R false`, `updatedAt*`, `version:R` | user-private; active → deletion requested → deleted |
| `Program` | Kelompok tujuan besar; stable slug/version; owner=platform content | `programId:R safe slug`, `title:R`, `summary:R`, `courseIds:R list`, `contentVersion:R`, `status:R draft/published/retired` | Published version immutable; root katalog belajar |
| `Course` | Paket topik; stable slug/version; owner=platform content | `programId:R`, `courseId:R safe slug`, `title:R`, `summary:R`, `levelLabel:R non-stigmatizing`, `contentVersion:R`, `status:R draft/published/retired`, `prerequisiteIds:list` | Published version immutable; retired tetap terbaca bagi progress lama |
| `Module` | Kelompok lesson; stable ID/version | `courseId:R`, `moduleId:R`, `title:R`, `lessonIds:R ordered list`, `contentVersion:R`, `status:R` | Bagian content package; urutan eksplisit |
| `Lesson` | Unit pendek; stable ID + version | `courseId:R`, `moduleId:R`, `title:R`, `bodyBlocks:R validated`, `estimatedSteps:R`, `assetRefs:list`, `contentVersion:R`, `status:R` | Bagian content package; no arbitrary script/HTML |
| `Activity` | Interaksi tanpa score; stable ID/version | `lessonId:R`, `type:R example/practice_prompt/reflection`, `contentBlocks:R validated`, `completionRule:R structured`, `contentVersion:R` | Completion tidak disamakan dengan quiz mastery |
| `Exercise` | Latihan dengan feedback; stable ID | `lessonId:R`, `type:R choice/ordering/numeric`, `prompt:R`, `options:O`, `answerRule:R structured`, `feedback:R`, `version:R` | Evaluated deterministically; content lifecycle mengikuti package |
| `Quiz` | Kumpulan assessment; stable ID/version | `lessonId:R`, `exerciseIds:R 1..n`, `passingRule:R structured`, `maxAttemptsDisplay:O`, `version:R` | Published content; rule bukan LLM output |
| `QuizAttempt` | Rekaman attempt; UUID; owner=learner | `quizId:R`, `contentVersion:R`, `scoreBasisPoints:R 0..10000`, `correctCount:R`, `itemCount:R>0`, `status:R completed`, `completedAtLocal:R`, `completedAtServer:O`, `operationId:R`; raw free text tidak disimpan | Immutable attempt; delete oleh learner/privacy flow |
| `LearningProgress` | State per learner/unit; ID=`courseId:lessonId`; owner=learner | `courseId:R`, `lessonId:R`, `state:R not_started/in_progress/needs_practice/mastered_this_practice`, `bestScoreBasisPoints:O`, `attemptCount:R`, `contentVersion:R`, `lastPracticedAt*`, `version:R` | Merge monotonic sesuai aturan; reset eksplisit tidak hard-delete attempts |
| `Achievement` | Pengakuan non-kompetitif optional; UUID/stable key; owner=learner | `achievementType:R allowlist`, `sourceProgressIds:R list`, `contentVersion:R`, `awardedAtLocal:R`, `awardedAtServer:O`; tanpa ranking global | Deferred dari MVP; dapat dicabut bila rule version salah, tanpa mengubah progress |
| `AgentActionDraft` | Draft untrusted untuk preview; UUID random; owner=actor/workspace | `actionType:R allowlist`, `workspaceId:O`, `payload:R schema-specific`, `source:R user_request`, `requiresConfirmation:R true`, `status:R drafted/confirmed/expired/cancelled/executed`, `expiresAt:R`, `confirmationNonceHash:O`, `operationId:O` | TTL pendek; draft tidak mengubah domain; executed sekali |
| `SyncOperation` | Outbox/receipt; `operationId` UUID; owner=account/workspace | `workspaceId:R`, `entityType:R`, `entityId:R`, `operationType:R`, `payloadVersion:R`, `payload:R validated`, `baseVersion:O`, `createdAtLocal:R`, `attemptCount:R=0`, `status:R pending/sending/acknowledged/blocked_auth/conflict/dead_letter`, `lastErrorCode:O` | Pending → sending → ack/conflict/dead; ID sama tidak diterapkan dua kali |
| `ExportJob` | Snapshot export; UUID; owner=requestor/workspace | `format:R csv/json/xlsx`, `period:R`, `snapshotVersion:R`, `status:R requested/processing/ready/failed/expired`, `rowCounts:O`, `checksum:O`, `expiresAt:O`, `errorCode:O` | File temporer; download authorization diulang; metadata audit minimal |
| `ImportJob` | Preview dan commit import; UUID; workspace | `format:R csv/json`, `schemaVersion:R`, `fileHash:R`, `status:R uploaded_local/validated/confirmed/committed/failed`, `rowCounts:R`, `errors:R bounded structured`, `operationId:O` | Tidak ada write sebelum confirmed; commit idempotent; file raw segera dibuang |

## Governance per entity

| Kelompok | Sensitivitas | Cache lokal | Export | Retention proposed |
| --- | --- | --- | --- | --- |
| UserProfile | User-private | Ya, namespace akun | Ya oleh user | Sampai dihapus |
| Workspace/member/invitation | Tenant-private; invitation security-sensitive | Ya; token mentah tidak | Owner; invitation tidak | Workspace aktif; invitation 30 hari setelah terminal, needs validation |
| Product/category | Tenant-private | Ya | Owner CSV/JSON | Workspace aktif + deletion grace |
| Inventory/sale/reversal/payment/expense/cash movement/session | Sensitive financial | Ya, offline wajib | Owner | Kebijakan hukum/bisnis belum diputuskan; tidak boleh dihapus otomatis sebelum keputusan owner/legal |
| Receipt | Sensitive financial | Ya | Owner/kasir terkait | Mengikuti Sale |
| Report | Sensitive financial derived | Boleh sebagai snapshot sementara | Owner sesuai permission | Ephemeral; hapus setelah export/session sesuai policy |
| AuditEvent | Internal/tenant-private | Queue lokal minimal | Owner dengan redaksi | Proposed 12 bulan; needs validation |
| LearningProfile/progress/attempt | Sensitive educational | Ya | Learner; mentor tidak export default | Sampai learner menghapus; backup policy needs validation |
| Course/lesson/exercise/quiz | Public atau internal sebelum publish | Ya sebagai package | Ya sebagai konten publik | Published versions selama masih direferensikan |
| AgentActionDraft | Tenant/user-private sementara | Memori/IndexedDB terenkripsi tidak dijanjikan | Tidak | Maksimum 24 jam proposed |
| SyncOperation | Tenant-private operasional | Ya | Metadata diagnostic terbatas | Acknowledgement proposed 90 hari; needs validation |
| ExportJob/ImportJob | Sensitive temporary | Ya untuk local job | Sesuai job | File segera; metadata proposed 30 hari |

## Representasi uang

- Mata uang MVP adalah `IDR` dan nilai disimpan sebagai integer rupiah: lima belas ribu rupiah disimpan sebagai `15000`.
- Sumber perhitungan tidak boleh berupa `15.000`, `"Rp15.000"`, atau `15000.00`.
- Semua operasi memeriksa integer, non-negatif bila relevan, dan batas JavaScript `Number.isSafeInteger`. Batas nominal bisnis harus diputuskan sebelum pilot.
- Diskon final disimpan sebagai `discountMinor`. Bila input berupa persen, gunakan basis points integer `0..10000`, hitung dengan integer division, dan gunakan aturan half-up untuk nilai positif; nilai final yang tersimpan tetap integer.
- `grandTotalMinor = subtotalMinor - discountMinor`; diskon tidak boleh melebihi subtotal.
- Pembayaran tunai kurang dari grand total ditolak pada MVP. Pembayaran lebih menghasilkan `changeMinor = amountPaidMinor - grandTotalMinor`.
- Split payment, hutang, refund, dan pajak deferred. Void bukan refund dan dicatat dengan reversal.
- Estimasi HPP memakai snapshot harga beli yang tersedia. Nilai yang tidak lengkap harus ditandai, bukan dianggap nol tanpa keterangan.

## Kuantitas

MVP direkomendasikan kuantitas bulat dengan `quantityScale=1`. Bila owner memutuskan produk timbang, gunakan fixed-point `quantityScaled` dan `quantityScale` allowlist (misalnya 1000 untuk tiga desimal), bukan floating point. Keputusan ini memblokir schema sale/inventory Fase 3, tetapi tidak memblokir foundation Fase 1.

## Waktu dan urutan

- `createdAtLocal` menjaga UX offline dan bukan urutan final lintas perangkat.
- `createdAtServer`/`updatedAtServer` ditetapkan server setelah acknowledgement.
- Semua laporan memakai timezone workspace (IANA) dan menyimpan instan UTC.
- Jam perangkat yang salah ditandai saat selisih terhadap server diketahui; operation tetap diurutkan oleh server sequence/version untuk rekonsiliasi.
- Sale final menyimpan kedua waktu agar pengguna memahami kapan dicatat lokal dan kapan diterima cloud.

## Strategi ID dan idempotency

UUID v4 client-generated melalui `crypto.randomUUID()` direkomendasikan untuk entity offline dan `operationId`. Fallback harus memakai `crypto.getRandomValues`; `Math.random()` tidak diterima untuk ID security-sensitive. Collision sangat kecil tetapi tetap ditangani sebagai conflict, bukan overwrite.

ID tidak dipakai untuk kronologi. Server menyimpan receipt berdasarkan `operationId`; pengiriman ulang payload identik mengembalikan acknowledgement lama, sedangkan ID sama dengan hash payload berbeda ditolak sebagai `idempotency_mismatch` dan diaudit.
