export type Option = {
  id: string;
  label: string;
  score: number;
  note?: string;
  urgent?: boolean;
};

export type Question = {
  id: string;
  prompt: string;
  detail: string;
  options: Option[];
};

export const questions: Question[] = [
  {
    id: "sleep",
    prompt: "Semalam, kira-kira berapa lama kamu tidur?",
    detail: "Perkiraan saja. Tidak perlu jam yang tepat.",
    options: [
      { id: "s0", label: "Kurang dari 5 jam", score: 0, note: "Kurang tidur yang sering berulang layak diatur, bukan dijadikan vonis." },
      { id: "s1", label: "Sekitar 5–6 jam", score: 1, note: "Masih di bawah kisaran yang umumnya disebut cukup untuk orang dewasa." },
      { id: "s2", label: "Sekitar 7–8 jam", score: 2 },
      { id: "s3", label: "Lebih dari 9 jam, tetapi tetap lelah", score: 1, note: "Tidur panjang yang tetap menyisakan lelah berat perlu diceritakan ke tenaga kesehatan, bukan ditambah jamnya terus." },
    ],
  },
  {
    id: "water",
    prompt: "Hari ini, bagaimana minummu?",
    detail: "Air putih, bukan minuman manis.",
    options: [
      { id: "w0", label: "Hampir tidak ingat minum", score: 0, note: "Mulai dari satu gelas air putih yang benar-benar diminum, bukan dari target yang mustahil." },
      { id: "w1", label: "Minum kalau sudah haus saja", score: 1 },
      { id: "w2", label: "Minum cukup teratur sepanjang hari", score: 2 },
    ],
  },
  {
    id: "move",
    prompt: "Tubuhmu hari ini lebih banyak duduk atau bergerak?",
    detail: "Berjalan dan berdiri dihitung. Tidak harus olahraga.",
    options: [
      { id: "m0", label: "Hampir tidak beranjak", score: 0, note: "Jeda berdiri beberapa kali lebih jujur daripada janji olahraga panjang yang tidak terjadi." },
      { id: "m1", label: "Ada berjalan singkat", score: 1 },
      { id: "m2", label: "Bergerak beberapa kali dengan nyaman", score: 2 },
    ],
  },
  {
    id: "meals",
    prompt: "Makan hari ini terasa bagaimana?",
    detail: "Keteraturan, bukan menu sempurna.",
    options: [
      { id: "e0", label: "Terlewat atau hanya kudapan manis", score: 0, note: "Melewatkan makan lalu menggantinya dengan yang manis sering membuat tenaga naik-turun." },
      { id: "e1", label: "Makan, tetapi terburu dan tidak enak badan", score: 1 },
      { id: "e2", label: "Ada jeda makan yang cukup tenang", score: 2 },
    ],
  },
  {
    id: "screen",
    prompt: "Menjelang tidur, layar biasanya bagaimana?",
    detail: "Ponsel, laptop, atau televisi di tempat tidur.",
    options: [
      { id: "c0", label: "Layar sampai mata berat", score: 0, note: "Memindahkan layar keluar dari tempat tidur sering lebih manjur daripada memaksa langsung tidur." },
      { id: "c1", label: "Masih ada, tetapi ada batasnya", score: 1 },
      { id: "c2", label: "Sudah disimpan sebelum berbaring", score: 2 },
    ],
  },
  {
    id: "rest",
    prompt: "Saat tubuh minta jeda, apa yang biasanya terjadi?",
    detail: "Istirahat di sini bukan malas. Ia bagian dari daya.",
    options: [
      { id: "r0", label: "Dipaksa terus sampai benar-benar jatuh", score: 0, note: "Mengabaikan lelah berulang bukan ketangguhan yang perlu dipertahankan." },
      { id: "r1", label: "Kadang berhenti, kadang tidak", score: 1 },
      { id: "r2", label: "Ada ruang untuk berhenti sejenak", score: 2 },
    ],
  },
  {
    id: "load",
    prompt: "Beban pikiran beberapa hari ini terasa di mana?",
    detail: "Bukan untuk menamai gangguan. Hanya untuk jujur pada tempo hidup.",
    options: [
      { id: "l0", label: "Menumpuk dan mengganggu tidur atau makan", score: 0, note: "Kalau beban ini sudah mengubah tidur, makan, atau rasa aman, ceritakan pada orang yang kamu percaya atau tenaga kesehatan. Chat tidak cukup." },
      { id: "l1", label: "Ada, tetapi masih bisa dibagi", score: 1 },
      { id: "l2", label: "Beratnya wajar untuk hari-hari ini", score: 2 },
    ],
  },
  {
    id: "flag",
    prompt: "Ada keluhan yang menghentikan aktivitasmu?",
    detail: "Pilih yang paling dekat. Ini bukan pemeriksaan.",
    options: [
      { id: "f0", label: "Tidak ada", score: 0 },
      { id: "f1", label: "Ringan, aktivitas masih jalan", score: 0, note: "Keluhan ringan yang menetap beberapa hari tetap layak ditanyakan saat periksa, bukan dicari diagnosisnya di chat." },
      {
        id: "f2",
        label: "Berat: nyeri hebat, sesak, pingsan, atau perdarahan",
        score: 0,
        urgent: true,
        note: "Keluhan berat tidak dinilai di VitaCheck. Hubungi 119 atau pergi ke IGD.",
      },
    ],
  },
];

export type CheckResult = {
  at: string;
  score: number;
  max: number;
  band: "perhatian" | "campuran" | "terjaga";
  notes: string[];
  urgent: boolean;
};

const SCORED = questions.filter((q) => q.id !== "flag");

export function summarize(answers: Record<string, string>): CheckResult {
  let score = 0;
  const notes: string[] = [];
  let urgent = false;

  for (const question of questions) {
    const picked = question.options.find((option) => option.id === answers[question.id]);
    if (!picked) continue;
    if (question.id !== "flag") score += picked.score;
    if (picked.urgent) urgent = true;
    if (picked.note) notes.push(picked.note);
  }

  const max = SCORED.reduce((sum, question) => sum + Math.max(...question.options.map((option) => option.score)), 0);
  const band = score <= 5 ? "perhatian" : score <= 10 ? "campuran" : "terjaga";

  return {
    at: new Date().toISOString(),
    score,
    max,
    band,
    notes,
    urgent,
  };
}

export const bandCopy: Record<CheckResult["band"], { title: string; body: string }> = {
  perhatian: {
    title: "Beberapa kebiasaan minta perhatian",
    body: "Angka ini hanya menghitung yang kamu laporkan hari ini. Ia tidak mengukur organ, tidak membandingkanmu dengan orang lain, dan tidak berkata bahwa kamu sakit.",
  },
  campuran: {
    title: "Ada yang sudah terjaga, ada yang masih longgar",
    body: "Cermin ini berguna untuk memilih satu kebiasaan yang ingin dijaga minggu ini. Bukan untuk mengejar skor.",
  },
  terjaga: {
    title: "Kebiasaan yang kamu laporkan cukup mendukung",
    body: "Ini kabar baik tentang ritme hari ini, bukan surat sehat. Besok boleh berbeda, dan itu tidak menghapus hari ini.",
  },
};
