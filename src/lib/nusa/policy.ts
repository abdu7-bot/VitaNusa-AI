export type PolicyId =
  | "emergency"
  | "crisis"
  | "halal"
  | "dose"
  | "claim"
  | "diagnosis"
  | "citation"
  | "educate";

export type PolicyDecision = {
  id: PolicyId;
  blockModel: boolean;
  title: string;
  text: string;
  warnings: string[];
};

const CRISIS =
  /bunuh diri|mengakhiri hidup|mengakhiri nyawa|ingin mati|pengen mati|pengen bunuh|tidak ingin hidup|tidak mau hidup|nggak mau hidup|gak mau hidup|ga mau hidup|menyakiti diri|nyakitin diri|self[-\s]?harm|suicidal|akhiri hidup/;

const EMERGENCY =
  /nyeri dada|sakit dada|dada sakit|dada (sesak|tertekan|sakit berat|saya sakit)|sesak( napas)? (berat|parah|sekali)|tidak bisa bernapas|tidak bisa napas|susah bernapas|sulit bernapas|napas (nggak|gak|ga|tidak) bisa|(nggak|gak|ga) bisa napas|wajah (perot|mencong)|mulut mencong|bicara (pelo|cedal)|lemah sebelah|lumpuh sebelah|gejala stroke|kejang|tidak sadar|tidak sadarkan|pingsan|overdosis|minum (racun|pemutih)|pendarahan (hebat|banyak|tidak berhenti)|muntah darah|batuk darah|bayi (biru|tidak bernapas|kejang)|alergi parah|reaksi alergi|bengkak (tenggorokan|bibir)/;

const DOSE =
  /dosis|berapa (mg|miligram|tablet|kapsul|sendok)|resepkan|resep obat|obat apa yang harus|obat apa yang (aman|boleh)|boleh (minum|konsumsi) obat|minum obat ini berapa|stop obat|berhenti(kan)? obat|ubah(an)? dosis|naikkan dosis|turunkan dosis/;

const VULNERABLE = /\b(anak|bayi|balita|hamil|kehamilan|menyusui)\b/;
const MEDICINE = /obat|dosis|ramuan|suplemen|kapsul|tablet/;

const HALAL_ASK =
  /(apakah|apa|status|sudah|belum|halalkah|halal gak|halal nggak|halal tidak).{0,40}halal|halal.{0,40}(apakah|status|sudah|belum|produk|merk|merek|suplemen|herbal|madu|susu)|halal (nggak|gak|ga|tidak|kan)\b/;

const CONCEPT =
  /apa (itu|arti|beda|bedanya)|thayyib|bukan sertifikat|cara cek sertifikat|literasi/;

const CITE =
  /buat(kan)? (sitasi|rujukan jurnal|hadits|hadis|ayat)|karang(kan)? (jurnal|hadits|hadis|ayat|sitasi)|nomor (jurnal|pmid)|pmid\s*\d/;

const CLAIM =
  /sembuh total|menyembuhkan|obat mujarab|100% ampuh|tanpa efek samping|ganti(kan)? obat dokter|jamin sembuh|pasti sembuh/;

const DIAGNOSIS =
  /apakah saya (sakit|kena|mengidap|punya)|sakit apa|diagnos|penyakit apa|ini penyakit apa|kena penyakit/;

const OUTPUT_UNSAFE =
  /\b\d+\s*(mg|miligram|mcg|tablet|kapsul|sendok)\b|\b(pmid|doi)\b|doi\.org|qs\.?\s*\d{1,3}\b|hadits?\s+(no\.?|nomor|riwayat)\s+\w+|kamu (menderita|mengidap|terdiagnosis)|diagnosis(mu| anda| kamu)|(produk|madu|susu|obat) (ini|tersebut) (halal|tidak halal|haram)/i;

function clean(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function held(id: PolicyId, title: string, text: string): PolicyDecision {
  return { id, blockModel: true, title, text, warnings: [] };
}

const DOSE_DECISION = held(
  "dose",
  "Di luar batas Nusa",
  "Nusa tidak memberikan dosis, resep, atau saran untuk mulai, berhenti, atau mengubah obat.\n\nJumlah yang aman bergantung pada usia, kondisi tubuh, dan obat lain yang sedang dipakai. Itu hanya boleh ditentukan tenaga kesehatan, atau dibaca pada etiket resmi obatmu.\n\nKalau ini soal keracunan atau kelebihan obat, hubungi 119 atau IGD sekarang.",
);

const CITE_DECISION = held(
  "citation",
  "Sitasi tidak dikarang",
  "Nusa tidak mengarang nomor jurnal, ayat, atau hadits.\n\nKalau sumber pastinya tidak ada di rak, itu edukasi umum, bukan kutipan.",
);

export function classify(input: string): PolicyDecision {
  const text = clean(input);
  const crisis = CRISIS.test(text);
  const emergency = EMERGENCY.test(text);

  if (crisis || emergency) {
    const both = crisis && emergency;
    return {
      id: crisis && !emergency ? "crisis" : "emergency",
      blockModel: true,
      title: both ? "Tanda bahaya dan krisis" : crisis ? "Butuh manusia, bukan chat" : "Tanda yang tidak boleh ditunda",
      text: crisis
        ? both
          ? "Ada dua hal yang tidak bisa diselesaikan di sini: keluhan tubuh yang terdengar gawat, dan pikiran untuk menyakiti diri.\n\nHubungi 119 atau pergi ke IGD sekarang, dan jangan tinggal sendiri. Untuk dukungan jiwa, Healing119 dari Kemenkes bisa dihubungi lewat 119 ekstensi 8, atau lewat situs healing119.id.\n\nNusa berhenti di sini. Tidak ada langkah pengobatan dari chat."
          : "Kalau kamu sedang berpikir untuk menyakiti diri atau mengakhiri hidup, kamu tidak harus menanggungnya sendirian.\n\nHubungi orang yang kamu percaya sekarang, atau 119 jika kamu dalam bahaya. Dukungan jiwa gratis dari Kemenkes, Healing119, bisa lewat 119 ekstensi 8 atau healing119.id.\n\nNusa bukan tempat yang tepat untuk menemani krisis ini."
        : "Ini terdengar seperti tanda yang tidak boleh ditunda di ruang chat.\n\nHubungi 119 atau pergi ke IGD terdekat sekarang. Kalau ada orang di sekitarmu, minta mereka menemani.\n\nNusa tidak bisa menilai kegawatdaruratan dari jauh dan tidak memberi langkah pengobatan di sini.",
      warnings: [],
    };
  }

  if (DOSE.test(text) || (VULNERABLE.test(text) && MEDICINE.test(text) && !CONCEPT.test(text))) {
    return DOSE_DECISION;
  }

  if (CITE.test(text)) return CITE_DECISION;

  if (HALAL_ASK.test(text) && !CONCEPT.test(text)) {
    return {
      id: "halal",
      blockModel: true,
      title: "Status halal tidak ditebak",
      text: "Nusa tidak menebak status halal suatu produk.\n\nDi Indonesia, bukti halal ada pada sertifikat dan label BPJPH, bukan pada tebakan AI atau janji penjual. Periksa nomor sertifikat di kemasan. Kalau tidak ketemu, tunda dulu.\n\nThayyib — soal kelayakan dan kebaikan — juga bukan cap yang bisa ditempelkan pada satu merek dari jauh.",
      warnings: [],
    };
  }

  const warnings: string[] = [];
  let id: PolicyId = "educate";
  if (CLAIM.test(text)) {
    id = "claim";
    warnings.push("Nusa hanya membantu membaca klaim, bukan membenarkan atau menjual produk.");
  }
  if (DIAGNOSIS.test(text)) {
    id = id === "claim" ? "claim" : "diagnosis";
    warnings.push("Ini bukan diagnosis. Keluhan pribadi perlu diperiksa tenaga kesehatan.");
  }

  return {
    id,
    blockModel: false,
    title: "",
    text: "",
    warnings,
  };
}

export function screenModelText(text: string): { pass: true } | { pass: false; decision: PolicyDecision } {
  if (OUTPUT_UNSAFE.test(text)) {
    return {
      pass: false,
      decision: held(
        "citation",
        "Jawaban ditahan",
        "Jawaban model memuat dosis, diagnosis, tebakan halal, atau sitasi yang tidak boleh ditampilkan. Nusa membuangnya.\n\nUntuk obat, baca etiket atau tanya tenaga kesehatan. Untuk sumber, pakai rak sumber.",
      ),
    };
  }
  return { pass: true };
}

const SEVERITY: PolicyId[] = ["crisis", "emergency", "dose", "halal", "citation", "claim", "diagnosis", "educate"];

export function stricter(current: PolicyDecision | null, next: PolicyDecision): PolicyDecision {
  if (!next.blockModel) return current ?? next;
  if (!current?.blockModel) return next;
  return SEVERITY.indexOf(next.id) < SEVERITY.indexOf(current.id) ? next : current;
}
