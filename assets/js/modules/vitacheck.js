const QUESTION_IDS = ['tidur', 'air', 'makan', 'gerak'];
const STORAGE_KEY = 'vitanusa-vitacheck-result';

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage mungkin tidak tersedia di beberapa mode browser.
  }
}

function readSavedResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.score !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function renderResult(output, score, result, { animate = true } = {}) {
  if (animate) {
    animateScore(output.score, score);
  } else {
    output.score.textContent = String(score);
  }

  output.status.textContent = result.status;
  output.summary.textContent = result.summary;
  renderFocusList(output.focus, result.focus);
}

function buildSavedNote(form, saved) {
  if (!saved) return null;

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = `Hasil terakhir tersimpan: skor ${saved.score}/100. Isi ulang VitaCheck kapan saja untuk memperbarui fokus mingguan.`;

  form.insertAdjacentElement('afterend', note);
  return note;
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

  const saved = readSavedResult();
  const savedNote = buildSavedNote(form, saved);

  if (saved) {
    renderResult(output, saved.score, getResultCopy(saved.score), { animate: false });
  }

  const handleSubmit = (event) => {
    event.preventDefault();

    const values = getQuestionValues(QUESTION_IDS);
    const score = calculateScore(values);
    const result = getResultCopy(score);

    renderResult(output, score, result, { animate: true });

    const payload = {
      score,
      values,
      createdAt: new Date().toISOString(),
    };

    saveResult(payload);

    if (savedNote) {
      savedNote.textContent = `Hasil terbaru tersimpan: skor ${score}/100. Gunakan sebagai bahan refleksi kebiasaan, bukan diagnosis medis.`;
    }
  };

  form.addEventListener('submit', handleSubmit);

  return {
    calculateScore,
    getResultCopy,
    destroy() {
      form.removeEventListener('submit', handleSubmit);
    },
  };
}
