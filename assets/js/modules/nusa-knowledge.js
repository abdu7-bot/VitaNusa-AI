import { findMatchingNusaArticle } from './nusa-articles-map.js?v=20260625-chatgpt-like-minimal';

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
  greeting: ['assalamualaikum', 'assalamu alaikum', 'salam', 'halo', 'hai', 'hello'],
  start: ['mulai', 'mulai dari mana', 'dari mana', 'bingung', 'bantu saya', 'arahin saya', 'saya bingung'],
  vitacheckStart: ['mulai vitacheck', 'cek kebiasaan sehat', 'vital check', 'vitacheck'],
  habit: [
    'kebiasaan',
    'tanya kebiasaan sehat',
    'tidur',
    'makan',
    'air',
    'minum',
    'lelah',
    'energi',
    'gerak',
    'olahraga',
    'pencernaan',
  ],
  testimonial: [
    'testimoni',
    'bukti',
    'klaim',
    'promosi',
    'hasil orang',
    'cek klaim',
    'cek testimoni',
    'klaim produk',
    'percaya testimoni',
  ],
  product: [
    'produk',
    'key propolis',
    'langfit deto pro',
    'langfit',
    'deto pro',
    'katalog',
    'harga',
    'beli',
    'tanya produk',
    'cara membeli',
    'reseller',
    'propolis',
  ],
  productSuitability: [
    'produk cocok untuk saya',
    'produk apa yang cocok untuk saya',
    'produk apa yang sesuai untuk saya',
    'produk yang cocok untuk saya',
    'produk yang sesuai untuk saya',
    'mana yang cocok',
    'mana yang cocok untuk saya',
    'mana yang sesuai untuk saya',
    'saya cocok pakai apa',
  ],
  diagnosis: ['diagnosis', 'diagnosa', 'saya sakit apa', 'penyakit saya apa', 'apakah saya kena', 'kena penyakit apa'],
  seriousComplaint: [
    'sesak napas',
    'sesak nafas',
    'sesak',
    'pingsan',
    'perdarahan',
    'pendarahan',
    'nyeri hebat',
    'darurat',
    'memburuk',
    'tidak tertahankan',
    'keluhan berat',
    'menetap',
    'gangguan aktivitas',
    'sakit parah',
  ],
  article: ['artikel', 'edukasi', 'baca', 'blog', 'kesehatan', 'belajar'],
  amanah: ['prinsip amanah', 'amanah', 'batas klaim', 'klaim berlebihan', 'edukasi dulu', 'produk belakangan'],
  faq: ['faq', 'pertanyaan', 'cara pakai', 'tentang vitanusa'],
  contact: ['wa', 'whatsapp', 'admin', 'email', 'hubungi', 'kontak', 'kerja sama', 'kolaborasi'],
});

export const NUSA_RESPONSES = Object.freeze({
  greeting: 'Assalamualaikum, saya Nusa AI. Apa yang ingin kamu pahami hari ini?',
  start: 'Kita mulai pelan-pelan. Kamu bisa bertanya langsung tentang kebiasaan sehat, artikel edukasi, klaim/testimoni, produk, atau kontak admin.',
  vitacheckStart: 'Baik. VitaCheck membantu kamu melihat gambaran kebiasaan sehat secara edukatif. Hasilnya bukan diagnosis medis.',
  habit: 'Kita bisa mulai dari kebiasaan harian seperti tidur, minum air, pola makan, gerak, energi, dan pencernaan. Untuk gambaran awal yang rapi, gunakan VitaCheck terlebih dahulu.',
  article: 'Kamu bisa mulai dari ruang artikel VitaNusa AI. Pilih bacaan yang paling sesuai dengan kebutuhanmu, lalu ambil langkah kecil yang realistis.',
  testimonial: 'Testimoni bisa menjadi pengalaman pribadi, tetapi bukan bukti utama untuk semua orang. Lebih aman menilai klaim produk dengan tenang: lihat label resmi, batas klaim, dan jangan menjadikan cerita orang sebagai jaminan hasil.',
  amanah: 'Prinsip Amanah menjelaskan batas VitaNusa AI: edukasi dulu, tidak diagnosis, tidak membuat klaim berlebihan, dan produk bukan janji hasil.',
  product: 'Produk di VitaNusa AI ditampilkan sebagai katalog informasi reseller. Sebelum mempertimbangkan produk, baca Prinsip Amanah dan pahami label resmi. Produk hanya opsi pendukung, bukan pengganti pola hidup sehat atau konsultasi tenaga kesehatan.',
  productSuitability: 'Saya tidak bisa memastikan produk yang cocok untuk kondisi pribadi. Saya bisa membantu mengarahkan kamu membaca informasi produk secara amanah. Jika memiliki kondisi khusus, sedang hamil/menyusui, memakai obat, atau punya riwayat penyakit tertentu, sebaiknya konsultasikan kepada tenaga kesehatan.',
  diagnosis: 'Saya tidak bisa memberi diagnosis. Saya bisa membantu memberi arahan edukatif dan menunjukkan bacaan yang relevan. Untuk diagnosis dan penanganan, konsultasikan kepada tenaga kesehatan yang berwenang.',
  seriousComplaint: 'Jika keluhan berat, menetap, memburuk, atau mengganggu aktivitas, sebaiknya segera berkonsultasi kepada tenaga kesehatan yang berwenang. Nusa AI hanya membantu edukasi awal dan tidak menggantikan pemeriksaan medis.',
  faq: 'Kamu bisa membuka FAQ untuk jawaban singkat tentang VitaNusa AI, VitaCheck, artikel, produk, dan batas edukasi.',
  contact: 'Kamu bisa menghubungi admin VitaNusa AI melalui WhatsApp atau email. Untuk pertanyaan produk, sampaikan kondisi secara jujur dan jangan mengharapkan jawaban diagnosis dari admin.',
});

export const NUSA_INITIAL_REPLY = Object.freeze({
  id: 'initial-greeting',
  text: NUSA_RESPONSES.greeting,
  actions: [],
});

export const NUSA_FALLBACK_RESPONSE = Object.freeze({
  id: 'fallback',
  text: NUSA_RESPONSES.start,
  actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.articles, NUSA_ROUTE_BUTTONS.amanah],
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
    return 'Kamu bisa mulai dari artikel “Sehat Itu Amanah” untuk memahami pola hidup sehat sebagai amanah: kebiasaan kecil, pilihan halal-thayyib, dan sikap kritis terhadap klaim kesehatan. Jika ingin refleksi awal, mulai juga dari VitaCheck.';
  }

  if (article.id === 'ai-untuk-edukasi-kesehatan') {
    return 'AI bisa membantu edukasi kesehatan dengan bahasa yang lebih mudah dipahami, tetapi tetap bukan dokter dan bukan alat diagnosis. Artikel ini menjelaskan batas aman memakai AI untuk belajar kesehatan secara amanah.';
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
    actions: [NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.whatsapp],
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
        || (includesAny(text, ['produk', 'suplemen']) && includesAny(text, ['cocok', 'sesuai', 'untuk saya']));
    },
  },
  {
    id: 'vitacheck-start',
    keywords: NUSA_KEYWORDS.vitacheckStart,
    response: NUSA_RESPONSES.vitacheckStart,
    actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.educationArticles],
  },
  {
    id: 'testimonial',
    keywords: NUSA_KEYWORDS.testimonial,
    response: NUSA_RESPONSES.testimonial,
    actions: [NUSA_ROUTE_BUTTONS.testimonialArticle, NUSA_ROUTE_BUTTONS.amanah],
  },
  {
    id: 'amanah',
    keywords: NUSA_KEYWORDS.amanah,
    response: NUSA_RESPONSES.amanah,
    actions: [NUSA_ROUTE_BUTTONS.amanah],
  },
  {
    id: 'product',
    keywords: NUSA_KEYWORDS.product,
    response: NUSA_RESPONSES.product,
    actions: [NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.products, NUSA_ROUTE_BUTTONS.whatsapp],
  },
  {
    id: 'article-specific',
    keywords: [],
    matcher(text) {
      return Boolean(findMatchingNusaArticle(text));
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
  {
    id: 'contact',
    keywords: NUSA_KEYWORDS.contact,
    response: NUSA_RESPONSES.contact,
    actions: [NUSA_ROUTE_BUTTONS.contact, NUSA_ROUTE_BUTTONS.whatsapp, NUSA_ROUTE_BUTTONS.email],
  },
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
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
