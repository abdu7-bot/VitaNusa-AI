const MIN_ARTICLE_SCORE = 1;

export const NUSA_ARTICLE_MAP = Object.freeze([
  {
    id: 'testimoni-bukan-bukti',
    title: 'Testimoni Bukan Bukti',
    href: 'articles/artikel-3.html',
    category: 'Literasi Produk',
    keywords: ['testimoni bukan bukti', 'testimoni', 'testi', 'bukti', 'bukti utama', 'bukti nyata', 'klaim', 'klaim produk', 'promosi', 'promosi kesehatan', 'promosi aman', 'percaya testimoni', 'testimoni produk bisa dipercaya', 'janji hasil', 'janji sembuh', 'katanya sembuh', 'katanya ampuh', 'cerita sembuh', 'hasil instan', 'hasil orang', 'hasil orang lain', 'review orang', 'ulasan orang', 'literasi produk', 'ulasan produk', 'review produk', 'bendera merah klaim', 'klaim berlebihan'],
    summary: 'Artikel tentang cara bijak menilai klaim dan testimoni produk tanpa menjadikannya bukti utama untuk semua orang.',
  },
  {
    id: 'kapan-harus-ke-tenaga-kesehatan',
    title: 'Kapan Harus ke Tenaga Kesehatan?',
    href: 'articles/kapan-harus-ke-tenaga-kesehatan.html',
    category: 'Edukasi Aman',
    keywords: ['kapan harus ke tenaga kesehatan', 'tenaga kesehatan', 'dokter', 'fasilitas kesehatan', 'darurat', 'sesak napas', 'nyeri dada', 'pingsan', 'demam tinggi', 'memburuk', 'kapan harus ke dokter', 'keluhan berat', 'gejala memburuk', 'perlu dokter', 'harus ke dokter'],
    summary: 'Panduan edukatif tentang tanda perhatian yang sebaiknya tidak ditunda dan perlu dibawa ke tenaga kesehatan.',
  },
  {
    id: 'kebiasaan-sehat-7-hari',
    title: 'Kebiasaan Sehat 7 Hari',
    href: 'articles/kebiasaan-sehat-7-hari.html',
    category: 'Kebiasaan Sehat',
    keywords: ['kebiasaan sehat', '7 hari', 'hidup sehat', 'pola hidup', 'rutinitas', 'mulai hidup sehat', 'mau mulai hidup sehat', 'langkah kecil', 'habit sehat', 'kebiasaan sehat 7 hari', 'rutinitas sehat 7 hari', 'mulai kebiasaan sehat', 'mulai dari mana hidup sehat'],
    summary: 'Rute awal 7 hari untuk merapikan tidur, air, makan, gerak ringan, dan energi tanpa langkah ekstrem.',
  },
  {
    id: 'tidur-dan-energi-harian',
    title: 'Tidur dan Energi Harian',
    href: 'articles/tidur-dan-energi-harian.html',
    category: 'Kebiasaan Sehat',
    keywords: ['tidur', 'energi', 'lelah', 'kurang tidur', 'begadang', 'fokus', 'mood', 'susah tidur', 'capek', 'tidur berantakan', 'sering lelah', 'jam tidur', 'energi harian'],
    summary: 'Bacaan aman tentang hubungan tidur dengan energi, fokus, mood, dan kebiasaan makan, disertai langkah umum yang realistis.',
  },
  {
    id: 'pencernaan-dan-pola-makan',
    title: 'Pencernaan dan Pola Makan',
    href: 'articles/pencernaan-dan-pola-makan.html',
    category: 'Pencernaan',
    keywords: ['pencernaan', 'pola makan', 'perut tidak nyaman', 'makan berantakan', 'serat', 'air putih', 'mual ringan', 'kembung ringan', 'pencernaan kurang nyaman', 'pencernaan saya kurang nyaman', 'perut sering tidak nyaman', 'makan tidak teratur'],
    summary: 'Arahan umum untuk membaca hubungan pola makan, air, serat, gerak, dan stres ringan dengan kenyamanan pencernaan.',
  },
  {
    id: 'produk-bukan-jalan-pintas',
    title: 'Produk Bukan Jalan Pintas',
    href: 'articles/produk-bukan-jalan-pintas.html',
    category: 'Literasi Produk',
    keywords: ['produk bukan jalan pintas', 'produk', 'suplemen', 'klaim produk', 'produk bukan obat', 'produk bukan janji sembuh', 'produk bisa menyembuhkan', 'produk bisa jadi jalan pintas', 'produk solusi cepat', 'produk menggantikan pola hidup sehat', 'katalog reseller', 'label resmi', 'hati hati produk', 'produk jalan pintas'],
    summary: 'Artikel literasi produk yang menegaskan produk bukan pengganti pola hidup sehat, bukan obat, dan bukan janji sembuh.',
  },
  {
    id: 'cara-memakai-vitacheck',
    title: 'Cara Memakai VitaCheck',
    href: 'articles/cara-memakai-vitacheck.html',
    category: 'VitaCheck',
    keywords: ['cara memakai vitacheck', 'cara pakai vitacheck', 'pakai vitacheck', 'mulai vitacheck', 'cek kebiasaan', 'skor kebiasaan', 'hasil vitacheck', 'hasil vita check', 'refleksi kebiasaan', 'maksud hasil vitacheck', 'apa maksud hasil vitacheck'],
    summary: 'Panduan memakai VitaCheck sebagai alat refleksi kebiasaan, bukan diagnosis atau alat menentukan penyakit.',
  },
  {
    id: 'ai-untuk-edukasi-kesehatan',
    title: 'AI untuk Edukasi Kesehatan',
    href: 'articles/ai-untuk-edukasi-kesehatan.html',
    category: 'AI & Edukasi Digital',
    keywords: ['ai untuk edukasi kesehatan', 'ai kesehatan', 'ai edukasi', 'edukasi digital', 'teknologi edukasi', 'belajar dengan ai', 'chatbot kesehatan', 'nusa ai', 'batas ai', 'ai bukan dokter', 'ai bukan diagnosis', 'ai bukan pengganti dokter', 'konten ai kesehatan', 'video ai kesehatan'],
    summary: 'Artikel tentang pemanfaatan AI untuk edukasi kesehatan yang etis, amanah, dan tidak menggantikan tenaga kesehatan profesional.',
  },
  {
    id: 'sehat-itu-amanah',
    title: 'Sehat Itu Amanah',
    href: 'articles/sehat-itu-amanah.html',
    category: 'Halal-Thayyib & Gaya Hidup',
    keywords: ['sehat itu amanah', 'pola hidup sehat', 'pola hidup', 'gaya hidup sehat', 'hidup sehat', 'kebiasaan sehat', 'kebiasaan kecil', 'amanah tubuh', 'menjaga tubuh', 'merawat tubuh', 'halal thayyib', 'halal-thayyib', 'ikhtiar sehat', 'tawakal sehat', 'tidur cukup', 'makan seimbang', 'pola makan', 'minum air', 'gerak ringan', 'olahraga ringan'],
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
  let score = title && normalizedText.includes(title) ? 3 : 0;

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
    .map((article) => ({ article, score: scoreArticleMatch(normalizedText, article) }))
    .filter((entry) => entry.score >= MIN_ARTICLE_SCORE)
    .sort((a, b) => b.score - a.score)[0];

  return bestMatch ? bestMatch.article : null;
}
