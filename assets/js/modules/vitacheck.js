const QUESTION_IDS = ['tidur', 'air', 'makan', 'gerak'];

const RESULT_COPY = {
  strong: {
    min: 80,
    status: 'Kebiasaanmu cukup baik',
    summary: 'Pertahankan kebiasaan baik. Tetap jaga pola tidur, air, makan, dan gerak ringan secara konsisten.',
    focus: ['Pertahankan rutinitas sehat.', 'Jangan mudah tergoda klaim instan.', 'Evaluasi kebiasaan setiap pekan.'],
  },
  medium: {
    min: 50,
    status: 'Cukup, perlu konsistensi',
    summary: 'Pilih satu kebiasaan kecil untuk diperbaiki lebih dulu agar perubahan terasa ringan dan berkelanjutan.',
    focus: ['Rapikan jam tidur.', 'Minum air lebih teratur.', 'Gerak ringan 10 menit.'],
  },
  low: {
    min: 0,
    status: 'Perlu perhatian bertahap',
    summary: 'Mulai dari dasar: tidur, air, makan, dan gerak ringan. Jangan memaksa semuanya berubah dalam satu hari.',
    focus: ['Tidur lebih teratur.', 'Siapkan air minum dekat aktivitas.', 'Makan tepat waktu sebisa mungkin.'],
  },
};

function getResultCopy(score) {
  if (score >= RESULT_COPY.strong.min) return RESULT_COPY.strong;
  if (score >= RESULT_COPY.medium.min) return RESULT_COPY.medium;
  return RESULT_COPY.low;
}

function getQuestionValues(ids) {
  return ids.map((id) => {
    const field = document.getElementById(id);
    return Number(field?.value ?? 0);
  });
}

function calculateScore(values) {
  const maxScore = QUESTION_IDS.length * 2;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / maxScore) * 100);
}

function renderFocusList(listElement, items) {
  listElement.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      return li;
    }),
  );
}

export function initVitaCheck({ formSelector = '#form' } = {}) {
  const form = document.querySelector(formSelector);
  if (!form) return null;

  const output = {
    score: document.getElementById('skor'),
    status: document.getElementById('status'),
    summary: document.getElementById('ringkasan'),
    focus: document.getElementById('fokus'),
  };

  if (!output.score || !output.status || !output.summary || !output.focus) return null;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const values = getQuestionValues(QUESTION_IDS);
    const score = calculateScore(values);
    const result = getResultCopy(score);

    output.score.textContent = String(score);
    output.status.textContent = result.status;
    output.summary.textContent = result.summary;
    renderFocusList(output.focus, result.focus);
  });

  return { calculateScore, getResultCopy };
}
