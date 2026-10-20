export type PolicyId =
  | "emergency"
  | "crisis"
  | "halal"
  | "dose"
  | "claim"
  | "diagnosis"
  | "educate";

export type PolicyDecision = {
  id: PolicyId;
  blockModel: boolean;
  title: string;
  text: string;
  warnings: string[];
};

const CRISIS =
  /bunuh diri|mengakhiri hidup|ingin mati|tidak ingin hidup|nggak mau hidup|menyakiti diri|self[-\s]?harm|suicidal|akhiri hidup/;

const EMERGENCY =
  /nyeri dada|dada (sesak|tertekan|sakit berat)|sesak( napas)? (berat|parah|sekali)|tidak bisa bernapas|susah bernapas|wajah (perot|mencong)|bicara (pelo|cedal)|lemah sebelah|gejala stroke|kejang|tidak sadar|pingsan|overdosis|minum (racun|pemutih)|pendarahan (hebat|banyak|tidak berhenti)|muntah darah|batuk darah|bayi (biru|tidak bernapas|kejang)|alergi parah/;

const DOSE =
  /dosis|berapa (mg|miligram|tablet|kapsul|sendok)|resepkan|resep obat|obat apa yang harus|minum obat ini berapa|stop obat|berhenti(kan)? obat/;

const HALAL_ASK =
  /(apakah|apa|status|sudah|belum|halalkah|halal gak|halal nggak|halal tidak).{0,40}halal|halal.{0,40}(apakah|status|sudah|belum|produk|merk|merek|suplemen|herbal|madu|susu)/;

const CONCEPT =
  /apa (itu|arti|beda|bedanya)|thayyib|bukan sertifikat|cara cek sertifikat|literasi/;

const CLAIM =
  /sembuh total|menyembuhkan|obat mujarab|100% ampuh|tanpa efek samping|ganti(kan)? obat dokter|jamin sembuh|pasti sembuh/;

const DIAGNOSIS =
  /apakah saya (sakit|kena|mengidap|punya)|sakit apa|diagnos|penyakit apa|ini penyakit apa|kena penyakit/;

function clean(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

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

  if (DOSE.test(text)) {
    return {
      id: "dose",
      blockModel: true,
      title: "Di luar batas Nusa",
      text: "Nusa tidak memberikan dosis, resep, atau saran untuk mulai, berhenti, atau mengubah obat.\n\nJumlah yang aman bergantung pada usia, kondisi tubuh, dan obat lain yang sedang dipakai. Itu hanya boleh ditentukan tenaga kesehatan, atau dibaca pada etiket resmi obatmu.\n\nKalau ini soal keracunan atau kelebihan obat, hubungi 119 atau IGD sekarang.",
      warnings: [],
    };
  }

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
