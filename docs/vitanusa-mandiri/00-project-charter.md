# 00 — Project Charter

Status: **Proposed — Fase 0, belum diterapkan**.

## Visi

VitaNusa Mandiri bertujuan membantu masyarakat mempelajari keterampilan dasar, membantu pelaku UMKM mencatat usaha sederhana, membantu pengguna memahami uang dan stok, menyediakan literasi kesehatan yang aman, serta menghadirkan NusaAgent sebagai pendamping tanpa mengambil kendali manusia. Pengalaman dirancang untuk ponsel Android, koneksi tidak stabil, dan tingkat kemampuan digital yang beragam.

Nilai produk bukan diukur dari banyaknya fitur. Nilainya diukur dari apakah pengguna dapat memahami langkah berikutnya, memulihkan data, memeriksa perhitungan, mengekspor catatan, dan menolak saran Agent tanpa kehilangan pekerjaan.

## Masalah yang hendak dibantu

- Materi dasar sering terlalu panjang atau memakai bahasa yang mempermalukan pengguna.
- Pencatatan usaha kecil mudah tercecer, sulit dipulihkan, atau tidak transparan cara menghitungnya.
- Koneksi tidak selalu tersedia ketika transaksi harus dicatat.
- Peran pemilik dan kasir perlu dibedakan tanpa memberi platform akses global ke data privat.
- Bantuan AI berisiko terlihat meyakinkan walau nilai transaksi atau izin belum benar.
- Data kesehatan, belajar, dan usaha memiliki tujuan berbeda dan tidak boleh digabung demi kenyamanan teknis.

## Prinsip produk dan teknik

1. **Sederhana** — satu tugas utama per layar dan bahasa operasional yang pendek.
2. **Offline-first** — tindakan inti lokal tidak menunggu jaringan; status sinkron terlihat.
3. **Mobile-first** — target sentuh, layout, dan performa diuji pada Android kelas menengah.
4. **Amanah** — sumber data, estimasi, kegagalan, dan keterbatasan dijelaskan jujur.
5. **Privat** — akses mengikuti pemilik data, membership, consent, dan tujuan penggunaan.
6. **Tidak mempermalukan** — feedback belajar dan error tidak memberi label buruk pada orang.
7. **Tidak berlebihan** — laporan bukan akuntansi/pajak resmi; kesehatan bukan diagnosis.
8. **Dapat diperiksa** — rumus deterministik, audit event minimal, dan status operasi tersedia.
9. **Dapat diekspor** — pengguna dapat mengambil data yang menjadi haknya dalam format aman.
10. **Dapat dipulihkan** — backup, migration, retry, conflict state, dan rollback dirancang sejak awal.
11. **Manusia tetap mengendalikan tindakan** — Agent tidak mengeksekusi hanya karena menghasilkan teks.

## Bukan tujuan

VitaNusa Mandiri bukan pengganti sekolah formal atau guru; bukan alat diagnosis, dokter, atau tenaga kesehatan; bukan software akuntansi resmi, layanan perpajakan, perbankan, pemberi kredit, atau payroll; bukan marketplace atau ERP besar; dan bukan mesin yang mengambil keputusan keuangan tanpa manusia.

Penyelesaian pelajaran tidak menyatakan kesetaraan pendidikan formal. Ringkasan kasir tidak menyatakan kepatuhan pajak. Estimasi laba kotor bukan laba bersih. Saran kesehatan tetap mengikuti konstitusi VitaNusa dan jalur Medical Safety.

## Sasaran pengguna

- pelajar mandiri yang membutuhkan materi pendek dan ramah;
- mentor dengan consent terbatas dari pelajar;
- pemilik usaha mikro yang membutuhkan pencatatan sederhana;
- kasir yang hanya membutuhkan tugas operasional sesuai izin;
- pengguna VitaNusa umum yang tetap memakai fitur inti tanpa Mandiri;
- pengelola platform yang mengelola materi dan operasi platform, bukan data tenant.

Persona lengkap berada di [03-users-and-journeys.md](03-users-and-journeys.md).

## Indikator keberhasilan

| Area | Indikator yang dapat diuji |
| --- | --- |
| Offline | Produk dan penjualan local-only dapat dibuat, aplikasi direstart, dan data tetap ada |
| Sinkronisasi | Operation ID yang sama diterapkan maksimal sekali dan menghasilkan acknowledgement yang sama |
| Tenant | Akun anggota toko A ditolak saat membaca atau menulis workspace B |
| Transaksi | Penjualan final tidak dapat ditimpa; void menghasilkan rekaman koreksi dan movement |
| Inventori | Saldo dapat ditelusuri ke movement, bukan angka akhir tanpa asal |
| Laporan | Laporan harian dapat diekspor dan totalnya cocok dengan kalkulasi domain |
| Belajar | Pelajar dapat menyelesaikan unit singkat offline dan memahami status progres |
| Privasi | Progres belajar privat; mentor hanya melihat scope yang diberi consent |
| AI | Setiap command menghasilkan preview dan tidak dieksekusi tanpa konfirmasi valid |
| Pemulihan | Backup lokal dapat divalidasi sebelum restore dan kegagalan tidak merusak data aktif |
| Aksesibilitas | Alur inti dapat digunakan keyboard, zoom, screen reader, dan viewport 360 px |

Indikator di atas tidak menetapkan angka pengguna, pendapatan, atau keberhasilan bisnis yang belum memiliki data.

## Batas fase dan governance

Fase 0 hanya menghasilkan dokumentasi. Setiap fase implementasi memakai feature flag, PR kecil, test proporsional, review keamanan, dan jalur rollback. Cloud workspace tidak boleh dibangun sebelum pseudo-Rules diterjemahkan menjadi Rules yang diuji Emulator. Pilot tidak boleh memakai data produksi tanpa persetujuan, dukungan pengguna, backup, serta prosedur insiden.

## Definisi selesai Fase 0

Fase 0 selesai ketika batas, pilihan arsitektur, risiko, pertanyaan owner, dan backlog dapat dipakai untuk menilai PR berikutnya. Fase 0 tidak membuktikan usability, performa perangkat, biaya Firestore, atau kelayakan bisnis; hal tersebut tetap membutuhkan spike dan pilot.
