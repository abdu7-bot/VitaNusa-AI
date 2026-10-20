# VitaNusa AI

Pendamping edukasi kesehatan. Bukan dokter, bukan diagnosis, bukan resep, dan bukan etalase produk.

Pratinjau ini berisi:

- Nusa Chat, dengan pagar darurat, krisis, dosis, dan tebakan halal
- VitaCheck, refleksi kebiasaan tanpa skor diagnosis
- Navigator, catatan terstruktur untuk dibawa ke tenaga kesehatan
- Edukasi dan Prinsip
- Rak sumber ke laman lembaga publik, bukan sitasi yang dikarang

## Menjalankan

```bash
npm install
npm run dev
```

Jawaban model memakai `XAI_API_KEY` di server. Kunci itu tidak dikirim ke peramban. Tanpa kunci, chat menolak dengan jujur dan Navigator memakai catatan tetap ruangnya.

Riwayat Nusa dan hasil VitaCheck hanya tersimpan di peramban perangkat itu. Server tidak menyimpan percakapan.

Pagar darurat, krisis, dosis, dan tebakan halal berjalan sebelum model dipanggil. Jawaban model yang memuat dosis, diagnosis, tebakan halal, atau nomor sitasi dibuang. Pagar kata kunci ini bukan sistem klinis yang lengkap.

Tanda bahaya tetap diarahkan ke 119. Dukungan jiwa Healing119 lewat 119 ekstensi 8.

Cabang `preview` tidak seleluhur dengan `main` dan tidak menggantikan situs statis di sana. Jangan menggabungkannya secara buta.
