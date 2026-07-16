# 14 — Threat Model

Status: **Proposed**, menggunakan model sederhana Asset → Threat → Attack path → Impact → Mitigation → Residual risk → Test. Severity mempertimbangkan dampak dan kemudahan relatif, bukan menyatakan probabilitas pasti.

## Critical

| ID | Asset / threat | Attack path | Impact | Mitigation | Residual risk | Test |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | Workspace / cross-tenant read | Ganti `workspaceId`, query tanpa scope, Rules salah | Kebocoran seluruh data usaha | Nested path, membership check, default deny, no global query, IDOR tests | Bug server dengan credential dapat bypass Rules | Emulator + API cross-tenant matrix |
| T02 | Membership / role escalation | Kasir mengubah member doc/claim/client state | Kontrol workspace diambil alih | Owner-only transaction, no self-promotion, owner-count invariant, audit | Bootstrap/recovery manual tetap sensitif | Rules + domain invariant + replay tests |
| T03 | Sale ledger / duplicate transaction | Double tap, retry, network timeout, replay operation | Penjualan/stok/kas ganda | UUID sale + operation ID, receipt/hash, transaction atomik | Operator dapat sengaja membuat dua sale berbeda | Concurrency/timeout/duplicate tests |
| T04 | Financial integrity / delete or overwrite final sale | DevTools/direct SDK/update path | Laporan, stok, dan kas berubah tanpa jejak | Create-only sale, update/delete deny, void/reversal | Privileged service bug masih dapat merusak | Rules immutable + server authorization tests |
| T05 | Agent/action / execute without consent | Prompt injection, generic “ya”, forged draft/nonce | Perubahan finansial tak disadari | No direct repository, preview, explicit button, nonce TTL, fresh role, idempotency | Pengguna dapat salah memahami preview | Negative action suite + usability review |
| T06 | Report/export / cross-tenant IDOR | Ubah job/workspace/download ID | Eksfiltrasi data finansial | Bind actor/workspace/job, fresh download auth, short TTL, no platform bypass | Downloaded file dapat diteruskan user | API/URL fuzz and authorization tests |
| T07 | Private domains / platform admin bypass | Reuse `isAdmin` sebagai allow global | Data usaha/belajar/kesehatan terbuka | Separate namespaces, explicit deny, membership/UID/consent only | Emergency support design future dapat membuka path baru | Rules tests for both platform roles on every private path |

## High

| ID | Asset / threat | Attack path | Impact | Mitigation | Residual risk | Test |
| --- | --- | --- | --- | --- | --- | --- |
| T08 | Product price / DevTools manipulation | Edit DOM/payload before finalize | Total lebih rendah/salah | Re-read product/version, show snapshot, domain recompute, server validation | Offline device owner controls local state | Tampered payload and stale price tests |
| T09 | Inventory / negative stock | Two devices/offline sale/stale balance | Oversell dan laporan stok salah | Movement ledger, local guard, conflict review, no balance overwrite | Offline concurrent availability cannot be guaranteed | Multi-device chaos test |
| T10 | Sync / replay operation | Capture/resend old request | Duplicate or unauthorized change | Operation receipt, payload hash, actor/workspace binding, expiry where relevant | Storage of receipts has retention/cost | Replay same/different payload tests |
| T11 | Data / conflict two devices | Concurrent product/price/cash changes | Silent lost update | Base version, no LWW for price/sale, field merge preview | User may choose wrong resolution | Deterministic conflict fixtures |
| T12 | Time / wrong device clock | Manual clock or drift | Sale appears wrong day/order | Store local+server time, workspace timezone, server sequence | Offline reports before sync use local time | Clock +/- days tests |
| T13 | XLSX / formula injection | Product/note begins `= + - @` or control | Spreadsheet code/link execution | Force safe string/apostrophe, allowlisted formulas only | Viewer-specific behavior differs | Corpus across spreadsheet readers |
| T14 | Import / malicious or oversized file | Zip bomb, huge rows, malformed CSV/JSON | Memory exhaustion/corruption | Size/row/depth limit, streaming/preview, no macro/XLSX import MVP | Parser/library vulnerabilities | Fuzz/limit/memory tests |
| T15 | UI / XSS product name | Stored `<script>`, event attrs, malicious URL | Account data/action theft | Plain text render, CSP later, exact schema, no HTML | Existing same-origin legacy surface remains | DOM/XSS payload tests |
| T16 | Receipt / HTML injection | Malicious product/workspace text in receipt | Phishing/script/altered print | text nodes/escaping, no arbitrary HTML/template code | Printed visual spoofing via Unicode | Receipt render/suspicious Unicode tests |
| T17 | Local data / IndexedDB after logout | Shared phone next user opens app | Financial/learning disclosure | Account scope, close DB, purge choice/shared-device mode, no SW user cache | User may decline cleanup or downloaded files remain | Account-switch/e2e storage inspection |
| T18 | PWA cache / previous account shell/data | Cache tenant response or stale JS | Old data exposure or incompatible schema | Cache shell only, Firebase/API bypass, version/migration gate | Browser bugs/stale worker | Service worker static tests + manual update |
| T19 | Backup / modified JSON restore | User/attacker edits totals/roles/IDs | Corrupt or escalated local database | Schema, checksum, preview, never import membership/receipt authority | Checksum not cryptographic signer by itself | Tamper/schema/cross-workspace restore tests |
| T20 | Invitation / brute force | Guess token or enumerate errors | Unauthorized membership | >=128-bit token, stored hash, TTL, one-time, rate limit, same error | Email/link compromise | Entropy, expiry, replay, rate-limit tests |
| T21 | Agent / prompt injection from product/import | Stored text says ignore policy/execute | Unsafe draft or leakage | Quote as data, context allowlist, model cannot execute, domain validation | Model may still generate confusing preview | Adversarial prompt corpus |
| T22 | Agent / fabricated amount/entity | Model fills missing price/expense | Wrong financial record | `needs_input`, source attribution, no model default money, recompute | User may manually accept wrong input | Missing-field/hallucination tests |
| T23 | Offline / never synchronized | App closed, auth blocked, permanent error | Cloud/report differs from device | Visible pending count, manual retry, dead-letter/export, no silent delete | Device loss before sync | Long-offline/restart/auth-expiry tests |
| T24 | Migration / IndexedDB corruption | Upgrade interrupted/schema bug | Local data unavailable/lost | Versioned idempotent migration, checkpoint, quarantine, backup | Browser storage corruption outside app control | Kill-during-upgrade and rollback tests |
| T25 | Logging / full financial or personal payload | Debug/error/audit logs serialize object | Secondary data leak | Allowlist event schema, hashes/IDs, redaction, no console docs | Developers may add unsafe logs later | Static lint/review + capture test |

## Medium

| ID | Asset / threat | Attack path | Impact | Mitigation | Residual risk | Test |
| --- | --- | --- | --- | --- | --- | --- |
| T26 | LocalStorage / sensitive domain data | Convenience code stores cart/sale/profile | Easy exposure and stale data | Domain data only IndexedDB repository; localStorage for non-sensitive prefs/flags | Same-origin script can still access IndexedDB | Static search and storage inventory test |
| T27 | Learning / mentor overreach | Broad grant, no expiry/revoke cache | Educational privacy breach | Course/field scope, grant status/expiry, revoke, cache cleanup | Mentor may retain screenshots | Rules/consent UI tests |
| T28 | Reports / stale or inconsistent snapshot | Sheets query at different times | Totals disagree | Immutable export snapshot/cutoff, reconciliation and row counts | Very large snapshot job can fail | Concurrent-write export tests |
| T29 | Service availability / backend down | Render sleep/network outage | XLSX/sync/Agent online unavailable | Local MVP, retry, CSV/JSON offline, honest status | Cloud-only rich XLSX unavailable | Offline/5xx/timeout tests |
| T30 | Workspace deletion / partial cascade | Batch fails midway | Orphan data or access persists | Deletion job checkpoints, tombstone, retry, verification | Provider failures extend deletion time | Failure injection per collection |
| T31 | Medical/business boundary | Agent business route suppresses emergency | Unsafe health response | Current message always Intent/Medical Safety/Policy first | New intents may regress keyword handling | Mixed business+emergency prompts |
| T32 | Product claims / invented halal/BPOM/benefit | Agent/import auto-enrichment | Misleading consumer information | Owner source only, no enrichment, existing halal/product policy | Owner-entered false data remains possible | Claim/unknown-data safety tests |
| T33 | Shared device / wrong active workspace | Stale selection or quick switch | Sale masuk toko salah | Persistent workspace banner, confirm on risky action, account/workspace binding | Human selection error remains | Multi-workspace usability/e2e tests |
| T34 | CSV / delimiter or Unicode spoof | Crafted text changes column perception | Misread report/import | RFC-style quoting, UTF-8 BOM decision, normalization warning, raw IDs | Spreadsheet rendering varies | Unicode/delimiter/newline test corpus |

## Low

| ID | Asset / threat | Attack path | Impact | Mitigation | Residual risk | Test |
| --- | --- | --- | --- | --- | --- | --- |
| T35 | Report meaning / mistaken tax report | User treats simple report as official | Bad business/compliance decision | Prominent disclaimer and terminology “estimasi” | User may ignore copy | Content/usability review |
| T36 | Learning status / mistaken ability label | Mastery copy generalized | Stigma or false confidence | “pada latihan ini”, no intelligence/formal equivalence | Social interpretation remains | Content snapshot/reviewer test |
| T37 | Export filename / path/control chars | Workspace name enters filename | Broken download/spoof | Safe slug, bounded length, generated suffix | Duplicate readable names | Filename corpus test |

## Cross-cutting assumptions

- Browser and device are not trusted execution environments; client validation cannot replace Rules/server validation.
- An authenticated user may be malicious.
- Platform service credentials, if introduced, are technical principals and require least privilege, rotation, audit, and no human inheritance.
- Offline permission revocation has latency. MVP must disclose and constrain cached permission duration before multi-device use.
- No mitigation produces zero residual risk.

## Review triggers

Threat model must be reopened when adding cloud writes, new role, customer data, payment integration, XLSX library, file import type, multi-device sync, multi-branch, support access, or new Agent executable action.
