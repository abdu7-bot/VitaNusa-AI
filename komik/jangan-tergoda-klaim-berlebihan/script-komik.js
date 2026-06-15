document.addEventListener("DOMContentLoaded", () => {
  const scrollProgress = document.getElementById("scrollProgress");

  const updateScrollProgress = () => {
    if (!scrollProgress) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    scrollProgress.style.width = `${Math.min(progress, 100)}%`;
  };

  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  updateScrollProgress();
});