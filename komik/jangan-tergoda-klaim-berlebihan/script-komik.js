document.addEventListener("DOMContentLoaded", () => {
  const panelsContainer = document.getElementById("comicPanels");
  const panelNav = document.getElementById("panelNav");
  const scrollProgress = document.getElementById("scrollProgress");

  if (!panelsContainer || !panelNav) return;

  const panelCount = Number(panelsContainer.dataset.panelCount || 0);
  const comicTitle = panelsContainer.dataset.title || "Komik VitaNusa AI";

  if (!panelCount) return;

  // Buat tombol navigasi dan panel gambar otomatis
  for (let i = 1; i <= panelCount; i++) {
    const navLink = document.createElement("a");
    navLink.href = `#panel-${i}`;
    navLink.textContent = i;
    navLink.setAttribute("aria-label", `Lompat ke panel ${i}`);
    panelNav.appendChild(navLink);

    const figure = document.createElement("figure");
    figure.id = `panel-${i}`;

    const img = document.createElement("img");
    img.src = `panel-${i}.png`;
    img.alt = `Panel ${i} komik: ${comicTitle}`;
    img.loading = i === 1 ? "eager" : "lazy";
    img.decoding = "async";

    figure.appendChild(img);
    panelsContainer.appendChild(figure);

    if (i < panelCount) {
      const divider = document.createElement("hr");
      divider.className = "panel-divider";
      divider.setAttribute("aria-hidden", "true");
      panelsContainer.appendChild(divider);
    }
  }

  // Highlight tombol panel yang sedang dibaca
  const navLinks = panelNav.querySelectorAll("a");
  const panelFigures = panelsContainer.querySelectorAll("figure");

  const setActivePanel = (id) => {
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActivePanel(entry.target.id);
        }
      });
    },
    {
      root: null,
      threshold: 0.45
    }
  );

  panelFigures.forEach((figure) => observer.observe(figure));

  // Progress baca di bagian atas
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