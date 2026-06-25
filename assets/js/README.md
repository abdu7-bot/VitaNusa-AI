# JavaScript VitaNusa AI

Folder ini menyimpan JavaScript terpisah agar kode website lebih rapi, mudah dirawat, dan siap dikembangkan bertahap.

## Struktur

```text
assets/js/
  main.js
  modules/
    nav.js
    premium-ui.js
    nusa-chat.js
    nusa-knowledge.js
    nusa-articles-map.js
    vitacheck.js
```

## Peran file utama

- `main.js` adalah bootstrap modul. File ini menjadi pintu masuk utama, memanggil modul kecil, dan menjaga inisialisasi tetap rapi.
- `modules/nusa-chat.js` menangani render chat Nusa AI: form, bubble chat, log percakapan, dan action button kontekstual.
- `modules/nusa-knowledge.js` adalah router utama Nusa AI. File ini menangani intent, prioritas keamanan, jawaban pendek, serious complaint, diagnosis, product suitability, produk bukan jalan pintas, VitaCheck, artikel, kontak, dan fallback.
- `modules/nusa-articles-map.js` adalah peta artikel. File ini memetakan keyword pertanyaan ke artikel VitaNusa AI yang benar-benar tersedia.
- `modules/vitacheck.js` menangani logika VitaCheck.
- `modules/nav.js` menangani navigasi mobile untuk halaman yang masih memakai navigasi.
- `modules/premium-ui.js` menangani sentuhan UI ringan/premium yang aman untuk halaman.

## Catatan pengembangan

- Jangan menumpuk logic chatbot di `index.html`. Letakkan logika percakapan di modul agar struktur website tetap bersih dan mudah dirawat.
- Untuk tahap frontend rule-based, jangan menaruh API key di file JavaScript, HTML, atau CSS.
- Nusa AI saat ini masih rule-based frontend. Jangan menambahkan backend, OpenAI API, login, database AI, atau external library sebelum knowledge, artikel, dan Prinsip Amanah stabil.
- Untuk pertanyaan produk, alur aman adalah Prinsip Amanah terlebih dahulu, lalu katalog sebagai informasi reseller.
- Untuk pertanyaan produk sebagai jalan pintas, arahkan ke artikel Produk Bukan Jalan Pintas dan Prinsip Amanah.
- Untuk keluhan berat, jangan arahkan ke produk. Prioritaskan tenaga kesehatan.
- Untuk diagnosis, tolak dengan aman. VitaCheck hanya refleksi kebiasaan, bukan alat diagnosis.
- Jika `nusa-knowledge.js` berubah, update cache import di `nusa-chat.js`.
- Jika `nusa-chat.js` berubah, update cache import di `main.js`.
- Jika `main.js` berubah, update cache script di `index.html`.
