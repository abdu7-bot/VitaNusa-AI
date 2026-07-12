import { initNusaUiShell } from '../assets/js/modules/nusa-ui-shell.js?v=20260704-vitanusa-master-map-v1';

const READY_ATTRIBUTE = 'data-premium-article-ready';
const feedbackTimers = new WeakMap();

function setButtonMessage(button, message) {
  const original = button.dataset.originalText || button.textContent;
  button.dataset.originalText = original;
  button.textContent = message;

  const existingTimer = feedbackTimers.get(button);
  if (existingTimer) window.clearTimeout(existingTimer);

  const timer = window.setTimeout(() => {
    button.textContent = original;
    feedbackTimers.delete(button);
  }, 1800);

  feedbackTimers.set(button, timer);
}

async function copyCurrentLink(button) {
  const url = window.location.href.split('#')[0];

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      setButtonMessage(button, 'Link tersalin');
      return;
    }

    const input = document.createElement('input');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    setButtonMessage(button, 'Link tersalin');
  } catch (error) {
    console.warn('[VitaNusa AI] Copy link gagal:', error);
    setButtonMessage(button, 'Salin manual');
  }
}

async function shareCurrentArticle(button) {
  const title = document.title;
  const text = document.querySelector('meta[name="description"]')?.content || 'Artikel edukasi VitaNusa AI';
  const url = window.location.href.split('#')[0];

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }

    await copyCurrentLink(button);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.warn('[VitaNusa AI] Share gagal:', error);
      await copyCurrentLink(button);
    }
  }
}

function initPremiumArticle() {
  if (document.documentElement.hasAttribute(READY_ATTRIBUTE)) return;
  document.documentElement.setAttribute(READY_ATTRIBUTE, 'true');

  initNusaUiShell();

  document.querySelectorAll('[data-copy-link]').forEach((button) => {
    button.addEventListener('click', () => copyCurrentLink(button));
  });

  document.querySelectorAll('[data-share-link]').forEach((button) => {
    button.addEventListener('click', () => shareCurrentArticle(button));
  });

  const progressBar = document.querySelector('[data-reading-progress-bar]');
  if (!progressBar) return;

  let animationFrame = 0;

  const updateProgress = () => {
    animationFrame = 0;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const rawProgress = scrollRange > 0 ? (scrollTop / scrollRange) * 100 : 0;
    const progress = Math.min(100, Math.max(0, rawProgress));
    progressBar.style.width = `${progress}%`;
  };

  const scheduleProgressUpdate = () => {
    if (animationFrame) return;
    animationFrame = window.requestAnimationFrame(updateProgress);
  };

  window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
  window.addEventListener('resize', scheduleProgressUpdate);
  window.addEventListener('load', scheduleProgressUpdate, { once: true });
  scheduleProgressUpdate();
}

initPremiumArticle();
