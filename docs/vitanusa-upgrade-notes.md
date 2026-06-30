# VitaNusa Upgrade Notes

## Ringkasan perubahan
- Memperbaiki pengalaman admin artikel dengan ringkasan status dan pesan yang lebih jelas.
- Memperbaiki halaman artikel publik dengan loading state, empty state, dan related articles.
- Menambah metadata SEO dasar dan keamanan sanitasi HTML untuk konten dinamis.
- Menjaga validasi amanah dan menahan klaim berbahaya tanpa menambah backend atau API baru.

## Struktur modul utama
- admin/articles.js: validasi artikel, publish, dan sinkronisasi data artikel.
- assets/js/modules/public-articles.js: pemuatan artikel publik, detail, dan related articles.
- articles/index.html dan articles/detail.html: halaman artikel publik dengan SEO dan aksesibilitas dasar.

## Cara test admin
1. Buka admin dashboard.
2. Lihat ringkasan artikel draft/published/archived.
3. Tambah artikel draft, lalu publish artikel low risk.
4. Coba publish artikel dengan klaim berbahaya dan pastikan ditahan.

## Cara test publik
1. Buka halaman artikel publik.
2. Periksa loading state dan empty state.
3. Buka detail artikel dan cek related articles.
4. Pastikan konten berbahaya tidak tampil sebagai script aktif.

## Catatan keamanan
- Konten dinamis disanitasi sebelum ditampilkan.
- Draft dan archived tidak ditampilkan di publik.
- Tidak ada API atau backend baru ditambahkan.

## Tahap berikutnya
- Menyambungkan knowledge/Q&A secara penuh ke dashboard admin.
- Menambahkan lebih banyak metadata artikel untuk rekomendasi yang lebih tajam.
