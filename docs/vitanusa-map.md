# Peta Besar VitaNusa AI

## 1. Identitas Platform

**Nama:** VitaNusa AI  
**Arah:** Edukasi kesehatan, Navigator Kesehatan Multi-Bidang non-diagnostik, refleksi hidup, literasi produk, VitaCheck, dan katalog reseller berbasis AI.  
**Prinsip:** Amanah, edukatif, tidak berlebihan dalam klaim, dan tidak menggantikan tenaga medis.

VitaNusa AI dibangun untuk membantu masyarakat memahami kesehatan secara lebih sederhana, bijak, dan membumi. Fokus utamanya bukan menjual produk secara agresif, tetapi membangun pemahaman terlebih dahulu.

## 2. Visi

Menjadi platform edukasi kesehatan berbasis AI yang membantu masyarakat lebih bijak memahami tubuh, kebiasaan hidup, produk kesehatan, dan informasi kesehatan tanpa terjebak klaim berlebihan.

## 3. Misi

1. Menyediakan artikel edukasi kesehatan yang mudah dipahami.
2. Membantu pengguna melakukan refleksi kebiasaan sehat melalui VitaCheck.
3. Membantu masyarakat menilai klaim produk dengan lebih kritis.
4. Menghadirkan katalog produk secara amanah dan tidak manipulatif.
5. Menggunakan AI sebagai alat bantu edukasi, bukan sebagai pengganti dokter.
6. Menghadirkan ruang edukasi kesehatan multi-bidang dengan emergency gate, sumber, dan rujukan aman.
7. Menjaga prinsip kejujuran, manfaat, privasi, biaya nol, dan tanggung jawab dalam setiap fitur.

## 4. Struktur Website

### 4.1 Beranda

Beranda adalah pintu utama VitaNusa AI. Implementasi saat ini memakai pendekatan **chat-only**: pengguna langsung bertemu Nusa Chat, bukan landing page besar.

Isi utama:

- Nusa Chat edukatif
- Prompt cepat untuk VitaCheck, artikel, klaim produk, dan Prinsip Amanah
- Disclaimer bahwa AI bukan diagnosis, resep, fatwa final, atau konsultasi profesional
- Global sidebar sebagai navigasi utama publik

Tujuan halaman:

- Membuat pengguna langsung paham fungsi VitaNusa AI
- Mengarahkan pengguna ke VitaCheck
- Menjelaskan bahwa VitaNusa AI adalah edukasi, bukan diagnosis

### 4.2 VitaCheck

VitaCheck adalah fitur cek kebiasaan sehat sederhana.

Area pertanyaan:

1. Pola tidur
2. Minum air
3. Pola makan
4. Aktivitas fisik
5. Pencernaan
6. Rasa lelah atau energi harian

Hasil VitaCheck:

- Skor kebiasaan sehat
- Ringkasan kondisi umum
- Fokus perbaikan mingguan
- Rekomendasi artikel terkait
- Catatan kapan harus ke dokter

Batasan:

VitaCheck tidak boleh disebut sebagai diagnosis medis.

### 4.3 Navigator Kesehatan Multi-Bidang

Navigator Kesehatan adalah arah pengembangan Nusa Chat untuk membantu pengguna memahami keluhan secara edukatif, mengenali tanda bahaya, menemukan sumber, dan memilih tenaga kesehatan yang relevan.

Nama publik yang disetujui:

> **VitaNusa Navigator Kesehatan Multi-Bidang**

Batasan:

- bukan dokter atau dokter spesialis;
- tidak memberi diagnosis, diagnosis banding personal, resep, atau dosis;
- tidak menyuruh menghentikan obat;
- tidak menafsirkan pemeriksaan sebagai keputusan klinis final;
- tidak merekomendasikan produk dari keluhan personal;
- anak, kehamilan, penyakit kronis, obat, dan krisis mental memakai mode lebih konservatif;
- emergency gate berjalan sebelum artikel, AI, VitaCheck, dan produk;
- data kesehatan diminimalkan dan penyimpanan cloud bersifat opt-in.

Setiap jawaban kesehatan diarahkan ke format: pemahaman singkat, tanda bahaya, edukasi umum, langkah aman, hal yang dihindari, kapan mencari bantuan, pertanyaan untuk tenaga kesehatan, sumber, dan batas jawaban.

Rancangan lengkap: [`vitanusa-health-navigator-zero-cost.md`](./vitanusa-health-navigator-zero-cost.md).

### 4.4 Edukasi

Halaman edukasi berisi artikel kesehatan dasar.

Kategori:

- Kesehatan dasar
- Pencernaan
- Tidur
- Pola makan
- Mitos vs fakta
- Kapan harus ke dokter
- Literasi produk
- Testimoni dan klaim produk
- Refleksi Islami

Artikel admin menggunakan metadata cerdas agar Nusa AI memahami konteks artikel:

- `userQuestions`
- `answerSnippet`
- `problemTags`
- `audience`
- `doNotUseFor`
- `whenToSeekHelp`
- `sources`

Kondisi aktual: semua artikel admin disimpan sebagai `published`. Warning, risk high, atau sensitive flags tidak membuat artikel menjadi draft otomatis. Jika konten sensitif, artikel tetap published selama validasi teknis lolos, lalu diberi warning, sensitive flags, disclaimer, reviewer note, dan arahan aksi amanah.

Kondisi tersebut dicatat sebagai implementasi berjalan, bukan pola untuk konten AI baru. Evaluasi menuju `DRAFT → REVIEWED → APPROVED → PUBLISHED` harus dilakukan pada tugas terpisah setelah audit dampak dan perubahan policy/test; peta ini tidak mengklaim migrasi itu telah terjadi.

Tujuan:

- Meningkatkan literasi kesehatan
- Mengurangi ketergantungan pada testimoni
- Membantu pengguna memahami informasi secara rasional

### 4.5 VitaStory

VitaStory adalah ruang cerita, komik, dan refleksi.

Isi:

- Komik sehat
- Novel pendek
- Cerita keluarga
- Cerita inspiratif
- Audio story

Tujuan:

- Membuat edukasi terasa lebih manusiawi
- Menggabungkan hikmah hidup dengan kebiasaan sehat
- Menyampaikan pesan tanpa menggurui

### 4.6 Produk

Halaman produk berisi katalog reseller.

Isi:

- Produk pilihan
- Produk promo
- FAQ produk
- Catatan amanah
- Disclaimer klaim produk

Prinsip produk:

1. Tidak menjanjikan kesembuhan.
2. Tidak membuat klaim medis tanpa dasar.
3. Tidak memakai testimoni sebagai bukti utama.
4. Menjelaskan produk sebagai opsi pendukung, bukan solusi mutlak.
5. Mengarahkan pengguna untuk membaca komposisi dan aturan pakai.

Alur aman publik: VitaCheck -> Artikel -> Prinsip Amanah -> Produk.

### 4.7 Video AI

Halaman Video AI berisi konten visual edukatif.

Kategori:

- Video edukasi
- Video cerita
- Video produk
- Video refleksi
- Video mitos vs fakta

Batasan:

Video tidak boleh membuat klaim berlebihan, menakut-nakuti, atau memanipulasi emosi pengguna secara tidak etis.

### 4.8 Blog

Blog berisi artikel panjang dan catatan edukasi.

Tema:

- Kesehatan
- Refleksi hidup
- Literasi produk
- AI dan edukasi
- Catatan perjalanan VitaNusa AI

### 4.9 FAQ

FAQ menjelaskan:

- Apa itu VitaNusa AI
- Batasan AI
- Disclaimer kesehatan
- Privasi pengguna
- Cara menghubungi admin
- Pertanyaan tentang produk
- Kebijakan nol biaya, batas kuota, dan ketersediaan AI

### 4.10 Kontak

Kontak berisi:

- WhatsApp
- Email
- Instagram
- TikTok

Catatan:

Media sosial dapat dikosongkan terlebih dahulu jika belum aktif.

## 5. Arsitektur Nol Biaya

Target biaya layanan digital tahap awal adalah **Rp0 per bulan**.

Aturan:

1. Tidak memasukkan kartu atau payment method.
2. Tidak menautkan cloud billing.
3. Tidak memakai API atau fallback berbayar.
4. Layanan gratis berhenti saat kuota habis.
5. Model lokal menjadi jalur utama AI.
6. Data kesehatan sensitif tidak dikirim ke AI publik yang tidak disetujui.
7. Situs statis, policy rule-based, dan rujukan aman tetap tersedia ketika AI lokal tidak aktif.
8. AI publik 24/7 tidak dijanjikan pada arsitektur Rp0.

| Komponen | Pilihan Rp0 |
|---|---|
| Situs publik | HTML/CSS/JS dan Vite yang sudah ada + GitHub Pages |
| CI | GitHub Actions standard runner pada repository publik |
| Penyimpanan default | IndexedDB/local-first |
| Cloud opsional | Firebase Spark tanpa billing dan dengan consent |
| AI teks | Ollama/llama.cpp dengan model lokal yang disetujui |
| Pencarian | SQLite FTS5 atau indeks JSON lokal |
| API sumber | provider gratis dengan cache, hard quota, dan hard stop |

`Rp0` berarti tidak ada tagihan langganan, API, atau cloud. Listrik, internet, perangkat yang sudah dimiliki, waktu kerja, dan review tenaga kesehatan tetap mempunyai biaya nyata.

Dokumen rinci: [`api-inventory-free-tier-2026.md`](./api-inventory-free-tier-2026.md) dan [`vitanusa-health-navigator-zero-cost.md`](./vitanusa-health-navigator-zero-cost.md).
## 6. Prinsip Amanah VitaNusa AI

VitaNusa AI harus menjaga prinsip:

1. Jujur dalam informasi.
2. Tidak memakai klaim palsu.
3. Tidak menakut-nakuti pengguna.
4. Tidak menjadikan AI sebagai dokter.
5. Tidak menjanjikan hasil instan.
6. Tidak menjual produk dengan manipulasi.
7. Mengutamakan edukasi sebelum promosi.
8. Mengarahkan pengguna ke dokter saat ada tanda bahaya.

## 7. Disclaimer Utama

VitaNusa AI adalah platform edukasi kesehatan berbasis AI. Informasi yang diberikan bersifat umum dan tidak menggantikan nasihat dokter, diagnosis medis, pemeriksaan langsung, atau pengobatan profesional.

Jika pengguna mengalami gejala berat, nyeri hebat, sesak napas, pingsan, perdarahan, reaksi alergi serius, atau kondisi darurat lainnya, pengguna harus segera menghubungi tenaga medis atau fasilitas kesehatan terdekat.

## 8. Arah Pengembangan

Status wajib dibedakan menjadi `completed`, `partial`, `planned`, `blocked`, dan `future`.

### Tahap 1 — Fondasi publik

- Website statis
- Artikel edukasi
- VitaCheck dasar
- Katalog produk
- Tombol WhatsApp
- Disclaimer dan Prinsip Amanah

### Tahap 2 — Konten, akun, dan keamanan

- Admin artikel dan metadata
- Search/filter artikel
- Login dan riwayat VitaCheck
- Content rendering security
- Pemisahan data kesehatan dan bisnis
- Consent, retensi, dan penghapusan data

### Tahap 3 — Navigator kesehatan dasar

- Emergency gate terstruktur
- Intake minimum tanpa identitas penuh
- Kontrak jawaban kesehatan
- Source/evidence registry
- Pemisahan keluhan personal dari produk
- Ruang edukasi dewasa umum, pencernaan, tidur, dan kebiasaan

### Tahap 4 — Multi-bidang dan AI lokal

- Router ruang edukasi
- Literasi obat, nutrisi, kulit, dan otot-sendi
- Mode konservatif anak, kehamilan, penyakit kronis, dan mental
- Ollama/llama.cpp lokal
- Claim, citation, authority, privacy, dan budget gates
- Tidak ada fallback berbayar

### Tahap 5 — Validasi dan pilot

- Golden test set bahasa Indonesia
- Adversarial safety test
- Review tenaga kesehatan
- Audit false negative/false positive/harmful omission
- Pilot edukasi terbatas
- Kanal koreksi dan penarikan
- Tanpa klaim dokter, diagnosis, atau spesialis
## 9. Catatan Pengembangan

VitaNusa AI tidak boleh hanya menjadi website yang terlihat indah. Ia harus menjadi platform yang berguna, jujur, dan menjaga pengguna dari informasi kesehatan yang menyesatkan.

Tujuan akhirnya bukan sekadar membuat pengguna kagum pada AI, tetapi membantu mereka lebih paham, lebih hati-hati, dan lebih bertanggung jawab terhadap kesehatan.
