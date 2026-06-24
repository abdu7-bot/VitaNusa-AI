const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
const searchInput = document.getElementById('searchInput');
const filterButtons = [...document.querySelectorAll('.filter-btn')];
const pathFilterButtons = [...document.querySelectorAll('.path-filter')];
const emptyState = document.getElementById('emptyState');
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
    setActiveCategory(button.dataset.category || 'semua');
    filterArticles();
  });
});

pathFilterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextCategory = button.dataset.filterTarget || 'semua';
    setActiveCategory(nextCategory);
    filterArticles();
    articleList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

searchInput?.addEventListener('input', filterArticles);
window.addEventListener('vitanusa:public-articles-rendered', filterArticles);

function setActiveCategory(category) {
  currentCategory = normalizeText(category || 'semua');

  filterButtons.forEach((button) => {
    const isActive = normalizeText(button.dataset.category || 'semua') === currentCategory;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
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
    if (isVisible) visibleCount += 1;
  });

  if (emptyState) {
    emptyState.hidden = visibleCount !== 0;
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
