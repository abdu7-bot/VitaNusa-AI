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
const state = { initialized: false, knowledge: [], editingId: null };

if (knowledgeApp) {
  window.addEventListener('vitanusa:admin-ready', initKnowledgeCrud);
  if (window.vitaNusaAdmin?.user) initKnowledgeCrud();
}

function initKnowledgeCrud() {
  if (state.initialized) return;
  state.initialized = true;
  getForm()?.addEventListener('submit', handleSaveKnowledge);
  document.querySelector('[data-knowledge-new]')?.addEventListener('click', resetKnowledgeForm);
  document.querySelector('[data-knowledge-refresh]')?.addEventListener('click', loadKnowledge);
  document.querySelector('[data-knowledge-reset]')?.addEventListener('click', resetKnowledgeForm);
  document.querySelector('[data-knowledge-analyze]')?.addEventListener('click', analyzeKnowledgeAmanah);
  getListBody()?.addEventListener('click', handleKnowledgeListAction);
  resetKnowledgeForm();
  loadKnowledge();
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
    body.innerHTML = '<tr><td colspan="6">Belum ada Q&amp;A.</td></tr>';
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
  actions.append(
    createActionButton('Edit', 'edit', item.id),
    createActionButton('Publish', 'publish', item.id),
    createActionButton('Archive', 'archive', item.id)
  );
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
    status: values.status || 'draft',
    reviewerNote: cleanText(values.reviewerNote)
  };
}

function validateKnowledgePayload(payload, { publishing = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!payload.question) errors.push('Question wajib diisi.');
  if (!payload.shortAnswer) errors.push('Short answer wajib diisi.');
  if (!payload.answerHtml) errors.push('Answer HTML wajib diisi.');
  if (!VALID_STATUSES.has(payload.status)) errors.push('Status tidak valid.');
  if (!VALID_RISK_LEVELS.has(payload.riskLevel)) errors.push('Risk level tidak valid.');
  if (!VALID_INTENT_TARGETS.has(payload.intentTarget)) errors.push('Intent target tidak valid.');
  if (!VALID_PRIMARY_ACTIONS.has(payload.primaryAction)) errors.push('Primary action tidak valid.');
  if (!Number.isFinite(payload.priority)) errors.push('Priority harus angka.');
  if (/<\s*script\b/i.test(payload.answerHtml)) errors.push('Answer HTML tidak boleh mengandung script.');
  if (payload.riskLevel === 'high') warnings.push('Risk level high: tahan sebagai draft sampai reviewer kompeten menyetujui.');
  if (payload.isMedicalSensitive && payload.primaryAction === 'view-products') errors.push('Medical sensitive tidak boleh diarahkan ke view-products.');
  const text = normalize(`${payload.question} ${payload.shortAnswer} ${payload.answerHtml}`);
  const riskyClaims = findMainRiskClaims(text);
  if (payload.isProductSensitive && riskyClaims.length) errors.push(`Klaim produk berbahaya terdeteksi: ${riskyClaims.join(', ')}.`);
  if (payload.isIslamicSensitive && includesAny(text, FATWA_FINAL_TERMS)) warnings.push('Konten Islami terdengar seperti fatwa final. Review ulang batas refleksi.');
  if (publishing && payload.riskLevel === 'high') errors.push('Q&A high risk tidak dipublish otomatis. Simpan sebagai draft untuk review kompeten.');
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
      setMessage(warnings.length ? 'warning' : 'success', `Q&A diperbarui. ${warnings.join(' ')}`.trim());
    } else {
      await addDoc(collection(db, 'nusaKnowledge'), {
        ...nowPayload,
        status: payload.status || 'draft',
        createdAt: serverTimestamp()
      });
      setMessage(warnings.length ? 'warning' : 'success', `Q&A disimpan. ${warnings.join(' ')}`.trim());
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
  form.elements.status.value = VALID_STATUSES.has(item.status) ? item.status : 'draft';
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
    form.elements.status.value = 'draft';
  }
  document.querySelector('[data-knowledge-form-title]').textContent = 'Tambah Q&A';
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
  setMessage(riskLevel === 'high' ? 'warning' : 'success', notes.join(' ') || 'Analisis amanah selesai. Tidak ada sinyal sensitif kuat.');
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
