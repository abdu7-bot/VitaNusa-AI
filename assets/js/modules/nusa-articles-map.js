const MIN_ARTICLE_SCORE = 1;

export const NUSA_ARTICLE_MAP = Object.freeze([
  {
    id: 'testimoni-bukan-bukti',
    title: 'Testimoni Bukan Bukti',
    href: 'articles/artikel-3.html',
    category: 'Literasi Produk',
    keywords: [
      'testimoni bukan bukti',
      'testimoni',
      'testi',
      'bukti',
      'bukti utama',
      'bukti nyata',
      'klaim',
      'klaim produk',
      'promosi',
      'promosi kesehatan',
      'promosi aman',
      'percaya testimoni',
      'janji hasil',
      'janji sembuh',
      'katanya sembuh',
      'katanya ampuh',
      'hasil instan',
      'hasil orang',
      'hasil orang lain',
      'review orang',
      'ulasan orang',
      'literasi produk',
      'ulasan produk',
      'review produk',
      'bendera merah klaim',
      'klaim berlebihan',
    ],
    summary: 'Artikel tentang cara bijak menilai klaim dan testimoni produk tanpa menjadikannya bukti utama untuk semua orang.',
  },
  {
    id: 'ai-untuk-edukasi-kesehatan',
    title: 'AI untuk Edukasi Kesehatan',
    href: 'articles/ai-untuk-edukasi-kesehatan.html',
    category: 'AI & Edukasi Digital',
    keywords: [
      'ai untuk edukasi kesehatan',
      'ai kesehatan',
      'ai edukasi',
      'edukasi digital',
      'teknologi edukasi',
      'belajar dengan ai',
      'chatbot kesehatan',
      'nusa ai',
      'batas ai',
      'ai bukan dokter',
      'ai bukan diagnosis',
      'ai bukan pengganti dokter',
      'konten ai kesehatan',
      'video ai kesehatan',
    ],
    summary: 'Artikel tentang pemanfaatan AI untuk edukasi kesehatan yang etis, amanah, dan tidak menggantikan tenaga kesehatan profesional.',
  },
  {
    id: 'sehat-itu-amanah',
    title: 'Sehat Itu Amanah',
    href: 'articles/sehat-itu-amanah.html',
    category: 'Halal-Thayyib & Gaya Hidup',
    keywords: [
      'sehat itu amanah',
      'pola hidup sehat',
      'pola hidup',
      'gaya hidup sehat',
      'hidup sehat',
      'kebiasaan sehat',
      'kebiasaan kecil',
      'amanah tubuh',
      'menjaga tubuh',
      'merawat tubuh',
      'halal thayyib',
      'halal-thayyib',
      'ikhtiar sehat',
      'tawakal sehat',
      'tidur cukup',
      'makan seimbang',
      'pola makan',
      'minum air',
      'gerak ringan',
      'olahraga ringan',
    ],
    summary: 'Artikel tentang menjaga tubuh sebagai amanah melalui ilmu, kebiasaan baik, pilihan halal-thayyib, dan sikap kritis terhadap klaim kesehatan.',
  },
]);

function normalizeArticleText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.:,;()[\]{}"'`~_+=/\\|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreArticleMatch(normalizedText, article) {
  const title = normalizeArticleText(article.title);
  let score = 0;

  if (title && normalizedText.includes(title)) {
    score += 3;
  }

  for (const keyword of article.keywords) {
    const normalizedKeyword = normalizeArticleText(keyword);

    if (normalizedKeyword && normalizedText.includes(normalizedKeyword)) {
      score += normalizedKeyword.length > 12 ? 2 : 1;
    }
  }

  return score;
}

export function findMatchingNusaArticle(input) {
  const normalizedText = normalizeArticleText(input);

  if (!normalizedText) return null;

  const bestMatch = NUSA_ARTICLE_MAP
    .map((article) => ({
      article,
      score: scoreArticleMatch(normalizedText, article),
    }))
    .filter((entry) => entry.score >= MIN_ARTICLE_SCORE)
    .sort((a, b) => b.score - a.score)[0];

  return bestMatch ? bestMatch.article : null;
}
