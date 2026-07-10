# Job Malam Ini — VitaNusa AI

Tanggal: 2026-07-10  
Tujuan: memberi daftar kerja jelas untuk programmer/Codex agar fokus memperbaiki kualitas jawaban VitaNusa AI, menyiapkan paket berlangganan, dan membuat aplikasi relevan untuk mahasiswa, dokter, klinik, dan edukator.

## Aturan wajib

- Baca file relevan sebelum mengubah kode.
- Jangan ubah `index.html`, `service-worker.js`, `manifest.webmanifest`, atau `style.css` kecuali ada instruksi khusus.
- Jangan mengarang data produk, harga, stok, BPOM, halal, komposisi, rating, diskon, atau testimoni.
- Jangan membuat diagnosis pasti, resep obat, dosis obat resep, klaim sembuh, klaim 100% aman, atau klaim tanpa efek samping.
- Gejala darurat harus diarahkan ke bantuan medis darurat.
- Produk Amanah harus edukatif, jujur, dan tidak agresif menjual.

---

## Batch 1 — Prioritas wajib malam ini

### JOB 1 — Rapikan format jawaban VitaNusa AI

**File yang dibaca:**

- `backend/app/responses.py`
- `backend/app/intent_router.py`
- `backend/app/main.py`
- `assets/js/modules/nusa-chat.js`
- `assets/js/modules/nusa-knowledge.js`

**Masalah:**

- Paragraf jawaban terlalu panjang.
- Poin-poin belum rapi.
- Fallback terasa seperti error.
- Disclaimer kadang terlalu penuh.
- Jawaban belum terasa profesional seperti aplikasi edukasi kesehatan.

**Target format jawaban:**

```text
Pembuka singkat.

Penjelasan utama 2–3 paragraf pendek.

Poin penting:
- ...
- ...
- ...

Yang bisa dilakukan:
- ...
- ...
- ...

Catatan amanah:
Jawaban ini bersifat edukatif dan bukan pengganti konsultasi tenaga kesehatan.
```

**Acceptance criteria:**

- Jawaban lebih pendek, jelas, dan ramah.
- Poin-poin rapi.
- Disclaimer tetap ada, tetapi tidak berlebihan.
- Tidak ada diagnosis pasti atau klaim medis berlebihan.
- Jawaban “aplikasi apa ini” menjelaskan VitaNusa AI dengan baik.

---

### JOB 2 — Buat template jawaban berdasarkan intent

**Intent minimal:**

- `identity`
- `vitacheck`
- `product`
- `health_education`
- `emergency`
- `fallback`

**Contoh identity:**

```text
VitaNusa AI adalah asisten edukasi kesehatan dan wellness yang membantu pengguna memahami kebiasaan sehat, membaca artikel edukatif, mencoba VitaCheck, melihat Produk Amanah, dan mendapatkan arahan umum yang aman.

VitaNusa AI bukan pengganti dokter, tetapi bisa membantu memberi penjelasan awal yang mudah dipahami.
```

**Contoh product:**

```text
Produk ini ditampilkan sebagai katalog informasi amanah.

Yang perlu dicek:
- label resmi
- komposisi
- aturan pakai
- peringatan penggunaan
- izin edar jika tersedia

Catatan:
VitaNusa AI tidak menjanjikan produk menyembuhkan penyakit.
```

**Contoh emergency:**

```text
Gejala yang Anda sebutkan bisa termasuk kondisi darurat.

Segera cari bantuan medis darurat atau hubungi fasilitas kesehatan terdekat, terutama bila disertai sesak berat, pingsan, nyeri dada berat, kelemahan separuh tubuh, perdarahan hebat, atau kejang.
```

**Acceptance criteria:**

- Setiap intent punya pola jawaban.
- Emergency tegas.
- Product amanah.
- Fallback ramah dan memberi arahan.

---

### JOB 3 — Perbaiki fallback jawaban AI

**Fallback yang diharapkan:**

```text
Saya belum punya informasi yang cukup untuk menjawab pertanyaan itu secara aman.

Yang bisa Anda lakukan:
- tulis pertanyaan lebih spesifik
- sebutkan konteks umum tanpa data pribadi sensitif
- pilih topik seperti VitaCheck, artikel sehat, produk amanah, atau kebiasaan sehat

Catatan:
Untuk keluhan berat atau darurat, segera cari bantuan medis.
```

**Acceptance criteria:**

- Tidak terasa seperti error.
- Memberi arahan langkah berikutnya.
- Tetap aman secara kesehatan.

---

## Batch 2 — Penting

### JOB 4 — Perbaiki tampilan paragraf dan poin-poin di chat

**File yang dibaca:**

- `assets/js/modules/nusa-chat.js`
- `assets/css/nusa-app-shell.css`
- `assets/js/main.js`

**Target:**

- Line break tampil rapi.
- Bullet list tidak terlalu rapat.
- Nomor list tidak menempel.
- Paragraf pendek nyaman dibaca di HP.
- Tidak merusak layout chat yang sudah diperbaiki.

**Contoh tampilan:**

```text
Poin penting:
• Tidur cukup
• Minum air
• Makan seimbang
• Bergerak ringan

Catatan:
Bila gejala berat, segera konsultasi tenaga kesehatan.
```

---

### JOB 5 — Upgrade copywriting paket VitaNusa AI berlangganan

**Klaim yang dilarang:**

- Diagnosis otomatis.
- Menggantikan dokter.
- Pasti sembuh.
- Rekomendasi obat resep.
- Hasil medis pasti.
- 100% aman.
- Tanpa efek samping.

**Klaim yang aman:**

- Edukasi lebih terarah.
- Catatan kebiasaan.
- Ringkasan artikel.
- Panduan tanya dokter.
- Pengingat sehat.
- Konten belajar.
- Laporan kebiasaan mingguan.
- Bahan edukasi pasien.

**Konsep paket:**

#### Gratis

- Artikel edukatif.
- VitaCheck dasar.
- Chat edukasi terbatas.
- Produk Amanah.
- VitaGame.
- Komik edukatif.

#### Plus

- Chat edukasi lebih banyak.
- Riwayat VitaCheck.
- Fokus sehat mingguan.
- Rekomendasi artikel terkait.
- Ringkasan kebiasaan sehat.
- Template pertanyaan untuk dokter.

#### Pro

- Laporan kebiasaan bulanan.
- Materi belajar kesehatan terstruktur.
- Export ringkasan PDF.
- Mode belajar mahasiswa.
- Mode edukasi pasien.
- Prioritas fitur baru.

#### Klinik / Edukator

- Materi edukasi pasien.
- Template FAQ klinik.
- Konten edukasi siap bagikan.
- Dashboard edukasi dasar.
- Katalog Produk Amanah.
- Branding klinik/komunitas.

**Catatan:** jangan tampilkan harga palsu. Gunakan “Segera hadir” atau “Tanya admin” jika harga belum ditentukan.

---

### JOB 6 — Buat section “Untuk Siapa VitaNusa AI?”

**Target pengguna:**

#### Pengguna umum

- Belajar kebiasaan sehat.
- Cek kebiasaan lewat VitaCheck.
- Baca artikel edukatif.

#### Mahasiswa / orang kuliahan

- Belajar konsep kesehatan.
- Kuis dan flashcard.
- Bahan presentasi edukasi.
- Ringkasan artikel.

#### Dokter / klinik

- Edukasi pasien.
- FAQ klinik.
- Konten promosi kesehatan amanah.
- Template pesan edukasi WhatsApp.

#### Reseller amanah

- Katalog produk.
- Edukasi sebelum membeli.
- Promosi tanpa klaim berlebihan.

**Copywriting mahasiswa:**

```text
VitaNusa AI membantu mahasiswa belajar kesehatan dengan bahasa sederhana, contoh sehari-hari, dan kuis interaktif — tanpa menggantikan dosen, buku ajar, atau tenaga kesehatan.
```

**Copywriting dokter/klinik:**

```text
VitaNusa AI membantu tenaga kesehatan menyusun edukasi pasien yang lebih mudah dipahami, konsisten, dan amanah. Keputusan medis tetap berada pada tenaga kesehatan.
```

---

## Batch 3 — Lanjutan

### JOB 7 — Buat halaman Paket VitaNusa AI

**Rekomendasi path:**

- `paket.html`

**Isi halaman:**

- Hero “Paket VitaNusa AI”.
- Paket Gratis, Plus, Pro, Klinik/Edukator.
- Section “Untuk Siapa VitaNusa AI?”.
- CTA WhatsApp.
- Harga “Segera hadir” atau “Tanya admin” jika belum ada keputusan harga.

**Acceptance criteria:**

- Mobile responsive.
- Tidak ada harga palsu.
- Tidak ada klaim medis berlebihan.
- CTA WhatsApp amanah.
- Jangan ubah root `index.html` kecuali ada instruksi eksplisit.

---

### JOB 8 — Strategi agar dipakai mahasiswa

**Use case:**

1. Belajar konsep kesehatan dasar.
2. Membuat ringkasan artikel edukatif.
3. Latihan kuis kesehatan.
4. Membuat catatan kebiasaan sehat.
5. Menyusun pertanyaan sebelum konsultasi.
6. Membuat bahan presentasi edukasi.
7. Membuat konten promosi kesehatan kampus.
8. Belajar membedakan mitos vs fakta.

**Fitur yang disiapkan:**

- Mode Belajar.
- Kuis edukasi.
- Ringkasan artikel.
- Flashcard kesehatan.
- Template presentasi.
- VitaGame.
- VitaStory / komik edukatif.

---

### JOB 9 — Strategi agar dipakai dokter / klinik

**Use case:**

1. Membuat edukasi pasien dengan bahasa sederhana.
2. Membuat FAQ klinik.
3. Menyiapkan materi pencegahan.
4. Membantu pasien memahami kebiasaan sehat.
5. Membuat template pesan edukasi WhatsApp.
6. Menyusun konten promosi kesehatan yang aman.

**Batasan:**

VitaNusa AI adalah alat bantu edukasi, komunikasi, dan konten kesehatan. Bukan alat diagnosis, bukan pemberi resep, dan bukan pengganti keputusan klinis.

---

### JOB 10 — Checklist QA jawaban VitaNusa AI

Sebelum merge, cek:

1. Apakah jawaban terlalu panjang?
2. Apakah paragraf mudah dibaca?
3. Apakah poin-poin rapi?
4. Apakah ada klaim medis berlebihan?
5. Apakah ada diagnosis pasti?
6. Apakah ada instruksi obat berisiko?
7. Apakah kondisi darurat diarahkan ke bantuan medis?
8. Apakah produk ditulis amanah?
9. Apakah CTA jelas?
10. Apakah bahasa ramah dan membumi?

---

## Prompt kerja ringkas untuk Codex

```text
Audit repo VitaNusa-AI dan kerjakan job sesuai urutan pada docs/job-malam-vitanusa-ai-2026-07-10.md.

Fokus Batch 1 dulu:
1. Rapikan format jawaban VitaNusa AI.
2. Buat template jawaban berdasarkan intent.
3. Perbaiki fallback jawaban AI.

Jangan mengubah root index.html, service-worker.js, manifest.webmanifest, halaman produk, artikel, komik, atau backend lain yang tidak terkait.

Jaga batasan kesehatan:
- tidak diagnosis pasti
- tidak resep obat
- tidak klaim sembuh
- emergency diarahkan ke bantuan medis
- produk ditulis amanah

Setelah selesai, laporkan file yang dibaca, file yang diubah, ringkasan perubahan, hasil test, dan risiko yang tersisa.
```

---

## Definisi selesai

Pekerjaan dianggap selesai jika:

- Jawaban VitaNusa AI lebih rapi.
- Fallback lebih ramah.
- Template intent lebih jelas.
- Poin-poin chat lebih nyaman dibaca.
- Konsep paket berlangganan siap dipakai.
- Ada arah jelas untuk mahasiswa, dokter, klinik, dan edukator.
- Tidak ada klaim kesehatan atau produk yang berlebihan.
