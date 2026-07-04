import { db } from './firebase-auth.js';
import { collection, addDoc, doc, getDocs, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const knowledgeApp = document.querySelector('[data-knowledge-app]');
const VALID_STATUSES = new Set(['draft', 'published', 'archived']);
const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high']);
const VALID_INTENT_TARGETS = new Set(['article-general', 'general-health', 'habit', 'vitacheck', 'testimonial', 'product-claim', 'product-safety', 'product-general', 'serious-complaint-education', 'islamic-reflection', 'amanah']);
const VALID_PRIMARY_ACTIONS = new Set(['answer-only', 'read-article', 'start-vitacheck', 'read-prinsip-amanah', 'contact-admin', 'seek-professional-help', 'view-products']);
const HEALTH_TERMS = ['diagnosis', 'obat', 'dosis', 'terapi', 'diabetes', 'kanker', 'hipertensi', 'stroke', 'jantung', 'ginjal', 'asma', 'gerd', 'maag kronis', 'keluhan serius', 'gejala berat'];
const SERIOUS_DISEASE_TERMS = ['diabetes', 'kanker', 'hipertensi', 'stroke', 'jantung', 'ginjal', 'asma', 'gerd', 'maag kronis', 'keluhan serius', 'gejala berat'];
const PRODUCT_TERMS = ['produk', 'testimoni', 'klaim produk', 'checkout', 'beli', 'konsumsi produk', 'langfit', 'deto pro'];
const ISLAMIC_TERMS = ['al-quran', 'quran', 'q.s.', 'hadits', 'hadis', 'tafsir', 'halal', 'haram', 'fatwa', 'ulama', 'ustadz'];
const RISK_CLAIM_TERMS = ['pasti sembuh', '100% aman', 'obat segala penyakit', 'sembuh total', 'hasil instan', 'tanpa efek samping', 'menyembuhkan diabetes', 'menyembuhkan kanker', 'menyembuhkan penyakit kronis'];
const EDUCATIONAL_CONTEXT_TERMS = ['jangan percaya', 'hindari', 'waspada', 'hati-hati', 'bukan bukti', 'bukan diagnosis', 'bukan terapi', 'bukan obat', 'bukan pengganti dokter', 'klaim berlebihan', 'klaim palsu', 'contoh klaim yang harus dihindari', 'menilai klaim'];
const FATWA_FINAL_TERMS = ['fatwa final', 'pasti halal', 'pasti haram', 'wajib secara mutlak', 'haram secara mutlak', 'hukum final'];
const KNOWLEDGE_IMPORT_LABELS = new Map(Object.entries({
  question: 'question',
  pertanyaan: 'question',
  q: 'question',
  alternatequestions: 'alternateQuestions',
  alternatequestion: 'alternateQuestions',
  pertanyaanalternatif: 'alternateQuestions',
  variasipertanyaan: 'alternateQuestions',
  shortanswer: 'shortAnswer',
  jawabanpendek: 'shortAnswer',
  jawabansingkat: 'shortAnswer',
  ringkasanjawaban: 'shortAnswer',
  answerhtml: 'answerHtml',
  jawabanhtml: 'answerHtml',
  answer: 'answerHtml',
  jawaban: 'answerHtml',
  content: 'answerHtml',
  konten: 'answerHtml',
  keywords: 'keywords',
  keyword: 'keywords',
  katakunci: 'keywords',
  category: 'category',
  kategori: 'category',
  intenttarget: 'intentTarget',
  intent: 'intentTarget',
  risklevel: 'riskLevel',
  risk: 'riskLevel',
  levelsensitif: 'riskLevel',
  primaryaction: 'primaryAction',
  action: 'primaryAction',
  aksiutama: 'primaryAction',
  relatedarticles: 'relatedArticles',
  artikelterkait: 'relatedArticles',
  priority: 'priority',
  prioritas: 'priority',
  status: 'status',
  reviewersnote: 'reviewerNote',
  reviewernote: 'reviewerNote',
  catatanreviewer: 'reviewerNote',
  catatanadmin: 'reviewerNote',
  medicalsensitive: 'isMedicalSensitive',
  sensitivedokter: 'isMedicalSensitive',
  medis: 'isMedicalSensitive',
  productsensitive: 'isProductSensitive',
  sensitiveproduk: 'isProductSensitive',
  produk: 'isProductSensitive',
  islamicsensitive: 'isIslamicSensitive',
  sensitiveislamic: 'isIslamicSensitive',
  sensitifislami: 'isIslamicSensitive',
  islami: 'isIslamicSensitive'
}));
const state = { initialized: false, knowledge: [], editingId: null };

if (knowledgeApp) {
  window.addEventListener('vitanusa:admin-ready', initKnowledgeCrud);
  if (window.vitaNusaAdmin?.user) initKnowledgeCrud();
}

function initKnowledgeCrud() {
  if (state.initialized) return;
  state.initialized = true;
  injectKnowledgeImportBlock();
  getForm()?.addEventListener('submit', handleSaveKnowledge);
  document.querySelector('[data-knowledge-new]')?.addEventListener('click', resetKnowledgeForm);
  document.querySelector('[data-knowledge-refresh]')?.addEventListener('click', loadKnowledge);
  document.querySelector('[data-knowledge-reset]')?.addEventListener('click', resetKnowledgeForm);
  document.querySelector('[data-knowledge-analyze]')?.addEventListener('click', analyzeKnowledgeAmanah);
  document.querySelector('[data-knowledge-import-parse]')?.addEventListener('click', handleKnowledgeImportParse);
  document.querySelector('[data-knowledge-import-clear]')?.addEventListener('click', clearKnowledgeImport);
  getListBody()?.addEventListener('click', handleKnowledgeListAction);
  resetKnowledgeForm();
  loadKnowledge();
}

function injectKnowledgeImportBlock() {
  const form = getForm();
  if (!form || document.querySelector('[data-knowledge-import-block]')) return;
  const block = document.createElement('div');
  block.className = 'article-import-block knowledge-import-block';
  block.dataset.knowledgeImportBlock = '';
  block.innerHTML = `
    <div class="article-import-heading">
      <h4>Import Knowledge dari Prompt</h4>
      <p>Paste Q&amp;A lengkap dari ChatGPT, lalu parse untuk mengisi form. Default diset published agar bisa dibaca Nusa AI publik.</p>
    </div>
    <label class="article-import-label">Output Knowledge ChatGPT
      <textarea name="knowledgeImportText" data-knowledge-import-text rows="10" placeholder="Paste format Knowledge di sini...\n\nQuestion:\nApa itu VitaNusa AI?\n\nAlternate Questions:\nvitanusa ai itu apa\napa fungsi vitanusa ai\n\nShort Answer:\nVitaNusa AI adalah platform edukasi...\n\nAnswer HTML:\n<p>Jawaban edukatif...</p>\n\nKeywords:\nvitanusa, edukasi kesehatan\n\nCategory:\nTentang VitaNusa\n\nStatus:\npublished"></textarea>
    </label>
    <div class="article-import-actions">
      <button class="admin-button admin-button-primary" type="button" data-knowledge-import-parse>Parse ke Form</button>
      <button class="admin-button admin-button-light" type="button" data-knowledge-import-clear>Bersihkan Import</button>
    </div>
    <div class="article-import-status" data-knowledge-import-status role="status" aria-live="polite" hidden></div>
  `;
  form.insertBefore(block, form.firstElementChild || null);
}

async function loadKnowledge() {
  setMessage('success', 'Memuat daftar Q&A...');
  try {
    const snapshot = await getDocs(collection(db, 'nusaKnowledge'));
    state.knowledge = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    state.knowledge.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() || 0;
      const bTime = b.updatedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    renderKnowledge();
    setMessage('success', `Daftar Q&A dimuat: ${state.knowledge.length} item.`);
  } catch (error) {
    setMessage('error', error.message || 'Gagal memuat nusaKnowledge.');
  }
}

function renderKnowledge() {
  const body = getListBody();
  if (!body) return;
  if (!state.knowledge.length) {
    body.innerHTML = '<tr><td colspan="6"><strong>Belum ada Q&amp;A Nusa AI.</strong><br><span class="article-meta-muted">Klik Tambah Q&amp;A atau pakai Import Knowledge dari Prompt untuk membuat pustaka pertama. Item baru default published agar dibaca Nusa AI.</span></td></tr>';
    return;
  }
  body.replaceChildren(...state.knowledge.map(createKnowledgeRow));
}

function createKnowledgeRow(item) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td class="article-title-cell"><strong></strong><small></small></td>
    <td></td>
    <td></td>
    <td><span class="article-status"></span></td>
    <td class="article-meta-muted"></td>
    <td><div class="article-row-actions"></div></td>
  `;
  row.querySelector('strong').textContent = item.question || '(tanpa pertanyaan)';
  row.querySelector('small').textContent = item.category || '-';
  row.children[1].textContent = item.intentTarget || '-';
  row.children[2].textContent = item.riskLevel || '-';
  const status = row.querySelector('.article-status');
  status.textContent = item.status || 'draft';
  status.classList.add(`article-status-${item.status || 'draft'}`);
  row.children[4].textContent = formatDate(item.updatedAt);
  const actions = row.querySelector('.article-row-actions');
  actions.append(createActionButton('Edit', 'edit', item.id));
  if (item.status !== 'published') actions.append(createActionButton('Publish', 'publish', item.id));
  if (item.status !== 'archived') actions.append(createActionButton('Archive', 'archive', item.id));
  return row;
}

function getKnowledgePayloadFromForm() {
  const form = getForm();
  const values = Object.fromEntries(new FormData(form).entries());
  return {
    question: cleanText(values.question),
    alternateQuestions: splitList(values.alternateQuestions),
    shortAnswer: cleanText(values.shortAnswer),
    answerHtml: String(values.answerHtml || '').trim(),
    keywords: splitList(values.keywords),
    category: cleanText(values.category),
    intentTarget: values.intentTarget || 'article-general',
    riskLevel: values.riskLevel || 'low',
    isMedicalSensitive: Boolean(form.elements.isMedicalSensitive?.checked),
    isProductSensitive: Boolean(form.elements.isProductSensitive?.checked),
    isIslamicSensitive: Boolean(form.elements.isIslamicSensitive?.checked),
    primaryAction: values.primaryAction || 'answer-only',
    relatedArticles: splitList(values.relatedArticles),
    priority: Number(values.priority || 0),
    status: values.status || 'published',
    reviewerNote: cleanText(values.reviewerNote)
  };
}

function validateKnowledgePayload(payload, { publishing = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!payload.question) errors.push('Question wajib diisi.');
  if (!payload.shortAnswer) errors.push('Short answer wajib diisi.');
  if (!payload.answerHtml) errors.push('Answer HTML wajib diisi.');
  if (!payload.keywords.length) warnings.push('Keywords kosong. Jawaban tetap bisa disimpan, tetapi pencocokan Nusa AI mungkin lemah.');
  if (!VALID_STATUSES.has(payload.status)) errors.push('Status tidak valid.');
  if (!VALID_RISK_LEVELS.has(payload.riskLevel)) errors.push('Risk level tidak valid.');
  if (!VALID_INTENT_TARGETS.has(payload.intentTarget)) errors.push('Intent target tidak valid.');
  if (!VALID_PRIMARY_ACTIONS.has(payload.primaryAction)) errors.push('Primary action tidak valid.');
  if (!Number.isFinite(payload.priority)) errors.push('Priority harus angka.');
  if (/<\s*script\b/i.test(payload.answerHtml)) errors.push('Answer HTML tidak boleh mengandung script.');
  if (payload.riskLevel === 'high') warnings.push('Risk level high: tetap review manual. Jika sensitif, tambahkan reviewer note dan arahkan ke bantuan ahli/prinsip amanah.');
  if (payload.isMedicalSensitive && payload.primaryAction === 'view-products') errors.push('Medical sensitive tidak boleh diarahkan ke view-products.');
  const text = normalize(`${payload.question} ${payload.shortAnswer} ${payload.answerHtml}`);
  const riskyClaims = findMainRiskClaims(text);
  if (payload.isProductSensitive && riskyClaims.length) errors.push(`Klaim produk berbahaya terdeteksi: ${riskyClaims.join(', ')}.`);
  if (payload.isIslamicSensitive && includesAny(text, FATWA_FINAL_TERMS)) warnings.push('Konten Islami terdengar seperti fatwa final. Review ulang batas refleksi.');
  if (publishing && payload.riskLevel === 'high') warnings.push('Q&A high risk disimpan sebagai published hanya jika admin sadar dan reviewer note sudah jelas.');
  return { errors, warnings };
}

async function handleSaveKnowledge(event) {
  event.preventDefault();
  const payload = getKnowledgePayloadFromForm();
  const { errors, warnings } = validateKnowledgePayload(payload, { publishing: payload.status === 'published' });
  if (errors.length) {
    setMessage('error', errors.join(' '));
    return;
  }
  const id = getForm().elements.knowledgeId.value;
  const existing = id ? state.knowledge.find((item) => item.id === id) : null;
  const nowPayload = {
    ...payload,
    updatedAt: serverTimestamp(),
    publishedAt: payload.status === 'published'
      ? existing?.status === 'published' ? existing.publishedAt || serverTimestamp() : serverTimestamp()
      : null
  };
  try {
    if (id) {
      await updateDoc(doc(db, 'nusaKnowledge', id), nowPayload);
      setMessage(warnings.length ? 'warning' : 'success', `Q&A diperbarui sebagai ${payload.status}. ${warnings.join(' ')}`.trim());
    } else {
      await addDoc(collection(db, 'nusaKnowledge'), {
        ...nowPayload,
        status: payload.status || 'published',
        createdAt: serverTimestamp()
      });
      setMessage(warnings.length ? 'warning' : 'success', `Q&A disimpan sebagai ${payload.status || 'published'}. ${warnings.join(' ')}`.trim());
    }
    resetKnowledgeForm();
    loadKnowledge();
  } catch (error) {
    setMessage('error', error.message || 'Gagal menyimpan Q&A.');
  }
}

function handleKnowledgeListAction(event) {
  const button = event.target instanceof Element ? event.target.closest('[data-knowledge-action]') : null;
  if (!button) return;
  const item = state.knowledge.find((entry) => entry.id === button.dataset.knowledgeId);
  if (!item) return;
  if (button.dataset.knowledgeAction === 'edit') fillKnowledgeForm(item);
  if (button.dataset.knowledgeAction === 'publish') publishKnowledge(item);
  if (button.dataset.knowledgeAction === 'archive') archiveKnowledge(item);
}

async function publishKnowledge(item) {
  const payload = { ...item, status: 'published' };
  const { errors, warnings } = validateKnowledgePayload(payload, { publishing: true });
  if (errors.length) {
    setMessage('error', errors.join(' '));
    return;
  }
  try {
    await updateDoc(doc(db, 'nusaKnowledge', item.id), {
      status: 'published',
      updatedAt: serverTimestamp(),
      publishedAt: item.status === 'published' ? item.publishedAt || serverTimestamp() : serverTimestamp()
    });
    setMessage(warnings.length ? 'warning' : 'success', `Q&A dipublish. ${warnings.join(' ')}`.trim());
    loadKnowledge();
  } catch (error) {
    setMessage('error', error.message || 'Gagal publish Q&A.');
  }
}

async function archiveKnowledge(item) {
  try {
    await updateDoc(doc(db, 'nusaKnowledge', item.id), {
      status: 'archived',
      updatedAt: serverTimestamp(),
      publishedAt: null
    });
    setMessage('success', 'Q&A diarsipkan.');
    loadKnowledge();
  } catch (error) {
    setMessage('error', error.message || 'Gagal archive Q&A.');
  }
}

function fillKnowledgeForm(item) {
  const form = getForm();
  state.editingId = item.id;
  form.elements.knowledgeId.value = item.id;
  form.elements.question.value = item.question || '';
  form.elements.alternateQuestions.value = (item.alternateQuestions || []).join('\n');
  form.elements.shortAnswer.value = item.shortAnswer || '';
  form.elements.answerHtml.value = item.answerHtml || '';
  form.elements.keywords.value = (item.keywords || []).join(', ');
  form.elements.category.value = item.category || '';
  form.elements.intentTarget.value = VALID_INTENT_TARGETS.has(item.intentTarget) ? item.intentTarget : 'article-general';
  form.elements.riskLevel.value = VALID_RISK_LEVELS.has(item.riskLevel) ? item.riskLevel : 'low';
  form.elements.isMedicalSensitive.checked = Boolean(item.isMedicalSensitive);
  form.elements.isProductSensitive.checked = Boolean(item.isProductSensitive);
  form.elements.isIslamicSensitive.checked = Boolean(item.isIslamicSensitive);
  form.elements.primaryAction.value = VALID_PRIMARY_ACTIONS.has(item.primaryAction) ? item.primaryAction : 'answer-only';
  form.elements.relatedArticles.value = (item.relatedArticles || []).join(', ');
  form.elements.priority.value = Number(item.priority || 0);
  form.elements.status.value = VALID_STATUSES.has(item.status) ? item.status : 'published';
  form.elements.reviewerNote.value = item.reviewerNote || '';
  document.querySelector('[data-knowledge-form-title]').textContent = 'Edit Q&A';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetKnowledgeForm() {
  const form = getForm();
  state.editingId = null;
  form?.reset();
  if (form) {
    form.elements.knowledgeId.value = '';
    form.elements.intentTarget.value = 'article-general';
    form.elements.riskLevel.value = 'low';
    form.elements.primaryAction.value = 'answer-only';
    form.elements.priority.value = '0';
    form.elements.status.value = 'published';
  }
  document.querySelector('[data-knowledge-form-title]').textContent = 'Tambah Q&A';
}

function handleKnowledgeImportParse() {
  try {
    const rawText = document.querySelector('[data-knowledge-import-text]')?.value || '';
    const item = parseKnowledgeImport(rawText);
    applyKnowledgeImportToForm(item);
    setKnowledgeImportStatus('success', 'Knowledge berhasil diparse ke form. Status default published agar bisa dibaca Nusa AI. Tetap review isi sebelum simpan.');
  } catch (error) {
    setKnowledgeImportStatus('error', error.message || 'Format knowledge tidak terbaca.');
  }
}

function clearKnowledgeImport() {
  const textarea = document.querySelector('[data-knowledge-import-text]');
  if (textarea) textarea.value = '';
  setKnowledgeImportStatus('success', 'Import Knowledge dibersihkan.');
}

function parseKnowledgeImport(rawText) {
  const source = String(rawText || '').trim();
  if (!source) throw new Error('Import Knowledge masih kosong.');
  const fields = getKnowledgeImportFields(source);
  const htmlCandidate = fields.answerHtml || fields.answer || fields.content || '';
  const fallbackQuestion = getFirstMeaningfulLine(source);
  const answerHtml = normalizeAnswerHtml(htmlCandidate || source.replace(fallbackQuestion, '').trim());
  const plainAnswer = cleanText(stripTags(answerHtml));
  const question = cleanText(fields.question || fallbackQuestion);
  const shortAnswer = cleanText(fields.shortAnswer || plainAnswer.slice(0, 360));
  if (!question) throw new Error('Question tidak ditemukan. Tambahkan Question: atau tulis pertanyaan di baris pertama.');
  if (!shortAnswer) throw new Error('Short Answer tidak ditemukan. Tambahkan Short Answer: atau Answer HTML:.');
  if (!answerHtml) throw new Error('Answer HTML tidak ditemukan. Tambahkan Answer HTML: atau jawaban paragraf.');

  const combinedText = normalize(`${question} ${shortAnswer} ${answerHtml} ${fields.keywords || ''} ${fields.category || ''}`);
  const isMedical = parseBoolean(fields.isMedicalSensitive, includesAny(combinedText, HEALTH_TERMS));
  const isProduct = parseBoolean(fields.isProductSensitive, includesAny(combinedText, PRODUCT_TERMS));
  const isIslamic = parseBoolean(fields.isIslamicSensitive, includesAny(combinedText, ISLAMIC_TERMS));
  const riskyClaims = findMainRiskClaims(combinedText);
  const riskLevel = normalizeRiskLevel(fields.riskLevel || (riskyClaims.length ? 'high' : isMedical || isProduct || isIslamic ? 'medium' : 'low'));
  const intentTarget = normalizeIntentTarget(fields.intentTarget || inferIntentTarget({ isMedical, isProduct, isIslamic, combinedText }));
  const primaryAction = normalizePrimaryAction(fields.primaryAction || inferPrimaryAction({ isMedical, isProduct, riskLevel }));
  const reviewerNote = cleanText(fields.reviewerNote || createImportReviewerNote({ isMedical, isProduct, isIslamic, riskyClaims, riskLevel }));

  return {
    question,
    alternateQuestions: splitList(fields.alternateQuestions),
    shortAnswer,
    answerHtml,
    keywords: splitList(fields.keywords || buildKeywordFallback(question, shortAnswer)),
    category: cleanText(fields.category || inferCategory({ isMedical, isProduct, isIslamic })),
    intentTarget,
    riskLevel,
    isMedicalSensitive: isMedical,
    isProductSensitive: isProduct,
    isIslamicSensitive: isIslamic,
    primaryAction,
    relatedArticles: splitList(fields.relatedArticles),
    priority: Number(fields.priority || 0),
    status: normalizeStatus(fields.status || 'published'),
    reviewerNote
  };
}

function applyKnowledgeImportToForm(item) {
  resetKnowledgeForm();
  const form = getForm();
  form.elements.question.value = item.question;
  form.elements.alternateQuestions.value = item.alternateQuestions.join('\n');
  form.elements.shortAnswer.value = item.shortAnswer;
  form.elements.answerHtml.value = item.answerHtml;
  form.elements.keywords.value = item.keywords.join(', ');
  form.elements.category.value = item.category;
  form.elements.intentTarget.value = item.intentTarget;
  form.elements.riskLevel.value = item.riskLevel;
  form.elements.isMedicalSensitive.checked = item.isMedicalSensitive;
  form.elements.isProductSensitive.checked = item.isProductSensitive;
  form.elements.isIslamicSensitive.checked = item.isIslamicSensitive;
  form.elements.primaryAction.value = item.primaryAction;
  form.elements.relatedArticles.value = item.relatedArticles.join(', ');
  form.elements.priority.value = Number(item.priority || 0);
  form.elements.status.value = item.status;
  form.elements.reviewerNote.value = item.reviewerNote;
  form.dispatchEvent(new Event('input', { bubbles: true }));
  form.dispatchEvent(new Event('change', { bubbles: true }));
}

function getKnowledgeImportFields(rawText) {
  const fields = {};
  let currentKey = '';
  let currentValue = [];
  const flush = () => {
    if (!currentKey) return;
    fields[currentKey] = currentValue.join('\n').trim();
  };
  for (const line of String(rawText || '').replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^\s*([A-Za-zÀ-ÿ0-9 _-]{1,44})\s*[:：]\s*(.*)$/);
    const key = match ? normalizeImportLabel(match[1]) : '';
    if (key && KNOWLEDGE_IMPORT_LABELS.has(key)) {
      flush();
      currentKey = KNOWLEDGE_IMPORT_LABELS.get(key);
      currentValue = [match[2] || ''];
      continue;
    }
    if (currentKey) currentValue.push(line);
  }
  flush();
  return fields;
}

function normalizeImportLabel(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getFirstMeaningfulLine(value) {
  return String(value || '').split(/\r?\n/).map((line) => line.replace(/^[-*#\d.)\s]+/, '').trim()).find(Boolean) || '';
}

function normalizeAnswerHtml(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/<[a-z][\s\S]*>/i.test(source)) return source;
  return source.split(/\n{2,}/).map(cleanText).filter(Boolean).map((item) => `<p>${escapeHtml(item)}</p>`).join('\n');
}

function stripTags(value) {
  const div = document.createElement('div');
  div.innerHTML = String(value || '');
  return div.textContent || '';
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseBoolean(value, fallback = false) {
  const text = normalize(value);
  if (!text) return fallback;
  if (['true', 'ya', 'yes', 'y', '1', 'aktif', 'checked', 'sensitif', 'sensitive'].includes(text)) return true;
  if (['false', 'tidak', 'no', 'n', '0', 'nonaktif', 'off'].includes(text)) return false;
  return fallback;
}

function normalizeStatus(value) {
  const status = normalize(value || 'published');
  return VALID_STATUSES.has(status) ? status : 'published';
}

function normalizeRiskLevel(value) {
  const level = normalize(value || 'low');
  return VALID_RISK_LEVELS.has(level) ? level : 'low';
}

function normalizeIntentTarget(value) {
  const intent = normalize(value || 'article-general');
  return VALID_INTENT_TARGETS.has(intent) ? intent : 'article-general';
}

function normalizePrimaryAction(value) {
  const action = normalize(value || 'answer-only');
  return VALID_PRIMARY_ACTIONS.has(action) ? action : 'answer-only';
}

function inferIntentTarget({ isMedical, isProduct, isIslamic, combinedText }) {
  if (isProduct) return 'product-safety';
  if (isMedical && includesAny(combinedText, SERIOUS_DISEASE_TERMS)) return 'serious-complaint-education';
  if (isMedical) return 'general-health';
  if (isIslamic) return 'islamic-reflection';
  return 'article-general';
}

function inferPrimaryAction({ isMedical, isProduct, riskLevel }) {
  if (isMedical && riskLevel !== 'low') return 'seek-professional-help';
  if (isProduct) return 'read-prinsip-amanah';
  return 'answer-only';
}

function inferCategory({ isMedical, isProduct, isIslamic }) {
  if (isProduct) return 'Amanah Produk';
  if (isMedical) return 'Edukasi Kesehatan';
  if (isIslamic) return 'Refleksi Islami';
  return 'Knowledge Nusa AI';
}

function buildKeywordFallback(question, answer) {
  return `${question} ${answer}`.split(/\s+/).map((item) => item.toLowerCase().replace(/[^a-z0-9à-ÿ-]/g, '')).filter((item) => item.length > 4).slice(0, 8).join(', ');
}

function createImportReviewerNote({ isMedical, isProduct, isIslamic, riskyClaims, riskLevel }) {
  const notes = [];
  if (isMedical) notes.push('Import terdeteksi medical sensitive: jawaban harus edukatif, bukan diagnosis/dosis/terapi.');
  if (isProduct) notes.push('Import terdeteksi product sensitive: jangan jadikan produk sebagai klaim kesembuhan.');
  if (isIslamic) notes.push('Import terdeteksi Islamic sensitive: refleksi edukatif, bukan fatwa final.');
  if (riskLevel === 'high') notes.push('Risk high: tetap review manual sebelum dipromosikan luas.');
  if (riskyClaims.length) notes.push(`Klaim berisiko: ${riskyClaims.join(', ')}.`);
  return notes.join(' ');
}

function setKnowledgeImportStatus(kind, message) {
  const box = document.querySelector('[data-knowledge-import-status]');
  if (!box) return;
  box.hidden = false;
  box.classList.remove('is-success', 'is-warning', 'is-error');
  box.classList.add(`is-${kind}`);
  box.textContent = message;
}

function analyzeKnowledgeAmanah() {
  const form = getForm();
  const text = normalize(`${form.elements.question.value} ${form.elements.shortAnswer.value} ${form.elements.answerHtml.value} ${form.elements.keywords.value} ${form.elements.category.value}`);
  const isMedical = includesAny(text, HEALTH_TERMS);
  const isSerious = includesAny(text, SERIOUS_DISEASE_TERMS);
  const isProduct = includesAny(text, PRODUCT_TERMS);
  const isIslamic = includesAny(text, ISLAMIC_TERMS);
  const riskyClaims = findMainRiskClaims(text);
  const notes = [];

  let intentTarget = 'article-general';
  let riskLevel = 'low';
  let primaryAction = 'answer-only';

  if (isMedical) {
    intentTarget = 'general-health';
    riskLevel = isSerious ? 'medium' : 'low';
    primaryAction = isSerious ? 'seek-professional-help' : 'read-article';
    notes.push('Konten kesehatan: edukasi umum, bukan diagnosis atau terapi.');
  }
  if (isProduct) {
    intentTarget = 'product-safety';
    riskLevel = riskyClaims.length ? 'high' : 'medium';
    primaryAction = 'read-prinsip-amanah';
    notes.push('Konten produk/testimoni: jangan jadikan produk sebagai klaim medis.');
  }
  if (isIslamic) {
    intentTarget = 'islamic-reflection';
    primaryAction = 'read-article';
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    notes.push('Konten Islami: refleksi edukatif, bukan fatwa final.');
  }
  if (riskyClaims.length) {
    riskLevel = 'high';
    notes.push(`Klaim berisiko terdeteksi sebagai klaim utama: ${riskyClaims.join(', ')}.`);
  }

  form.elements.intentTarget.value = intentTarget;
  form.elements.riskLevel.value = riskLevel;
  form.elements.isMedicalSensitive.checked = isMedical;
  form.elements.isProductSensitive.checked = isProduct;
  form.elements.isIslamicSensitive.checked = isIslamic;
  form.elements.primaryAction.value = isMedical && primaryAction === 'view-products' ? 'seek-professional-help' : primaryAction;
  form.elements.reviewerNote.value = notes.join(' ');
  const analysisMessage = ['Analisis selesai. Tetap review manual sebelum publish.', ...notes].join(' ');
  setMessage(riskLevel === 'high' ? 'warning' : 'success', analysisMessage);
}

function findMainRiskClaims(text) {
  return RISK_CLAIM_TERMS.filter((term) => {
    const index = text.indexOf(term);
    if (index < 0) return false;
    const context = text.slice(Math.max(0, index - 80), index + term.length + 80);
    return !includesAny(context, EDUCATIONAL_CONTEXT_TERMS);
  });
}

function getForm() { return document.querySelector('[data-knowledge-form]'); }
function getListBody() { return document.querySelector('[data-knowledge-list]'); }
function setMessage(kind, message) {
  const box = document.querySelector('[data-knowledge-message]');
  if (!box) return;
  box.hidden = false;
  box.classList.remove('is-error', 'is-warning');
  if (kind !== 'success') box.classList.add(`is-${kind}`);
  box.textContent = message;
}
function splitList(value) { return String(value || '').split(/[\n,]/).map(cleanText).filter(Boolean); }
function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function normalize(value) { return cleanText(value).toLowerCase(); }
function includesAny(text, terms) { return terms.some((term) => text.includes(normalize(term))); }
function formatDate(value) {
  const date = value?.toDate?.();
  return date ? date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}
function createActionButton(label, action, id) {
  const button = document.createElement('button');
  button.className = 'admin-button admin-button-light article-action-button';
  button.type = 'button';
  button.dataset.knowledgeAction = action;
  button.dataset.knowledgeId = id;
  button.textContent = label;
  return button;
}
