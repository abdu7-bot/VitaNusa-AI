import { initNusaUiShell } from './nusa-ui-shell.js?v=20260703-sidebar-solid-v2';

initNusaUiShell();

const progressBar = document.querySelector("[data-reading-progress]");
const copyButtons = document.querySelectorAll("[data-copy-link]");
const shareButtons = document.querySelectorAll("[data-share-link]");

function updateProgress() {
  if (!progressBar) return;

  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;

  progressBar.style.width = `${progress}%`;
}

function setButtonMessage(button, message) {
  const original = button.dataset.originalText || button.textContent;
  button.dataset.originalText = original;
  button.textContent = message;

  window.setTimeout(() => {
    button.textContent = original;
  }, 1800);
}

async function copyCurrentLink(button) {
  const url = window.location.href.split("#")[0];

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      setButtonMessage(button, "Link tersalin");
      return;
    }

    const input = document.createElement("input");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    setButtonMessage(button, "Link tersalin");
  } catch (error) {
    console.warn("[VitaNusa AI] Copy link gagal:", error);
    setButtonMessage(button, "Salin manual");
  }
}

async function shareCurrentArticle(button) {
  const title = document.title;
  const text = document.querySelector('meta[name="description"]')?.content || "Artikel edukasi VitaNusa AI";
  const url = window.location.href.split("#")[0];

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }

    await copyCurrentLink(button);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.warn("[VitaNusa AI] Share gagal:", error);
      await copyCurrentLink(button);
    }
  }
}

copyButtons.forEach((button) => {
  button.addEventListener("click", () => copyCurrentLink(button));
});

shareButtons.forEach((button) => {
  button.addEventListener("click", () => shareCurrentArticle(button));
});

if (progressBar) {
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();
}
