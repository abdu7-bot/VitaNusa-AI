# Review Kandidat Konten — Menghitung Uang Sederhana

Status paket: `draft`

Status review: `pending_human_review`

Dokumen ini menampilkan materi dan kunci jawaban untuk pemeriksaan manusia. Hasil validator dan test membantu menemukan kesalahan teknis, tetapi tidak menggantikan keputusan content reviewer.

## Struktur materi

- Program: **Keterampilan Dasar Sehari-hari**
- Course: **Menghitung Uang Sederhana**
- Module: **Belanja dan Kembalian**
- Lesson 1: **Membaca Harga**
- Lesson 2: **Menjumlahkan Dua Harga**
- Lesson 3: **Menghitung Kembalian Sederhana**

## Learning objective

- Course: Pengguna dapat melakukan perhitungan uang sederhana untuk kebutuhan sehari-hari.
- Module: Pengguna dapat membaca harga, menjumlahkan dua harga, dan menghitung kembalian sederhana.
- Membaca Harga: Pengguna dapat membaca angka rupiah pada label harga sederhana.
- Menjumlahkan Dua Harga: Pengguna dapat menjumlahkan dua harga dalam rupiah.
- Menghitung Kembalian Sederhana: Pengguna dapat menghitung kembalian dari pembayaran sederhana.

## Contoh angka yang harus diperiksa

- `Rp8.000` ditampilkan sebagai delapan ribu rupiah dan memakai integer `8000` untuk perhitungan.
- Buku tulis `Rp8.000`, pensil `Rp3.000`, dan penghapus `Rp2.000`.
- `8000 + 3000 = 11000`.
- `5000 + 7000 = 12000`.
- `4000 + 6000 = 10000`.
- `3000 + 7000 = 10000`.
- `5000 + 4000 = 9000`, bukan `10000`.
- `20000 - 13000 = 7000`.
- `15000 - 10000 = 5000`.

## Activity

1. `read_example` — Perhatikan tiga label harga dan cocokkan nama barang dengan harga tertulis. Activity ini tidak memiliki score.
2. `observe_sequence` — Perhatikan urutan menulis dua angka, menjumlahkan, lalu memeriksa hasil. Activity ini tidak memiliki score.
3. `observe_sequence` — Perhatikan urutan membaca total, membaca uang dibayar, mengurangi, lalu memeriksa hasil. Activity ini tidak memiliki score.

## Exercise dan kunci jawaban

### Lesson 1 — Membaca Harga

1. **Harga buku tulis adalah ...**
   - Tipe: `single_choice`
   - Pilihan: `Rp6.000`, `Rp8.000`, `Rp10.000`
   - Jawaban benar: `choice-read-price-8000-id` (`Rp8.000`)
   - Explanation: Rp8.000 berarti delapan ribu rupiah.
2. **Tuliskan angka untuk harga Rp3.000.**
   - Tipe: `numeric_input`
   - Jawaban benar: integer `3000`
   - Explanation: Rp3.000 ditulis sebagai angka 3000 untuk perhitungan.
3. **Apa nama mata uang pada contoh ini?**
   - Tipe: `short_text_exact`
   - Jawaban diterima: `rupiah`
   - Case-sensitive: tidak
   - Explanation: Rp adalah tanda untuk mata uang rupiah.

### Lesson 2 — Menjumlahkan Dua Harga

1. **Rp8.000 + Rp3.000 = ...**
   - Tipe: `numeric_input`
   - Jawaban benar: integer `11000`
   - Explanation: Delapan ribu ditambah tiga ribu adalah sebelas ribu.
2. **Rp5.000 + Rp7.000 = ...**
   - Tipe: `single_choice`
   - Pilihan: `Rp10.000`, `Rp12.000`, `Rp14.000`
   - Jawaban benar: `choice-add-price-12000-id` (`Rp12.000`)
   - Explanation: Lima ribu ditambah tujuh ribu adalah dua belas ribu.
3. **Pilih semua pasangan yang jumlahnya Rp10.000.**
   - Tipe: `multiple_choice`
   - Jawaban benar: `choice-pair-4000-6000-id` dan `choice-pair-3000-7000-id`
   - Bukan jawaban: `choice-pair-5000-4000-id`
   - Explanation: Empat ribu ditambah enam ribu dan tiga ribu ditambah tujuh ribu sama-sama berjumlah sepuluh ribu.

### Lesson 3 — Menghitung Kembalian Sederhana

1. **Total Rp13.000, dibayar Rp20.000. Berapa kembaliannya?**
   - Tipe: `numeric_input`
   - Jawaban benar: integer `7000`
   - Explanation: Kembalian dihitung dengan Rp20.000 - Rp13.000 = Rp7.000.
2. **Total Rp10.000, dibayar Rp15.000. Berapa kembaliannya?**
   - Tipe: `numeric_input`
   - Jawaban benar: integer `5000`
   - Explanation: Kembalian dihitung dengan Rp15.000 - Rp10.000 = Rp5.000.
3. **Susun urutan menghitung kembalian.**
   - Tipe: `sequence`
   - Jawaban benar:
     1. `choice-change-read-total-id` — Baca total belanja.
     2. `choice-change-read-paid-id` — Baca uang yang dibayar.
     3. `choice-change-subtract-id` — Kurangi total dari uang yang dibayar.
     4. `choice-change-check-id` — Periksa hasil.
   - Explanation: Baca kedua nilai sebelum mengurangi, lalu periksa hasil kembalian.

## Quiz module

- Jumlah exercise: 6, masing-masing dua dari setiap lesson.
- Passing threshold kandidat: `7000` basis points (`70%`).
- Tidak ada timer, ranking, leaderboard, penalti pengulangan, atau AI grading.

## Hasil pemeriksaan otomatis pada kandidat awal

- Arithmetic check: lulus untuk tujuh relasi hitung yang didokumentasikan.
- Content graph schema: lulus.
- Reference dan ID validation: lulus.
- SHA-256 dan ukuran byte: lulus pada saat dokumen ini dibuat.
- Content safety lint: 0 finding pada paket utama.

Jalankan ulang hasil faktual dengan:

```bash
npm run check:mandiri:learning-content
npm run test:mandiri:learning-content
npm run review:mandiri:learning-content
```

## Checklist reviewer manusia

- [ ] Bahasa sederhana dan satu ide per bagian.
- [ ] Nada ramah, dewasa, dan tidak kekanak-kanakan.
- [ ] Tidak merendahkan atau mempermalukan pengguna.
- [ ] Bukan klaim kesetaraan sekolah atau kelulusan formal.
- [ ] Tidak memuat diagnosis atau klaim kesehatan.
- [ ] Tidak memuat klaim keuntungan atau laporan pajak resmi.
- [ ] Seluruh contoh angka dan kunci jawaban benar.
- [ ] Explanation membantu tanpa memberi label kemampuan umum.
- [ ] Threshold quiz `7000` sesuai untuk paket kandidat ini.
- [ ] Materi layak diubah dari draft hanya setelah seluruh koreksi selesai.

## Keputusan reviewer

Reviewer:

Tanggal:

Keputusan:

Catatan:

Keputusan sengaja belum diisi. Codex bukan reviewer manusia dan tidak boleh mengubah `pending_human_review` menjadi `approved` tanpa persetujuan eksplisit.
