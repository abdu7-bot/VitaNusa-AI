# AGENTS.md

## Project

VitaNusa AI adalah website edukasi kesehatan, refleksi Islami, VitaCheck, artikel, dan katalog reseller produk secara amanah.

## Sumber Kebenaran

- Nilai dan prioritas induk: `docs/vitanusa-constitution.md`
- Cara menambah policy: `docs/hierarchy-system.md`
- Kontrak policy: `backend/app/policies/base.py`
- Registry: `backend/app/policies/registry.py`
- Penggabungan keputusan: `backend/app/policy_engine.py`

Jangan membuat hierarchy logic baru di frontend, prompt, atau response builder bila semestinya dimiliki specialized policy.

## Prinsip Utama

- Safety medis lebih dahulu.
- Edukasi dulu, bukan klaim.
- Konten kesehatan adalah edukasi umum, bukan diagnosis.
- Konten Islami adalah refleksi, bukan fatwa final.
- Status halal tidak boleh ditebak.
- Thayyib bukan sertifikasi universal.
- Konten produk hanya informasi reseller, bukan klaim medis.
- Artikel sensitif tetap memakai warning, sensitive flags, reviewerNote, dan Catatan Amanah sesuai kebijakan artikel.

## Aturan Policy

- Satu aturan memiliki satu pemilik teknis utama.
- Intent hanya mendeteksi maksud; policy menentukan batas tindakan.
- Policy baru harus punya `policy_id`, domain, priority, hasil, dan test.
- Beberapa policy boleh aktif bersamaan.
- Jangan menjadikan semua warning sebagai blocker.
- Emergency harus melarang produk, artikel biasa, dan VitaCheck sebagai pengganti pertolongan.
- Jangan memakai LLM sebagai satu-satunya penentu policy.
- Jangan menambahkan status halal, sertifikat, izin, klaim, harga, atau stok tanpa bukti.

## Area yang Dilindungi

Jangan mengubah kecuali dibutuhkan oleh scope:

- homepage publik;
- chat UI Nusa AI;
- layout utama;
- VitaCheck logic;
- halaman produk;
- halaman kontak;
- Firebase config;
- Firestore rules;
- WhatsApp/email;
- asset path;
- service worker dan deployment config.

## Aturan Artikel Admin

- Artikel baru/import default `published`.
- Pertahankan metadata artikel.
- Related Articles memakai slug.
- Draft/archived tidak tampil publik.
- Warning bukan alasan otomatis memaksa draft.
- Jangan menghapus Catatan Amanah.
- Referensi berada di `article-references`.

## Struktur HTML Artikel

Gunakan `article.vitanusa-article`, header dengan `h1` dan summary, section isi, `article-note`, serta `article-references` bila ada. Jangan memasukkan full document HTML ke `contentHtml`.

## Workflow

1. Audit aliran sebelum refactor.
2. Kerjakan perubahan kecil dan spesifik.
3. Gunakan branch/worktree bersih.
4. Jangan menyentuh gambar yang tidak terkait.
5. Jalankan test lama dan test baru.
6. Jangan merge otomatis untuk perubahan sensitif.
7. Laporkan file, test, risiko, dan status Git.
