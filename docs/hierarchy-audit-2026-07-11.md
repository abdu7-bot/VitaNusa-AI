# Audit Hierarki VitaNusa AI — 11 Juli 2026

## Ruang lingkup

Audit meliputi dokumentasi amanah dan prompt, backend endpoint `/ask`, intent dan safety, response builder, Nusa Chat fallback, article map, metadata artikel yang didokumentasikan, VitaCheck, katalog produk, halaman Prinsip Amanah, test backend, README, dan AGENTS.md.

## Struktur sebelum perubahan

Alur backend utama adalah:

```text
question -> detect_intent() -> classify_risk() -> build_answer(intent, safetyLevel) -> build_actions(intent)
```

Safety medis sudah diproses sebelum intent lain, tetapi keputusan akhir masih tersebar di `intent_router.py`, `safety.py`, `responses.py`, prompt, pedoman amanah, dan fallback JavaScript.

## Temuan utama

### 1. Sumber aturan tersebar

- Batas diagnosis, dosis, fatwa, klaim produk, dan kondisi darurat ditulis ulang di beberapa dokumen dan JavaScript fallback.
- Dokumentasi menyebut “konstitusi” dan urutan prioritas, tetapi backend belum mempunyai kontrak teknis yang menggunakannya.
- Frontend lokal tetap membutuhkan fallback, tetapi duplikasi tersebut belum dibedakan secara tegas sebagai lapisan kompatibilitas, bukan sumber kebenaran utama.

### 2. Intent terlalu dekat dengan keputusan final

- `intent_router.py` menentukan intent dan safety level.
- `responses.py` langsung memilih jawaban dan tombol berdasarkan intent.
- Tidak ada wadah untuk mempertahankan beberapa aturan aktif sekaligus. Satu intent dominan dapat menyembunyikan konteks lain seperti fatwa, status halal, atau klaim menyembuhkan.

### 3. Safety lama baik tetapi belum menjadi policy yang dapat digabung

- Keyword kondisi darurat sudah tersedia dan diprioritaskan.
- Hasil safety hanya berupa `safetyLevel` dan `recommendedAction`, sehingga belum dapat menyatakan tindakan yang dilarang seperti `show_products` atau `give_personal_dose` secara terstruktur.

### 4. Status halal belum memiliki model teknis resmi

- Halaman produk sudah jujur memakai “Perlu cek label” dan tidak menebak sertifikasi.
- Belum ada status baku `verified`, `self_declared`, `unknown`, dan `not_applicable` di backend.
- Belum ada validasi yang mencegah `verified` tanpa bukti yang dapat diperiksa.

### 5. Thayyib berisiko menjadi istilah mutlak

- Dokumentasi sudah memakai halal-thayyib sebagai nilai.
- Belum ada aturan teknis yang menerjemahkan thayyib menjadi keamanan, komposisi, risiko, peringatan, dan kesesuaian pengguna.

### 6. Produk dan artikel belum dikendalikan oleh keputusan gabungan

- Action link ditentukan oleh intent.
- Emergency telah menghasilkan jawaban darurat, tetapi belum ada kontrak umum yang melarang produk, artikel, atau VitaCheck.
- Article router dan fallback Firestore memiliki aturan aman sendiri, tetapi backend belum memberi `prohibitedActions` yang dapat dipakai lapisan lain.

### 7. VitaCheck sudah cukup aman

- VitaCheck V2 telah menyatakan diri sebagai refleksi kebiasaan, bukan diagnosis.
- Pertanyaan literasi produk sudah ada, sehingga tidak perlu menambah panjang kuesioner hanya demi hierarki baru.

### 8. Katalog produk tidak memiliki bukti resmi yang cukup untuk migrasi metadata

- Dua produk ditampilkan sebagai katalog reseller.
- Halaman secara eksplisit menyatakan data label, komposisi, izin edar, halal, harga, dan stok tidak ditampilkan bila belum tersedia.
- Karena tidak ada bukti resmi tersimpan, metadata sertifikasi tidak ditambahkan dan status tidak dinaikkan menjadi `verified`.

## Risiko arsitektur sebelum perubahan

1. Aturan baru harus ditambahkan ke banyak `if/elif`.
2. Prioritas dapat berbeda antara prompt, backend, dan fallback frontend.
3. Satu intent dapat membuang warning penting dari domain lain.
4. Status halal dapat dinyatakan tanpa kontrak bukti.
5. Warning dapat salah diperlakukan sebagai blocker, atau blocker menghilangkan warning lain.
6. Kegagalan satu pemeriksaan policy belum memiliki fallback konservatif.
7. Tidak ada test untuk duplikasi `policy_id`, validitas domain, atau urutan prioritas.

## File yang perlu diubah

- Backend `/ask`, schema, response builder, intent/safety adapter.
- Fondasi policy, registry, dan engine baru.
- Test unit dan integration smoke.
- Dokumen konstitusi, panduan hierarchy, prompt, pedoman amanah, README, AGENTS.md.
- Halaman publik `prinsip-amanah.html`.

## File yang sengaja tidak diubah

- `assets/js/modules/nusa-chat.js`: field lama tetap kompatibel; payload tambahan diabaikan dengan aman.
- `assets/js/modules/nusa-knowledge.js`: tetap menjadi fallback lokal. Konsolidasi penuh ditunda karena dapat merusak chat saat backend tidak tersedia.
- `assets/js/modules/nusa-articles-map.js`: article map masih berjalan dan tidak perlu mengetahui HTML policy.
- `assets/js/modules/vitacheck.js` dan `vitacheck.html`: sudah low-risk dan non-diagnostic.
- `products/index.html`: tidak ada bukti resmi untuk menambah sertifikasi atau klaim.
- Admin/Firestore article schema: metadata yang ada tetap dipertahankan; policy engine tidak mengubah proses publish.
- Service worker, manifest, CORS, deployment, route, aset gambar, dan Firebase: tidak ada bukti kebutuhan perubahan.

## Keputusan audit

Refactor dilakukan secara bertahap. Safety lama tidak dihapus. Ia diadaptasi oleh `MedicalSafetyPolicy`, lalu policy lain ditambahkan melalui registry eksplisit. Format response lama dipertahankan dan hanya diperluas dengan `policyDecision`.
