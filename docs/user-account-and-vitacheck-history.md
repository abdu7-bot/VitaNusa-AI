# Akun Pengguna dan Riwayat VitaCheck Privat

## Ringkasan

Login Google pada halaman publik VitaNusa bersifat opsional. VitaCheck tetap dapat digunakan tanpa akun, dan hasil selalu dapat disimpan secara lokal terlebih dahulu. Login tidak memindahkan atau mengunggah hasil lama secara otomatis.

Alur privasinya adalah:

1. tanpa login: VitaCheck berjalan dan hasil ringkas tersimpan di perangkat;
2. login tanpa persetujuan simpan: hasil tetap hanya berada di perangkat;
3. pengguna memilih **Simpan ke akun**: dialog menjelaskan field yang dikirim;
4. pengguna mengonfirmasi: satu ringkasan minimal dibuat pada path milik UID aktif.

VitaCheck bersifat edukatif dan reflektif. VitaCheck bukan diagnosis medis dan bukan pengganti tenaga kesehatan.

## Arsitektur autentikasi

`assets/js/modules/user-auth.js` memakai Firebase app bernama `vitanusa-public`. Modul ini menangani Google popup pada desktop, redirect pada mobile atau ketika popup diblokir, status autentikasi, dan logout.

Auth pengguna publik terpisah dari pemeriksaan admin:

- pengguna publik tidak memerlukan dokumen `admins/{uid}`;
- modul publik tidak membaca role atau status admin;
- bootstrap admin yang sudah ada tidak diubah;
- state yang diberikan ke UI hanya berisi UID, nama tampilan, email, dan URL foto HTTPS yang telah disanitasi;
- token, credential, dan objek Firebase User lengkap tidak diteruskan ke UI atau disimpan.

Untuk GitHub Pages, domain publik yang benar harus terdaftar di **Firebase Authentication → Settings → Authorized domains**, dan provider Google harus aktif. Perubahan konfigurasi Firebase dilakukan secara manual oleh owner melalui proses yang disetujui.

## Data lokal dan cloud

Data lokal dan cloud merupakan dua tempat penyimpanan terpisah.

| Lokasi | Dibuat kapan | Dihapus dari mana | Akses |
| --- | --- | --- | --- |
| localStorage perangkat | Saat hasil VitaCheck selesai | Pengaturan → Hapus hasil di perangkat ini | Browser/perangkat tersebut |
| Firestore | Hanya setelah tombol dan dialog consent dikonfirmasi | Kartu riwayat, Hapus seluruh riwayat, atau Pengaturan | UID pemilik melalui Rules |

Menghapus riwayat cloud tidak menghapus hasil lokal. Menghapus hasil lokal tidak menghapus riwayat cloud. Logout juga tidak menghapus hasil lokal.

Payload localStorage lama yang masih memuat jawaban per pertanyaan dibaca secara defensif, diubah menjadi ringkasan berbasis ID, lalu ditulis ulang tanpa jawaban mentah.

## Skema Firestore

Path dokumen:

```text
users/{uid}/vitaCheckHistory/{resultId}
```

UID berasal dari Firebase Authentication. `resultId` dibuat ketika hasil selesai, disimpan bersama ringkasan lokal, dan dipakai sebagai Document ID cloud. Penyimpanan cloud memakai transaction create-only; dokumen dengan ID yang sama tidak ditimpa.

Field dokumen yang diizinkan hanya:

```text
version
score
resultBand
focusIds
attentionIds
recommendationSlugs
source
createdAt
```

Batas validasi:

- `version`: integer `2`;
- `score`: integer 0–100;
- `resultBand`: `strong`, `medium`, atau `low`;
- `focusIds`: maksimal empat ID kategori yang dikenal;
- `attentionIds`: maksimal empat ID kategori yang dikenal;
- `recommendationSlugs`: maksimal tiga slug aman;
- `source`: tepat `vitacheck-v2`;
- `createdAt`: server timestamp yang sama dengan `request.time`.

Kategori yang dikenal adalah `tidur`, `air`, `makan`, `gerak`, `pencernaan`, `energi`, `stres`, dan `literasi`.

## Data yang disimpan

Cloud hanya menyimpan versi format, skor refleksi, kategori hasil, ID fokus mingguan, ID perhatian, slug artikel terkait, sumber, dan waktu server. Nilai ini dipakai untuk menampilkan kartu riwayat, bukan untuk membuat diagnosis atau prediksi penyakit.

## Data yang sengaja tidak disimpan

Riwayat tidak menyimpan:

- jawaban lengkap setiap pertanyaan atau label jawaban;
- keluhan, gejala bebas, atau free text;
- diagnosis, obat, atau prediksi penyakit;
- percakapan Nusa AI;
- lokasi, nomor telepon, tanggal lahir, atau alamat;
- data admin;
- password, token, access token, refresh token, service account, atau private key;
- objek Firebase User lengkap.

Data VitaCheck juga tidak dikirim ke backend Nusa AI.

## Model izin Firestore

Rules adalah pengaman utama. UI hanya membantu menjelaskan dan mencegah tindakan yang tidak disengaja.

| Operasi | Pemilik UID | Pengguna lain | Admin/owner pada UID lain | Tanpa login |
| --- | --- | --- | --- | --- |
| Create valid | Diizinkan | Ditolak | Ditolak | Ditolak |
| Get/list | Diizinkan | Ditolak | Ditolak | Ditolak |
| Update | Ditolak | Ditolak | Ditolak | Ditolak |
| Delete | Diizinkan | Ditolak | Ditolak | Ditolak |

Role admin atau owner tidak memberi akses tambahan ke riwayat pengguna. Akun yang juga memiliki role admin tetap hanya dapat membaca path pengguna miliknya sendiri sebagai pemilik UID, bukan riwayat pengguna lain.

## Menyimpan hasil

1. Selesaikan VitaCheck.
2. Hasil ringkas tersimpan lokal; tidak ada write riwayat ke Firestore.
3. Pilih **Simpan ke akun**.
4. Jika belum login, selesaikan Google Login. Setelah login, tidak ada upload otomatis.
5. Pilih **Simpan ke akun** sekali lagi.
6. Baca dialog field minimal lalu pilih **Simpan ringkasan privat**.
7. Satu dokumen dibuat menggunakan `resultId` yang sama. Klik berulang tidak membuat dokumen kedua.

Jika Firestore gagal, hasil lokal tidak dihapus. UI menampilkan bahwa penyimpanan akun belum berhasil.

## Membaca dan menghapus riwayat

`account.html#riwayat-vitacheck` memuat 12 hasil terbaru terlebih dahulu dan mengurutkan dengan `createdAt` terbaru. **Muat lebih banyak** melanjutkan pagination.

Pengguna dapat:

- menghapus satu hasil melalui tombol pada kartu dan dialog konfirmasi;
- menghapus seluruh riwayat cloud melalui dialog konfirmasi;
- menghapus hasil lokal secara terpisah di `settings.html`.

Penghapusan seluruh cloud memuat dokumen pada subkoleksi UID aktif dan menghapusnya dalam batch maksimal 200 dokumen. Proses berulang sampai subkoleksi akun aktif kosong dan menampilkan progres. Operasi ini tidak menghapus akun Google, localStorage, atau koleksi pengguna lain.

## Pengaturan privasi

`settings.html` menyediakan:

- **Simpan hasil otomatis ke akun**: terlihat dalam keadaan mati dan dinonaktifkan pada versi pertama;
- **Tampilkan pengingat riwayat**: default hidup dan hanya disimpan sebagai preferensi browser;
- **Hapus hasil di perangkat ini**: hanya localStorage VitaCheck;
- **Hapus riwayat cloud**: hanya dokumen riwayat UID aktif.

Penyimpanan otomatis cloud tidak diaktifkan karena consent harus diberikan pada setiap hasil.

## Cache dan GitHub Pages

Service worker memakai network-first untuk `account.html`, `settings.html`, `vitacheck.html`, `user-auth.js`, `vitacheck-history.js`, dan modul integrasi VitaCheck. Respons Firebase Auth, Firestore, API eksternal, data pengguna, dan riwayat tidak dimasukkan ke Cache API. PWA publik lainnya tetap memakai strategi yang sudah ada.

## Menjalankan test

Gunakan Node dan JDK 21:

```bash
npm ci
npm run check
npm run test:admin-auth
npm run test:admin-management
npm run test:user-auth
npm run test:vitacheck-history
npm run test:firestore-rules
python scripts/check_suspicious_unicode.py
git diff --check
```

Rules test memakai project demo emulator dan UID/email `.test`. Test tidak memakai data atau identifier produksi.

## Test manual sebelum deployment

### Pengguna tanpa login

1. Buka VitaCheck dan selesaikan semua pertanyaan.
2. Pastikan hasil lokal tampil.
3. Periksa Network/Firestore Emulator dan pastikan tidak ada write ke `users/*/vitaCheckHistory`.

### Login Google

1. Buka `account.html`.
2. Login dengan Google dan pastikan foto, nama, email, serta status tampil.
3. Pastikan belum ada dokumen cloud baru tanpa persetujuan.

### Simpan hasil dan double submit

1. Selesaikan VitaCheck dan pilih **Simpan ke akun**.
2. Konfirmasikan dialog.
3. Pastikan tepat satu dokumen dibuat dan riwayat muncul.
4. Tekan simpan berulang dan pastikan Document ID yang sama tidak ditimpa atau diduplikasi.

### Privasi antar pengguna dan admin

1. Dengan akun A, pastikan riwayat akun B ditolak oleh Emulator/Rules.
2. Dengan akun admin atau owner, pastikan path pengguna lain tetap ditolak.

### Penghapusan

1. Hapus satu hasil dan pastikan hanya dokumen tersebut hilang.
2. Hapus seluruh riwayat dan pastikan hanya subkoleksi UID aktif yang kosong.
3. Pastikan hasil lokal tetap ada sampai pengguna memilih penghapusan lokal terpisah.

### Offline dan mobile

1. Uji lebar 360 px dan 390 px: kartu, tombol, serta dialog tidak boleh overflow.
2. Putuskan jaringan setelah hasil selesai.
3. Pastikan hasil lokal tetap tersedia, penyimpanan cloud gagal dengan pesan aman, dan hasil tidak hilang.
4. Uji dialog dengan keyboard, Escape, Tab, dan pemulihan fokus ke tombol pemicu.

## Rollback

Jika perubahan perlu dibatalkan setelah merge:

1. identifikasi commit fitur pada GitHub;
2. buat branch rollback dari `main` dan jalankan `git revert <commit-fitur>`;
3. jalankan seluruh test frontend, admin regression, dan Firestore Rules Emulator;
4. buka PR rollback dan minta review owner;
5. setelah PR rollback disetujui dan digabung, owner memublikasikan revisi Rules sebelumnya melalui prosedur Firebase yang berwenang;
6. verifikasi bahwa default deny dan Rules admin tetap utuh.

Jangan memublikasikan Rules dari workstation atau branch yang belum ditinjau.

## Checklist privasi sebelum deployment

- [ ] Provider Google aktif dan hanya domain resmi yang diizinkan.
- [ ] Tidak ada upload otomatis setelah login atau reload.
- [ ] Dialog consent tampil sebelum setiap create cloud.
- [ ] Payload hanya memiliki delapan field yang diizinkan.
- [ ] Jawaban mentah dan free text tidak ada di localStorage baru maupun Firestore.
- [ ] Admin dan owner tidak dapat membaca riwayat UID lain.
- [ ] Delete satu dan delete seluruh hanya menyentuh UID aktif.
- [ ] Respons Auth/Firestore tidak tersimpan dalam Cache API.
- [ ] Test JS, Rules Emulator, admin regression, build, Unicode, dan diff check lulus.
- [ ] Tidak ada data produksi atau credential dalam test dan dokumentasi.
- [ ] Copy VitaCheck tetap menyatakan bukan diagnosis.
