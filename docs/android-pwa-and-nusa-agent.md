# Android PWA dan Nusa Agent

Dokumen ini menjelaskan shell aplikasi Android PWA VitaNusa AI, Nusa Agent global, Web Share Target, mode offline, dan alur pembaruan. Implementasi tetap berupa situs HTML/CSS/JavaScript modular; tidak membuat APK, TWA, proyek Android Studio, atau publikasi Play Store.

## Batas produk dan kesehatan

Nusa Agent adalah antarmuka untuk alur Nusa Chat yang sudah ada. Pertanyaan tetap melewati endpoint backend `/ask`, sehingga Intent Router, Medical Safety, Policy Engine, knowledge VitaNusa, serta validasi jawaban tetap menjadi jalur utama. Bila backend tidak dapat dijangkau, modul Nusa Chat memakai fallback lokal yang sudah mempunyai pagar keselamatan.

Nusa Agent:

- bersifat edukatif;
- tidak mendiagnosis;
- tidak memberi dosis atau resep personal;
- tidak menjanjikan kesembuhan;
- tidak menentukan status halal tanpa bukti;
- tidak mengirim pertanyaan langsung ke provider LLM;
- tetap memprioritaskan pesan darurat untuk tanda bahaya.

## Instalasi Android

Manifest memakai URL relatif supaya satu konfigurasi dapat dipakai pada root Vite, GitHub Pages di subpath, dan domain khusus di masa depan.

Alur pengguna:

1. Buka VitaNusa dari Chrome Android.
2. Pilih tombol **Pasang VitaNusa** pada Beranda atau Pengaturan ketika tersedia.
3. Konfirmasi pemasangan pada dialog Chrome.
4. Buka ikon VitaNusa dari layar utama.
5. Aplikasi berjalan dengan `display: standalone` dan mobile bottom navigation.

Prompt pemasangan tidak dibuka otomatis. Penolakan disimpan sementara di `localStorage` tanpa identitas pengguna agar CTA ringan tidak mengganggu pada setiap reload. Halaman Pengaturan tetap menjelaskan cara memakai menu Chrome bila `beforeinstallprompt` tidak didukung.

Ikon `images/icon-192.png` dan `images/icon-512.png` valid dan opaque. Manifest menggunakan `purpose: any`. Desain saat ini belum dinyatakan maskable karena elemen tepinya belum diverifikasi mempunyai safe zone maskable yang memadai.

## Application shell

Pada viewport sampai 860 piksel, bottom navigation menyediakan:

- Beranda;
- VitaCheck;
- Tanya Nusa;
- Akun.

Desktop right rail tetap dipertahankan. Shell publik menambahkan Agent dan PWA helper melalui `initNusaUiShell()`, sehingga halaman artikel lama yang sudah memakai shell tidak perlu diduplikasi mark-upnya. Path `/admin/` diperiksa dan dikecualikan secara eksplisit.

## Nusa Agent

Pada halaman selain Beranda, Agent dibuat sebagai dialog global. Pada mobile dialog memakai tinggi visual viewport, safe-area inset, dan tampilan layar penuh. Pada desktop Agent menjadi panel kanan. Beranda menggunakan chat utama sebagai satu-satunya instance agar state, session ID, backend request, sanitasi, dan fallback tidak digandakan.

Agent mempunyai:

- quick actions yang baru berjalan setelah tindakan pengguna;
- focus trap dan pengembalian fokus;
- Escape pada desktop;
- history state agar Android Back menutup Agent lebih dahulu;
- query `?agent=open` untuk app shortcut;
- status online/offline/backend berdasarkan request aktual;
- `aria-live`, `aria-busy`, dan log chat screen-reader friendly.

Status **Online** hanya muncul setelah request backend benar-benar berhasil. `navigator.onLine` hanya dipakai untuk mendeteksi offline; nilai `true` tidak dianggap bukti backend tersedia. Tidak ada polling.

## Konteks halaman

Konteks Agent hanya dibentuk lokal untuk label dan navigasi:

- route key;
- judul halaman;
- jenis halaman;
- slug artikel atau produk yang aman;
- indikator bahwa VitaCheck sedang dibuka.

Konteks tidak ditambahkan ke request backend. Modul tidak membaca input formulir, email, UID, jawaban atau hasil VitaCheck, Firestore, seluruh teks halaman, tab lain, aplikasi lain, layar, notifikasi, maupun clipboard.

## Android Share Target

Manifest mendaftarkan `share-target.html` dengan metode GET dan parameter `title`, `text`, serta `url`.

Alurnya:

1. Pengguna memilih VitaNusa dari menu Bagikan Android.
2. Share Target membaca dan menormalkan parameter.
3. Halaman menampilkan preview plain text.
4. Pengguna meninjau catatan privasi dan sumber.
5. Hanya setelah menekan **Tanya Nusa**, Agent dibuka dengan draft.
6. Draft belum dikirim sampai pengguna menekan tombol kirim di Agent.

URL hanya menerima protokol `http:` dan `https:`. `javascript:`, `data:`, `file:`, `intent:`, dan `content:` ditolak. VitaNusa tidak melakukan fetch terhadap URL yang dibagikan dan tidak menyimpan draft ke server atau Cache API.

Service worker mengambil shell `share-target.html` tanpa query, sehingga parameter pengguna tidak diteruskan sebagai URL fetch ke origin. Halaman juga memakai kebijakan referrer `no-referrer` dan segera membersihkan query dari address bar setelah draft dibaca. Pengguna tetap harus menghindari membagikan data pribadi karena parameter GET sempat hadir secara lokal pada URL navigasi Android.

Batas input:

- judul: 200 karakter;
- teks: 4.000 karakter;
- URL: 2.048 karakter.

## Offline dan cache

Service worker menghitung base dari `self.registration.scope`. Strateginya:

- navigasi publik: network-first, lalu cache halaman, lalu `offline.html`;
- aset statis same-origin: stale-while-revalidate;
- admin: network-only;
- request non-GET: tidak dicache;
- `/ask`, `/health`, dan `/feedback`: tidak dicache;
- Firebase Auth dan Firestore: tidak dicache;
- query Share Target: tidak menjadi cache key.

`offline.html` menjelaskan bahwa backend tidak tersedia dan respons lokal hanya dapat digunakan bila modulnya sudah tersimpan. Tidak ada background sync chat dan tidak ada data kesehatan yang disimpan di Cache API.

## Pembaruan aplikasi

Worker baru tidak memanggil `skipWaiting()` saat instalasi. Ketika worker menunggu, UI menampilkan:

- **Perbarui sekarang**;
- **Nanti**.

Pesan `SKIP_WAITING` hanya dikirim setelah tombol pembaruan ditekan. Pembaruan ditahan bila pengguna sedang mengetik chat, mengisi VitaCheck, atau elemen lain menandai state edit/busy. Setelah `controllerchange`, halaman reload satu kali; first install tidak memicu reload otomatis.

## Pengujian otomatis

Jalankan:

```bash
npm ci
npm run check
npm run test:android-pwa
npm run test:admin-auth
npm run test:admin-management
npm run test:user-auth
npm run test:vitacheck-history
npm run test:firestore-rules
```

Pemeriksaan tambahan:

```bash
node --check assets/js/modules/pwa-install.js
node --check assets/js/modules/nusa-agent.js
node --check assets/js/modules/share-target.js
node --check assets/js/modules/nusa-chat.js
node --check assets/js/modules/chat-viewport.js
node --check service-worker.js
python scripts/check_suspicious_unicode.py
git diff --check
```

## Checklist manual Android

1. Uji install dari Chrome Android pada domain HTTPS resmi.
2. Buka ikon dan pastikan mode standalone aktif.
3. Uji 360×800, 390×844, 412×915, dan 430×932.
4. Pastikan bottom navigation tidak menutupi tombol.
5. Buka Agent, tampilkan keyboard, rotasikan perangkat, dan pastikan input tetap terlihat.
6. Tekan Android Back dan pastikan Agent tertutup sebelum navigasi halaman.
7. Uji quick actions dan respons tanda bahaya.
8. Matikan jaringan dan pastikan status offline serta fallback jujur.
9. Bagikan teks dan tautan dari aplikasi lain; pastikan tidak terkirim otomatis.
10. Uji URL dengan protokol terlarang dan string HTML.
11. Uji update worker saat chat/VitaCheck kosong dan saat sedang diisi.
12. Pastikan request Auth, Firestore, dan backend tidak muncul di Cache Storage.

## Rollback

Untuk rollback kode:

1. Revert commit fitur melalui pull request baru.
2. Naikkan `CACHE_NAME` pada service worker rollback agar cache lama dibersihkan saat aktivasi.
3. Pertahankan handler cache admin network-only serta pengecualian Firebase/backend.
4. Hapus `share_target` dari manifest bila halaman Share Target ikut dirollback.
5. Uji install, offline, dan update sebelum memublikasikan ulang.

Rollback repository tidak otomatis memublikasikan GitHub Pages atau service worker. Deployment dan publikasi tetap tindakan manual pemilik repository setelah review.
