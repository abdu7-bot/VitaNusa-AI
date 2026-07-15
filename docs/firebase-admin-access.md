# Akses Admin Firebase VitaNusa AI

Dokumen ini menjelaskan pendaftaran dan diagnosis akun admin tanpa Firebase Admin SDK, service account, email hardcoded, atau perubahan otomatis pada data produksi.

## Alur akses

1. Pengguna membuka `admin/login.html` dan login dengan Google.
2. Firebase Authentication memberikan identitas akun dan UID.
3. Aplikasi membaca `admins/{uid}` langsung dari server dengan `getDocFromServer()`.
4. Akses UI diberikan hanya bila dokumen ada, `status === "active"`, dan `role` tepat bernilai `owner` atau `admin`.
5. Firestore Rules tetap menjadi pengaman akhir untuk pembacaan dan penulisan koleksi admin.

Cache Firestore tidak dipakai sebagai bukti akhir akses admin. Jika server tidak dapat diverifikasi, akses ditolak dan pengguna diminta memeriksa ulang.

## Mendapatkan UID

1. Buka halaman login admin.
2. Tekan **Login dengan Google** dan pilih akun yang benar.
3. Salin nilai **UID** pada kartu **Diagnostik akses admin**.

Jangan mengambil UID dari tebakan, email, atau nama akun. Jangan mengirim token, service account, private key, atau isi Replit Secrets kepada siapa pun.

## Membuat dokumen admin

Dalam aplikasi, hanya owner aktif yang boleh membuat dokumen admin. Karena halaman pengelolaan admin belum tersedia, project owner yang berwenang masih dapat melakukan bootstrap atau pemulihan melalui Firebase Console. Perlu diingat bahwa Firebase Console memakai hak project dan tidak dibatasi oleh client Rules, sehingga perubahan manual wajib direview dengan ketat.

Contoh data pengujian yang valid:

```text
Collection ID: admins
Document ID: owner-test-uid

email  (string): owner@example.test
role   (string): owner
status (string): active
```

Di produksi, gunakan UID akun yang telah diverifikasi sebagai **Document ID**, bukan sebagai field tambahan. Contoh di atas sengaja palsu dan tidak boleh disalin ke produksi.

Perbandingan status bersifat ketat:

- `active` diterima;
- `aktif`, `Active`, `ACTIVE`, `true`, dan `1` ditolak;
- field yang kosong atau hilang ditolak.

Perbandingan role juga ketat: hanya `owner` dan `admin` yang diterima. Role tidak ditentukan dari email, domain email, nama pengguna, atau daftar email hardcoded.

Dokumen admin wajib memiliki tepat tiga field:

- `email`, bertipe string;
- `role`, bernilai `owner` atau `admin`;
- `status`, bernilai `active` atau `inactive`.

Field tambahan seperti `token`, `password`, `secret`, `privateKey`, dan `serviceAccount` ditolak oleh Rules.

## Perbedaan owner dan admin

| Kemampuan | Owner aktif | Admin aktif |
|---|---:|---:|
| Membaca dokumen admin sendiri | Ya | Ya |
| Membaca dokumen admin lain | Ya | Tidak |
| List atau query koleksi `admins` | Ya | Tidak |
| Membuat akun admin | Ya | Tidak |
| Mengubah email, role, atau status admin lain | Ya | Tidak |
| Menghapus admin lain | Ya | Tidak |
| Mengelola konten | Ya | Ya |

Owner aktif berarti dokumen `admins/{uid}` tersedia, `status === "active"`, dan `role === "owner"`. Admin aktif untuk pengelolaan konten berarti dokumen tersedia, status aktif, dan role bernilai `owner` atau `admin`.

Owner tidak boleh menghapus dokumen sendiri, mengubah status sendiri menjadi `inactive`, atau menurunkan role sendiri menjadi `admin`. Pembatasan ini menjaga akun yang sedang bertindak agar tidak mengunci dirinya sendiri. Perubahan terhadap owner lain tetap memerlukan kehati-hatian operasional dan audit manusia.

Firestore Rules adalah pengaman utama. Penyembunyian tombol, label role, atau nilai `canManageAdmins` di UI hanya membantu pengalaman pengguna dan bukan pengganti Rules.

## Mengapa Rules mengizinkan pembacaan dokumen sendiri

Rules memberi akun terautentikasi hak `get` read-only hanya pada `admins/{uid}` miliknya sendiri. Tujuannya agar aplikasi dapat membedakan:

- dokumen tidak ada;
- dokumen ada tetapi status bukan `active`;
- request ditolak oleh Rules.

Pengecualian ini tidak memberi hak `list`, create, update, atau delete. Hanya owner aktif yang boleh membaca dokumen admin lain, melakukan list, dan menulis koleksi admin. Admin aktif tetap dapat mengelola konten, tetapi tidak dapat mengelola akun admin.

Dokumen `admins/{uid}` harus tetap berisi metadata minimal seperti email, role, dan status. Jangan menyimpan token, secret, catatan privat, atau credential di dokumen ini karena pemilik UID dapat membaca dokumennya sendiri.

Jangan mengganti Rules menjadi `allow read, write: if true;` dan jangan memberi akses publik ke koleksi sensitif.

## Menguji Rules secara manual

Di Firestore Rules Playground gunakan:

```text
Operation: get
Path: admins/user-test-uid
Authentication: enabled
Authenticated UID: user-test-uid
```

Hasil yang diharapkan untuk pembacaan dokumen sendiri adalah **Allowed**. Uji tambahan:

- Authenticated UID berbeda dari UID pada path: **Denied**, kecuali peminta adalah owner aktif;
- operasi `list` oleh admin aktif: **Denied**;
- operasi `list` oleh owner aktif: **Allowed**;
- operasi create, update, atau delete oleh admin aktif: **Denied**;
- operasi create, update, atau delete terhadap admin lain oleh owner aktif: **Allowed** bila datanya valid;
- self-delete, self-demotion, dan self-deactivation owner: **Denied**;
- pembacaan atau penulisan koleksi privat oleh akun nonaktif: **Denied**.

Jangan melemahkan Rules hanya agar satu simulasi menghasilkan Allowed. Pastikan Rules yang diuji adalah Rules yang benar-benar dipublikasikan pada project `vitanusa-ai`.

## Menguji dengan Firebase Emulator

Pengujian otomatis memakai project ID demo dan data palsu; tidak ada koneksi ke data Firebase produksi.

```bash
npm ci
npm run test:firestore-rules
```

Perintah tersebut menjalankan Firestore Emulator lalu menguji self-read, batas owner/admin, validasi field, perlindungan owner sendiri, akses konten, public read, dan penolakan data privat. Emulator memerlukan Java yang kompatibel dengan versi Firebase CLI pada `package-lock.json`.

## Mengenali hasil pemeriksaan

| Hasil | Arti | Tindakan |
|---|---|---|
| Admin aktif | Dokumen server ada, status `active`, dan role `owner` atau `admin` | Dashboard boleh dibuka |
| Dokumen tidak ditemukan | `admins/{uid}` tidak ada pada project aplikasi | Buat dokumen dengan UID yang tampil |
| Status tidak aktif | Dokumen ada, tetapi status salah, kosong, atau inactive | Perbaiki field secara manual bila akun memang berwenang |
| Role tidak valid | Status aktif, tetapi role hilang atau bukan `owner`/`admin` | Owner memperbaiki role; jangan menentukan role dari email |
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

Hanya owner aktif yang boleh menonaktifkan admin lain melalui aplikasi. Sampai UI pengelolaan admin tersedia, project owner dapat mengubah field berikut secara manual setelah memverifikasi UID target:

```text
status: inactive
```

Owner tidak boleh menonaktifkan dirinya sendiri. Setelah **Periksa Ulang** atau login berikutnya, akun target tidak boleh membuka dashboard dan operasi Firestore yang memerlukan admin aktif harus ditolak.

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
- Status menunjukkan admin aktif dan role menampilkan **Owner** atau **Admin**.
- Dashboard terbuka.

### D. Role tidak valid

- Dokumen ditemukan dan status dapat bernilai active.
- Pesan menyebut role harus `owner` atau `admin`.
- Dashboard tidak terbuka dan penulisan konten ditolak.

### E. Batas owner dan admin

- Admin aktif tidak dapat membaca daftar atau mengubah akun admin lain.
- Owner aktif dapat mengelola akun admin lain dengan data valid.
- Owner tidak dapat menghapus, menonaktifkan, atau menurunkan role dirinya sendiri.

### F. Firestore permission denied

- Pesan menyebut Firestore Rules menolak pemeriksaan.
- Pesan tidak menyebut dokumen hilang.
- Kode error aman ditampilkan.

### G. Koneksi offline

- Akses tidak diberikan.
- Pesan koneksi atau timeout tampil.
- Tombol **Periksa Ulang** tersedia setelah request selesai.

### H. Cache lama

- Hapus site data atau lakukan hard reload.
- Pastikan Project ID dan pesan diagnostik versi baru tampil.
- Ulangi kasus C dengan akun aktif.

Pengujian login nyata harus dilakukan manual oleh owner. Jangan mengirim token, cookie, service account, atau screenshot UID dan email tanpa sensor.

## Rollback

1. Identifikasi commit Rules terakhir yang diketahui aman.
2. Revert commit perubahan melalui pull request baru; jangan force push ke `main`.
3. Jalankan `npm run test:firestore-rules`, `npm run test:admin-auth`, dan build frontend terhadap hasil revert.
4. Review bahwa versi rollback tetap menolak akses publik dan tidak mengembalikan hak pengelolaan admin kepada role `admin`.
5. Setelah persetujuan owner, publikasikan `firestore.rules` dan `storage.rules` yang telah direview melalui proses Firebase resmi.
6. Bersihkan site data dan ulangi checklist manual.

Rollback frontend tidak otomatis mengubah Rules produksi, dan merge GitHub tidak sama dengan deployment Rules. Keduanya harus ditinjau sebagai langkah terpisah.
