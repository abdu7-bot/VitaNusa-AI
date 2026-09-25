# VitaNusa-AI — MASTER ROADMAP

> Dokumen kendali utama pengembangan VitaNusa-AI.
> Semua agent wajib membaca dokumen ini sebelum mengambil pekerjaan.

## 1. TUJUAN BESAR

Membangun VitaNusa-AI sebagai sistem AI yang:
- aman;
- dapat diaudit;
- modular;
- mampu bekerja dengan agent;
- memiliki knowledge pipeline yang terverifikasi;
- menjaga integritas data pengguna;
- memisahkan sumber, fakta, analisis, dan generasi;
- mendukung pengembangan mandiri melalui workflow agent.

## 2. SUMBER ROADMAP

Dokumen arsitektur dan roadmap yang sudah ada:

- docs/roadmap.md
- docs/vitanusa-map.md
- docs/vitanusa-master-map-2026.md
- docs/vitanusa-work-queue.md
- docs/vitanusa-constitution.md
- docs/vitanusa-upgrade-notes.md

Dokumen tersebut adalah sumber referensi proyek dan tidak boleh dihapus hanya karena ROADMAP.md dibuat.

## 3. URUTAN PENGEMBANGAN

### FASE 0 — SECURITY FOUNDATION

Prioritas:
1. Content Rendering Security
2. Backend Security Hardening
3. Security regression tests
4. Audit data sensitif
5. Rate limiting
6. Trusted proxy fail-closed
7. Queue dan audit-log security

Selesai hanya jika test dan review memenuhi aturan repository.

### FASE 1 — ACCESSIBILITY & DOCUMENTATION

- Static Link and Accessibility
- Sinkronisasi roadmap
- Sinkronisasi current status
- Dokumentasi arsitektur
- Dokumentasi workflow agent

### FASE 2 — VALIDASI APLIKASI

Smoke test:

- Produk
- Kategori
- Inventory
- Riwayat stok
- CartDraft
- Sale Preview
- pembayaran tunai
- Receipt snapshot
- tracked product
- non-tracked product
- retry/idempotency
- reload persistence
- backup preview
- restore preview-only

Tidak boleh lanjut jika terdapat blocker keamanan atau integritas data.

### FASE 3 — NUSAKASIR FOUNDATION

Urutan:

1. Expense Foundation
2. Cash Session Foundation
3. Void
4. Sale Reversal
5. Refund
6. Reporting
7. Printer/PDF
8. Cloud Sync

Setiap komponen harus memiliki test dan migration/data-safety strategy.

### FASE 4 — KNOWLEDGE SYSTEM

Membangun pipeline:

SOURCE
→ INGEST
→ NORMALIZE
→ CLASSIFY
→ VERIFY
→ INDEX
→ RETRIEVE
→ ANSWER
→ CITE
→ AUDIT

Untuk pengetahuan agama:

Al-Qur'an
→ verifikasi teks Arab
→ verifikasi sumber
→ tafsir/ulama
→ hadits
→ derajat hadits
→ syarah
→ ijma'/ikhtilaf
→ jawaban dengan tingkat kepastian.

AI tidak boleh mengarang ayat, hadits, ijma', atau fatwa.

### FASE 5 — ARABIC VERIFICATION ENGINE

Sistem harus mampu memeriksa:

- teks Arab;
- harakat;
- akar kata;
- bentuk kata;
- morfologi;
- nahwu;
- sharaf;
- makna;
- konteks ayat;
- variasi qira'at bila relevan;
- istilah hadits;
- perbedaan lafaz;
- sumber rujukan.

Jawaban agama yang sensitif harus melewati verifikasi sumber sebelum diberikan.

### FASE 6 — AI AGENT ORCHESTRATION

Agent pipeline:

ROADMAP
→ TASK
→ BRANCH
→ IMPLEMENT
→ TEST
→ SECURITY CHECK
→ REVIEW
→ REPORT
→ MERGE

Tidak boleh langsung mengubah main.

### FASE 7 — MODEL ROUTING

Arsitektur model:

PRIMARY:
- Kilo Auto Free

SECONDARY:
- Kilo profile/model 1
- Kilo profile/model 2
- Kilo profile/model 3

FREE DAILY:
- Copilot profile/model 1
- Copilot profile/model 2
- Copilot profile/model 3
- Copilot profile/model 4

FREE MONTHLY:
- Codex profile/model 1
- Codex profile/model 2
- Codex profile/model 3
- Codex profile/model 4
- Aider profile/model 1
- Aider profile/model 2
- Aider profile/model 3
- Aider profile/model 4

Routing wajib memperhatikan:
- quota;
- availability;
- task type;
- privacy;
- cost;
- failure;
- rate limit.

Tidak boleh fallback ke endpoint berbayar tanpa izin eksplisit.

### FASE 8 — UNATTENDED DEVELOPMENT

Target:

Agent dapat:

1. membaca roadmap;
2. membaca status repository;
3. memilih task berikutnya;
4. membuat branch;
5. mengerjakan satu fokus;
6. menjalankan test;
7. menjalankan security check;
8. membuat laporan;
9. menunggu review;
10. melanjutkan task berikutnya jika aturan mengizinkan.

"Mandiri" bukan berarti agent bebas melakukan apa saja.

### FASE 9 — CREATIVE PRODUCTION

Pipeline:

RISK CLASSIFICATION
→ SOURCE LOCK
→ RESEARCH
→ OUTLINE
→ AI DRAFT
→ AUTOMATED CHECK
→ HUMAN REVIEW
→ SYARIAH/FACT REVIEW
→ VISUAL REVIEW
→ APPROVAL
→ PUBLICATION
→ CORRECTION/RETRACTION

AI tidak menetapkan fatwa.

### FASE 10 — CONTENT LIBRARY

- PDF episode
- metadata
- manifest
- indexing
- search
- citation
- versioning
- audit trail

Aturan:
- satu episode satu PDF;
- jangan mengarang judul;
- jangan mengganti nama tanpa keputusan;
- manifest harus berdasarkan file aktual.


## 4. ATURAN AGENT

- Jangan bekerja langsung di main.
- Satu branch = satu fokus.
- Satu PR = satu fokus.
- Codex = implementasi.
- Copilot = review read-only.
- Jangan menjalankan dua agent editor pada branch yang sama.
- Jangan merge sebelum test dan Actions hijau.
- Jangan downgrade IndexedDB.
- Jangan menghapus data pengguna.
- Jangan menyimpan secret di repository.
- Jangan melakukan deployment dari feature branch.

## 5. DEFINISI SELESAI

Sebuah task dianggap selesai jika:

- implementasi selesai;
- test lulus;
- security check lulus;
- git diff diperiksa;
- dokumentasi diperbarui;
- review selesai;
- tidak ada Blocker/High/Medium yang belum ditutup;
- PR dapat di-merge secara aman.

## 6. ATURAN PRIORITAS

Urutan default:

P0 Security
P1 Data Integrity
P2 Tests
P3 Documentation
P4 Core Features
P5 Knowledge
P6 Agent Automation
P7 Creative/Advanced Features

Agent tidak boleh melewati P0/P1 karena mengejar fitur baru.

## 7. CURRENT STATE

Status aktual repository harus selalu diverifikasi dari:

- git status
- git branch
- git log
- GitHub PR
- GitHub Actions
- docs/vitanusa-work-queue.md

Jangan menganggap status dokumen lama sebagai status aktual repository tanpa verifikasi.

## 8. NEXT ACTION

Sebelum pekerjaan baru:

1. baca ROADMAP.md;
2. baca docs/vitanusa-work-queue.md;
3. cek branch aktif;
4. cek git status;
5. pilih satu task prioritas tertinggi;
6. buat/gunakan branch khusus;
7. implementasikan;
8. test;
9. review;
10. laporkan hasil.

---

**MASTER RULE**

> Jangan mengejar kemampuan AI terlebih dahulu.
> Bangun fondasi yang membuat AI dapat dipercaya.
