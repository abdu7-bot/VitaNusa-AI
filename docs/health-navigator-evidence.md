# Health Navigator — Evidence Layer

## Tujuan
Evidence Layer memetakan topik Navigator ke sumber rujukan yang dapat diaudit. Sumber dipakai untuk edukasi umum dan tidak dianggap sebagai bukti diagnosis individual.

## Prinsip
1. **Source ≠ diagnosis.** Sumber hanya mendukung penjelasan umum.
2. **Topic-specific.** Navigator mengembalikan referensi yang relevan dengan topik, bukan daftar tautan acak.
3. **Safety-first.** Red flag dan emergency tetap diproses lebih dulu.
4. **No fabricated citation.** URL berasal dari registry kode dan harus ditinjau saat sumber berubah.
5. **Context matters.** Usia, kehamilan, penyakit penyerta, durasi, dan tingkat keparahan dapat mengubah kebutuhan rujukan.

## Topik saat ini
- `demam`: Kemenkes — tanda bahaya demam; Kemenkes — edukasi DBD.
- `batuk`: WHO — respiratory/COVID public health guidance; WHO — influenza; WHO — pneumonia.
- `diare`: WHO — diarrhoea.

## API
`POST /navigator/check` sekarang dapat mengembalikan:
- `sources`: identitas organisasi sumber.
- `evidence`: referensi spesifik topik, judul, URL, dan hal yang didukung.
- `evidenceNote`: batas penggunaan bukti.

`GET /navigator/sources` mengembalikan registry sumber yang dipercaya.

## Catatan implementasi
Evidence registry sengaja statis dan eksplisit agar perubahan sumber dapat direview melalui git. Registry bukan mesin pencarian dan tidak boleh digunakan untuk menyimpulkan diagnosis atau dosis obat.

## Review berikutnya
- Tambahkan referensi khusus untuk `sakit_kepala` dan `sakit_perut`.
- Tambahkan metadata `reviewedAt` dan pemilik review.
- Tambahkan test yang memastikan setiap topic publik memiliki minimal satu evidence reference.
- Pertimbangkan mekanisme validasi URL berkala tanpa membuat request eksternal pada request pengguna.
