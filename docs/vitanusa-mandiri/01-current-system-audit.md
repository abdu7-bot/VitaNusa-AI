# 01 — Audit Sistem Saat Ini

Audit dilakukan terhadap `main` pada commit awal `42918e2a3413b843162fedddb404f153c346ac67`. Status di bawah hanya diberikan bila ditemukan bukti isi file; nama file saja tidak dianggap bukti fitur.

## Klasifikasi

- **Sudah tersedia:** kode atau konfigurasi berfungsi ada di repository.
- **Dapat digunakan kembali:** kontrak existing relevan dan batas reusenya diketahui.
- **Perlu diperluas:** fondasi ada, tetapi belum memenuhi domain Mandiri.
- **Belum tersedia:** pencarian kode dan audit tidak menemukan implementasi.
- **Di luar scope Fase 0:** dapat diaudit, tetapi tidak diubah.

## Inventaris komponen

| Nama | Status | Path bukti | Tanggung jawab saat ini | Reuse untuk Mandiri | Perubahan yang mungkin diperlukan | Risiko integrasi |
| --- | --- | --- | --- | --- | --- | --- |
| Frontend HTML/CSS/JS | Sudah tersedia | `index.html`, `account.html`, `assets/js/main.js`, `assets/css/vitanusa-public.css` | Halaman publik modular tanpa framework besar | Ya, shell dan pola aksesibilitas | Route/feature flag Mandiri dan modul domain baru | Global shell dapat bentrok dengan layar transaksi padat |
| Vite MPA | Sudah tersedia | `vite.config.js` | Build multi-page, base relatif, copy aset PWA | Ya | Tambah entry hanya pada fase implementasi | Bundle dan cache perlu tetap terukur |
| PWA Android | Sudah tersedia | `manifest.webmanifest`, `assets/js/modules/pwa-install.js`, `docs/android-pwa-and-nusa-agent.md` | Install standalone, shortcut, share target | Ya | Shell Mandiri dan offline status domain | Cache shell tidak boleh menyimpan data tenant |
| Service worker | Sudah tersedia | `service-worker.js` | Network-first halaman publik, static SWR, admin network-only, API/Firebase bypass | Terbatas | Tidak menjadi database; koordinasi update dengan IndexedDB migration | Worker lama dapat menyajikan shell lama saat schema berubah |
| Nusa Agent | Sudah tersedia | `assets/js/modules/nusa-agent.js` | Dialog global, safe page context, singleton, offline status | UI dan navigasi dapat direuse | Action Draft Layer dan domain commands belum ada | Double initialization dan action bypass bila kontrak dicampur |
| Nusa Chat | Sudah tersedia | `assets/js/modules/nusa-chat.js` | `/ask`, fallback lokal, sanitasi, session per tab | Informational assistance | Schema action terpisah; jangan mengubah chat menjadi write API | Fallback lokal tidak sama dengan otorisasi tindakan |
| VitaCheck V2 | Sudah tersedia | `assets/js/modules/vitacheck.js` | Refleksi, skor, fokus, rekomendasi, local-first | Tetap bagian VitaNusa inti | Tidak dicampur dengan Mandiri | Kategori kesehatan dapat bocor ke profil usaha bila model disatukan |
| Akun pengguna | Sudah tersedia | `assets/js/modules/user-auth.js`, `account.html` | Google Auth opsional; state publik minimal | Identity bootstrap | Membership/workspace selection belum ada | Multi-account shared device dan cleanup belum diselesaikan |
| Riwayat VitaCheck | Sudah tersedia | `assets/js/modules/vitacheck-history.js`, `firestore.rules` | Ringkasan privat create-only per UID | Pola self-owned Rules dan consent | Tidak dipakai sebagai storage belajar/usaha | Admin atau mentor tidak boleh memperoleh akses implisit |
| Firebase Authentication | Sudah tersedia | `assets/js/modules/user-auth.js`, `admin/firebase-auth.js` | Auth publik dan admin memakai alur terpisah | Ya, identitas pengguna | Session boundary untuk tenant dan offline re-auth | UID valid tidak membuktikan membership |
| Firestore konten | Sudah tersedia | `firestore.rules` | Konten published, admin writes, default deny | Materi publik dapat mengikuti pola published | Hierarchy tenant belum ada | Rules kompleks dan read cost membership |
| Platform admin owner/admin | Sudah tersedia | `admin/admin-access.js`, `admin/admin-management.js`, `firestore.rules` | Owner mengelola akun admin; owner/admin aktif mengelola konten | Terbatas pada platform | Namespace konseptual `platform_owner`/`platform_admin`; jangan otomatis migrasi role existing | Role platform bisa keliru dipakai sebagai bypass tenant |
| Storage Rules | Sudah tersedia | `storage.rules` | Upload media publik oleh admin aktif, default deny | Materi publik saja | Asset tenant privat membutuhkan desain terpisah jika kelak dibutuhkan | Metadata `visibility` bukan membership tenant |
| FastAPI | Sudah tersedia | `backend/app/main.py`, `render.yaml` | `/ask`, preview router, feedback, health | Host kandidat command validation/export online | Auth tenant dan endpoint domain belum ada | CORS/auth/idempotency harus dirancang sebelum write endpoint |
| Policy Engine | Sudah tersedia | `backend/app/policy_engine.py`, `backend/app/policies/registry.py` | Menggabungkan specialized policy secara fail-conservative | Prinsip dan mekanisme dapat diperluas | Policy bisnis/action bukan pengganti domain validator | Menyalin policy ke prompt/frontend menimbulkan drift |
| Medical Safety | Sudah tersedia | `backend/app/safety.py`, `backend/app/policies/medical_safety.py` | Klasifikasi risiko dan prioritas darurat | Wajib tetap pada NusaAgent | Action bisnis tidak boleh melewati jalur kesehatan saat relevan | Intent baru dapat menurunkan prioritas darurat bila tidak diuji |
| Local LLM Router | Sudah tersedia terbatas | `backend/app/llm/router.py`, `backend/app/main.py` | Provider lokal terjaga guard; `/ask` dapat rephrase rule answer | Natural-language explanation/draft | Tidak boleh menghitung atau mengotorisasi nilai final | Output model terlihat benar walau payload salah |
| Web Search Router | Sudah tersedia sebagai preview | `backend/app/search/router.py`, `backend/app/main.py` | Search ber-guard pada `/search/preview` | Tidak dibutuhkan untuk transaksi | Hanya untuk konten bila ada review terpisah | Data shared URL/prompt injection dan sumber tidak tepercaya |
| Audit log backend | Sudah tersedia terbatas | `backend/app/audit_log.py` | JSONL append-only untuk metadata `/ask`, preview pertanyaan teredaksi | Pola minimisasi dan fail-safe | Bukan audit tenant; event workspace perlu schema/akses/retention baru | File lokal Render tidak menjamin durability/tamper resistance |
| Conversation memory | Sudah tersedia terbatas | `backend/app/conversation_memory.py` | In-memory, TTL, redacted context | Conversational UX | Tidak boleh menjadi action state atau ledger | Restart menghapus context; session ID bukan authorization |
| CI | Sudah tersedia | `.github/workflows/ci.yml`, `package.json` | Build, JS tests, Rules Emulator, backend, Unicode/safety | Ya | Tambah suite per modul/fase tanpa menghapus regresi | Test docs tidak membuktikan perangkat fisik/offline chaos |
| GitHub Pages | Perlu validasi operasional | `vite.config.js`, `docs/android-pwa-and-nusa-agent.md` | Build base relatif mendukung static hosting | Ya | Route Mandiri harus static-host compatible | Repository tidak memuat workflow deploy Pages; status deployment bukan bukti dari kode |
| Render | Konfigurasi tersedia | `render.yaml`, `backend/README.md` | Service FastAPI dengan root `backend` | Kandidat fitur online | Capacity, auth, persistence, privacy review | Free service sleep dan filesystem ephemeral |
| Workspace/tenant | Belum tersedia | Tidak ada entity/Rules/runtime terkait pada audit | — | — | Domain, membership, Rules, UI | Tenant leakage merupakan risiko kritis |
| NusaKasir | Belum tersedia | Tidak ada modul transaksi/inventori | — | — | Seluruh domain dan test deterministik | Uang, duplikasi, dan stok |
| NusaBelajar | Belum tersedia | Tidak ada lesson/progress engine | — | — | Content package, progress, consent | Bahasa merendahkan dan data progres privat |
| VitaSheet | Belum tersedia | Tidak ada generator CSV/XLSX domain | — | — | Export contract dan sanitasi | Formula injection dan total keliru |
| IndexedDB/outbox | Belum tersedia | Tidak ditemukan penggunaan `indexedDB` | — | — | Wrapper, migration, repository, sync | Korupsi/multi-account/device cleanup |
| Agent action execution | Belum tersedia | Agent hanya chat/navigasi; tidak ada command service | — | UI Agent dapat direuse | Draft token, validator, confirmation, receipt | Eksekusi tanpa izin atau replay |

## Tabel integrasi

| Komponen saat ini | Dipakai oleh Mandiri | Cara pemakaian | Batas |
| --- | --- | --- | --- |
| User Auth | Ya | Login pelajar, pemilik usaha, dan kasir | Login bukan membership; offline session tidak memberi izin baru |
| PWA shell | Ya | Install, navigasi, update, dan status koneksi | Cache API hanya shell/aset publik |
| Nusa Agent | Ya | Pendamping belajar/kasir dan pembuat draft | Tidak menulis langsung dan tidak menjadi kalkulator final |
| Nusa Chat/backend | Ya | Pertanyaan informasional melalui `/ask` | Action API membutuhkan kontrak terpisah |
| Policy Engine/Medical Safety | Ya | Pagar respons dan konflik safety | Domain validator tetap sumber kebenaran transaksi |
| VitaCheck | Tetap terpisah | Tautan dari shell; tidak masuk workspace | Data kesehatan tidak dicampur dengan usaha/belajar |
| Admin platform | Ya, terbatas | Materi publik dan operasi platform | Tidak membaca transaksi, pengeluaran, laba, atau progres privat |
| Firestore Rules | Pola direuse | Default deny, self-read, validasi field, Emulator | Rules tenant baru belum ada dan tidak dibuat di Fase 0 |
| Backend audit | Pola direuse | Redaksi dan metadata minimal | Bukan ledger tenant atau bukti finansial |

## Temuan batas keamanan

1. `firestore.rules` hanya memberi akses riwayat VitaCheck kepada UID pemilik; role admin tidak mendapat akses lintas pengguna.
2. `admin/admin-access.js` mendefinisikan admin aktif sebagai status `active` dan role `owner|admin`; ini adalah otorisasi platform, bukan workspace.
3. `service-worker.js` secara eksplisit melewati Firebase, API, request non-GET, dan admin. IndexedDB Mandiri harus menjadi komponen baru, bukan memperluas Cache API untuk data tenant.
4. `nusa-chat.js` mengirim pertanyaan ke `/ask`; tidak ada schema action atau authenticated command endpoint. Karena itu Agent existing hanya dapat dinyatakan informasional.
5. `backend/app/audit_log.py` menyimpan preview pertanyaan yang telah diredaksi pada file lokal. Ia tidak memenuhi kebutuhan audit transaksi yang durable dan tenant-scoped.

## Kesimpulan audit

VitaNusa menyediakan fondasi UX, auth, safety, PWA, dan quality gate yang berguna. Fondasi tersebut mengurangi pekerjaan shell tetapi tidak mengurangi kebutuhan desain domain dan security boundary Mandiri. Workspace, data finansial, progres belajar, sinkronisasi, dan action execution harus dianggap sistem baru dengan default deny dan test terpisah.
