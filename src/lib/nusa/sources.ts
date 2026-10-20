export type SourceLink = {
  title: string;
  publisher: string;
  href: string;
  note: string;
};

export const shelf = {
  sleep: {
    title: "About Sleep",
    publisher: "CDC",
    href: "https://www.cdc.gov/sleep/about/index.html",
    note: "Tabel jam tidur menurut usia. Untuk dewasa 18–60 tahun, halaman ini menyebut 7 jam atau lebih. Bukan jatah wajib untuk setiap tubuh.",
  },
  diet: {
    title: "Healthy diet",
    publisher: "WHO",
    href: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
    note: "Lembar fakta pola makan. Bukan menu personal dan bukan alasan membeli produk.",
  },
  water: {
    title: "Drinking-water",
    publisher: "WHO",
    href: "https://www.who.int/news-room/fact-sheets/detail/drinking-water",
    note: "Tentang air minum yang aman sebagai layanan publik, bukan jumlah gelas harian.",
  },
  move: {
    title: "Physical activity",
    publisher: "WHO",
    href: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
    note: "Lembar fakta aktivitas fisik. Bukan program latihan dan bukan target langkah.",
  },
  psc: {
    title: "Public Safety Center 119",
    publisher: "Kemenkes",
    href: "https://psc.kemkes.go.id/web/",
    note: "Laman layanan darurat medis 119. Untuk tanda bahaya, hubungi 119 lebih dulu daripada membaca tuntas.",
  },
  kemkes119: {
    title: "Akses darurat medis 119",
    publisher: "Kemenkes",
    href: "https://www.kemkes.go.id/id/akses-darurat-medis-119-kini-bisa-melalui-satusehat-mobile",
    note: "Penjelasan kanal 119, termasuk lewat SATUSEHAT Mobile. Tetap bukan penilaian gejala dari jauh.",
  },
  bpom: {
    title: "Cek BPOM",
    publisher: "BPOM",
    href: "https://cekbpom.pom.go.id/",
    note: "Cari izin edar pada kemasan. Izin edar bukan bukti klaim sembuh di iklan.",
  },
  bpjph: {
    title: "BPJPH",
    publisher: "BPJPH",
    href: "https://bpjph.halal.go.id/",
    note: "Kanal resmi sertifikat halal. Status halal tidak ditebak dari chat.",
  },
  maternal: {
    title: "Maternal health",
    publisher: "WHO",
    href: "https://www.who.int/health-topics/maternal-health",
    note: "Topik kesehatan ibu. Bukan penilaian kehamilan atau menyusui seseorang.",
  },
  idai: {
    title: "Ikatan Dokter Anak Indonesia",
    publisher: "IDAI",
    href: "https://www.idai.or.id/",
    note: "Situs organisasi profesi. Bukan pemeriksaan anak yang sedang dibahas.",
  },
  healing: {
    title: "Healing119",
    publisher: "Kemenkes",
    href: "https://www.healing119.id/",
    note: "Dukungan jiwa lewat 119 ekstensi 8. Bukan diagnosis, dan bukan pengganti 119 jika ada bahaya sekarang.",
  },
  mental: {
    title: "Mental health",
    publisher: "WHO",
    href: "https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response",
    note: "Lembar fakta penguatan kesehatan jiwa. Bukan penamaan gangguan dari satu cerita.",
  },
} satisfies Record<string, SourceLink>;

export const articleShelves: Record<string, SourceLink[]> = {
  "tidur-yang-cukup": [shelf.sleep],
  "air-putih": [shelf.water],
  "gerak-ringan": [shelf.move],
  "membaca-klaim-produk": [shelf.bpom],
  "kapan-ke-igd": [shelf.psc, shelf.kemkes119],
  "halal-dan-thayyib": [shelf.bpjph],
};

export function linksForBlock(policy: string): SourceLink[] {
  if (policy === "crisis") return [shelf.healing, shelf.psc];
  if (policy === "emergency" || policy === "dose") return [shelf.psc];
  if (policy === "halal") return [shelf.bpjph];
  return [];
}
