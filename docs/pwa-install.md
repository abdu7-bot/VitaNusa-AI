# VitaNusa AI PWA Install

## Status
VitaNusa AI sudah disiapkan sebagai Progressive Web App.

## File PWA
- manifest.webmanifest
- service-worker.js
- images/icon-192.png
- images/icon-512.png
- index.html
- assets/js/main.js

## Cara test lokal
1. Jalankan frontend:
   npm run dev

2. Buka:
   http://localhost:5173

3. Buka Chrome DevTools:
   Application > Manifest
   Application > Service Workers

4. Pastikan:
   - manifest terbaca
   - icon tidak 404
   - service worker registered
   - tidak ada error fatal di console

## Cara test di GitHub Pages
Buka:

https://abdu7-bot.github.io/VitaNusa-AI/

Di Chrome Android:
1. Tap menu titik tiga
2. Pilih Install app atau Tambahkan ke layar utama

Di Chrome/Edge desktop:
1. Lihat ikon install di address bar
2. Klik Install

## Catatan penting
- PWA membutuhkan HTTPS.
- GitHub Pages sudah mendukung HTTPS.
- FastAPI backend tetap harus online agar Nusa AI menjawab dari server.
- Service worker tidak boleh cache request POST /ask.
- Jangan simpan data kesehatan sensitif di cache.

## Troubleshooting
Jika belum muncul tombol install:
- Hard refresh
- Clear site data
- Cek Application > Manifest
- Cek Application > Service Workers
- Pastikan service-worker.js tidak 404
- Pastikan icon-192.png dan icon-512.png tidak 404
