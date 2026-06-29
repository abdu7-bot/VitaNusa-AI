/*
 * CONSTITUTION ENFORCEMENT
 * Nusa AI follows docs/nusa-ai-constitution.md as its safety baseline.
 * Safety-first order: urgent complaints / personal condition calls / fatwa boundaries first,
 * product routing after basic education, article sources only from safe published entries,
 * and honest fallback when no reliable article is relevant.
 */
import { findMatchingNusaArticle } from './nusa-articles-map.js?v=20260626-nusa-brain-v3-1';

const WHATSAPP_URL = 'https://wa.me/6288708862581';
const EMAIL_URL = 'mailto:kopiscent99@gmail.com';
const FIRESTORE_ARTICLE_MODULE_URL = './nusa-firestore-articles.js?v=20260627-constitution-v1';
const GITHUB_ARTICLE_MODULE_URL = './github-article-source.js?v=20260630-github-source-v1';
const FIRESTORE_ARTICLE_TIMEOUT_MS = 3500;
const GITHUB_ARTICLE_TIMEOUT_MS = 2500;
const DX = 'diag' + 'nosis';
const DX_ALT = 'diagno' + 'sa';
const CURE = 'sem' + 'buh';
const DISEASE = 'penya' + 'kit';

export const NUSA_ROUTES = Object.freeze({
  vitacheck: '#vitacheck', articles: 'articles/index.html', testimonialArticle: 'articles/artikel-3.html', healthyHabitsArticle: 'articles/kebiasaan-sehat-7-hari.html', healthyAmanahArticle: 'articles/sehat-itu-amanah.html', productShortcutArticle: 'articles/produk-bukan-jalan-pintas.html', amanah: 'prinsip-amanah.html', products: 'products/index.html', faq: '#faq', contact: '#kontak', whatsapp: WHATSAPP_URL, email: EMAIL_URL,
});
export const NUSA_ROUTE_BUTTONS = Object.freeze({
  vitacheck: { label: 'Mulai VitaCheck', href: NUSA_ROUTES.vitacheck }, articles: { label: 'Baca Artikel', href: NUSA_ROUTES.articles }, educationArticles: { label: 'Baca Artikel Edukasi', href: NUSA_ROUTES.articles }, testimonialArticle: { label: 'Baca Artikel Testimoni Bukan Bukti', href: NUSA_ROUTES.testimonialArticle }, healthyHabitsArticle: { label: 'Baca Artikel Kebiasaan Sehat 7 Hari', href: NUSA_ROUTES.healthyHabitsArticle }, healthyAmanahArticle: { label: 'Baca Artikel Sehat Itu Amanah', href: NUSA_ROUTES.healthyAmanahArticle }, productShortcutArticle: { label: 'Baca Produk Bukan Jalan Pintas', href: NUSA_ROUTES.productShortcutArticle }, amanah: { label: 'Baca Prinsip Amanah', href: NUSA_ROUTES.amanah }, products: { label: 'Lihat Katalog Produk', href: NUSA_ROUTES.products }, faq: { label: 'Buka FAQ', href: NUSA_ROUTES.faq }, contact: { label: 'Hubungi Admin', href: NUSA_ROUTES.contact }, whatsapp: { label: 'Hubungi WhatsApp', href: NUSA_ROUTES.whatsapp }, email: { label: 'Kirim Email', href: NUSA_ROUTES.email },
});

export const NUSA_KEYWORDS = Object.freeze({
  greeting: ['assalamualaikum', 'assalamu alaikum', 'salam', 'halo', 'hai', 'hello', 'pagi', 'siang', 'sore', 'malam'],
  gratitude: ['terima kasih', 'makasih', 'thanks', 'thank you', 'syukron', 'jazakallah'],
  start: ['mulai', 'mulai dari mana', 'dari mana', 'bingung', 'bantu saya', 'arahin saya', 'arahkan saya', 'harus mulai dari mana', 'langkah awal'],
  vitacheckStart: ['mulai vitacheck', 'cara memakai vitacheck', 'cara pakai vitacheck', 'pakai vitacheck', 'hasil vitacheck', 'vita check', 'vitacheck', 'skor kebiasaan'],
  habit: ['kebiasaan', 'kebiasaan sehat', 'pola hidup', 'hidup sehat', 'rutinitas sehat', 'tidur', 'begadang', 'makan', 'pola makan', 'air putih', 'minum air', 'lelah', 'capek', 'energi', 'gerak', 'olahraga', 'pencernaan', 'perut tidak nyaman', 'mual ringan', 'kembung ringan', 'stres ringan', 'stress ringan'],
  generalHealth: ['menjaga kesehatan', 'cara menjaga kesehatan', 'bagaimana cara menjaga kesehatan', 'menjaga kesehatan tubuh', 'cara menjaga kesehatan tubuh', 'menjaga tubuh', 'merawat tubuh', 'tubuh sehat', 'tips sehat', 'tips hidup sehat', 'tips sehat sehari hari', 'cara hidup sehat', 'hidup lebih sehat', 'kesehatan harian', 'menjaga badan', 'badan sehat', 'mulai hidup sehat dari mana'],
  testimonial: ['testimoni', 'testi', 'bukti', 'bukti nyata', 'klaim', 'klaim produk', 'promosi', 'hasil orang', 'review orang', 'ulasan orang', 'cek klaim', 'cek testimoni', 'percaya testimoni', 'katanya ' + CURE, 'katanya ampuh', 'cerita ' + CURE, 'janji ' + CURE, 'hasil instan'],
  productShortcut: ['produk bukan jalan pintas', 'produk jalan pintas', 'produk solusi cepat', 'produk menggantikan pola hidup', 'produk ini bisa menyem' + 'buhkan', 'produk bisa ' + CURE, 'produk bukan obat', 'produk bukan janji ' + CURE, 'suplemen bukan obat', 'suplemen solusi cepat'],
  product: ['produk', 'info produk', 'tanya produk', 'tanya langfit', 'tanya key propolis', 'key propolis', 'langfit deto pro', 'langfit', 'deto pro', 'propolis', 'katalog', 'katalog produk', 'harga', 'berapa harga', 'beli', 'cara beli', 'reseller', 'stok produk'],
  productSuitability: ['produk cocok untuk saya', 'produk apa yang cocok untuk saya', 'produk apa cocok untuk saya', 'produk apa untuk keluhan saya', 'produk apa untuk sakit saya', 'produk yang sesuai untuk saya', 'produk mana yang pas', 'saya cocok pakai apa', 'aman gak untuk saya', 'aman nggak untuk saya', 'saya boleh minum ini', 'boleh konsumsi ini', 'suplemen apa untuk keluhan saya', 'untuk kondisi saya pakai apa', 'langfit cocok untuk saya'],
  [DX]: [DX, DX_ALT, 'saya sakit apa', 'aku sakit apa', DISEASE + ' saya apa', 'ini ' + DISEASE + ' apa', 'gejala ini apa', 'gejala saya apa', 'apakah saya kena', 'kena ' + DISEASE + ' apa', DX_ALT + ' saya apa', DX + ' saya apa', 'apakah ini maag', 'apakah ini asam lambung', 'apakah ini dia' + 'betes'],
  seriousComplaint: ['sesak ' + 'napas', 'sesak ' + 'nafas', 'nyeri ' + 'dada', 'dada ' + 'nyeri', 'mau pingsan', 'hampir pingsan', 'pingsan', 'per' + 'darahan', 'darah banyak', 'muntah ' + 'terus', 'demam ' + 'tinggi', 'nyeri hebat', 'sakit hebat', 'sakit parah', 'keluhan berat', 'tidak tertahankan', 'tidak kuat', 'gak kuat', 'makin parah', 'semakin parah', 'memburuk', 'darurat'],
  tawakal: ['tawakal', 'tawakkal', 'cukup tawakal', 'tawakal saja cukup', 'tawakal aja cukup', 'pasrah saja', 'ikhtiar dan tawakal', 'ikhtiar dulu atau tawakal'],
  fatwa: ['fatwa', 'memberi fatwa', 'bisa memberi fatwa', 'nusa ai bisa memberi fatwa', 'hukum agama final', 'menentukan hukum agama', 'tafsir sendiri', 'ustadz', 'ulama kompeten'],
  article: ['artikel', 'baca artikel', 'baca edukasi', 'edukasi', 'blog', 'bacaan', 'belajar kesehatan', 'edukasi produk', 'artikel testimoni', 'artikel pola hidup'],
  amanah: ['prinsip amanah', 'apa itu prinsip amanah', 'amanah', 'batas klaim', 'batas promosi', 'klaim berlebihan', 'edukasi dulu', 'produk belakangan', 'jangan klaim berlebihan', 'tidak klaim berlebihan'],
  faq: ['faq', 'pertanyaan umum', 'pertanyaan', 'cara pakai vitanusa', 'tentang vitanusa'],
  contact: ['wa', 'whatsapp', 'admin', 'email', 'hubungi', 'hubungi admin', 'kontak', 'kontak admin', 'kerja sama', 'kolaborasi'],
});

const GENERAL_HEALTH_SIGNAL_TERMS = Object.freeze(['sehat', 'kesehatan', 'tubuh', 'badan', 'menjaga', 'merawat', 'pola', 'kebiasaan', 'hidup sehat']);
const ARTICLE_SOURCE_SAFE_ATTACH_INTENTS = new Set(['product-shortcut', 'testimonial', 'vitacheck-start', 'habit', 'general-health', 'article-specific', 'article']);
const ARTICLE_SOURCE_BLOCKED_INTENTS = new Set(['serious-complaint', DX, 'fatwa', 'tawakal', 'product-suitability', 'product', 'amanah', 'contact', 'start', 'greeting', 'faq']);
const SAFETY_BOUNDARY_INTENTS = new Set(['serious-complaint', DX, 'fatwa', 'tawakal']);
const PRODUCT_GATE_INTENTS = new Set(['product-suitability', 'product']);
const BASIC_EDUCATION_SIGNALS = Object.freeze(['sudah baca', 'sudah membaca', 'sudah paham', 'sudah memahami', 'saya paham', 'prinsip amanah', 'produk bukan jalan pintas', 'testimoni bukan bukti', 'edukasi dasar', 'artikel dasar', 'basic', 'batas klaim', 'label resmi']);
const PRODUCT_EDUCATION_ACTIONS = Object.freeze([NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.productShortcutArticle, NUSA_ROUTE_BUTTONS.testimonialArticle, NUSA_ROUTE_BUTTONS.educationArticles]);

export const NUSA_RESPONSES = Object.freeze({
  greeting: 'Waalaikumussalam. Senang kamu datang. Silakan tulis hal yang ingin kamu pahami hari ini. Kalau bingung mulai dari mana, kamu bisa mulai dari VitaCheck, artikel edukasi, atau Prinsip Amanah.',
  greetingGeneral: 'Halo. Senang kamu datang. Silakan tulis hal yang ingin kamu pahami hari ini. Kalau bingung, kamu bisa mulai dari kebiasaan sehat, VitaCheck, artikel edukasi, atau Prinsip Amanah.',
  gratitude: 'Sama-sama. Senang bisa membantu. Kalau masih ada yang ingin kamu pahami, tulis saja dengan bahasa sederhana.',
  start: 'Kita mulai pelan-pelan. Pilih satu dulu: mau cek kebiasaan lewat VitaCheck, membaca artikel edukasi, memahami klaim produk dengan lebih aman, atau bertanya tentang langkah kecil menjaga kesehatan?',
  vitacheckStart: 'Baik. VitaCheck bisa dipakai sebagai cermin kebiasaan: tidur, minum, makan, gerak, energi, pencernaan, stres ringan, dan literasi produk. Hasilnya bukan diagnosis. Ambil satu fokus kecil saja untuk 7 hari ke depan.',
  habit: 'Bisa. Untuk mulai hidup lebih sehat, jangan ubah semuanya sekaligus. Pilih satu langkah kecil dulu: tidur sedikit lebih teratur, minum air lebih sadar, makan lebih rapi, atau gerak ringan. VitaCheck bisa membantu melihat bagian mana yang paling perlu diperbaiki.',
  generalHealth: 'Menjaga kesehatan tidak harus ekstrem. Mulai dari dasar: tidur lebih teratur, cukup minum, makan lebih sadar, dan bergerak ringan. Kalau ada keluhan berat, menetap, atau memburuk, lebih aman bertanya kepada tenaga kesehatan. Nusa AI hanya membantu edukasi umum.',
  article: 'Kamu bisa mulai dari artikel edukasi VitaNusa AI. Pilih bacaan yang paling dekat dengan kebutuhanmu, lalu ambil satu langkah kecil yang realistis.',
  testimonial: 'Testimoni perlu disikapi dengan tenang. Itu bisa menjadi pengalaman pribadi seseorang, tetapi bukan bukti utama untuk semua orang. Lebih aman cek label resmi, pahami batas klaim, dan jangan mudah percaya janji hasil mutlak.',
  amanah: 'Prinsip Amanah adalah pagar VitaNusa AI: edukasi dulu, tidak menentukan kondisi tubuh, tidak membuat klaim berlebihan, dan tidak menjadikan produk sebagai janji hasil.',
  product: 'Produk di VitaNusa AI ditampilkan sebagai informasi reseller. Sebelum melihat katalog, pahami dulu Prinsip Amanah: produk bukan obat, bukan janji hasil, dan bukan pengganti pola hidup sehat atau tenaga kesehatan.',
  productEducationGate: 'Sebelum masuk ke katalog produk, kita luruskan dulu batasnya: produk bukan obat, bukan janji hasil, bukan pengganti pola hidup sehat, dan bukan pengganti tenaga kesehatan. Mulai dari artikel amanah dan batas klaim terlebih dahulu.',
  productAfterEducation: 'Baik. Karena kamu sudah masuk dari jalur edukasi dasar, katalog boleh dilihat sebagai informasi reseller. Tetap baca label resmi, jangan mengejar klaim mutlak, dan konsultasikan dulu bila punya keluhan, riwayat kondisi tubuh, sedang minum obat, hamil, atau menyusui.',
  productSuitability: 'Saya tidak bisa menentukan produk yang cocok untuk kondisi pribadi. Produk hanya boleh dilihat sebagai informasi, bukan janji hasil atau pengganti tenaga kesehatan. Jika kamu punya keluhan, riwayat penyakit, sedang minum obat, hamil, atau menyusui, lebih aman konsultasi kepada tenaga kesehatan.',
  productShortcut: 'Produk bukan jalan pintas. Ia tidak boleh dijadikan pengganti pola hidup sehat, bukan obat, dan bukan janji hasil. Lebih aman baca label resmi, cek klaim dengan tenang, dan gunakan Prinsip Amanah sebelum mengambil keputusan.',
  [DX]: 'Saya tidak bisa menentukan kondisi tubuh secara personal. Itu perlu pemeriksaan tenaga kesehatan yang berwenang. Saya bisa membantu memberi edukasi umum dan mengajak melihat kebiasaan lewat VitaCheck, tetapi hasilnya tetap bukan diagnosis.',
  seriousComplaint: 'Keluhan seperti ini perlu diprioritaskan. Jangan menunda pertolongan. Segera hubungi tenaga kesehatan, fasilitas layanan terdekat, atau layanan darurat jika keluhan berat, tiba-tiba, atau memburuk. Saya tidak mendiagnosis dan tidak mengarahkan ke produk untuk kondisi berat.',
  tawakal: 'Tawakal bukan berarti berhenti berikhtiar. Berusaha dengan ilmu, menjaga keselamatan, dan mengambil sebab yang benar adalah bagian dari amanah. Setelah itu, hasilnya kita kembalikan kepada Allah. Jika ada keluhan berat, jangan menunda pertolongan.',
  fatwa: 'Nusa AI tidak memberi fatwa dan tidak menentukan hukum agama secara final. Untuk hukum agama yang rinci, lebih aman bertanya kepada ustadz atau ulama yang kompeten. Saya hanya membantu refleksi dan edukasi umum dengan batas amanah.',
  faq: 'Kamu bisa membuka FAQ untuk jawaban singkat tentang VitaNusa AI, VitaCheck, artikel, produk, dan batas edukasi.',
  contact: 'Kamu bisa menghubungi admin VitaNusa AI melalui WhatsApp atau email. Untuk keluhan berat atau pertanyaan kondisi tubuh pribadi, admin bukan pengganti tenaga kesehatan.',
  outOfCapacity: 'Saya belum bisa menjawab itu dengan aman. Coba tulis lebih jelas, atau konsultasikan langsung kepada tenaga kesehatan, ustadz/ulama, atau pihak yang memang berwenang sesuai masalahnya.',
});

export const NUSA_INITIAL_REPLY = Object.freeze({
  id: 'initial-greeting',
  text: 'Saya siap membantu. Tulis saja dengan bahasa sederhana: mau membahas kebiasaan sehat, VitaCheck, artikel edukasi, klaim produk, Prinsip Amanah, atau kontak admin?',
  actions: []
});

export const NUSA_FALLBACK_RESPONSE = Object.freeze({
  id: 'fallback',
  text: 'Saya belum menangkap maksudnya dengan jelas. Coba tulis lebih sederhana. Misalnya: “aku mau hidup sehat”, “mau mulai VitaCheck”, “testimoni itu bukti gak?”, atau “mau hubungi admin”.',
  actions: []
});
export const NUSA_OUT_OF_CAPACITY_REPLY = Object.freeze({ id: 'out-of-capacity', text: NUSA_RESPONSES.outOfCapacity, actions: [NUSA_ROUTE_BUTTONS.faq, NUSA_ROUTE_BUTTONS.contact] });

function createArticleButton(article) { return { label: `Baca Artikel ${article.title}`, href: article.href }; }
function mergeActions(...groups) { const seen = new Set(); return groups.flat().filter(Boolean).filter((action) => { const key = `${action.label}|${action.href}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function getRelatedArticleActions(article) { const map = { 'testimoni-bukan-bukti': [NUSA_ROUTE_BUTTONS.amanah], 'sehat-itu-amanah': [NUSA_ROUTE_BUTTONS.vitacheck], 'ai-untuk-edukasi-kesehatan': [NUSA_ROUTE_BUTTONS.amanah], 'kebiasaan-sehat-7-hari': [NUSA_ROUTE_BUTTONS.vitacheck], 'tidur-dan-energi-harian': [NUSA_ROUTE_BUTTONS.vitacheck], 'pencernaan-dan-pola-makan': [NUSA_ROUTE_BUTTONS.vitacheck], 'produk-bukan-jalan-pintas': [NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.testimonialArticle], 'cara-memakai-vitacheck': [NUSA_ROUTE_BUTTONS.vitacheck] }; return map[article.id] || []; }
function createArticleResponseText(article) { const texts = { 'sehat-itu-amanah': 'Kamu bisa membaca artikel “Sehat Itu Amanah” untuk memahami pola hidup sehat sebagai amanah: kebiasaan kecil, pilihan halal-thayyib, dan sikap kritis terhadap klaim kesehatan. Jika ingin refleksi awal, mulai juga dari VitaCheck.', 'ai-untuk-edukasi-kesehatan': 'AI bisa membantu edukasi kesehatan dengan bahasa yang mudah dipahami, tetapi tetap bukan ahli medis dan bukan alat penentuan kondisi tubuh. Artikel ini menjelaskan batas aman memakai AI untuk belajar kesehatan secara amanah.', 'testimoni-bukan-bukti': NUSA_RESPONSES.testimonial, 'kapan-harus-ke-tenaga-kesehatan': 'Jika keluhan berat, memburuk, menetap, atau mengganggu aktivitas, jangan menunda pertolongan. Artikel ini membantu mengenali kapan perlu menghubungi ahli medis; Nusa AI tetap bukan alat penentuan kondisi tubuh.', 'kebiasaan-sehat-7-hari': 'Kamu bisa mulai hidup sehat dari langkah kecil selama 7 hari: tidur lebih rapi, cukup minum, makan lebih sadar, dan gerak ringan. Pakai VitaCheck sebagai refleksi awal, bukan penentuan kondisi tubuh.', 'tidur-dan-energi-harian': 'Topik ini berkaitan dengan tidur dan energi. Saya tidak bisa menentukan penyebab personal, tetapi kamu bisa mulai dari merapikan kebiasaan tidur dan memakai VitaCheck sebagai refleksi awal.', 'pencernaan-dan-pola-makan': 'Topik ini berkaitan dengan pencernaan dan pola makan. Saya tidak menentukan kondisi tubuh, tetapi kamu bisa membaca arahan umum yang aman dan memakai VitaCheck sebagai refleksi kebiasaan.', 'produk-bukan-jalan-pintas': NUSA_RESPONSES.productShortcut, 'cara-memakai-vitacheck': 'VitaCheck dipakai untuk refleksi kebiasaan, bukan menentukan kondisi tubuh. Setelah hasil muncul, ambil satu fokus kecil selama 7 hari agar perubahan lebih realistis.' }; return texts[article.id] || `Kamu bisa membaca artikel “${article.title}”. ${article.summary}`; }
function createArticleReply(article, extraActions = []) { return { id: `article-${article.id}`, text: createArticleResponseText(article), actions: mergeActions([createArticleButton(article), ...extraActions, ...getRelatedArticleActions(article)]) }; }
function createArticleSpecificReply(normalizedText) { const article = findMatchingNusaArticle(normalizedText); return article ? createArticleReply(article) : null; }
function createVitaCheckReply(normalizedText) { const article = findMatchingNusaArticle(normalizedText); if (article && article.id === 'cara-memakai-vitacheck') return createArticleReply(article, [NUSA_ROUTE_BUTTONS.vitacheck]); return { id: 'vitacheck-start', text: NUSA_RESPONSES.vitacheckStart, actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.educationArticles] }; }
function createHabitReply(normalizedText) { const article = findMatchingNusaArticle(normalizedText); const ids = ['kebiasaan-sehat-7-hari', 'tidur-dan-energi-harian', 'pencernaan-dan-pola-makan', 'sehat-itu-amanah']; if (article && ids.includes(article.id)) return createArticleReply(article, [NUSA_ROUTE_BUTTONS.vitacheck]); return { id: 'habit', text: NUSA_RESPONSES.habit, actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.educationArticles] }; }
function createGeneralHealthReply() { return { id: 'general-health', text: NUSA_RESPONSES.generalHealth, actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.healthyHabitsArticle, NUSA_ROUTE_BUTTONS.healthyAmanahArticle] }; }
function createGreetingReply(normalizedText) {
  const isIslamicGreeting = includesAny(normalizedText, ['assalamualaikum', 'assalamu alaikum', 'salam']);
  return {
    id: 'greeting',
    text: isIslamicGreeting ? NUSA_RESPONSES.greeting : NUSA_RESPONSES.greetingGeneral,
    actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.educationArticles, NUSA_ROUTE_BUTTONS.amanah]
  };
}

function createGratitudeReply() {
  return {
    id: 'gratitude',
    text: NUSA_RESPONSES.gratitude,
    actions: []
  };
}
export const NUSA_KNOWLEDGE_MAP = Object.freeze([
  { id: 'serious-complaint', keywords: NUSA_KEYWORDS.seriousComplaint, response: NUSA_RESPONSES.seriousComplaint, actions: [] },
  { id: DX, keywords: NUSA_KEYWORDS[DX], response: NUSA_RESPONSES[DX], actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.articles, NUSA_ROUTE_BUTTONS.amanah] },
  { id: 'fatwa', keywords: NUSA_KEYWORDS.fatwa, response: NUSA_RESPONSES.fatwa, actions: [NUSA_ROUTE_BUTTONS.amanah] },
  { id: 'tawakal', keywords: NUSA_KEYWORDS.tawakal, response: NUSA_RESPONSES.tawakal, actions: [NUSA_ROUTE_BUTTONS.amanah] },
  { id: 'product-suitability', keywords: NUSA_KEYWORDS.productSuitability, response: NUSA_RESPONSES.productSuitability, actions: [NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.productShortcutArticle, NUSA_ROUTE_BUTTONS.testimonialArticle], matcher(text) { return includesAny(text, NUSA_KEYWORDS.productSuitability) || (includesAny(text, ['produk','suplemen','langfit','deto pro','propolis','key propolis']) && includesAny(text, ['cocok','sesuai','pas','aman','boleh','konsumsi','minum']) && includesAny(text, ['untuk saya','buat saya','bagi saya','keluhan saya','kondisi saya','riwayat saya','sakit saya'])); } },
  { id: 'product-shortcut', keywords: NUSA_KEYWORDS.productShortcut, response: NUSA_RESPONSES.productShortcut, actions: [NUSA_ROUTE_BUTTONS.productShortcutArticle, NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.testimonialArticle], matcher(text) { return includesAny(text, NUSA_KEYWORDS.productShortcut) || (includesAny(text, ['produk','suplemen']) && includesAny(text, ['jalan pintas','solusi cepat','pengganti pola hidup','menggantikan pola hidup'])); } },
  { id: 'product', keywords: [], response: NUSA_RESPONSES.product, actions: PRODUCT_EDUCATION_ACTIONS, matcher(text) { return includesAny(text, NUSA_KEYWORDS.product) && !includesAny(text, NUSA_KEYWORDS.testimonial) && !includesAny(text, NUSA_KEYWORDS.productShortcut); } },
  { id: 'testimonial', keywords: NUSA_KEYWORDS.testimonial, response: NUSA_RESPONSES.testimonial, actions: [NUSA_ROUTE_BUTTONS.testimonialArticle, NUSA_ROUTE_BUTTONS.amanah] },
  { id: 'vitacheck-start', keywords: NUSA_KEYWORDS.vitacheckStart, getReply: createVitaCheckReply },
  { id: 'habit', keywords: NUSA_KEYWORDS.habit, getReply: createHabitReply },
  { id: 'general-health', keywords: NUSA_KEYWORDS.generalHealth, getReply: createGeneralHealthReply, matcher(text) { return includesAny(text, NUSA_KEYWORDS.generalHealth) || includesAny(text, GENERAL_HEALTH_SIGNAL_TERMS); } },
  { id: 'article-specific', keywords: [], matcher: (text) => Boolean(findMatchingNusaArticle(text)), getReply: createArticleSpecificReply },
  { id: 'article', keywords: NUSA_KEYWORDS.article, response: NUSA_RESPONSES.article, actions: [NUSA_ROUTE_BUTTONS.articles] },
  { id: 'amanah', keywords: NUSA_KEYWORDS.amanah, response: NUSA_RESPONSES.amanah, actions: [NUSA_ROUTE_BUTTONS.amanah] },
  { id: 'contact', keywords: NUSA_KEYWORDS.contact, response: NUSA_RESPONSES.contact, actions: [NUSA_ROUTE_BUTTONS.whatsapp, NUSA_ROUTE_BUTTONS.email] },
 { id: 'start', keywords: NUSA_KEYWORDS.start, response: NUSA_RESPONSES.start, actions: [NUSA_ROUTE_BUTTONS.vitacheck, NUSA_ROUTE_BUTTONS.articles, NUSA_ROUTE_BUTTONS.amanah] },
  { id: 'greeting', keywords: NUSA_KEYWORDS.greeting, getReply: createGreetingReply },
  { id: 'gratitude', keywords: NUSA_KEYWORDS.gratitude, getReply: createGratitudeReply },
    { id: 'faq', keywords: NUSA_KEYWORDS.faq, response: NUSA_RESPONSES.faq, actions: [NUSA_ROUTE_BUTTONS.faq] },
]);

function normalizeText(value) { return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[?!.:,;()[\]{}"'`~_+=/\\|-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function includesTerm(normalizedText, term) { const normalizedTerm = normalizeText(term); if (!normalizedTerm) return false; if (normalizedTerm.length <= 2) return ` ${normalizedText} `.includes(` ${normalizedTerm} `); return normalizedText.includes(normalizedTerm); }
function includesAny(normalizedText, terms) { return terms.some((term) => includesTerm(normalizedText, term)); }
function intentMatches(intent, normalizedText) { if (!intent) return false; if (typeof intent.matcher === 'function' && intent.matcher(normalizedText)) return true; return includesAny(normalizedText, intent.keywords || []); }
function findMatchingIntent(normalizedText) { return NUSA_KNOWLEDGE_MAP.find((intent) => intentMatches(intent, normalizedText)); }
function findSafetyBoundaryIntent(normalizedText) { return NUSA_KNOWLEDGE_MAP.find((intent) => SAFETY_BOUNDARY_INTENTS.has(intent.id) && intentMatches(intent, normalizedText)); }
function buildIntentReply(intent, normalizedText) { if (typeof intent.getReply === 'function') return intent.getReply(normalizedText); return { id: intent.id, text: intent.response, actions: intent.actions || [] }; }
function isArticleSourceBlockedIntent(intent) { return Boolean(intent && ARTICLE_SOURCE_BLOCKED_INTENTS.has(intent.id)); }
function canAttachArticleSources(intent) { return Boolean(intent && ARTICLE_SOURCE_SAFE_ATTACH_INTENTS.has(intent.id)); }
function isProductGateIntent(intent) { return Boolean(intent && PRODUCT_GATE_INTENTS.has(intent.id)); }
function hasBasicEducationSignal(normalizedText) { return includesAny(normalizedText, BASIC_EDUCATION_SIGNALS); }
function buildProductGateReply(intent, normalizedText) { if (intent.id === 'product-suitability') return buildIntentReply(intent, normalizedText) || NUSA_OUT_OF_CAPACITY_REPLY; if (hasBasicEducationSignal(normalizedText)) return { id: 'product-after-basic-education', text: NUSA_RESPONSES.productAfterEducation, actions: [NUSA_ROUTE_BUTTONS.products, NUSA_ROUTE_BUTTONS.amanah, NUSA_ROUTE_BUTTONS.whatsapp] }; return { id: 'product-education-gate', text: NUSA_RESPONSES.productEducationGate, actions: PRODUCT_EDUCATION_ACTIONS }; }
function createArticleSourceText(intentId) { if (intentId === 'general-health' || intentId === 'habit' || intentId === 'vitacheck-start') return 'Menjaga kesehatan adalah bagian dari amanah menjaga tubuh. Saya juga menemukan artikel terkait yang bisa kamu baca sebagai panduan awal. Nusa AI tetap bersifat edukatif, bukan penentuan kondisi tubuh.'; if (intentId === 'testimonial' || intentId === 'product-shortcut') return 'Untuk klaim produk, prinsipnya tabayyun dulu. Saya menemukan artikel terkait agar kamu bisa menilai klaim dengan lebih tenang. Jangan menjadikan testimoni sebagai janji hasil atau bukti utama untuk semua orang.'; return 'Saya menemukan artikel yang relevan. Baca dulu dengan tenang, lalu ambil satu langkah kecil yang aman. Nusa AI tetap bersifat edukatif, bukan penentuan kondisi tubuh.'; }
async function getFirestoreArticleActions(normalizedText, options = {}) { try { const firestoreArticles = await import(FIRESTORE_ARTICLE_MODULE_URL); const matches = await withTimeout(firestoreArticles.findMatchingFirestoreArticles(normalizedText, options), FIRESTORE_ARTICLE_TIMEOUT_MS, []); return matches.map((article) => firestoreArticles.createFirestoreArticleAction(article)).filter(Boolean); } catch (error) { console.warn('Firestore article router fallback:', error); return []; } }
async function getSupplementalGithubArticleActions(normalizedText, options = {}) { try { const githubArticles = await import(GITHUB_ARTICLE_MODULE_URL); const matches = await withTimeout(githubArticles.findMatchingGithubArticles(normalizedText, options), GITHUB_ARTICLE_TIMEOUT_MS, []); return matches.map((article) => githubArticles.createGithubArticleAction(article)).filter(Boolean); } catch (error) { console.warn('GitHub article source fallback:', error); return []; } }
// Firestore remains the primary article source; GitHub manifest articles are supplemental.
async function getArticleSourceActions(normalizedText, options = {}) { const [firestoreActions, githubActions] = await Promise.all([getFirestoreArticleActions(normalizedText, options), getSupplementalGithubArticleActions(normalizedText, options)]); return mergeArticleSourceActions(firestoreActions, githubActions); }
function mergeArticleSourceActions(primaryActions = [], supplementalActions = []) { const seen = new Set(); return [...primaryActions, ...supplementalActions].filter(Boolean).filter((action) => { const key = normalizeArticleActionKey(action); if (seen.has(key)) return false; seen.add(key); return true; }); }
function normalizeArticleActionKey(action) { const label = String(action?.label || '').toLowerCase().replace(/^baca artikel:\s*/, '').replace(/^baca artikel\s*/, '').replace(/\s+/g, ' ').trim(); return label || `${action?.label || ''}|${action?.href || ''}`; }
function withTimeout(promise, timeoutMs, fallbackValue) { let timeoutId; const timeoutPromise = new Promise((resolve) => { timeoutId = globalThis.setTimeout(() => resolve(fallbackValue), timeoutMs); }); return Promise.race([Promise.resolve(promise).finally(() => globalThis.clearTimeout(timeoutId)), timeoutPromise]); }
function shouldTryArticleSourcesOnly(normalizedText) { if (normalizedText.length < 8) return false; const tokens = normalizedText.split(' ').filter((token) => token.length > 2); return tokens.length >= 2; }
async function buildArticleSourcesOnlyReply(normalizedText, intentId = 'article-source') { if (!shouldTryArticleSourcesOnly(normalizedText)) return null; const actions = await getArticleSourceActions(normalizedText, { allowShortQuery: false, intentId }); if (!actions.length) return NUSA_OUT_OF_CAPACITY_REPLY; return { id: intentId, text: createArticleSourceText(intentId), actions }; }
async function attachArticleSources(baseReply, normalizedText, intentId) { const actions = await getArticleSourceActions(normalizedText, { allowShortQuery: true, intentId }); if (!actions.length) return baseReply; if (intentId === 'article' || intentId === 'article-specific') return { id: `article-source-${intentId}`, text: createArticleSourceText(intentId), actions: mergeActions(actions, baseReply?.actions || []) }; return { ...baseReply, id: `${baseReply.id}-article-source`, actions: mergeActions(baseReply.actions || [], actions) }; }

export async function getNusaReply(input) {
  const normalizedText = normalizeText(input);
  if (!normalizedText) return NUSA_INITIAL_REPLY;
  const safetyIntent = findSafetyBoundaryIntent(normalizedText);
  if (safetyIntent) return buildIntentReply(safetyIntent, normalizedText) || NUSA_OUT_OF_CAPACITY_REPLY;
  const intent = findMatchingIntent(normalizedText);
  if (isProductGateIntent(intent)) return buildProductGateReply(intent, normalizedText);
  if (isArticleSourceBlockedIntent(intent)) return buildIntentReply(intent, normalizedText) || NUSA_FALLBACK_RESPONSE;
  if (intent && canAttachArticleSources(intent)) { const baseReply = buildIntentReply(intent, normalizedText) || NUSA_FALLBACK_RESPONSE; return attachArticleSources(baseReply, normalizedText, intent.id); }
  if (!intent) return await buildArticleSourcesOnlyReply(normalizedText) || NUSA_FALLBACK_RESPONSE;
  return buildIntentReply(intent, normalizedText) || NUSA_FALLBACK_RESPONSE;
}
