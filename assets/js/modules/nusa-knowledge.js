import { findMatchingNusaArticle } from './nusa-articles-map.js?v=20260624-nusa-article-map';

const WHATSAPP_URL = 'https://wa.me/6288708862581';
const EMAIL_URL = 'mailto:kopiscent99@gmail.com';

export const NUSA_ROUTES = Object.freeze({
  vitacheck: '#vitacheck',
  articles: 'articles/index.html',
  testimonialArticle: 'articles/artikel-3.html',
  amanah: 'prinsip-amanah.html',
  products: 'products/index.html',
  faq: '#faq',
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
  whatsapp: { label: 'Hubungi WhatsApp', href: NUSA_ROUTES.whatsapp },
  email: { label: 'Kirim Email', href: NUSA_ROUTES.email },
});

export const NUSA_KEYWORDS = Object.freeze({
  habit: [
    'kebiasaan',
    'cek kebiasaan',
    'vitacheck',
    'tidur',
    'makan',
    'minum',
    'air',
    'energi',
    'lelah',
    'gerak',
    'pencernaan',
  ],
  article: ['artikel', 'edukasi', 'baca', 'blog', 'kesehatan', 'belajar'],
  testimonial: ['testimoni', 'bukti', 'klaim', 'klaim produk', 'promosi', 'percaya testimoni'],
  amanah: [
    'amanah',
    'prinsip amanah',
    'batas',
    'batas klaim',
    'edukasi dulu',
    'produk belakangan',
    'klaim berlebihan',
  ],
  product: [
    'produk',
    'katalog',
    'reseller',
    'key propolis',
    'propolis',
    'langfit',
    'deto pro',
    'harga',
    'beli',
    'cara membeli',
    'produk apa yang cocok',
  ],
  productSuitability: [
    'produk apa yang cocok untuk saya',
    'produk apa yang sesuai untuk saya',
    'produk yang cocok untuk saya',
    'produk yang sesuai untuk saya',
    'mana yang cocok untuk saya',
    'mana yang sesuai untuk saya',
  ],
  seriousComplaint: [
    'darurat',
    'sesak napas',
    'sesak',
    'pingsan',
    'perdarahan',
    'nyeri hebat',
    'keluhan berat',
    'memburuk',
    'menetap',
    'gangguan aktivitas',
    'sakit parah',
    'tidak tertahankan',
  ],
  diagnosis: ['diagnosis', 'diagnosa', 'saya sakit apa', 'penyakit saya apa', 'apakah saya kena'],
  faq: ['faq', 'pertanyaan', 'bingung', 'cara pakai', 'tentang vitanusa'],
  contact: ['whatsapp', 'wa', 'kontak', 'admin', 'hubungi', 'email', 'kerja sama', 'kolaborasi'],
});

export const NUSA_RESPONSES = Object.freeze({
  habit: 'Untuk memahami kebiasaan harian, kamu bisa mulai dari VitaCheck. Hasilnya bersifat edukatif, bukan diagnosis.',
  article: 'Kamu bisa mulai dari ruang artikel VitaNusa AI. Pilih topik yang paling sesuai dengan kebutuhanmu.',
  testimonial: 'Testimoni bisa menjadi pengalaman pribadi, tetapi bukan bukti utama untuk semua orang. Lebih aman membaca klaim produk dengan tenang dan memahami batasnya.',
  amanah: 'Prinsip Amanah menjelaskan batas VitaNusa AI: edukasi dulu, tidak diagnosis, tidak membuat klaim berlebihan, dan produk bukan janji hasil.',
  product: 'Produk di VitaNusa AI ditampilkan sebagai katalog informasi reseller. Sebelum mempertimbangkan produk, baca Prinsip Amanah dan pahami label resmi. Produk bukan pengganti pola hidup sehat atau konsultasi tenaga kesehatan.',
  productSuitability: 'Saya tidak bisa memastikan produk yang cocok untuk kondisi pribadi. Saya bisa membantu mengarahkan kamu membaca informasi produk secara amanah. Jika memiliki kondisi khusus, sebaiknya konsultasikan kepada tenaga kesehatan.',
  seriousComplaint: 'Jika keluhan berat, menetap, memburuk, atau mengganggu aktivitas, sebaiknya segera berkonsultasi kepada tenaga kesehatan yang berwenang. Nusa AI hanya membantu edukasi awal dan tidak memberi diagnosis.',
  diagnosis: 'Saya tidak bisa memberi diagnosis. Saya bisa membantu memberi arahan edukatif dan menunjukkan sumber bacaan yang relevan. Untuk diagnosis dan penanganan, konsultasikan kepada tenaga kesehatan yang berwenang.',
  faq: 'Kamu bisa membuka FAQ untuk jawaban singkat tentang VitaNusa AI, VitaCheck, artikel, produk, dan batas edukasi.',
  contact: 'Kamu bisa menghubungi admin VitaNusa AI melalui WhatsApp atau email.',
});

export const NUSA_FALLBACK_RESPONSE = Object.freeze({
  text: 'Saya bisa bantu arahkan. Pilih salah satu: VitaCheck, Artikel, Prinsip Amanah, Produk, FAQ, WhatsApp, atau Email.',
  actions: [
    NUSA_ROUTE_BUTTONS.vitacheck,
    NUSA_ROUTE_BUTTONS.articles,
    NUSA_ROUTE_BUTTONS.amanah,
    NUSA_ROUTE_BUTTONS.products,
    NUSA_ROUTE_BUTTONS.faq,
    NUSA_ROUTE_BUTTONS.whatsapp,
    NUSA_ROUTE_BUTTONS.email,
  ],
});

export const NUSA_SERIOUS_COMPLAINT_RESPONSE = Object.freeze({
  text: NUSA_RESPONSES.seriousComplaint,
  actions: [NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.whatsapp],
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
        || (includesAny(text, ['produk']) && includesAny(text, ['cocok', 'sesuai', 'untuk saya']));
    },
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
    id: 'faq',
    keywords: NUSA_KEYWORDS.faq,
    response: NUSA_RESPONSES.faq,
    actions: [NUSA_ROUTE_BUTTONS.faq],
  },
  {
    id: 'contact',
    keywords: NUSA_KEYWORDS.contact,
    response: NUSA_RESPONSES.contact,
    actions: [NUSA_ROUTE_BUTTONS.whatsapp, NUSA_ROUTE_BUTTONS.email],
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
    actions: intent.actions,
  };
}

export function getNusaReply(input) {
  const normalizedText = normalizeText(input);
  const intent = findMatchingIntent(normalizedText);

  if (!intent) {
    return NUSA_FALLBACK_RESPONSE;
  }

  return buildIntentReply(intent, normalizedText) || NUSA_FALLBACK_RESPONSE;
}
