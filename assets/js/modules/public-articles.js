import { firebaseConfig } from '../../../admin/firebase-config.js';
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  limit
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const listRoot = document.querySelector('[data-public-article-list]');
const detailRoot = document.querySelector('[data-public-article-detail]');
const statusBox = document.querySelector('[data-public-article-status]');
const fallbackListHtml = listRoot?.innerHTML || '';

if (listRoot) {
  loadPublishedArticles();
}

if (detailRoot) {
  loadArticleDetail();
}

async function loadPublishedArticles() {
  setStatus('loading', 'Memuat artikel published dari Firestore...');

  try {
    const publishedQuery = query(
      collection(db, 'articles'),
      where('status', '==', 'published')
    );
    const snapshot = await getDocs(publishedQuery);
    const articles = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((article) => article.status === 'published')
      .sort(sortNewestFirst);

    if (!articles.length) {
      listRoot.replaceChildren(createEmptyCard('Belum ada artikel published dari dashboard admin.'));
      setStatus('warning', 'Belum ada artikel published dari Firestore. Artikel statis lama tetap aman di kode sebagai cadangan.');
      dispatchRenderEvent();
      return;
    }

    listRoot.replaceChildren(...articles.map(createArticleCard));
    setStatus('success', `${articles.length} artikel published berhasil dimuat dari Firestore.`);
    dispatchRenderEvent();
  } catch (error) {
    console.error('Gagal memuat artikel published dari Firestore:', error);
    if (fallbackListHtml) {
      listRoot.innerHTML = fallbackListHtml;
    }
    setStatus('warning', 'Firestore gagal dimuat. Artikel statis lama ditampilkan sebagai fallback. Periksa Firestore rules jika masalah berulang.');
    dispatchRenderEvent();
  }
}

async function loadArticleDetail() {
  const slug = new URLSearchParams(window.location.search).get('slug');

  if (!slug) {
    renderDetailMessage('Artikel tidak ditemukan atau belum dipublikasikan.');
    return;
  }

  renderDetailMessage('Memuat artikel...');

  try {
    const detailQuery = query(
      collection(db, 'articles'),
      where('status', '==', 'published'),
      where('slug', '==', slug),
      limit(1)
    );
    const snapshot = await getDocs(detailQuery);

    if (snapshot.empty) {
      renderDetailMessage('Artikel tidak ditemukan atau belum dipublikasikan.');
      return;
    }

    const article = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    renderArticleDetail(article);
  } catch (error) {
    console.error('Gagal memuat detail artikel dari Firestore:', error);
    renderDetailMessage('Artikel gagal dimuat. Periksa koneksi atau Firestore rules, lalu coba lagi.');
  }
}

function createArticleCard(article) {
  const card = document.createElement('article');
  card.className = 'article-card';
  card.dataset.title = article.title || '';
  card.dataset.category = buildSearchCategory(article);

  const badge = document.createElement('div');
  badge.className = 'article-badge green';
  badge.textContent = article.category || 'Edukasi';

  const content = document.createElement('div');
  content.className = 'article-content';

  const meta = document.createElement('p');
  meta.className = 'article-meta';
  meta.textContent = `VitaNusa AI • ${article.readTime || '5 menit baca'}`;

  const title = document.createElement('h3');
  title.textContent = article.title || 'Artikel VitaNusa AI';

  const summary = document.createElement('p');
  summary.textContent = article.summary || 'Ringkasan artikel belum tersedia.';

  content.append(meta, title, summary);

  const footer = document.createElement('div');
  footer.className = 'article-footer';

  const link = document.createElement('a');
  link.className = 'read-link';
  link.href = `detail.html?slug=${encodeURIComponent(article.slug || article.id)}`;
  link.textContent = 'Baca Artikel';

  footer.append(createTagList(article.tags), link);
  card.append(badge, content, footer);
  return card;
}

function createEmptyCard(message) {
  const card = document.createElement('article');
  card.className = 'article-card';
  card.dataset.title = message;
  card.dataset.category = 'all';

  const content = document.createElement('div');
  content.className = 'article-content';

  const title = document.createElement('h3');
  title.textContent = message;

  const text = document.createElement('p');
  text.textContent = 'Silakan publish artikel dari dashboard admin terlebih dahulu.';

  content.append(title, text);
  card.append(content);
  return card;
}

function createTagList(tags) {
  const tagList = document.createElement('div');
  tagList.className = 'article-tags';

  if (!Array.isArray(tags) || !tags.length) return tagList;

  tags.slice(0, 5).forEach((tag) => {
    const pill = document.createElement('span');
    pill.textContent = tag;
    tagList.append(pill);
  });

  return tagList;
}

function renderArticleDetail(article) {
  detailRoot.replaceChildren();

  const header = document.createElement('header');
  header.className = 'article-detail-header';

  const category = document.createElement('p');
  category.className = 'eyebrow';
  category.textContent = article.category || 'Artikel VitaNusa AI';

  const title = document.createElement('h1');
  title.textContent = article.title || 'Artikel VitaNusa AI';

  const meta = document.createElement('p');
  meta.className = 'article-detail-meta';
  meta.textContent = `VitaNusa AI • ${article.readTime || '5 menit baca'}`;

  header.append(category, title, meta, createTagList(article.tags));

  const body = document.createElement('article');
  body.className = 'article-detail-body';
  body.innerHTML = sanitizeArticleHtml(article.contentHtml || '<p>Konten artikel belum tersedia.</p>');

  detailRoot.append(header, body);
  document.title = `${article.title || 'Artikel'} | VitaNusa AI`;
}

function renderDetailMessage(message) {
  const box = document.createElement('div');
  box.className = 'empty-state article-detail-empty';
  box.style.display = 'block';

  const title = document.createElement('h3');
  title.textContent = message;

  const link = document.createElement('a');
  link.className = 'btn-primary';
  link.href = 'index.html';
  link.textContent = 'Kembali ke Daftar Artikel';

  box.append(title, link);
  detailRoot.replaceChildren(box);
}

function sanitizeArticleHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${html}</div>`, 'text/html');

  parsed.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((element) => element.remove());

  parsed.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = String(attribute.value || '').trim().toLowerCase();

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
      }

      if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return parsed.body.innerHTML;
}

function buildSearchCategory(article) {
  const parts = [article.category, ...(Array.isArray(article.tags) ? article.tags : [])];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function sortNewestFirst(a, b) {
  return getTimestampValue(b.publishedAt || b.updatedAt) - getTimestampValue(a.publishedAt || a.updatedAt);
}

function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return 0;
}

function setStatus(kind, message) {
  if (!statusBox) return;
  statusBox.hidden = false;
  statusBox.className = `article-load-status is-${kind}`;
  statusBox.textContent = message;
}

function dispatchRenderEvent() {
  window.dispatchEvent(new CustomEvent('vitanusa:public-articles-rendered'));
}
