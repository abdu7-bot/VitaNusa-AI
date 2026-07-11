const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
const searchInput = document.getElementById('searchInput');
const clearSearchButton = document.getElementById('clearSearch');
const filterButtons = [...document.querySelectorAll('.filter-btn')];
const pathFilterButtons = [...document.querySelectorAll('.path-filter')];
const emptyState = document.getElementById('emptyState');
const resultCount = document.getElementById('articleResultCount');
const articleList = document.getElementById('artikelList');

let currentCategory = 'semua';

if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('show');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveCategory(button.dataset.category || 'semua', button);
    filterArticles();
  });
});

pathFilterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextCategory = button.dataset.filterTarget || 'semua';
    const matchingButton = filterButtons.find((filterButton) => (
      normalizeText(filterButton.dataset.category || 'semua') === normalizeText(nextCategory)
    ));
    setActiveCategory(nextCategory, matchingButton);
    filterArticles();
    articleList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

searchInput?.addEventListener('input', filterArticles);
clearSearchButton?.addEventListener('click', () => {
  if (!searchInput) return;
  searchInput.value = '';
  const allButton = filterButtons.find((button) => normalizeText(button.dataset.category || '') === 'semua');
  setActiveCategory('semua', allButton);
  searchInput.focus();
  filterArticles();
});
document.addEventListener('vitanusa:public-articles-rendered', filterArticles);

function setActiveCategory(category, activeButton = null) {
  currentCategory = normalizeText(category || 'semua');

  filterButtons.forEach((button) => {
    const isActive = normalizeText(button.dataset.category || 'semua') === currentCategory;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  activeButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function getArticleCards() {
  return [...document.querySelectorAll('[data-article-card]')];
}

function filterArticles() {
  const keyword = normalizeText(searchInput?.value || '');
  const articleCards = getArticleCards();
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
    const matchKeyword = !keyword || haystack.includes(keyword);
    const matchCategory = currentCategory === 'semua' || category.includes(currentCategory);
    const isVisible = matchKeyword && matchCategory;

    card.hidden = !isVisible;
    card.setAttribute('aria-hidden', String(!isVisible));
    if (isVisible) visibleCount += 1;
  });

  if (emptyState) emptyState.hidden = visibleCount !== 0;
  if (clearSearchButton) clearSearchButton.hidden = !searchInput?.value;
  if (resultCount) {
    const suffix = currentCategory === 'semua' ? '' : ' pada kategori ini';
    resultCount.textContent = `${visibleCount} artikel ditemukan${suffix}.`;
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'dan')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

setActiveCategory(currentCategory);
filterArticles();
