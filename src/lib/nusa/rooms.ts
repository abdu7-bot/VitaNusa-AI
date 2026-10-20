import { shelf, type SourceLink } from "@/lib/nusa/sources";

export type RoomId = "tidur" | "makan" | "gerak" | "bahaya" | "klaim" | "rentan" | "beban";

export type AboutId = "diri" | "dewasa-lain" | "anak" | "hamil";

export type Room = {
  id: RoomId;
  title: string;
  blurb: string;
  fallbackKnown: string;
  steps: string[];
  questions: string[];
  seek: string;
  sources: SourceLink[];
};

export const rooms: Room[] = [
  {
    id: "tidur",
    title: "Tidur dan istirahat",
    blurb: "Ritme, layar, dan kapan lelah bukan lagi soal kebiasaan semata.",
    fallbackKnown:
      "Banyak panduan untuk orang dewasa menyebut kisaran sekitar tujuh jam sebagai titik awal percakapan, bukan angka yang wajib untuk setiap tubuh. Yang lebih berguna diperhatikan adalah keteraturan jam tidur dan apakah kurang tidur terjadi berulang.",
    steps: [
      "Samakan kira-kira jam tidur dan bangun, termasuk di akhir pekan.",
      "Simpan layar di luar tempat tidur sebagai satu perubahan minggu ini.",
    ],
    questions: [
      "Apakah ngantuk ini mengganggu menyetir atau bekerja, atau hanya satu dua malam?",
      "Apakah ada yang menyaksikan henti napas atau dengkuran yang tidak biasa?",
    ],
    seek: "Temui tenaga kesehatan jika ngantuk berat mengganggu aktivitas, atau jika tidur tidak pulih sampai hari-hari terasa hancur.",
    sources: [shelf.sleep],
  },
  {
    id: "makan",
    title: "Makan dan minum",
    blurb: "Keteraturan makan dan cairan, tanpa target gelas yang sama untuk semua orang.",
    fallbackKnown:
      "Haus adalah isyarat yang sah. Air putih adalah pilihan paling sederhana. Jumlah yang tepat berubah menurut cuaca, aktivitas, dan kondisi, jadi tidak ada satu jumlah gelas yang wajib di sini.",
    steps: [
      "Minum air putih lebih awal saat udara panas atau setelah banyak bergerak.",
      "Jangan mengganti makan yang terlewat hanya dengan minuman manis.",
    ],
    questions: [
      "Apakah saya sering pusing saat berdiri, atau urine sangat gelap sepanjang hari?",
      "Apakah pola makan ini baru berubah karena sakit, obat, atau tekanan?",
    ],
    seek: "Cari bantuan jika tidak bisa minum sama sekali, muntah terus, atau hampir tidak buang air kecil.",
    sources: [shelf.diet, shelf.water],
  },
  {
    id: "gerak",
    title: "Gerak tubuh",
    blurb: "Berdiri, berjalan, dan meregang. Nyeri adalah alasan berhenti.",
    fallbackKnown:
      "Bergerak tidak harus olahraga berat. Duduk berjam-jam perlu jeda, tetapi janji program tujuh hari tidak lebih jujur daripada berdiri dan berjalan singkat yang benar-benar terjadi.",
    steps: [
      "Sisipkan berdiri atau berjalan singkat beberapa kali di hari yang banyak duduk.",
      "Hentikan gerak jika muncul nyeri tajam, sesak, atau pusing.",
    ],
    questions: [
      "Apakah nyeri muncul saat mulai bergerak, atau sudah ada saat istirahat?",
      "Apakah aktivitas ini baru, atau keluhannya sudah berlangsung beberapa hari?",
    ],
    seek: "Hentikan aktivitas dan hubungi 119 jika muncul nyeri dada, sesak berat, atau pingsan saat bergerak.",
    sources: [shelf.move],
  },
  {
    id: "bahaya",
    title: "Tanda yang tidak ditunda",
    blurb: "Daftar pendek kapan chat harus berhenti. Sengaja tidak lengkap.",
    fallbackKnown:
      "Nyeri dada yang menekan, sesak yang memutus kalimat, lemah mendadak di satu sisi, bicara yang tiba-tiba pelo, kejang, pingsan, perdarahan yang tidak berhenti, dan alergi dengan bengkak serta sesak tidak dibahas tuntas di chat.",
    steps: ["Hubungi 119 atau pergi ke IGD.", "Minta seseorang menemani, jika ada."],
    questions: ["Tidak ada pertanyaan yang perlu disusun dulu jika tandanya sudah seperti di atas."],
    seek: "Ragu antara menunggu dan berangkat untuk tanda di atas: berangkat. Tidak adanya gejalamu di daftar ini tidak otomatis berarti aman.",
    sources: [shelf.psc, shelf.kemkes119],
  },
  {
    id: "klaim",
    title: "Membaca klaim",
    blurb: "Cara melambat sebelum percaya testimoni atau janji sembuh.",
    fallbackKnown:
      "Kalimat seperti sembuh total, tanpa efek samping, atau menggantikan obat dokter adalah bahasa jualan. Satu cerita kesembuhan tidak menjelaskan siapa yang tidak sembuh lalu tidak menulis testimoni.",
    steps: [
      "Cari nama bahan dan jumlahnya, bukan hanya nama dagang.",
      "Pisahkan izin edar dari kalimat yang melebar di caption.",
    ],
    questions: [
      "Apakah saya sudah menghentikan obat yang diresepkan karena sebuah iklan?",
      "Siapa yang mengawasi produk ini, dan apakah klaimnya sesuai label?",
    ],
    seek: "Jika obat resep sudah dihentikan karena iklan, hubungi tenaga kesehatan yang meresepkannya sebelum melanjutkan atau berhenti lagi.",
    sources: [shelf.bpom],
  },
  {
    id: "rentan",
    title: "Anak, hamil, dan menyusui",
    blurb: "Batas lebih ketat. Tidak ada ramuan, dosis, atau saran obat.",
    fallbackKnown:
      "Keluhan pada anak, kehamilan, dan menyusui tidak dinilai dari chat. Navigator hanya membantu menyusun apa yang ingin ditanyakan, lalu menurunkan ambang untuk memeriksakan diri.",
    steps: [
      "Catat sejak kapan keluhan ada, apa yang berubah, dan apa yang sudah diberikan.",
      "Jangan memulai ramuan, suplemen, atau obat atas saran chat.",
    ],
    questions: [
      "Apa yang perlu saya sampaikan lebih dulu kepada tenaga kesehatan?",
      "Tanda apa yang berarti saya tidak boleh menunggu janji berikutnya?",
    ],
    seek: "Untuk anak, kehamilan, dan menyusui, periksa lebih awal. Sesak, kejang, tidak mau minum, perdarahan, atau bayi yang lemas bukan bahan chat.",
    sources: [shelf.maternal, shelf.idai],
  },
  {
    id: "beban",
    title: "Beban pikiran",
    blurb: "Tempo hidup yang mengubah tidur, makan, atau rasa aman. Bukan penamaan gangguan.",
    fallbackKnown:
      "Beban yang sudah mengubah tidur, makan, atau rasa aman layak diceritakan kepada orang yang dipercaya atau tenaga kesehatan. Chat tidak cukup untuk menemani itu sendirian.",
    steps: [
      "Sebutkan kepada satu orang yang kamu percaya bahwa beban ini sudah mengubah hari.",
      "Jaga jeda minum dan tidur sebagai penyangga, bukan sebagai pengobatan.",
    ],
    questions: [
      "Sejak kapan tidur atau makan berubah?",
      "Apakah saya masih merasa aman sendirian hari ini?",
    ],
    seek: "Jika ada pikiran untuk menyakiti diri, hubungi 119 dan jangan tinggal sendiri. Dukungan jiwa Healing119 dari Kemenkes dapat dihubungi lewat 119 ekstensi 8 atau healing119.id.",
    sources: [shelf.healing, shelf.mental],
  },
];

export const aboutOptions: { id: AboutId; label: string; conservative: boolean }[] = [
  { id: "diri", label: "Untuk diri sendiri, dewasa", conservative: false },
  { id: "dewasa-lain", label: "Untuk orang dewasa lain", conservative: false },
  { id: "anak", label: "Untuk anak", conservative: true },
  { id: "hamil", label: "Kehamilan atau menyusui", conservative: true },
];

export function getRoom(id: string) {
  return rooms.find((room) => room.id === id);
}

export function isConservative(about: string) {
  return about === "anak" || about === "hamil";
}
