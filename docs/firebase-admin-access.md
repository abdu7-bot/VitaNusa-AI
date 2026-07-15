# Akses Admin Firebase VitaNusa AI

Dokumen ini menjelaskan pendaftaran dan diagnosis akun admin tanpa Firebase Admin SDK, service account, email hardcoded, atau perubahan otomatis pada data produksi.

## Alur akses

1. Pengguna membuka `admin/login.html` dan login dengan Google.
2. Firebase Authentication memberikan identitas akun dan UID.
3. Aplikasi membaca `admins/{uid}` langsung dari server dengan `getDocFromServer()`.
4. Akses UI diberikan hanya bila dokumen ada dan `status === "active"`.
5. Firestore Rules tetap menjadi pengaman akhir untuk pembacaan dan penulisan koleksi admin.

Cache Firestore tidak dipakai sebagai bukti akhir akses admin. Jika server tidak dapat diverifikasi, akses ditolak dan pengguna diminta memeriksa ulang.

## Mendapatkan UID

1. Buka halaman login admin.
2. Tekan **Login dengan Google** dan pilih akun yang benar.
3. Salin nilai **UID** pada kartu **Diagnostik akses admin**.

Jangan mengambil UID dari tebakan, email, atau nama akun. Jangan mengirim token, service account, private key, atau isi Replit Secrets kepada siapa pun.

## Membuat dokumen admin

Di Firebase Console untuk project `vitanusa-ai`, buka Firestore Database lalu buat dokumen berikut:

```text
Collection ID: admins
Document ID: contohUidFirebase1234567890

email  (string): admin.contoh@example.invalid
role   (string): admin
status (string): active
```

Gunakan UID akun yang sebenarnya sebagai **Document ID**, bukan sebagai field tambahan. Contoh di atas sengaja palsu dan tidak boleh disalin ke produksi.

Perbandingan status bersifat ketat:

- `active` diterima;
- `aktif`, `Active`, `ACTIVE`, `true`, dan `1` ditolak;
- field yang kosong atau hilang ditolak.

Field `role` saat ini adalah metadata. Nilai `owner` dan `admin` sama-sama dapat masuk bila `status` tepat bernilai `active`. Role belum menjadi pembatas tingkat izin dan perubahan perilaku itu memerlukan keputusan desain terpisah.

## Mengapa Rules mengizinkan pembacaan dokumen sendiri

Rules memberi akun terautentikasi hak `get` read-only hanya pada `admins/{uid}` miliknya sendiri. Tujuannya agar aplikasi dapat membedakan:

- dokumen tidak ada;
- dokumen ada tetapi status bukan `active`;
- request ditolak oleh Rules.

Pengecualian ini tidak memberi hak `list`, create, update, atau delete. Akses ke dokumen admin milik akun lain dan seluruh operasi tulis tetap membutuhkan admin aktif. Koleksi artikel, draft, media internal, dan pengaturan privat juga tetap dilindungi.

Dokumen `admins/{uid}` harus tetap berisi metadata minimal seperti email, role, dan status. Jangan menyimpan token, secret, catatan privat, atau credential di dokumen ini karena pemilik UID dapat membaca dokumennya sendiri.

Jangan mengganti Rules menjadi `allow read, write: if true;` dan jangan memberi akses publik ke koleksi sensitif.

## Menguji Rules secara manual

Di Firestore Rules Playground gunakan:

```text
Operation: get
Path: admins/contohUidFirebase1234567890
Authentication: enabled
Authenticated UID: contohUidFirebase1234567890
```

Hasil yang diharapkan untuk pembacaan dokumen sendiri adalah **Allowed**. Uji tambahan:

- Authenticated UID berbeda dari UID pada path: **Denied**, kecuali akun peminta sendiri sudah admin aktif;
- operasi `list` oleh akun nonaktif: **Denied**;
- operasi create, update, atau delete oleh akun nonaktif: **Denied**;
- pembacaan atau penulisan koleksi privat oleh akun nonaktif: **Denied**.

Jangan melemahkan Rules hanya agar satu simulasi menghasilkan Allowed. Pastikan Rules yang diuji adalah Rules yang benar-benar dipublikasikan pada project `vitanusa-ai`.

## Mengenali hasil pemeriksaan

| Hasil | Arti | Tindakan |
|---|---|---|
| Admin aktif | Dokumen server ada dan status tepat `active` | Dashboard boleh dibuka |
| Dokumen tidak ditemukan | `admins/{uid}` tidak ada pada project aplikasi | Buat dokumen dengan UID yang tampil |
| Status tidak aktif | Dokumen ada, tetapi status salah, kosong, atau inactive | Perbaiki field secara manual bila akun memang berwenang |
| `firestore/permission-denied` | Rules yang dipublikasikan menolak request | Periksa Rules, UID, project, dan status admin |
| `firestore/unavailable` atau `auth/network-request-failed` | Koneksi Firebase gagal | Periksa internet lalu tekan **Periksa Ulang** |
| `firestore/deadline-exceeded` | Request melewati batas waktu | Coba sekali lagi setelah koneksi stabil |
| Konfigurasi Firebase tidak sesuai | Project ID atau Auth Domain tidak cocok | Bandingkan dengan project Firebase yang benar |
| Error tidak dikenal | Kegagalan tidak termasuk klasifikasi aman | Catat hanya kode error aman; jangan kirim token |

Pada `permission-denied`, aplikasi memaksa refresh ID token satu kali lalu mengulang pembacaan server satu kali. Pada gangguan jaringan atau timeout, aplikasi juga mencoba ulang satu kali. Tidak ada retry tanpa batas.

## Memastikan project Firebase benar

Kartu diagnostik harus menampilkan:

```text
Firebase Project ID: vitanusa-ai
```

Konfigurasi sumber juga harus memakai `authDomain: vitanusa-ai.firebaseapp.com`. Konfigurasi repository, `.firebaserc`, dan Firestore Console harus merujuk ke project yang sama. Jangan mengganti konfigurasi berdasarkan screenshot atau pesan tidak terverifikasi.

## Menonaktifkan admin

Ubah hanya field berikut secara manual:

```text
status: inactive
```

Setelah **Periksa Ulang** atau login berikutnya, akun tidak boleh membuka dashboard dan operasi Firestore yang memerlukan admin aktif harus ditolak.

## Cache GitHub Pages dan service worker

Path `/VitaNusa-AI/admin/*` menggunakan network-only pada service worker. Halaman admin dan JavaScript otorisasi tidak disimpan sebagai bukti akses offline. Website publik tetap memakai PWA dan strategi cache publik yang sudah ada.

Jika perangkat masih memakai service worker lama:

1. Chrome Android: **Setelan > Setelan situs > Semua situs > abdu7-bot.github.io > Hapus data**.
2. Buka kembali halaman admin dan login ulang.
3. Pada desktop, alternatifnya gunakan DevTools > Application > Storage > Clear site data, lalu hard reload.

GitHub Pages dapat memberi header `cache-control: max-age=600`. Versi query pada aset admin membantu memutus cache aset lama, tetapi pembersihan site data tetap berguna untuk perangkat yang lama tidak memperbarui service worker.

## Checklist manual owner

### A. Akun tidak terdaftar

- Login Google berhasil.
- UID ditampilkan.
- Hasil menyebut dokumen admin tidak ditemukan.
- Dashboard tidak terbuka.

### B. Akun berstatus inactive

- Dokumen ditemukan.
- Nilai status yang tidak valid dijelaskan tanpa menampilkan seluruh dokumen.
- Dashboard tidak terbuka.

### C. Akun berstatus active

- Pemeriksaan server berhasil.
- Status menunjukkan admin aktif.
- Dashboard terbuka.

### D. Firestore permission denied

- Pesan menyebut Firestore Rules menolak pemeriksaan.
- Pesan tidak menyebut dokumen hilang.
- Kode error aman ditampilkan.

### E. Koneksi offline

- Akses tidak diberikan.
- Pesan koneksi atau timeout tampil.
- Tombol **Periksa Ulang** tersedia setelah request selesai.

### F. Cache lama

- Hapus site data atau lakukan hard reload.
- Pastikan Project ID dan pesan diagnostik versi baru tampil.
- Ulangi kasus C dengan akun aktif.

Pengujian login nyata harus dilakukan manual oleh owner. Jangan mengirim token, cookie, service account, atau screenshot UID dan email tanpa sensor.

## Rollback

1. Revert commit perubahan admin melalui pull request baru; jangan force push ke `main`.
2. Pulihkan versi Rules sebelumnya dari riwayat Git.
3. Review bahwa Rules lama tetap menolak akses publik.
4. Publikasikan Rules yang telah direview ke project `vitanusa-ai` melalui proses Firebase yang biasa digunakan owner.
5. Bersihkan site data dan ulangi checklist manual.

Rollback frontend tidak otomatis mengubah Rules produksi, dan merge GitHub tidak sama dengan deployment Rules. Keduanya harus ditinjau sebagai langkah terpisah.
