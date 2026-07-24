# Daftar Kerja VitaNusa AI

Terakhir diperbarui: 24 Juli 2026

Dokumen ini menjadi antrean kerja utama saat pengembangan dilakukan dari laptop. Setiap pekerjaan harus memakai branch terpisah, satu fokus per Pull Request, dan tidak boleh di-merge sebelum test serta GitHub Actions lulus.

## Prioritas 0 — Selesaikan audit keamanan konten

### Content Rendering Security

**Status:** belum selesai.

**Branch yang digunakan:**

`fix/vitanusa-content-rendering-security`

**Pelaksana utama:** Codex.

**Tujuan:**

- audit renderer dan sanitizer untuk knowledge, chat, artikel, dan HTML dinamis;
- menolak `script`, `iframe`, `object`, `embed`, `form`, event handler `on*`, `action`, `formaction`, `javascript:`, `data:`, `xlink:href`, SVG berisiko, HTML malformed, serta payload encoded/obfuscated;
- mengganti `innerHTML` dengan `textContent` bila HTML tidak diperlukan;
- menambah test payload berbahaya dan regresi konten normal.

**Selesai bila:**

- `npm ci` lulus;
- `npm run check` lulus;
- `npm run test:mandiri` lulus;
- seluruh test frontend/security lulus;
- Unicode scan dan `git diff --check` lulus;
- Draft PR dibuat;
- Copilot melakukan review read-only;
- tidak ada Blocker, High, atau Medium yang belum ditutup.

## Prioritas 1 — Tutup pekerjaan dokumentasi dan aksesibilitas

### Static Link and Accessibility

**Status:** perubahan sudah tersedia di branch, PR perlu dibuat atau diperiksa.

**Branch:**

`fix/static-link-accessibility`

**Perubahan yang diharapkan hanya:**

- `vitacheck.html`
- `komik.html`
- `404.html`

**Langkah laptop:**

1. Sinkronkan branch dengan remote.
2. Jalankan `npm run check`.
3. Jalankan `git diff --check`.
4. Pastikan hanya tiga file di atas yang berubah.
5. Buat Draft PR ke `main`.
6. Merge setelah Actions hijau.

### Sinkronisasi Roadmap dan Status

**Status:** perubahan dokumentasi sudah tersedia di branch, PR perlu dibuat atau diperiksa.

**Branch:**

`docs/vitanusa-status-sync`

**Perubahan yang diharapkan hanya:**

- `docs/vitanusa-mandiri/17-phased-roadmap.md`
- `docs/vitanusa-mandiri/current-status.md`

**Langkah laptop:**

1. Periksa apakah branch masih sesuai dengan `main` terbaru.
2. Jalankan `git diff --check origin/main...HEAD`.
3. Pastikan hanya dua file Markdown di atas yang berubah.
4. Buat Draft PR.
5. Merge setelah review dan Actions hijau.

## Prioritas 2 — Validasi nyata aplikasi

### Smoke Test Backend

**Status:** perlu dilakukan setelah backend security hardening berada di `main`.

Periksa:

- query token ditolak;
- Bearer token valid/invalid;
- data sensitif tidak masuk queue, audit log, atau respons admin;
- rate limit menghasilkan `429` dan `Retry-After`;
- trusted proxy tetap fail-closed bila belum dikonfigurasi;
- feedback queue tidak rusak saat append dan compaction.

### Smoke Test NusaKasir di Browser/Android

**Status:** belum selesai.

Periksa:

- Produk dan Kategori;
- Inventory dan riwayat stok;
- CartDraft dan Sale Preview;
- finalisasi pembayaran tunai;
- Receipt snapshot;
- tracked product mengurangi stok tepat satu kali;
- non-tracked product tidak membuat movement;
- retry tidak membuat Sale atau movement kedua;
- reload mempertahankan data;
- backup v6 dapat dipreview;
- restore tetap preview-only.

## Prioritas 3 — Lanjutkan Fase 3

### Fase 3 PR 8 — Expense dan Cash Session Foundation

**Status:** belum dimulai.

**Mulai hanya setelah:**

- Content Rendering Security selesai;
- PR aksesibilitas dan dokumentasi ditutup;
- smoke test utama tidak menemukan blocker.

**Pelaksana utama:** Codex.

**Reviewer:** Copilot read-only setelah Draft PR tersedia.

**Belum termasuk:**

- void;
- reversal;
- refund;
- laporan;
- printer/PDF;
- cloud sync;
- deployment.

## Prioritas 4 — Pustaka novel

### Upload PDF Episode

**Status:** tujuh novel tersedia, tetapi PDF aktual belum tersedia pada audit terakhir.

**Aturan:**

- satu episode satu file PDF;
- jangan mengarang judul episode;
- jangan mengganti nama file tanpa keputusan;
- unggah bertahap per novel;
- setelah PDF tersedia, perbarui README dan manifest berdasarkan file aktual.

## Aturan kerja

1. Jangan bekerja langsung di `main`.
2. Satu branch dan satu fokus per PR.
3. Jangan menjalankan Codex dan Copilot untuk mengedit branch yang sama secara bersamaan.
4. Codex mengerjakan implementasi; Copilot melakukan review read-only.
5. Konektor GitHub dipakai untuk dokumentasi, konten, audit, dan perubahan kecil yang terisolasi.
6. Jangan merge bila test atau GitHub Actions belum hijau.
7. Jangan melakukan deployment dari branch fitur.
8. Jangan downgrade IndexedDB atau menghapus data pengguna.
9. Jangan menyimpan token, API key, password, UID, atau secret di repository maupun log.
