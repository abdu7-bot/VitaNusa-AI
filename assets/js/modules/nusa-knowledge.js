import { findMatchingNusaArticle } from './nusa-articles-map.js?v=20260625-nusa-brain-v1';

const WHATSAPP_URL = 'https://wa.me/6288708862581';
const EMAIL_URL = 'mailto:kopiscent99@gmail.com';

export const NUSA_ROUTES = Object.freeze({
  vitacheck: '#vitacheck',
  articles: 'articles/index.html',
  testimonialArticle: 'articles/artikel-3.html',
  amanah: 'prinsip-amanah.html',
  products: 'products/index.html',
  faq: '#faq',
  contact: '#kontak',
  whatsapp: WHATSAPP_URL,
  email: EMAIL_URL,
});

export const NUSA_ROUTE_BUTTONS = Object.freeze({
  vitacheck: { label: 'Mulai VitaCheck', href: NUSA_ROUTES.vitacheck },
  articles: { label: 'Baca Artikel', href: NUSA_ROUTES.articles },
  educationArticles: { label: 'Baca Artikel Edukasi', href: NUSA_ROUTES.articles },
  testimonialArticle: {
    label: 'Baca Artikel Testimoni Bukan Bukti',
    href: NUSA_ROUTES.testimonialArticle,
  },
  amanah: { label: 'Baca Prinsip Amanah', href: NUSA_ROUTES.amanah },
  products: { label: 'Lihat Katalog Produk', href: NUSA_ROUTES.products },
  faq: { label: 'Buka FAQ', href: NUSA_ROUTES.faq },
  contact: { label: 'Hubungi Admin', href: NUSA_ROUTES.contact },
  whatsapp: { label: 'Hubungi WhatsApp', href: NUSA_ROUTES.whatsapp },
  email: { label: 'Kirim Email', href: NUSA_ROUTES.email },
});

export const NUSA_KEYWORDS = Object.freeze({
  greeting: [
    'assalamualaikum',
    'assalamu alaikum',
    'salam',
    'halo',
    'hai',
    'hello',
  ],
  start: [
    'mulai',
    'mulai dari mana',
    'dari mana',
    'bingung',
    'bantu saya',
    'arahin saya',
    'arahkan saya',
    'saya bingung',
    'aku bingung',
    'harus mulai dari mana',
    'mulainya dari mana',
    'langkah awal',
  ],
  vitacheckStart: [
    'mulai vitacheck',
    'cek kebiasaan sehat',
    'cek kebiasaan',
    'cek habit',
    'vital check',
    'vita check',
    'vitacheck',
    'skor kebiasaan',
  ],
  habit: [
    'kebiasaan',
    'kebiasaan sehat',
    'tanya kebiasaan sehat',
    'pola hidup',
    'hidup sehat',
    'rutinitas sehat',
    'gaya hidup sehat',
    'tidur',
    'tidur buruk',
    'tidur berantakan',
    'kurang tidur',
    'begadang',
    'makan',
    'pola makan',
    'makan berantakan',
    'air',
    'minum',
    'minum air',
    'kurang minum',
    'lelah',
    'sering lelah',
    'capek',
    'mudah capek',
    'energi',
    'gerak',
    'kurang gerak',
    'olahraga',
    'pencernaan',
    'perut tidak nyaman ringan',
    'stres ringan',
    'stress ringan',
    'mau hidup sehat',
    'ingin hidup sehat',
  ],
  testimonial: [
    'testimoni',
    'testi',
    'bukti',
    'bukti nyata',
    'klaim',
    'klaim produk',
    'promosi',
    'promosi aman',
    'hasil orang',
    'hasil orang lain',
    'review orang',
    'ulasan orang',
    'cek klaim',
    'cek testimoni',
    'percaya testimoni',
    'testimoni produk bisa dipercaya',
    'klaim produk benar',
    'katanya sembuh',
    'katanya ampuh',
    'cerita sembuh',
    'janji sembuh',
    'hasil instan',
  ],
  product: [
    'produk',
    'info produk',
    'tanya produk',
    'tanya langfit',
    'tanya key propolis',
    'key propolis',
    'langfit deto pro',
    'langfit',
    'deto pro',
    'propolis',
    'katalog',
    'katalog produk',
    'harga',
    'berapa harga',
    'beli',
    'mau beli',
    'cara membeli',
    'cara beli',
    'reseller',
    'stok produk',
  ],
  productSuitability: [
    'produk cocok untuk saya',
    'produk apa yang cocok untuk saya',
    'produk apa yang sesuai untuk saya',
    'produk yang cocok untuk saya',
    'produk yang sesuai untuk saya',
    'produk mana yang pas',
    'produk mana yang cocok',
    'mana yang cocok',
    'mana yang cocok untuk saya',
    'mana yang sesuai untuk saya',
    'saya cocok pakai apa',
    'aku cocok pakai apa',
    'cocok gak',
    'cocok nggak',
    'cocok ga',
    'cocok tidak',
    'aman gak untuk saya',
    'aman nggak untuk saya',
    'aman ga untuk saya',
    'aman tidak untuk saya',
    'saya boleh minum ini',
    'boleh minum ini',
    'boleh konsumsi ini',
    'suplemen apa untuk keluhan saya',
    'untuk penyakit saya pakai apa',
    'propolis cocok untuk penyakit saya',
    'langfit cocok untuk saya',
    'deto pro cocok untuk saya',
  ],
  diagnosis: [
    'diagnosis',
    'diagnosa',
    'saya sakit apa',
    'aku sakit apa',
    'penyakit saya apa',
    'penyakit aku apa',
    'ini penyakit apa',
    'gejala ini apa',
    'gejala saya apa',
    'gejala aku apa',
    'apakah saya kena',
    'apakah aku kena',
    'apa saya kena',
    'apa aku kena',
    'kena penyakit apa',
    'diagnosa saya apa',
    'diagnosis saya apa',
    'apakah ini maag',
    'apakah ini asam lambung',
    'apakah ini diabetes',
    'apakah saya diabetes',
    'apakah aku diabetes',
    'apakah saya kena maag',
    'apakah aku kena maag',
  ],
  seriousComplaint: [
    'sesak napas',
    'sesak nafas',
    'nyeri dada',
    'dada nyeri',
    'sakit dada berat',
    'mau pingsan',
    'hampir pingsan',
    'pingsan',
    'perdarahan',
    'pendarahan',
    'darah banyak',
    'muntah terus',
    'muntah terus menerus',
    'demam tinggi',
    'nyeri hebat',
    'sakit hebat',
    'sakit parah',
    'keluhan berat',
    'tidak tertahankan',
    'tidak kuat',
    'nggak kuat',
    'gak kuat',
    'ga kuat',
    'parah kali',
    'makin parah',
    'semakin parah',
    'memburuk',
    'gejala memburuk',
    'gangguan aktivitas berat',
    'mengganggu aktivitas berat',
    'darurat',
  ],
  article: [
    'artikel',
    'baca artikel',
    'baca edukasi',
    'edukasi',
    'blog',
    'bacaan',
    'belajar kesehatan',
    'saya mau belajar kesehatan',
    'edukasi produk',
    'artikel testimoni',
    'artikel pola hidup',
  ],
  amanah: [
    'prinsip amanah',
    'apa itu prinsip amanah',
    'amanah',
    'batas klaim',
    'batas promosi',
    'klaim berlebihan',
    'edukasi dulu',
    'produk belakangan',
    'jangan klaim berlebihan',
    'tidak klaim sembuh',
  ],
  faq: [
    'faq',
    'pertanyaan umum',
    'pertanyaan',
    'cara pakai vitanusa',
    'tentang vitanusa',
  ],
  contact: [
    'wa',
    'whatsapp',
    'admin',
    'email',
    'hubungi',
    'hubungi admin',
    'kontak',
    'kontak admin',
    'kerja sama',
    'kolaborasi',
  ],
});

export const NUSA_RESPONSES = Object.freeze({
  greeting: 'Assalamualaikum, saya Nusa AI. Apa yang ingin kamu pahami hari ini?',
  start: 'Kita mulai pelan-pelan. Kamu bisa mulai dari VitaCheck untuk refleksi kebiasaan, membaca artikel edukasi, memahami Prinsip Amanah, bertanya tentang produk secara hati-hati, atau menghubungi admin.',
  vitacheckStart: 'Baik. VitaCheck membantu kamu melihat gambaran kebiasaan sehat secara edukatif. Hasilnya bukan diagnosis dan bukan pengganti pemeriksaan medis.',
  habit: 'Topik ini berkaitan dengan kebiasaan harian. Kita bisa mulai dari langkah kecil: tidur lebih teratur, cukup minum, makan lebih rapi, dan gerak ringan. Untuk gambaran awal yang lebih rapi, gunakan VitaCheck sebagai refleksi edukatif, bukan diagnosis.',
  article: 'Kamu bisa mulai dari ruang artikel VitaNusa AI. Pilih bacaan yang paling sesuai, lalu ambil satu langkah kecil yang realistis.',
  testimonial: 'Testimoni bisa menjadi pengalaman pribadi, tetapi bukan bukti utama untuk semua orang. Lebih aman menilai klaim produk dengan tenang: cek label resmi, pahami batas klaim, dan jangan menjadikan cerita orang sebagai jaminan hasil.',
  amanah: 'Prinsip Amanah menjelaskan batas VitaNusa AI: edukasi dulu, tidak diagnosis, tidak membuat klaim berlebihan, dan produk bukan janji hasil.',
  product: 'Produk di VitaNusa AI ditampilkan sebagai katalog informasi reseller. Sebelum melihat katalog, baca Prinsip Amanah agar kamu paham batas klaim, label resmi, dan posisi produk sebagai opsi pendukung. Produk bukan pengganti pola hidup sehat atau konsultasi tenaga kesehatan.',
  productSuitability: 'Saya tidak bisa menentukan produk yang cocok untuk kondisi pribadi. Katalog hanya berisi informasi, bukan rekomendasi personal. Jika sedang hamil/menyusui, memakai obat, punya riwayat penyakit, atau punya keluhan tertentu, konsultasikan dulu kepada tenaga kesehatan yang berwenang.',
  diagnosis: 'Untuk hal seperti ini, saya tidak bisa menentukan diagnosis. Saya bisa bantu arahkan secara edukatif, tetapi pemeriksaan dan keputusan medis tetap perlu tenaga kesehatan yang berwenang. VitaCheck boleh dipakai hanya sebagai refleksi kebiasaan, bukan alat diagnosis.',
  seriousComplaint: 'Keluhan seperti ini perlu diprioritaskan. Jika sesak napas, nyeri dada, pingsan, perdarahan, demam tinggi, muntah terus, makin memburuk, atau terasa tidak tertahankan, segera hubungi tenaga kesehatan, fasilitas kesehatan, atau layanan darurat setempat. Saya tidak memberi diagnosis dan tidak mengarahkan ke produk untuk kondisi berat.',
  faq: 'Kamu bisa membuka FAQ untuk jawaban singkat tentang VitaNusa AI, VitaCheck, artikel, produk, dan batas edukasi.',
  contact: 'Kamu bisa menghubungi admin VitaNusa AI melalui WhatsApp atau email. Untuk keluhan berat atau pertanyaan diagnosis, admin bukan pengganti tenaga kesehatan.',
});

export const NUSA_INITIAL_REPLY = Object.freeze({
  id: 'initial-greeting',
  text: NUSA_RESPONSES.greeting,
  actions: [],
});

export const NUSA_FALLBACK_RESPONSE = Object.freeze({
  id: 'fallback',
  text: 'Saya belum menangkap maksudnya dengan jelas. Kamu bisa tanya tentang kebiasaan sehat, artikel edukasi, testimoni/klaim produk, Prinsip Amanah, produk, atau kontak admin.',
  actions: [],
});

function createArticleButton(article) {
  return {
    label: `Baca Artikel ${article.title}`,
    href: article.href,
  };
}

function getRelatedArticleActions(article) {
  if (article.id === 'testimoni-bukan-bukti') {
    return [NUSA_ROUTE_BUTTONS.amanah];
  }

  if (article.id === 'sehat-itu-amanah') {
    return [NUSA_ROUTE_BUTTONS.vitacheck];
  }

  if (article.id === 'ai-untuk-edukasi-kesehatan') {
    return [NUSA_ROUTE_BUTTONS.amanah];
  }

  return [];
}

function createArticleResponseText(article) {
  if (article.id === 'sehat-itu-amanah') {
    return 'Kamu bisa membaca artikel “Sehat Itu Amanah” untuk memahami pola hidup sehat sebagai amanah: kebiasaan kecil, pilihan halal-thayyib, dan sikap kritis terhadap klaim kesehatan. Jika ingin refleksi awal, mulai juga dari VitaCheck.';
  }

  if (article.id === 'ai-untuk-edukasi-kesehatan') {
    return 'AI bisa membantu edukasi kesehatan dengan bahasa yang mudah dipahami, tetapi tetap bukan dokter dan bukan alat diagnosis. Artikel ini menjelaskan batas aman memakai AI untuk belajar kesehatan secara amanah.';
  }

  if (article.id === 'testimoni-bukan-bukti') {
    return NUSA_RESPONSES.testimonial;
  }

  return `Kamu bisa membaca artikel “${article.title}”. ${article.summary}`;
}

function createArticleSpecificReply(normalizedText) {
  const article = findMatchingNusaArticle(normalizedText);

  if (!article) return null;

  return {
    id: `article-${article.id}`,
    text: createArticleResponseText(article),
    actions: [
      createArticleButton(article),
      ...getRelatedArticleActions(article),
    ],
  };
}

export const NUSA_KNOWLEDGE_MAP = Object.freeze([
  {
    id: 'serious-complaint',
    keywords: NUSA_KEYWORDS.seriousComplaint,
    response: NUSA_RESPONSES.seriousComplaint,
    actions: [],
  },
  {
    id: 'diagnosis',
    keywords: NUSA_KEYWORDS.diagnosis,
    response: NUSA_RESPONSES.diagnosis,
    actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.articles, NUSA_ROUTE_BUTTONS.amanah],
  },
  {
    id: 'product-suitability',
    keywords: NUSA_KEYWORDS.productSuitability,
    response: NUSA_RESPONSES.productSuitability,
    actions: [NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.products, NUSA_ROUTE_BUTTONS.whatsapp],
    matcher(text) {
      return includesAny(text, NUSA_KEYWORDS.productSuitability)
        || (
          includesAny(text, ['produk', 'suplemen', 'langfit', 'deto pro', 'propolis', 'key propolis'])
          && includesAny(text, ['cocok', 'sesuai', 'pas', 'aman'])
          && includesAny(text, ['untuk saya', 'buat saya', 'bagi saya'])
        );
    },
  },
  {
    id: 'product',
    keywords: [],
    response: NUSA_RESPONSES.product,
    actions: [NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.products, NUSA_ROUTE_BUTTONS.whatsapp],
    matcher(text) {
      return includesAny(text, NUSA_KEYWORDS.product)
        && !includesAny(text, NUSA_KEYWORDS.testimonial);
    },
  },
  {
    id: 'testimonial',
    keywords: NUSA_KEYWORDS.testimonial,
    response: NUSA_RESPONSES.testimonial,
    actions: [NUSA_ROUTE_BUTTONS.testimonialArticle, NUSA_ROUTE_BUTTONS.amanah],
  },
  {
    id: 'vitacheck-start',
    keywords: NUSA_KEYWORDS.vitacheckStart,
    response: NUSA_RESPONSES.vitacheckStart,
    actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.educationArticles],
  },
  {
    id: 'article-specific',
    keywords: [],
    matcher(text) {
      return includesAny(text, NUSA_KEYWORDS.article) && Boolean(findMatchingNusaArticle(text));
    },
    getReply: createArticleSpecificReply,
  },
  {
    id: 'habit',
    keywords: NUSA_KEYWORDS.habit,
    response: NUSA_RESPONSES.habit,
    actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.educationArticles],
  },
  {
    id: 'article',
    keywords: NUSA_KEYWORDS.article,
    response: NUSA_RESPONSES.article,
    actions: [NUSA_ROUTE_BUTTONS.articles],
  },
  {
    id: 'amanah',
    keywords: NUSA_KEYWORDS.amanah,
    response: NUSA_RESPONSES.amanah,
    actions: [NUSA_ROUTE_BUTTONS.amanah],
  },
  {
    id: 'contact',
    keywords: NUSA_KEYWORDS.contact,
    response: NUSA_RESPONSES.contact,
    actions: [NUSA_ROUTE_BUTTONS.whatsapp, NUSA_ROUTE_BUTTONS.email],
  },
  {
    id: 'start',
    keywords: NUSA_KEYWORDS.start,
    response: NUSA_RESPONSES.start,
    actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.articles, NUSA_ROUTE_BUTTONS.amanah],
  },
  {
    id: 'greeting',
    keywords: NUSA_KEYWORDS.greeting,
    response: NUSA_RESPONSES.greeting,
    actions: [],
  },
  {
    id: 'faq',
    keywords: NUSA_KEYWORDS.faq,
    response: NUSA_RESPONSES.faq,
    actions: [NUSA_ROUTE_BUTTONS.faq],
  },
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.:,;()[\]{}"'`~_+=/\\|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesTerm(normalizedText, term) {
  const normalizedTerm = normalizeText(term);

  if (!normalizedTerm) return false;

  if (normalizedTerm.length <= 2) {
    return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`).test(normalizedText);
  }

  return normalizedText.includes(normalizedTerm);
}

function includesAny(normalizedText, terms) {
  return terms.some((term) => includesTerm(normalizedText, term));
}

function findMatchingIntent(normalizedText) {
  return NUSA_KNOWLEDGE_MAP.find((intent) => {
    if (typeof intent.matcher === 'function' && intent.matcher(normalizedText)) {
      return true;
    }

    return includesAny(normalizedText, intent.keywords);
  });
}

function buildIntentReply(intent, normalizedText) {
  if (typeof intent.getReply === 'function') {
    return intent.getReply(normalizedText);
  }

  return {
    id: intent.id,
    text: intent.response,
    actions: intent.actions || [],
  };
}

export function getNusaReply(input) {
  const normalizedText = normalizeText(input);

  if (!normalizedText) {
    return NUSA_INITIAL_REPLY;
  }

  const intent = findMatchingIntent(normalizedText);

  if (!intent) {
    return NUSA_FALLBACK_RESPONSE;
  }

  return buildIntentReply(intent, normalizedText) || NUSA_FALLBACK_RESPONSE;
}
