export type Article = {
  slug: string;
  title: string;
  dek: string;
  minutes: number;
  topic: string;
  sections: { heading: string; body: string[] }[];
  amanah: string;
  seekHelp: string;
};

export const articles: Article[] = [
  {
    slug: "tidur-yang-cukup",
    title: "Tidur yang cukup, tanpa angka ajaib",
    dek: "Kurang tidur yang berulang layak diperhatikan. Satu malam buruk bukan vonis kesehatan.",
    minutes: 4,
    topic: "Kebiasaan",
    sections: [
      {
        heading: "Yang umumnya dibicarakan",
        body: [
          "Banyak panduan untuk orang dewasa menyebut kisaran sekitar tujuh jam sebagai waktu tidur yang cukup. Itu titik awal percakapan, bukan aturan yang sama untuk setiap tubuh.",
          "Yang lebih berguna diamati: apakah kamu bangun cukup segar untuk aktivitas hari itu, dan apakah kurang tidur terjadi berulang — bukan hanya semalam.",
        ],
      },
      {
        heading: "Yang bisa dicoba",
        body: [
          "Jam tidur dan bangun yang mirip setiap hari, termasuk akhir pekan, biasanya lebih menolong daripada mengejar satu malam yang sangat panjang.",
          "Layar terang, kafein sore, dan ruang yang panas atau berisik sering membuat tidur lebih dangkal. Mengubah satu hal dulu sudah cukup untuk minggu ini.",
        ],
      },
    ],
    amanah:
      "Ini edukasi umum tentang kebiasaan tidur. Bukan penilaian gangguan tidur, dan bukan alasan untuk minum obat tidur atas saran chat.",
    seekHelp:
      "Temui tenaga kesehatan jika ngantuk berat mengganggu kerja atau menyetir, jika mendengkur disertai henti napas yang disaksikan orang lain, atau jika tidak bisa tidur berlarut sampai aktivitas hancur.",
  },
  {
    slug: "air-putih",
    title: "Haus itu isyarat, bukan kegagalan",
    dek: "Air putih adalah pilihan paling sederhana. Tidak ada satu jumlah gelas yang wajib untuk semua orang.",
    minutes: 3,
    topic: "Kebiasaan",
    sections: [
      {
        heading: "Yang perlu diluruskan",
        body: [
          "Anjuran 'delapan gelas untuk semua orang' terlalu rapi untuk tubuh yang berbeda. Cuaca, aktivitas, makanan berkuah, dan kondisi kesehatan mengubah kebutuhan cairan.",
          "Haus adalah isyarat yang sah. Menunggunya sampai kepala pening tidak lebih saleh daripada minum lebih awal saat udara panas atau setelah banyak bergerak.",
        ],
      },
      {
        heading: "Minuman yang bukan pengganti",
        body: [
          "Minuman manis, energi, dan kopi berlebih tidak dihitung sebagai cara menutup kebutuhan air. Mereka membawa hal lain yang tubuh juga harus mengolah.",
          "Warna urine yang sangat gelap sepanjang hari, terutama disertai pusing saat berdiri, adalah alasan untuk minum dan — kalau tidak membaik — memeriksakan diri. Bukan untuk membeli suplemen elektrolit atas klaim iklan.",
        ],
      },
    ],
    amanah:
      "Nusa tidak menentukan target mililiter personal dan tidak menilai ginjalmu dari cerita singkat.",
    seekHelp:
      "Segera cari bantuan jika tidak bisa minum sama sekali, muntah terus, bingung, atau tidak buang air kecil dalam waktu yang terasa tidak biasa bagimu.",
  },
  {
    slug: "gerak-ringan",
    title: "Bergerak tidak harus olahraga berat",
    dek: "Berdiri dari duduk yang panjang, berjalan, dan meregang sudah berarti. Nyeri adalah alasan berhenti, bukan dipaksa.",
    minutes: 3,
    topic: "Kebiasaan",
    sections: [
      {
        heading: "Duduk panjang",
        body: [
          "Tubuh yang duduk berjam-jam tidak otomatis 'rusak', tetapi ia kehilangan jeda. Berdiri, berjalan ke air, atau meregang bahu beberapa kali sehari lebih jujur daripada janji program tujuh hari.",
        ],
      },
      {
        heading: "Batas yang jangan dilewati",
        body: [
          "Nyeri dada, sesak yang baru, atau pusing saat mulai bergerak adalah alasan untuk berhenti dan mencari pertolongan, bukan untuk 'dipanaskan' sampai hilang.",
          "Nyeri sendi yang makin tajam saat dipaksa juga bukan bukti karakter. Kurangi beban, lalu tanyakan ke tenaga kesehatan jika ia menetap.",
        ],
      },
    ],
    amanah: "Tidak ada program latihan di halaman ini, dan tidak ada target langkah yang dijadikan nilai moral.",
    seekHelp:
      "Hentikan aktivitas dan hubungi 119 jika muncul nyeri dada, sesak berat, atau pingsan saat bergerak.",
  },
  {
    slug: "membaca-klaim-produk",
    title: "Cara membaca klaim, sebelum tergoda membeli",
    dek: "Testimoni bukan bukti. Janji sembuh total adalah alasan untuk melambat, bukan untuk checkout.",
    minutes: 5,
    topic: "Literasi produk",
    sections: [
      {
        heading: "Tanda yang patut dicurigai",
        body: [
          "Hati-hati pada kalimat seperti sembuh total, tanpa efek samping, menggantikan obat dokter, atau rahasia yang disembunyikan industri. Itu bahasa jualan, bukan bahasa pemeriksaan.",
          "Satu cerita 'saya sudah sembuh' tidak menjelaskan apa yang sebenarnya terjadi pada tubuh orang itu, apa lagi yang mereka lakukan, dan siapa yang tidak sembuh lalu tidak menulis testimoni.",
        ],
      },
      {
        heading: "Pertanyaan yang lebih amanah",
        body: [
          "Apa nama bahan dan jumlahnya, bukan hanya nama dagang? Siapa yang mengawasi produk ini? Apakah klaimnya sesuai izin edar, atau melebar di caption?",
          "Edukasi datang lebih dulu. Produk, kalaupun dibahas, hanya informasi — bukan jalan pintas dan bukan bukti bahwa seseorang lalai jika tidak membelinya.",
        ],
      },
    ],
    amanah:
      "VitaNusa tidak mempromosikan produk di ruang ini dan tidak mengizinkan klaim medis dipakai sebagai alasan jual.",
    seekHelp:
      "Jika kamu sudah menghentikan obat yang diresepkan karena sebuah iklan, hubungi tenaga kesehatan yang meresepkannya sebelum melanjutkan atau berhenti lagi.",
  },
  {
    slug: "kapan-ke-igd",
    title: "Kapan chat harus berhenti",
    dek: "Beberapa tanda tidak menunggu artikel selesai dibaca. Daftar ini tidak lengkap, tetapi cukup untuk tidak menunda yang jelas gawat.",
    minutes: 3,
    topic: "Tanda bahaya",
    sections: [
      {
        heading: "Cari 119 atau IGD",
        body: [
          "Nyeri dada yang menekan, sesak yang membuat kalimat terputus, lemah mendadak di satu sisi tubuh, bicara yang tiba-tiba pelo, kejang, pingsan, perdarahan yang tidak berhenti, muntah darah, dan reaksi alergi dengan bengkak serta sesak.",
          "Bayi yang biru, tidak mau menyusu, atau kejang juga tidak dibahas tuntas di chat.",
        ],
      },
      {
        heading: "Yang masih boleh dipelajari nanti",
        body: [
          "Pertanyaan tentang kebiasaan, cara membaca label, dan cara menyiapkan pertanyaan untuk tenaga kesehatan adalah wilayah Nusa. Menentukan penyakit dari satu kalimat bukan wilayahnya.",
        ],
      },
    ],
    amanah: "Daftar ini sengaja pendek. Tidak adanya gejalamu di sini tidak berarti aman, dan adanya satu gejala ringan tidak otomatis darurat.",
    seekHelp: "Ragu antara menunggu dan berangkat? Untuk tanda di atas, berangkat. Untuk yang lain, fasilitas kesehatan terdekat lebih tepat daripada memperpanjang chat.",
  },
  {
    slug: "halal-dan-thayyib",
    title: "Halal tidak ditebak, thayyib bukan cap universal",
    dek: "Sertifikat dibaca di kemasan. Kebaikan sebuah produk tidak bisa disimpulkan dari kata-kata penjual.",
    minutes: 4,
    topic: "Amanah",
    sections: [
      {
        heading: "Halal",
        body: [
          "Status halal sebuah produk di Indonesia merujuk pada sertifikat dan label lembaga yang berwenang, yaitu BPJPH. AI yang 'yakin' tanpa melihat sertifikat sedang menebak.",
          "Nomor sertifikat yang tidak bisa ditelusuri, label yang buram, atau janji lisan 'pokoknya halal' adalah alasan untuk menunda, bukan untuk percaya.",
        ],
      },
      {
        heading: "Thayyib",
        body: [
          "Thayyib mengajak melihat kelayakan: apakah sesuatu baik, layak, dan tidak menipu. Itu refleksi, bukan sertifikat laboratorium yang bisa Nusa terbitkan untuk semua merek.",
          "Produk yang halal tetap bisa tidak thayyib jika klaimnya berlebihan, jika ia dijadikan pengganti perawatan, atau jika harganya dibayar dengan ketakutan.",
        ],
      },
    ],
    amanah:
      "Halaman ini bukan fatwa. Perkara yang membutuhkan ketetapan hukum ditanyakan kepada ulama atau lembaga yang memang berwenang.",
    seekHelp:
      "Untuk kesehatan, thayyib juga berarti tidak menunda tanda bahaya demi menunggu produk 'yang lebih alami'.",
  },
];

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}
