# 02 — Product Scope

Status: **Proposed**. MVP berarti cakupan produk pertama yang dapat diuji; bukan janji bahwa seluruh item akan masuk satu rilis atau satu PR.

## Batas produk

VitaNusa Mandiri menambahkan pembelajaran dasar dan pencatatan usaha di atas shell VitaNusa. Ia tidak mengubah VitaCheck menjadi penilaian kemampuan, tidak memakai progres belajar untuk keputusan finansial, dan tidak memakai transaksi untuk personalisasi kesehatan.

## NusaBelajar

### MVP

- katalog program/course dan unit pelajaran;
- pelajaran singkat dengan mode teks sederhana;
- aktivitas, latihan, dan kuis deterministik;
- progres lokal tanpa login sebagai default;
- progres cloud opsional setelah login dan consent;
- rekomendasi unit berikut berdasarkan aturan transparan;
- content package versioned dan akses offline opt-in;
- status ramah: Belum dicoba, Sedang dipelajari, Perlu latihan, Sudah dikuasai pada latihan ini;
- aksesibilitas untuk kemampuan baca rendah.

### Post-MVP

- undangan mentor dengan scope, expiry opsional, grant/revoke;
- export progres;
- paket audio yang dipilih pengguna;
- authoring workflow materi yang tervalidasi;
- achievement non-kompetitif.

### Masa depan

- cohort komunitas yang consent-based;
- adaptasi materi berbasis aturan yang dapat dijelaskan;
- dukungan bahasa lokal setelah content review.

## NusaKasir

### MVP

- satu workspace mewakili satu toko/usaha;
- produk dan kategori;
- harga beli opsional, harga jual wajib, dan status aktif;
- stok awal, movement, dan saldo terverifikasi;
- keranjang, validasi harga, pembayaran tunai, dan penjualan;
- pengeluaran sederhana;
- cash in/out manual beralasan, buka/tutup sesi kas, dan selisih kas;
- void penjualan melalui `SaleReversal` tanpa mengubah sale final;
- struk sederhana tanpa klaim fiskal;
- laporan harian dan estimasi laba kotor;
- ekspor CSV dan backup JSON;
- local-only lebih dahulu; cloud/sync berada pada fase berikutnya.

### Post-MVP

- role manager/viewer bila kebutuhan pilot membuktikan manfaat;
- lebih dari satu perangkat setelah cloud sync lulus chaos test;
- import produk dengan preview;
- pembayaran non-tunai sebagai label pencatatan, bukan payment processing.

### Masa depan

- multi-cabang;
- agregasi laporan antarcabang dengan izin eksplisit;
- integrasi printer atau barcode setelah capability/privacy review.

## VitaSheet

### MVP

- CSV produk, transaksi, stok, pengeluaran, dan progres bila diberi consent;
- backup/restore JSON dengan schema version dan preview;
- spesifikasi XLSX yang stabil;
- validasi impor produk tanpa write sebelum preview;
- neutralisasi formula injection pada seluruh nilai teks;
- audit metadata ekspor tanpa menyalin seluruh data ke log.

### Post-MVP

- workbook XLSX kaya sesuai [11-vitasheet-workbook-spec.md](11-vitasheet-workbook-spec.md);
- job online terautentikasi atau spike client-side;
- template import versioned dan error per baris.

## NusaAgent

### MVP

- membantu navigasi dan menjelaskan fitur;
- menjelaskan istilah seperti stok, selisih kas, dan estimasi laba kotor;
- membantu pelajaran tanpa memberi label kecerdasan;
- membuat draft produk/pengeluaran/latihan dari input pengguna;
- menampilkan sumber nilai draft dan meminta konfirmasi;
- tidak mengeksekusi tindakan finansial otomatis.

### Post-MVP

- command execution terbatas setelah confirmation token, permission re-check, validation, idempotency, dan audit;
- conflict explanation untuk outbox;
- preview import/export tanpa auto-submit.

## Fitur yang sengaja ditunda

Pajak kompleks, hutang-piutang, pembayaran online, payroll, barcode scanner, printer Bluetooth, multi-cabang, loyalty program, akuntansi double-entry, push notification, rekomendasi kredit, input suara, split payment, refund, dan penjualan timbang ditunda sampai keputusan owner dan bukti pilot tersedia.

## Di luar scope

- memproses pembayaran, menyimpan kartu, atau memindahkan dana;
- menghitung/menyetorkan pajak resmi;
- credit scoring, pinjaman, atau rekomendasi investasi;
- payroll dan data kepegawaian sensitif;
- marketplace dan fulfillment;
- diagnosis, resep, atau prediksi kesehatan dari data usaha/belajar;
- keputusan otomatis yang menutup kas, menghapus workspace, mengubah owner, atau mengirim laporan;
- akses platform admin ke data tenant tanpa model bantuan darurat terpisah yang belum disetujui.

## Gate MVP

| Gate | Syarat sebelum scope dinaikkan |
| --- | --- |
| UX | Alur inti lulus uji perangkat 360 px dan low-literacy review |
| Domain | Kalkulasi uang/stock/sale lulus unit dan property-style cases |
| Offline | Restart, migration, storage pressure, dan backup restore diuji |
| Cloud | Rencana 56 Rules scenarios serta idempotency/replay tests lulus; tidak boleh turun di bawah 40 tanpa review |
| Agent | Tidak ada command tanpa preview, confirm, fresh permission, dan receipt |
| Privasi | Data inventory, deletion, shared-device cleanup, dan incident playbook direview |
