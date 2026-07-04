# Roadmap VitaNusa AI

Roadmap ini menjadi peta pengembangan bertahap agar VitaNusa AI tidak hanya terlihat menarik, tetapi juga berguna, amanah, dan siap dikembangkan menjadi platform edukasi kesehatan berbasis AI.

## Tahap 1 — Fondasi Website

Fokus:

- Website statis yang rapi
- Beranda jelas
- Navigasi lengkap
- Artikel edukasi dasar
- VitaCheck sederhana
- Katalog produk reseller
- Tombol WhatsApp
- Disclaimer kesehatan

Target:

Pengguna langsung memahami bahwa VitaNusa AI adalah platform edukasi, bukan alat diagnosis medis.

## Tahap 2 — Konten dan Struktur

Fokus:

- Admin artikel
- Kategori artikel
- Search artikel
- Halaman produk yang lebih rapi
- FAQ produk
- FAQ kesehatan umum
- Catatan amanah produk
- Halaman kontak
- Global sidebar sebagai navigasi publik utama
- Metadata artikel cerdas untuk Nusa AI

Target:

Konten mudah dikelola dan pengguna lebih mudah menemukan informasi yang mereka butuhkan.

Status implementasi terbaru:

- Partial: admin artikel Firestore, import satu blok, artikel published publik, search/filter artikel, FAQ, produk amanah, dan global sidebar sudah ada.
- Partial: Nusa AI memakai artikel Firestore published sebagai sumber rekomendasi dan membaca `userQuestions`, `problemTags`, `answerSnippet`, `doNotUseFor`, `whenToSeekHelp`, dan `sources`.
- Planned: modul CRUD produk, FAQ dinamis, media manager penuh, user login publik, payment/subscription nyata, dan dashboard tim.

Kebijakan artikel admin:

- Semua artikel admin disimpan sebagai `published`.
- Warning bukan draft.
- Konten sensitif tetap published jika validasi teknis lolos.
- Validasi teknis yang memblokir hanya title/slug/summary/content kosong, slug duplikat/format rusak, `<script>`, atau full document HTML.

## Tahap 3 — Fitur Pengguna

Fokus:

- Login pengguna
- Riwayat VitaCheck
- Hasil cek mingguan
- Rekomendasi artikel terkait
- Chat edukasi AI terbatas
- Paket Gratis, Plus, dan Pro

Target:

VitaNusa AI mulai menjadi platform interaktif, bukan hanya website bacaan.

## Tahap 4 — AI Premium

Fokus:

- Analisis label produk
- Analisis klaim produk
- Analisis testimoni
- Ringkasan dokumen panjang
- Rencana kebiasaan sehat 30 hari
- Export PDF
- Sistem kredit AI

Target:

Pengguna mendapat nilai lebih dari AI, terutama untuk literasi produk dan kebiasaan sehat.

## Tahap 5 — Ultra dan Dashboard Tim

Fokus:

- Paket Ultra
- Dashboard tim
- Banyak akun dalam satu organisasi
- Konten edukasi otomatis
- Laporan bulanan
- Template caption amanah
- Template artikel edukasi
- Analisis produk massal

Target:

VitaNusa AI bisa digunakan oleh reseller, edukator, UMKM, komunitas, dan tim profesional.

## Prioritas Prinsip

Setiap tahap harus tetap menjaga:

1. Edukasi sebelum promosi.
2. Tidak membuat klaim medis berlebihan.
3. Tidak menjanjikan kesembuhan.
4. Tidak menggantikan dokter.
5. Tidak menipu pengguna dengan bahasa marketing yang kabur.
6. Menjaga privasi dan data pengguna.
7. Mengarahkan pengguna ke tenaga medis saat ada tanda bahaya.

## Catatan Teknis

Saat fitur AI mulai aktif, jangan semua permintaan memakai model paling mahal. Gunakan model routing:

- Tugas ringan: model murah atau rule-based.
- Tugas menengah: model standar.
- Tugas berat: model premium seperti GPT-5.5 untuk analisis lanjutan.

Dengan cara ini, biaya API tetap terkendali dan bisnis tidak bocor halus seperti ember retak.
