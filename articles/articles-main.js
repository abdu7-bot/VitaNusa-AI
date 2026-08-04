const controlsRoot = document.documentElement;

if (controlsRoot.dataset.publicArticleControlsInitialized !== 'true') {
  controlsRoot.dataset.publicArticleControlsInitialized = 'true';
  initializePublicArticleControls();
}

function initializePublicArticleControls() {
  const searchInput = document.getElementById('searchInput');
  const resetButton = document.getElementById('clearSearch');
  const filterButtons = [...document.querySelectorAll('.filter-btn')];
  const emptyState = document.getElementById('emptyState');
  const resultCount = document.getElementById('articleResultCount');

  let currentCategory = 'semua';

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveCategory(button.dataset.category || 'semua');
      filterArticles();
    });
  });

  searchInput?.addEventListener('input', filterArticles);
  resetButton?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    setActiveCategory('semua');
    searchInput?.focus();
    filterArticles();
  });

  document.addEventListener('vitanusa:public-articles-rendered', filterArticles);

  function setActiveCategory(category) {
    currentCategory = normalizeText(category || 'semua');

    filterButtons.forEach((button) => {
      const isActive = normalizeText(button.dataset.category || 'semua') === currentCategory;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function filterArticles() {
    const keyword = normalizeText(searchInput?.value || '');
    const articleCards = [...document.querySelectorAll('[data-article-card]')];
    let visibleCount = 0;

    articleCards.forEach((card) => {
      const haystack = normalizeText([
        card.dataset.title,
        card.dataset.description,
        card.dataset.category,
        card.dataset.tags,
        card.textContent,
      ].filter(Boolean).join(' '));

      const category = normalizeText(card.dataset.category || '');
      const matchesKeyword = !keyword || haystack.includes(keyword);
      const matchesCategory = currentCategory === 'semua' || category.includes(currentCategory);
      const isVisible = matchesKeyword && matchesCategory;

      card.hidden = !isVisible;
      card.setAttribute('aria-hidden', String(!isVisible));
      if (isVisible) visibleCount += 1;
    });

    if (emptyState) emptyState.hidden = visibleCount !== 0;
    if (resetButton) resetButton.hidden = !keyword && currentCategory === 'semua';
    if (resultCount) {
      if (!articleCards.length) {
        resultCount.textContent = 'Belum ada artikel yang tersedia.';
      } else if (!visibleCount) {
        resultCount.textContent = 'Tidak ada artikel yang cocok dengan pencarian atau kategori ini.';
      } else {
        resultCount.textContent = `${visibleCount} artikel ditemukan.`;
      }
    }
  }

  setActiveCategory(currentCategory);
  filterArticles();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/&/gu, 'dan')
    .replace(/[^a-z0-9\s-]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
