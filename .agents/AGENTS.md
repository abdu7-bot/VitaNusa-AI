# VitaNusa-AI Agent Governance Contract

Dokumen ini adalah kontrak kerja wajib untuk setiap coding agent (Kilo, Copilot,
Codex, atau agent lain) yang bekerja di VitaNusa-AI. Dokumen lain menguraikan;
dokumen ini menetapkan batas, ownership, dan urutan kerja.

Rujukan rinci:

- `.agents/RULES.md` — aturan yang tidak boleh dilanggar.
- `.agents/WORKFLOW.md` — state machine, gate, dan checklist per fase.
- `.agents/ARCHITECTURE.md` — posisi governance dalam arsitektur.
- `ROADMAP.md` — arah pekerjaan.
- `tasks/TODO.md` — antrean kerja aktif.

## 0. Workspace

| Peran | Path | Aturan |
|---|---|---|
| Canonical workspace | `/root/VitaNusa-AI` | Satu-satunya tempat agent boleh membaca dan menulis. |
| Read-only secondary copy | `/home/vita/VitaNusa-AI` | Jangan ditulis, dipindahkan, atau dihapus. Jangan dijadikan asal perubahan. |

Semua path relatif pada dokumen ini dihitung dari canonical workspace. Jika
pekerjaan dilakukan di checkout lain, agent wajib BERHENTI dan melaporkannya,
bukan memindahkan sendiri pekerjaan ke sana.

## 1. Urutan sumber kebenaran

1. Kode dan test yang sedang berjalan.
2. `docs/vitanusa-master-architecture-2026.md`.
3. `AGENTS.md` (root).
4. Dokumen domain, termasuk `.agents/`.
5. `ROADMAP.md` dan `tasks/`.
6. Asumsi agent.

Konflik antar sumber tidak diselesaikan oleh agent dengan menebak. Agent
berhenti dan escalate (§7).

## 2. Peran agent

Empat peran wajib, mengikuti tier pada `ROADMAP.md` §5: Planner, Implementer,
Reviewer, dan Integrator. Pada task kelas `DOC` atau `TEST`, satu agen boleh
menjadi Implementer sekaligus Reviewer, asalkan checklist review (§7 di
`.agents/WORKFLOW.md`) dijalankan dan hasilnya dicatat. Pada task kelas `TOOL`,
`CONFIG`, `CI`, `CODE`, atau `ADR`, reviewer harus orang atau agen lain yang
tidak menulis perubahan itu.

| Peran | Tanggung jawab | Wajib | Tidak boleh |
|---|---|---|---|
| Planner | Scope, urutan, kelas task | Membaca roadmap, memecah pekerjaan, menulis objective/scope/acceptance, menentukan file dan kategori perubahan yang boleh disentuh | Menulis kode aplikasi, memperluas scope sendiri |
| Implementer | Eksekusi | Mengubah hanya file di scope, menjalankan validasi, menyiapkan diff | Menentukan scope, menandai DONE, mengubah production code atau area terlindungi tanpa approval tertulis |
| Reviewer | Penolakan | Menjalankan checklist review, menolak perubahan yang melanggar aturan, memutuskan PASS atau BLOCKED | Menulis perubahan yang sedang direview, meloloskan perubahan yang tidak ditelusuri ke task |
| Integrator | Penggabungan perubahan yang sudah PASS | Menggabungkan perubahan yang sudah PASS review, menjaga build dan test tetap hijau, memastikan satu task satu commit | Menulis perubahan baru, memperluas scope, menyetujui karyanya sendiri, menggabungkan ke production code atau area terlindungi tanpa approval manusia |

Siapa menentukan scope: **Planner**, berdasarkan `ROADMAP.md` dan
`tasks/TODO.md`. Planner tidak boleh mengubah prioritas atau urutan task yang
sedang aktif; pemindahan task dan perubahan roadmap adalah keputusan manusia
kecuali pemilik task menyuruh secara eksplisit.

Integrator adalah peran tersendiri, bukan versi Planner. `ROADMAP.md` §5 Tier 4
menggambarkan Integrator sebagai tahap setelah Reviewer: ia menggabungkan
perubahan yang sudah lolos dan menjaga build serta test tetap hijau. Kontrak ini
menerjemahkannya menjadi peran, bukan menghilangkan tiers tersebut:

- Integrator bekerja setelah `REVIEW` PASS dan tidak menambah langkah approval
  baru. Pada sesi satu task, commit dilakukan oleh Implementer setelah reviewer
  PASS (`.agents/WORKFLOW.md` §8); Integrator bekerja ketika beberapa perubahan
  yang sudah PASS perlu digabungkan.
- Integrator tidak berwenang menambah scope, menulis perubahan baru, atau PASS
  atas perubahan yang ia buat sendiri.
- Integrator tidak menggantikan approval manusia untuk production code,
  configuration, CI, deployment, dan area terlindungi.

Istilah peran pada dokumen lain dipetakan di `.agents/ARCHITECTURE.md` §6.1.

## 3. Alur dasar

```text
PLAN
  ↓
IMPLEMENT
  ↓
VALIDATE
  ↓
REVIEW
  ↓
COMMIT
  ↓
DONE
```

Tahapan tidak boleh dilompati. `VALIDATE` berjalan pada state `TESTING`;
`REVIEW` pada state `REVIEW`; `COMMIT` hanya setelah reviewer PASS. Rinci gate
ada di `.agents/WORKFLOW.md`.

## 4. Kapan agent boleh coding

Agent boleh coding hanya bila seluruh kondisi berikut benar:

1. Ada task dengan ID di `tasks/TODO.md` atau file task di `tasks/active/`.
2. Task sedang pada state `ACTIVE` dan diklaim oleh agent tersebut.
3. Scope file tertulis eksplisit, bukan "yang relevan" atau "sedikit saja".
4. Kelas task (§5) sudah ditentukan dan gate-nya jelas.
5. Dependency task sebelumnya sudah DONE.
6. `git status --short` dibaca dan kondisi tree diketahui.
7. Perubahan tidak menyentuh area terlindungi (§6) tanpa approval manusia.
8. Untuk task yang menyentuh `CODE`, `CONFIG`, `CI`, atau `DEPLOY`, approval
   manusia tertulis sudah tercatat pada file task **sebelum** file pertama
   disentuh (§5.1).

## 5. Kelas task dan kategori perubahan

Setiap file task wajib menyebut kelas task untuk **setiap** kategori perubahan
yang disentuh. Definisi path per kategori ada di `.agents/ARCHITECTURE.md` §7.

| Kelas | Kategori | Boleh disentuh | Gate minimum |
|---|---|---|---|
| `DOC` | Documentation-only | Hanya file dokumentasi yang disebut scope | `git status --short`, `git diff --check`, `scripts/check_agent_governance.py`, `scripts/check_suspicious_unicode.py`, review dokumen |
| `TEST` | Test-only | Hanya file test dan fixture yang disebut scope | Suite lama dan baru lulus, nol perubahan production |
| `TOOL` | Repository tooling | Hanya script dan utilitas non-runtime yang disebut scope | Nol perubahan production behavior, pemeriksaan sintaks, minimal satu smoke check atau kasus negatif, diff review penuh, reviewer terpisah |
| `CONFIG` | Configuration | Hanya manifest dan konfigurasi non-deployment yang disebut scope | Pemeriksaan sinkronisasi dependency bila manifest berubah, diff review penuh, approval manusia bila menyentuh area terlindungi |
| `CI` | Continuous integration | Hanya file workflow CI yang disebut scope | Approval manusia tertulis, diff review penuh, nol perubahan production behavior |
| `DEPLOY` | Deployment | Hanya konfigurasi deployment yang disebut scope | Approval manusia tertulis, rollback path tertulis, tidak dijalankan agent tanpa perintah manusia |
| `CODE` | Production-code | Hanya file runtime yang disebut scope | Tiga syarat pada §5.1, regression suite, diff review penuh, reviewer terpisah |
| `ADR` | Architecture decision | Dokumen arsitektur dan konsekuensinya | Human approval mandatory, tidak dikerjakan otonom |

Penulisan kelas pada file task:

- satu kategori: `**Class:** DOC`
- beberapa kategori: `**Class:** DOC + TOOL`; seluruh gate pada kategori yang
  disebut wajib dijalankan, dan gate terketat yang berlaku.
- kategori yang tidak disebut tetapi ternyata disentuh adalah pelanggaran scope,
  bukan promosi kelas otomatis.

Aturan kelas:

- `DOC`, `TEST`, dan `TOOL` tidak boleh diam-diam menjadi `CONFIG`, `CI`,
  `DEPLOY`, atau `CODE`. Bila dokumentasi, test, atau tooling menuntut perubahan
  di luar kategorinya, task dipecah; implementer berhenti.
- Kategori yang tidak diketahui atau tidak disebut di scope diperlakukan sebagai
  `CODE`, yaitu kelas paling ketat.
- `CODE` pada area terlindungi selalu memerlukan human approval tertulis lebih
  dulu.
- `ADR` tidak dapat diselesaikan hanya dengan menulis dokumen; harus ada
  keputusan manusia yang tercatat.

### 5.1 Tiga syarat perubahan production code

Setiap perubahan production code memerlukan ketiganya, bukan salah satu:

1. **Scope eksplisit** — file target disebut satu per satu pada file task sebelum
   disentuh. "Yang relevan" bukan scope.
2. **Human approval tertulis sebelum perubahan** — approval dicatat pada file task
   (siapa, kapan, file mana, objective mana) sebelum file pertama ditulis, bukan
   sesudah review.
3. **Traceability** — perubahan dapat ditelusuri dari commit ke task ID, dari task
   ID ke requirement, dan dari requirement ke file; nomor commit dan hasil review
   dicatat pada file task.

Documentation, test, dan tooling tidak memerlukan human approval, tetapi tetap
memerlukan scope eksplisit dan traceability. `CONFIG`, `CI`, dan `DEPLOY`
memerlukan approval manusia tertulis dan tidak dijalankan agent tanpa perintah
manusia.

### 5.2 Perbedaan kategori perubahan

| Kategori | Contoh path | Risiko utama | Wajib |
|---|---|---|---|
| Documentation | `docs/`, `*.md`, `tasks/`, `.agents/` | Pembaca salah paham dan kontrak governance tidak dijalankan | Scope eksplisit, traceability |
| Test | `backend/tests/`, `tests/` | Test berubah jadi production behaviour tersembunyi | Scope eksplisit, traceability, nol perubahan production |
| Tooling | `scripts/` non-runtime, pemeriksa dan generator | Perkakas dieksekusi dengan hak akses yang lebih luas dan dapat gagal diam-diam | Scope eksplisit, traceability, smoke check atau kasus negatif, nol perubahan production behaviour |
| Configuration | `backend/requirements*.txt`, `pyproject.toml`, `package.json`, `.env.example` | Dependency atau konfigurasi tidak sinkron antar lingkungan | Scope eksplisit, traceability, approval manusia bila area terlindungi |
| CI | `.github/workflows/` | Gate hilang, coverage hilang, atau build rusak | Approval manusia tertulis, diff review penuh |
| Deployment | `render.yaml`, `.replit`, konfigurasi hosting | Perubahan produksi tidak dapat di-rollback | Approval manusia tertulis, rollback path |
| Production code | `backend/app/`, halaman dan aset runtime, `service-worker.js`, `firestore.rules`, `storage.rules`, `firebase.json` | Behaviour pengguna berubah | Tiga syarat §5.1, regression suite, reviewer terpisah |

Kategori `ADR` tidak masuk tabel ini karena hasilnya keputusan yang tercatat,
bukan perubahan file pada kategori mana pun.

## 6. Area terlindungi

Area berikut tidak boleh diubah tanpa scope eksplisit **dan** approval manusia
tertulis. Daftar ini sama dengan `.agents/ARCHITECTURE.md` §7 dan
`.agents/RULES.md`:

- homepage publik dan layout utama;
- chat UI Nusa AI;
- logika VitaCheck;
- halaman produk dan halaman kontak;
- backend aplikasi, yaitu `backend/app/`;
- Firebase config, Firestore rules, dan storage rules;
- WhatsApp/email dan asset path;
- service worker;
- workflow CI, yaitu `.github/workflows/`;
- konfigurasi deployment, yaitu `render.yaml`, `.replit`, dan hosting config;
- manifest dependency runtime.

Perlindungan bersifat default. "Tidak diminta secara eksplisit" berarti tidak
boleh diubah. Area terlindungi yang masuk kategori production code juga
memerlukan tiga syarat pada §5.1; area terlindungi kategori `CONFIG`, `CI`, dan
`DEPLOY` memerlukan approval manusia tertulis dan tidak dijalankan agent tanpa
perintah manusia.

## 7. Kapan agent wajib berhenti

Agent wajib BERHENTI, tidak melanjutkan sendiri, dan mencatat alasannya pada file
task bila salah satu kondisi ini terjadi:

1. Scope task tidak jelas.
2. Requirement bertentangan satu sama lain.
3. Perubahan keluar dari scope.
4. Production behavior berubah tanpa otorisasi.
5. Test gagal dan penyebab belum dipahami.
6. Ditemukan konflik arsitektur.
7. Membutuhkan keputusan manusia.

Tanda berhenti yang sah: state `BLOCKED` pada file task atau
`TESTING → FAILED`. "Rasa yakin", "test hijau", dan "hanya sedikit lagi" bukan
alasan melanjutkan.

## 8. Aturan yang tidak dapat dinegosiasikan

1. Test hijau **tidak** memberi hak memperluas scope. Perbaikan di luar scope
   adalah pekerjaan baru, bukan penyelesaian pekerjaan lama.
2. Setiap perubahan harus dapat ditelusuri ke task dan requirement tertentu.
   Perubahan tanpa jejak task ditolak reviewer.
3. Satu task, satu owner, satu rentang file. Dua agent tidak boleh mengerjakan
   scope yang sama pada waktu yang sama (lihat `.agents/WORKFLOW.md` bagian
   claim).
4. Jangan memperbaiki di luar scope hanya karena mudah.
5. Jangan menghapus file, test, atau dokumentasi tanpa bukti kuat bahwa file
   tersebut obsolete dan tanpa persetujuan reviewer.
6. Jangan membuat klaim tentang repository yang belum diverifikasi dengan
   command atau referensi file.
7. Jangan menambahkan dependency runtime hanya untuk keperluan governance.
8. Jangan mengaktifkan loop autonomous baru di luar yang tertulis di
   `.agents/WORKFLOW.md`.

## 9. Syarat task DONE

Task hanya DONE bila seluruhnya terpenuhi:

1. Objective tercapai dan dapat dibuktikan.
2. Acceptance criteria terisi dan terverifikasi.
3. Validasi relevan (§5) dijalankan dan dicatat hasilnya pada file task.
4. Diff direview sesuai aturan reviewer pada §2: reviewer terpisah untuk
   `TOOL`, `CONFIG`, `CI`, `CODE`, dan `ADR`, atau self-review dengan checklist
   lengkap untuk `DOC` dan `TEST`.
5. Tidak melanggar `.agents/RULES.md`.
6. Perubahan ter-commit dengan pesan yang menyebut task ID.
7. Status task dan bukti diperbarui pada file task, termasuk kelas task per
   kategori, nomor commit, dan approval manusia bila diwajibkan.

Kode berhasil ditulis bukan berarti task selesai.
