const WHATSAPP_URL = 'https://wa.me/6288708862581';
const EMAIL_URL = 'mailto:kopiscent99@gmail.com';

const ROUTES = {
  vitacheck: { label: 'Mulai VitaCheck', href: '#vitacheck' },
  articles: { label: 'Baca Artikel', href: 'articles/index.html' },
  amanah: { label: 'Baca Prinsip Amanah', href: 'prinsip-amanah.html' },
  products: { label: 'Lihat Katalog Produk', href: 'products/index.html' },
  faq: { label: 'Buka FAQ', href: '#faq' },
  whatsapp: { label: 'Hubungi WhatsApp', href: WHATSAPP_URL },
  email: { label: 'Kirim Email', href: EMAIL_URL },
};

const FALLBACK_ACTIONS = [
  ROUTES.vitacheck,
  ROUTES.articles,
  ROUTES.amanah,
  ROUTES.products,
  ROUTES.faq,
  ROUTES.whatsapp,
  ROUTES.email,
];

const INTENTS = [
  {
    name: 'professional',
    terms: [
      'dokter',
      'tenaga kesehatan',
      'konsultasi',
      'keluhan berat',
      'darurat',
      'sesak',
      'nyeri berat',
      'memburuk',
      'menetap',
      'mengganggu aktivitas',
      'pingsan',
      'perdarahan',
    ],
    text: 'Jika keluhan berat, menetap, memburuk, atau mengganggu aktivitas, sebaiknya konsultasikan kepada tenaga kesehatan yang berwenang.',
    actions: [ROUTES.amanah, ROUTES.whatsapp],
  },
  {
    name: 'contact',
    terms: ['whatsapp', 'wa', 'kontak', 'hubungi', 'email', 'pesan'],
    text: 'Silakan gunakan kanal resmi VitaNusa AI. Untuk pertanyaan produk atau konten, pilih WhatsApp atau email.',
    actions: [ROUTES.whatsapp, ROUTES.email],
  },
  {
    name: 'amanah',
    terms: ['amanah', 'batas', 'klaim produk', 'testimoni', 'janji sembuh', 'pasti sembuh'],
    text: 'Prinsip Amanah membantu menjaga bahasa edukasi dan produk tetap jujur: tidak menakut-nakuti, tidak menjanjikan kesembuhan, dan tidak melebihkan testimoni.',
    actions: [ROUTES.amanah, ROUTES.articles],
  },
  {
    name: 'product',
    terms: ['produk', 'katalog', 'key propolis', 'propolis', 'langfit', 'deto pro', 'reseller'],
    text: 'Produk ditampilkan sebagai katalog reseller. Baca label dan pahami Prinsip Amanah dulu. Produk tidak diposisikan sebagai obat, diagnosis, atau jaminan hasil.',
    actions: [ROUTES.amanah, ROUTES.products, ROUTES.whatsapp],
  },
  {
    name: 'article',
    terms: ['artikel', 'edukasi', 'klaim', 'ai kesehatan', 'bacaan', 'blog'],
    text: 'Kamu bisa mulai dari artikel edukasi VitaNusa AI. Isinya fokus pada kebiasaan sehat, literasi klaim, dan penggunaan AI yang amanah.',
    actions: [ROUTES.articles, ROUTES.amanah],
  },
  {
    name: 'habit',
    terms: ['cek', 'kebiasaan', 'tidur', 'makan', 'air', 'minum', 'energi', 'lelah', 'gerak'],
    text: 'Untuk refleksi kebiasaan sehat, mulai dari VitaCheck. Hasilnya bersifat edukatif dan membantu memilih kebiasaan kecil untuk dirapikan.',
    actions: [ROUTES.vitacheck, ROUTES.articles],
  },
  {
    name: 'faq',
    terms: ['faq', 'pertanyaan umum', 'tanya jawab'],
    text: 'FAQ berisi jawaban singkat tentang batas VitaCheck, produk, dan kapan perlu berkonsultasi kepada tenaga kesehatan.',
    actions: [ROUTES.faq, ROUTES.amanah],
  },
];

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesTerm(text, term) {
  const normalizedTerm = normalizeText(term);

  if (normalizedTerm.length <= 2) {
    return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`).test(text);
  }

  return text.includes(normalizedTerm);
}

function getReply(input) {
  const text = normalizeText(input);
  const intent = INTENTS.find((item) => item.terms.some((term) => includesTerm(text, term)));

  if (intent) {
    return {
      text: intent.text,
      actions: intent.actions,
    };
  }

  return {
    text: 'Saya bisa bantu arahkan. Pilih salah satu: VitaCheck, Artikel, Prinsip Amanah, Produk, FAQ, atau WhatsApp.',
    actions: FALLBACK_ACTIONS,
  };
}

function createRouteLink(action) {
  const link = document.createElement('a');
  link.className = 'nusa-route-link';
  link.href = action.href;
  link.textContent = action.label;
  return link;
}

function appendMessage(log, role, text, actions = []) {
  const message = document.createElement('article');
  message.className = `nusa-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'nusa-bubble';

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  bubble.append(paragraph);

  if (actions.length) {
    const actionRow = document.createElement('div');
    actionRow.className = 'nusa-route-actions';
    actionRow.append(...actions.map(createRouteLink));
    bubble.append(actionRow);
  }

  message.append(bubble);
  log.append(message);
  log.scrollTop = log.scrollHeight;
}

export function initNusaChat({ rootSelector = '[data-nusa-chat]' } = {}) {
  const root = document.querySelector(rootSelector);
  if (!root) return null;

  const log = root.querySelector('[data-nusa-chat-log]');
  const form = root.querySelector('[data-nusa-chat-form]');
  const input = root.querySelector('[data-nusa-chat-input]');
  const promptButtons = root.querySelectorAll('[data-nusa-prompt]');

  if (!log || !form || !input) return null;

  function handleQuestion(value) {
    const question = value.trim();
    if (!question) return;

    appendMessage(log, 'user', question);
    input.value = '';

    window.setTimeout(() => {
      const reply = getReply(question);
      appendMessage(log, 'assistant', reply.text, reply.actions);
    }, 120);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleQuestion(input.value);
  });

  promptButtons.forEach((button) => {
    button.addEventListener('click', () => {
      handleQuestion(button.dataset.nusaPrompt || button.textContent || '');
      input.focus();
    });
  });

  return {
    ask: handleQuestion,
  };
}
