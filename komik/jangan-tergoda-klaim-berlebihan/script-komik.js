document.addEventListener("DOMContentLoaded", () => {
  const scrollProgress = document.getElementById("scrollProgress");

  const updateScrollProgress = () => {
    if (!scrollProgress) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    scrollProgress.style.width = `${Math.min(progress, 100)}%`;
  };

  const markPanelOrientation = (img) => {
    const figure = img.closest("figure");
    if (!figure) return;

    const applyOrientation = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;

      const ratio = img.naturalWidth / img.naturalHeight;

      figure.classList.remove("panel-portrait", "panel-landscape", "panel-square");

      if (ratio > 1.18) {
        figure.classList.add("panel-landscape");
      } else if (ratio < 0.85) {
        figure.classList.add("panel-portrait");
      } else {
        figure.classList.add("panel-square");
      }
    };

    if (img.complete) {
      applyOrientation();
    } else {
      img.addEventListener("load", applyOrientation, { once: true });
    }
  };

  document.querySelectorAll(".comic-strip img").forEach(markPanelOrientation);

  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  updateScrollProgress();
});
