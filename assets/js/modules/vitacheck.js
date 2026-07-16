import {
  getCurrentPublicUser,
  mapUserAuthError,
  signInPublicUser,
  subscribeUserAuth,
} from './user-auth.js';
import {
  VITACHECK_CATEGORIES,
  VITACHECK_RESULT_BANDS,
  createVitaCheckResultId,
  getVitaCheckResultBand,
  mapVitaCheckHistoryError,
  readLocalVitaCheckResult,
  saveLocalVitaCheckResult,
  saveVitaCheckHistory,
} from './vitacheck-history.js';

const QUESTIONS = [
  {
    id: 'tidur',
    label: 'Tidur',
    question: 'Dalam 7 hari terakhir, bagaimana kualitas tidurmu?',
    options: [
      { label: 'Baik dan cukup', value: 2 },
      { label: 'Kadang cukup', value: 1 },
      { label: 'Sering kurang tidur', value: 0 },
    ],
    focus: 'Tidur 15–30 menit lebih awal.',
    attention: 'Tidur',
    redFlag: true,
    healthyHabit: true,
  },
  {
    id: 'air',
    label: 'Air Minum',
    question: 'Apakah kamu cukup minum air setiap hari?',
    options: [
      { label: 'Cukup teratur', value: 2 },
      { label: 'Kadang lupa', value: 1 },
      { label: 'Sering kurang', value: 0 },
    ],
    focus: 'Siapkan air minum dekat tempat aktivitas.',
    attention: 'Air minum',
    healthyHabit: true,
  },
  {
    id: 'makan',
    label: 'Pola Makan',
    question: 'Bagaimana pola makanmu akhir-akhir ini?',
    options: [
      { label: 'Teratur dan cukup seimbang', value: 2 },
      { label: 'Kadang telat atau asal makan', value: 1 },
      { label: 'Sering tidak teratur', value: 0 },
    ],
    focus: 'Rapikan satu waktu makan terlebih dahulu.',
    attention: 'Pola makan',
    healthyHabit: true,
  },
  {
    id: 'gerak',
    label: 'Gerak Tubuh',
    question: 'Apakah kamu bergerak ringan setiap hari?',
    options: [
      { label: 'Ya, cukup rutin', value: 2 },
      { label: 'Kadang-kadang', value: 1 },
      { label: 'Hampir tidak pernah', value: 0 },
    ],
    focus: 'Jalan kaki atau bergerak ringan 10 menit.',
    attention: 'Gerak tubuh',
    healthyHabit: true,
  },
  {
    id: 'pencernaan',
    label: 'Pencernaan',
    question: 'Bagaimana kondisi pencernaanmu akhir-akhir ini?',
    options: [
      { label: 'Umumnya nyaman', value: 2 },
      { label: 'Kadang tidak nyaman', value: 1 },
      { label: 'Sering bermasalah', value: 0 },
    ],
    focus: 'Perhatikan pola makan dan jangan abaikan keluhan yang menetap.',
    attention: 'Pencernaan',
    redFlag: true,
    healthyHabit: true,
  },
  {
    id: 'energi',
    label: 'Energi / Rasa Lelah',
    question: 'Apakah kamu sering merasa lelah meski aktivitas tidak terlalu berat?',
    options: [
      { label: 'Jarang', value: 2 },
      { label: 'Kadang', value: 1 },
      { label: 'Sering', value: 0 },
    ],
    focus: 'Kurangi begadang dan perhatikan sinyal tubuh.',
    attention: 'Energi / rasa lelah',
    redFlag: true,
    healthyHabit: true,
  },
  {
    id: 'stres',
    label: 'Stres Ringan',
    question: 'Bagaimana kondisi pikiranmu akhir-akhir ini?',
    options: [
      { label: 'Cukup tenang', value: 2 },
      { label: 'Kadang penuh tekanan', value: 1 },
      { label: 'Sering terasa berat', value: 0 },
    ],
    focus: 'Ambil jeda napas, kurangi beban kecil yang tidak perlu, dan cari dukungan jika terasa berat.',
    attention: 'Kondisi pikiran',
    redFlag: true,
  },
  {
    id: 'literasi',
    label: 'Literasi Produk',
    question: 'Saat melihat produk kesehatan, biasanya kamu bagaimana?',
    options: [
      { label: 'Membaca label dan klaim dulu', value: 2 },
      { label: 'Kadang langsung percaya testimoni', value: 1 },
      { label: 'Sering tergoda klaim cepat atau instan', value: 0 },
    ],
    focus: 'Baca label, cek klaim, dan jangan jadikan testimoni sebagai bukti utama.',
    attention: 'Literasi produk',
    productLiteracy: true,
  },
];

const MAX_SCORE = QUESTIONS.length * 2;
const EDUCATION_DISCLAIMER = 'VitaCheck bersifat edukatif dan reflektif. VitaCheck bukan diagnosis medis dan bukan pengganti tenaga kesehatan.';
const RED_FLAG_COPY = 'Catatan penting: Jika keluhan berat, menetap, memburuk, atau mengganggu aktivitas harian, jangan hanya mengandalkan tips umum. Konsultasikan kepada tenaga kesehatan yang berwenang.';
const FIRESTORE_ARTICLE_LIMIT = 80;
let firestoreArticleCache = null;
let firebaseModulesPromise = null;

const RESULT_COPY = {
  strong: {
    min: 80,
    status: 'Kebiasaan cukup kuat',
    summary: 'Pertahankan kebiasaan baik. Jangan terlalu cepat merasa aman, tetapi juga jangan terlalu keras pada diri sendiri. Fokusmu adalah konsistensi.',
  },
  medium: {
    min: 50,
    status: 'Cukup, tetapi perlu dirapikan',
    summary: 'Kebiasaanmu belum buruk, tetapi ada beberapa bagian yang perlu ditata. Pilih satu kebiasaan dulu, jangan memperbaiki semuanya sekaligus.',
  },
  low: {
    min: 0,
    status: 'Perlu perhatian bertahap',
    summary: 'Jangan panik. Mulai dari hal paling dasar. Tubuh sering tidak butuh perubahan ekstrem, tetapi butuh kebiasaan kecil yang diulang.',
  },
};

const ARTICLE_RECOMMENDATIONS = {
  habits: {
    slug: 'kebiasaan-sehat-7-hari',
    title: 'Sehat Itu Dimulai dari Kebiasaan Kecil yang Konsisten',
    href: 'articles/index.html',
    note: 'Buka daftar artikel dan pilih artikel kebiasaan kecil dari Firestore.',
  },
  testimony: {
    slug: 'testimoni-bukan-bukti',
    title: 'Testimoni Bukan Bukti',
    href: 'articles/artikel-3.html',
    note: 'Untuk melatih sikap kritis saat membaca klaim produk.',
  },
  ai: {
    slug: 'ai-untuk-edukasi-kesehatan',
    title: 'AI untuk Edukasi Kesehatan',
    href: 'articles/ai-untuk-edukasi-kesehatan.html',
    note: 'Untuk memahami peran AI sebagai alat bantu edukasi.',
  },
};

function getResultCopy(score) {
  if (score >= RESULT_COPY.strong.min) return RESULT_COPY.strong;
  if (score >= RESULT_COPY.medium.min) return RESULT_COPY.medium;
  return RESULT_COPY.low;
}

function getInitialAnswers() {
  return QUESTIONS.map(() => null);
}

function calculateScoreFromAnswers(answers) {
  const total = answers.reduce((sum, answer) => sum + Number(answer?.value ?? 0), 0);
  return Math.round((total / MAX_SCORE) * 100);
}

function getAnsweredCount(answers) {
  return answers.filter((answer) => answer !== null).length;
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

function renderList(listElement, items) {
  listElement.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      return li;
    }),
  );
}

function animateScore(element, nextScore) {
  const startScore = Number(element.textContent) || 0;
  const duration = 520;
  const startTime = performance.now();

  element.classList.add('vn-score-pop');

  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(startScore + (nextScore - startScore) * eased);

    element.textContent = String(value);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = String(nextScore);
      window.setTimeout(() => element.classList.remove('vn-score-pop'), 160);
    }
  }

  requestAnimationFrame(tick);
}

function saveResult(payload) {
  try {
    return saveLocalVitaCheckResult(payload);
  } catch {
    // localStorage mungkin tidak tersedia di beberapa mode browser.
    return null;
  }
}

function readSavedResult() {
  return readLocalVitaCheckResult();
}

function buildVitaCheckShell(form) {
  form.classList.add('vitacheck-form-v2');
  form.setAttribute('novalidate', 'novalidate');
  form.innerHTML = `
    <div class="vitacheck-v2" data-vc-root>
      <div class="vitacheck-intro">
        <span class="article-category">VitaCheck V2</span>
        <h3>Asisten refleksi kebiasaan sehat</h3>
        <p>${EDUCATION_DISCLAIMER}</p>
      </div>

      <div class="vitacheck-progress-wrap" aria-label="Progres VitaCheck">
        <div class="vitacheck-progress-meta">
          <span data-vc-step> Pertanyaan 1 dari ${QUESTIONS.length}</span>
          <span data-vc-percent>0%</span>
        </div>
        <div class="vitacheck-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Progres jawaban VitaCheck">
          <span data-vc-progress-bar></span>
        </div>
      </div>

      <div class="vitacheck-question-card">
        <p class="eyebrow" data-vc-label></p>
        <h3 id="vitacheck-question" data-vc-question></h3>
        <div class="vitacheck-options" data-vc-options role="group" aria-labelledby="vitacheck-question"></div>
      </div>

      <div class="vitacheck-actions">
        <button class="btn outline" type="button" data-vc-prev>Sebelumnya</button>
        <button class="btn primary" type="button" data-vc-next disabled>Lanjut</button>
      </div>

      <p class="note vitacheck-helper" data-vc-helper>Jawab dengan jujur sesuai kebiasaan 7 hari terakhir. Tidak perlu sempurna, cukup mulai sadar.</p>
    </div>
  `;
}

function getShell(form) {
  return {
    root: form.querySelector('[data-vc-root]'),
    step: form.querySelector('[data-vc-step]'),
    percent: form.querySelector('[data-vc-percent]'),
    progress: form.querySelector('.vitacheck-progress'),
    progressBar: form.querySelector('[data-vc-progress-bar]'),
    label: form.querySelector('[data-vc-label]'),
    question: form.querySelector('[data-vc-question]'),
    options: form.querySelector('[data-vc-options]'),
    prev: form.querySelector('[data-vc-prev]'),
    next: form.querySelector('[data-vc-next]'),
    helper: form.querySelector('[data-vc-helper]'),
  };
}

function ensureResultDetails(output) {
  const resultCard = output.status.closest('.card') || output.status.parentElement;
  if (!resultCard) return null;

  resultCard.classList.add('vitacheck-result-card');
  resultCard.setAttribute('aria-live', 'polite');
  resultCard.setAttribute('aria-atomic', 'false');

  let details = resultCard.querySelector('[data-vc-result-details]');
  if (details) return details;

  details = document.createElement('div');
  details.className = 'vitacheck-result-details';
  details.setAttribute('data-vc-result-details', '');
  details.innerHTML = `
    <section class="vitacheck-result-section">
      <h4>Titik kuat</h4>
      <ul data-vc-strong-list><li>Isi VitaCheck untuk melihat titik kuatmu.</li></ul>
    </section>
    <section class="vitacheck-result-section">
      <h4>Perlu diperhatikan</h4>
      <ul data-vc-attention-list><li>Isi VitaCheck untuk melihat bagian yang perlu dirapikan.</li></ul>
    </section>
    <section class="vitacheck-result-section">
      <h4>Artikel disarankan</h4>
      <div class="vitacheck-articles" data-vc-articles>
        <a href="articles/index.html">Buka daftar artikel VitaNusa AI</a>
      </div>
    </section>
    <section class="vitacheck-save-panel" data-vc-save-panel hidden aria-busy="false">
      <h4>Simpan hasil refleksi</h4>
      <p>Hasil otomatis tersimpan secara lokal di perangkat ini. Penyimpanan ke akun selalu memerlukan persetujuanmu.</p>
      <div class="vitacheck-save-actions">
        <button class="btn outline" type="button" data-vc-save-local>Simpan di perangkat</button>
        <button class="btn primary" type="button" data-vc-save-cloud>Simpan ke akun</button>
        <a class="btn outline" href="account.html#riwayat-vitacheck">Lihat riwayat</a>
      </div>
      <div class="vn-inline-status" data-vc-save-status role="status" aria-live="polite" hidden></div>
      <dialog class="vn-confirm-dialog" data-vc-save-dialog aria-labelledby="vcSaveDialogTitle">
        <form method="dialog" class="vn-confirm-dialog-card">
          <p class="eyebrow">Persetujuan penyimpanan</p>
          <h4 id="vcSaveDialogTitle">Simpan ringkasan ke akun?</h4>
          <p>Hanya versi, skor refleksi, kategori hasil, ID fokus, ID perhatian, slug artikel, sumber, dan waktu server yang dikirim. Jawaban mentah tidak dikirim.</p>
          <div class="vn-dialog-actions">
            <button class="btn outline" type="button" data-vc-save-cancel>Batal</button>
            <button class="btn primary" type="button" data-vc-save-confirm>Simpan ringkasan privat</button>
          </div>
        </form>
      </dialog>
    </section>
    <p class="note vitacheck-redflag" data-vc-redflag hidden>${RED_FLAG_COPY}</p>
    <p class="note vitacheck-disclaimer">${EDUCATION_DISCLAIMER}</p>
    <button class="btn outline full" type="button" data-vc-reset>Ulangi VitaCheck</button>
  `;

  output.focus.insertAdjacentElement('afterend', details);
  return details;
}

function getOutputElements() {
  const output = {
    score: document.getElementById('skor'),
    status: document.getElementById('status'),
    summary: document.getElementById('ringkasan'),
    focus: document.getElementById('fokus'),
  };

  if (!output.score || !output.status || !output.summary || !output.focus) return null;

  const details = ensureResultDetails(output);
  if (!details) return null;

  return {
    ...output,
    strongList: details.querySelector('[data-vc-strong-list]'),
    attentionList: details.querySelector('[data-vc-attention-list]'),
    articles: details.querySelector('[data-vc-articles]'),
    savePanel: details.querySelector('[data-vc-save-panel]'),
    saveLocal: details.querySelector('[data-vc-save-local]'),
    saveCloud: details.querySelector('[data-vc-save-cloud]'),
    saveStatus: details.querySelector('[data-vc-save-status]'),
    saveDialog: details.querySelector('[data-vc-save-dialog]'),
    saveCancel: details.querySelector('[data-vc-save-cancel]'),
    saveConfirm: details.querySelector('[data-vc-save-confirm]'),
    redFlag: details.querySelector('[data-vc-redflag]'),
    reset: details.querySelector('[data-vc-reset]'),
  };
}

function getAnswerSummary(answers) {
  const answered = QUESTIONS.map((question, index) => ({ ...question, answer: answers[index] }))
    .filter((item) => item.answer !== null);

  const strong = answered
    .filter((item) => item.answer.value === 2)
    .map((item) => `${item.label}: ${item.answer.label}`);

  const attention = answered
    .filter((item) => item.answer.value === 0)
    .map((item) => item.attention);

  const low = answered
    .filter((item) => item.answer.value === 0);

  const medium = answered
    .filter((item) => item.answer.value === 1);

  const focusSource = low.length ? low : medium;
  const focus = focusSource.slice(0, 4).map((item) => item.focus);

  const hasRedFlag = answered.some((item) => item.redFlag && item.answer.value === 0);
  const hasLowHealthyHabit = answered.some((item) => item.healthyHabit && item.answer.value === 0);
  const hasLowProductLiteracy = answered.some((item) => item.productLiteracy && item.answer.value <= 1);

  return {
    strong: strong.length ? strong : ['Kesadaran untuk mengecek kebiasaan sudah menjadi langkah awal yang baik.'],
    attention: attention.length ? attention : ['Tidak ada titik perhatian besar dari jawabanmu, tetap jaga konsistensi.'],
    focus: focus.length ? focus : ['Pertahankan rutinitas sehat yang sudah berjalan.', 'Evaluasi kebiasaan setiap pekan.', 'Tetap kritis terhadap klaim produk yang terlalu instan.'],
    hasRedFlag,
    hasLowHealthyHabit,
    hasLowProductLiteracy,
  };
}

function getStoredResultSummary(payload) {
  const focusIds = Array.isArray(payload?.focusIds) ? payload.focusIds : [];
  const attentionIds = Array.isArray(payload?.attentionIds) ? payload.attentionIds : [];
  const redFlagIds = new Set(['tidur', 'pencernaan', 'energi', 'stres']);

  return {
    strong: ['Ringkasan lokal tidak menyimpan jawaban per pertanyaan.'],
    attention: attentionIds.length
      ? attentionIds.map((id) => VITACHECK_CATEGORIES[id]?.label || id)
      : ['Tidak ada kategori perhatian yang tersimpan.'],
    focus: focusIds.length
      ? focusIds.map((id) => VITACHECK_CATEGORIES[id]?.focus || VITACHECK_CATEGORIES[id]?.label || id)
      : ['Pertahankan rutinitas sehat yang sudah berjalan.'],
    hasRedFlag: attentionIds.some((id) => redFlagIds.has(id)),
    hasLowHealthyHabit: attentionIds.some((id) => id !== 'stres' && id !== 'literasi'),
    hasLowProductLiteracy: attentionIds.includes('literasi'),
  };
}

function getStoredRecommendedArticles(payload) {
  const slugs = Array.isArray(payload?.recommendationSlugs) ? payload.recommendationSlugs : [];
  const known = Object.values(ARTICLE_RECOMMENDATIONS);
  return slugs.map((slug) => {
    const match = known.find((article) => article.slug === slug);
    if (match) return match;
    return {
      slug,
      title: slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      href: `articles/detail.html?slug=${encodeURIComponent(slug)}`,
      note: 'Artikel terkait ringkasan VitaCheck.',
    };
  });
}

function getRecommendedArticles(summary) {
  const articles = [];

  if (summary.hasLowProductLiteracy) articles.push(ARTICLE_RECOMMENDATIONS.testimony);
  if (summary.hasLowHealthyHabit) articles.push(ARTICLE_RECOMMENDATIONS.habits);
  articles.push(ARTICLE_RECOMMENDATIONS.ai);

  if (!articles.some((article) => article.href === ARTICLE_RECOMMENDATIONS.habits.href)) {
    articles.push(ARTICLE_RECOMMENDATIONS.habits);
  }

  const uniqueArticles = [];
  for (const article of articles) {
    if (!uniqueArticles.some((item) => item.title === article.title)) uniqueArticles.push(article);
  }

  return uniqueArticles.slice(0, 3);
}

async function loadFirebaseModules() {
  if (!firebaseModulesPromise) {
    firebaseModulesPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
    ]).then(([appModule, firestoreModule]) => ({
      initializeApp: appModule.initializeApp,
      getApp: appModule.getApp,
      getApps: appModule.getApps,
      getFirestore: firestoreModule.getFirestore,
      collection: firestoreModule.collection,
      getDocs: firestoreModule.getDocs,
      query: firestoreModule.query,
      where: firestoreModule.where,
      limit: firestoreModule.limit
    }));
  }
  return firebaseModulesPromise;
}

async function getDb() {
  const { initializeApp, getApp, getApps, getFirestore } = await loadFirebaseModules();
  const { firebaseConfig } = await import('../../../admin/firebase-config.js');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[?!.:,;()[\]{}"'`~_+=/\\|-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function getList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

async function loadPublishedFirestoreArticles() {
  if (firestoreArticleCache) return firestoreArticleCache;
  const { collection, getDocs, query, where, limit } = await loadFirebaseModules();
  const db = await getDb();
  const publishedQuery = query(collection(db, 'articles'), where('status', '==', 'published'), limit(FIRESTORE_ARTICLE_LIMIT));
  const snapshot = await getDocs(publishedQuery);
  firestoreArticleCache = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((article) => article.status === 'published' && article.title && article.slug);
  return firestoreArticleCache;
}

function getVitaCheckSignals(summary) {
  const attention = [...(summary.attention || []), ...(summary.focus || [])].join(' ');
  const normalized = normalizeText(attention);
  const signals = new Set(['vitacheck', 'kebiasaan sehat']);
  if (/tidur|lelah|energi|begadang/.test(normalized)) ['tidur', 'energi harian'].forEach((item) => signals.add(item));
  if (/air|minum/.test(normalized)) ['air', 'kebiasaan sehat'].forEach((item) => signals.add(item));
  if (/makan|pola makan|serat|gizi/.test(normalized)) ['pola makan', 'pencernaan'].forEach((item) => signals.add(item));
  if (/gerak|aktivitas|jalan kaki|olahraga/.test(normalized)) ['gerak', 'kebiasaan sehat'].forEach((item) => signals.add(item));
  if (/cerna|pencernaan|perut/.test(normalized)) signals.add('pencernaan');
  if (summary.hasLowProductLiteracy) ['literasi produk', 'testimoni', 'klaim produk'].forEach((item) => signals.add(item));
  return [...signals];
}

function scoreVitaCheckArticle(article, signals) {
  const haystack = normalizeText([
    article.title,
    article.slug,
    article.category,
    article.summary,
    article.answerSnippet,
    ...getList(article.tags),
    ...getList(article.problemTags),
    ...getList(article.userQuestions)
  ].join(' '));
  return signals.reduce((score, signal) => score + (haystack.includes(normalizeText(signal)) ? 1 : 0), 0);
}

async function getFirestoreRecommendedArticles(summary) {
  try {
    const signals = getVitaCheckSignals(summary);
    const articles = await loadPublishedFirestoreArticles();
    return articles
      .map((article) => ({ article, score: scoreVitaCheckArticle(article, signals) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ article }) => ({
        slug: article.slug,
        title: article.title,
        href: `articles/detail.html?slug=${encodeURIComponent(article.slug)}`,
        note: article.answerSnippet || article.summary || 'Artikel terkait hasil VitaCheck.'
      }));
  } catch (error) {
    console.warn('Rekomendasi artikel Firestore untuk VitaCheck belum tersedia:', error);
    return [];
  }
}

function renderArticles(container, articles) {
  container.replaceChildren(
    ...articles.map((article) => {
      const link = document.createElement('a');
      link.href = article.href;
      link.className = 'vitacheck-article-link';
      const title = document.createElement('strong');
      const note = document.createElement('span');
      title.textContent = article.title;
      note.textContent = article.note;
      link.append(title, note);
      return link;
    }),
  );
}

function renderResult(output, payload, { animate = true } = {}) {
  const result = getResultCopy(payload.score);
  const summary = payload.summary || getStoredResultSummary(payload);
  const articles = payload.articles || getStoredRecommendedArticles(payload);

  if (animate) {
    animateScore(output.score, payload.score);
  } else {
    output.score.textContent = String(payload.score);
  }

  output.status.textContent = result.status;
  output.summary.textContent = result.summary;
  renderList(output.focus, summary.focus);
  renderList(output.strongList, summary.strong);
  renderList(output.attentionList, summary.attention);
  renderArticles(output.articles, articles);
  if (output.savePanel) output.savePanel.hidden = false;

  if (output.redFlag) output.redFlag.hidden = !summary.hasRedFlag;
}

async function refreshFirestoreRecommendations(output, payload) {
  const summary = payload.summary || getStoredResultSummary(payload);
  const articles = await getFirestoreRecommendedArticles(summary);
  if (!articles.length) return;
  payload.articles = articles;
  payload.recommendationSlugs = articles.map((article) => article.slug).filter(Boolean).slice(0, 3);
  renderArticles(output.articles, articles);
  saveResult(payload);
}

function buildPayload(answers) {
  const score = calculateScoreFromAnswers(answers);
  const summary = getAnswerSummary(answers);
  const articles = getRecommendedArticles(summary);
  const answered = answers.map((answer, index) => ({ answer, question: QUESTIONS[index] }));
  const lowIds = answered.filter((item) => item.answer?.value === 0).map((item) => item.question.id);
  const mediumIds = answered.filter((item) => item.answer?.value === 1).map((item) => item.question.id);

  return {
    resultId: createVitaCheckResultId(),
    version: 2,
    score,
    resultBand: getVitaCheckResultBand(score),
    focusIds: (lowIds.length ? lowIds : mediumIds).slice(0, 4),
    attentionIds: lowIds.slice(0, 4),
    recommendationSlugs: articles.map((article) => article.slug).filter(Boolean).slice(0, 3),
    source: 'vitacheck-v2',
    summary,
    articles,
    createdAt: new Date().toISOString(),
  };
}

function renderStep(shell, answers, currentIndex) {
  const question = QUESTIONS[currentIndex];
  const selectedAnswer = answers[currentIndex];
  const answeredPercent = Math.round((getAnsweredCount(answers) / QUESTIONS.length) * 100);

  shell.step.textContent = `Pertanyaan ${currentIndex + 1} dari ${QUESTIONS.length}`;
  shell.percent.textContent = `${answeredPercent}%`;
  shell.progress.setAttribute('aria-valuenow', String(answeredPercent));
  shell.progressBar.style.width = `${answeredPercent}%`;
  shell.label.textContent = question.label;
  shell.question.textContent = question.question;
  shell.prev.disabled = currentIndex === 0;
  shell.next.disabled = !selectedAnswer;
  shell.next.textContent = currentIndex === QUESTIONS.length - 1 ? 'Lihat Hasil' : 'Lanjut';
  shell.helper.textContent = selectedAnswer
    ? `Pilihanmu: ${selectedAnswer.label}. Kamu bisa lanjut atau kembali jika ingin mengubah jawaban.`
    : 'Pilih jawaban yang paling mendekati kondisi 7 hari terakhir.';

  shell.options.replaceChildren(
    ...question.options.map((option) => {
      const button = document.createElement('button');
      const isActive = selectedAnswer?.value === option.value && selectedAnswer?.label === option.label;

      button.type = 'button';
      button.className = `vitacheck-option${isActive ? ' is-active' : ''}`;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.dataset.value = String(option.value);
      button.innerHTML = `<strong>${option.label}</strong><span>${option.value === 2 ? 'Kuat' : option.value === 1 ? 'Sedang' : 'Perlu perhatian'}</span>`;
      button.addEventListener('click', () => {
        answers[currentIndex] = { value: option.value, label: option.label, questionId: question.id };
        renderStep(shell, answers, currentIndex);
      });

      return button;
    }),
  );
}

function updateSavedNote(form, text) {
  let note = form.parentElement?.querySelector('[data-vc-saved-note]');
  if (!note) {
    note = createElement('p', 'note vitacheck-saved-note', text);
    note.setAttribute('data-vc-saved-note', '');
    form.insertAdjacentElement('afterend', note);
    return;
  }

  note.textContent = text;
}

function setSaveStatus(output, kind, title, message, busy = false) {
  if (!output.saveStatus) return;
  output.saveStatus.hidden = false;
  output.saveStatus.dataset.kind = kind;
  output.saveStatus.setAttribute('aria-busy', String(busy));
  output.saveStatus.replaceChildren();
  const strong = document.createElement('strong');
  const span = document.createElement('span');
  strong.textContent = title;
  span.textContent = message;
  output.saveStatus.append(strong, span);
}

function setSaveButtonsBusy(output, busy) {
  if (output.savePanel) output.savePanel.setAttribute('aria-busy', String(busy));
  if (output.saveLocal) output.saveLocal.disabled = busy;
  if (output.saveCloud) {
    output.saveCloud.disabled = busy;
    output.saveCloud.textContent = busy ? 'Memproses…' : 'Simpan ke akun';
  }
  if (output.saveConfirm) output.saveConfirm.disabled = busy;
  if (output.saveCancel) output.saveCancel.disabled = busy;
}

export function initVitaCheck({ formSelector = '#form' } = {}) {
  const form = document.querySelector(formSelector);
  if (!form) return null;

  buildVitaCheckShell(form);

  const shell = getShell(form);
  const output = getOutputElements();
  if (!shell.root || !output) return null;

  const answers = getInitialAnswers();
  let currentIndex = 0;
  let currentPayload = null;
  let authState = { isAuthenticated: false, user: null };
  let saveOperationInFlight = false;
  let loginRequestedForSave = false;

  const saved = readSavedResult();
  if (saved) {
    currentPayload = saved;
    renderResult(output, saved, { animate: false });
    setSaveStatus(output, 'neutral', 'Tersimpan di perangkat', 'Login dan penyimpanan cloud tetap bersifat opsional.');
    updateSavedNote(form, `Hasil terakhir tersimpan lokal: skor refleksi ${saved.score}/100. Isi ulang VitaCheck kapan saja untuk memperbarui fokus 7 hari.`);
  }

  renderStep(shell, answers, currentIndex);

  const closeSaveDialog = ({ restoreFocus = true } = {}) => {
    if (!output.saveDialog) return;
    if (output.saveDialog.open) output.saveDialog.close();
    else output.saveDialog.hidden = true;
    if (restoreFocus) output.saveCloud?.focus({ preventScroll: true });
  };

  const openSaveDialog = () => {
    if (!output.saveDialog || saveOperationInFlight) return;
    output.saveDialog.hidden = false;
    if (typeof output.saveDialog.showModal === 'function' && !output.saveDialog.open) {
      output.saveDialog.showModal();
    }
    output.saveConfirm?.focus({ preventScroll: true });
  };

  const handleSaveLocal = () => {
    if (!currentPayload || saveOperationInFlight) return;
    const savedResult = saveResult(currentPayload);
    if (savedResult) {
      setSaveStatus(output, 'success', 'Tersimpan di perangkat', 'Ringkasan berbasis ID disimpan lokal tanpa jawaban mentah.');
    } else {
      setSaveStatus(output, 'error', 'Penyimpanan lokal belum berhasil', 'Browser tidak menyediakan localStorage. Hasil pada layar tidak dihapus.');
    }
  };

  const handleSaveCloud = async () => {
    if (!currentPayload || saveOperationInFlight) return;
    const user = getCurrentPublicUser();

    if (!user) {
      loginRequestedForSave = true;
      saveOperationInFlight = true;
      setSaveButtonsBusy(output, true);
      setSaveStatus(output, 'loading', 'Login diperlukan', 'Setelah login, tekan Simpan ke akun lagi. Tidak ada upload otomatis.', true);
      try {
        const result = await signInPublicUser();
        if (result.mode === 'popup') {
          loginRequestedForSave = false;
          setSaveStatus(output, 'success', 'Login berhasil', 'Tekan Simpan ke akun lagi untuk membuka konfirmasi penyimpanan.');
        }
      } catch (error) {
        loginRequestedForSave = false;
        const mapped = mapUserAuthError(error);
        setSaveStatus(output, 'error', mapped.title, `${mapped.message} Hasil tetap tersimpan di perangkat.`);
      } finally {
        saveOperationInFlight = false;
        setSaveButtonsBusy(output, false);
      }
      return;
    }

    openSaveDialog();
  };

  const handleSaveConfirm = async () => {
    if (!currentPayload || saveOperationInFlight) return;
    const user = getCurrentPublicUser();
    if (!user) {
      closeSaveDialog();
      setSaveStatus(output, 'error', 'Sesi berubah', 'Sesi pengguna tidak lagi valid. Silakan login kembali. Hasil lokal tetap tersedia.');
      return;
    }

    saveOperationInFlight = true;
    setSaveButtonsBusy(output, true);
    setSaveStatus(output, 'loading', 'Menyimpan ringkasan privat', 'Mengirim hanya field minimal yang diizinkan.', true);

    try {
      await saveVitaCheckHistory({ uid: user.uid, result: currentPayload });
      closeSaveDialog({ restoreFocus: false });
      setSaveStatus(output, 'success', 'Tersimpan ke akun', 'Hasil berhasil disimpan secara privat ke akunmu.');
      output.saveCloud?.focus({ preventScroll: true });
    } catch (error) {
      const mapped = mapVitaCheckHistoryError(error);
      if (mapped.code === 'already-exists') {
        closeSaveDialog({ restoreFocus: false });
        setSaveStatus(output, 'success', mapped.title, mapped.message);
        output.saveCloud?.focus({ preventScroll: true });
      } else {
        setSaveStatus(output, 'error', mapped.title, `Hasil tetap tersimpan di perangkat. Penyimpanan akun belum berhasil. ${mapped.message}`);
      }
    } finally {
      saveOperationInFlight = false;
      setSaveButtonsBusy(output, false);
    }
  };

  const handleSaveCancel = () => {
    if (saveOperationInFlight) return;
    closeSaveDialog();
    setSaveStatus(output, 'neutral', 'Penyimpanan dibatalkan', 'Tidak ada ringkasan yang dikirim ke akun. Hasil lokal tetap tersedia.');
  };

  const handleSaveDialogCancel = (event) => {
    event.preventDefault();
    handleSaveCancel();
  };

  const unsubscribeAuth = subscribeUserAuth((state) => {
    authState = state;
    if (loginRequestedForSave && authState.isAuthenticated) {
      loginRequestedForSave = false;
      setSaveStatus(output, 'success', 'Login berhasil', 'Tekan Simpan ke akun lagi untuk membuka konfirmasi penyimpanan.');
    }
  });

  const handlePrevious = () => {
    currentIndex = Math.max(0, currentIndex - 1);
    renderStep(shell, answers, currentIndex);
  };

  const handleNext = () => {
    if (!answers[currentIndex]) return;

    if (currentIndex < QUESTIONS.length - 1) {
      currentIndex += 1;
      renderStep(shell, answers, currentIndex);
      return;
    }

    const payload = buildPayload(answers);
    currentPayload = payload;
    renderResult(output, payload, { animate: true });
    saveResult(payload);
    refreshFirestoreRecommendations(output, payload);
    setSaveStatus(output, 'success', 'Tersimpan di perangkat', 'Belum ada data yang dikirim ke akun. Pilih Simpan ke akun jika kamu menyetujuinya.');
    updateSavedNote(form, `Hasil terbaru tersimpan lokal: skor refleksi ${payload.score}/100. Gunakan sebagai bahan refleksi kebiasaan, bukan diagnosis medis.`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleNext();
  };

  const handleReset = () => {
    answers.fill(null);
    currentIndex = 0;
    currentPayload = null;
    output.score.textContent = '0';
    output.status.textContent = 'Hasil Edukasi';
    output.summary.textContent = 'Isi VitaCheck untuk melihat saran kebiasaan sehat.';
    renderList(output.focus, ['Mulai dari satu kebiasaan kecil.']);
    renderList(output.strongList, ['Isi VitaCheck untuk melihat titik kuatmu.']);
    renderList(output.attentionList, ['Isi VitaCheck untuk melihat bagian yang perlu dirapikan.']);
    renderArticles(output.articles, [{ title: 'Buka daftar artikel VitaNusa AI', href: 'articles/index.html', note: 'Pilih artikel edukasi yang paling sesuai kebutuhanmu.' }]);
    if (output.redFlag) output.redFlag.hidden = true;
    if (output.savePanel) output.savePanel.hidden = true;
    closeSaveDialog({ restoreFocus: false });
    renderStep(shell, answers, currentIndex);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  shell.prev.addEventListener('click', handlePrevious);
  shell.next.addEventListener('click', handleNext);
  form.addEventListener('submit', handleSubmit);
  output.reset?.addEventListener('click', handleReset);
  output.saveLocal?.addEventListener('click', handleSaveLocal);
  output.saveCloud?.addEventListener('click', handleSaveCloud);
  output.saveConfirm?.addEventListener('click', handleSaveConfirm);
  output.saveCancel?.addEventListener('click', handleSaveCancel);
  output.saveDialog?.addEventListener('cancel', handleSaveDialogCancel);

  return {
    calculateScore: calculateScoreFromAnswers,
    getResultCopy,
    destroy() {
      shell.prev.removeEventListener('click', handlePrevious);
      shell.next.removeEventListener('click', handleNext);
      form.removeEventListener('submit', handleSubmit);
      output.reset?.removeEventListener('click', handleReset);
      output.saveLocal?.removeEventListener('click', handleSaveLocal);
      output.saveCloud?.removeEventListener('click', handleSaveCloud);
      output.saveConfirm?.removeEventListener('click', handleSaveConfirm);
      output.saveCancel?.removeEventListener('click', handleSaveCancel);
      output.saveDialog?.removeEventListener('cancel', handleSaveDialogCancel);
      unsubscribeAuth();
    },
  };
}
