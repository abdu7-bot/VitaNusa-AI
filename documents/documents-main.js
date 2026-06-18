const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".filter-btn");
const documentCards = document.querySelectorAll(".document-card");
const emptyState = document.getElementById("emptyState");
const visibleCount = document.getElementById("visibleCount");

let currentCategory = "all";

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("show");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("show");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      navLinks.classList.remove("show");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    currentCategory = button.dataset.category || "all";
    filterDocuments();
  });
});

if (searchInput) {
  searchInput.addEventListener("input", filterDocuments);
}

function filterDocuments() {
  const keyword = (searchInput?.value || "").toLowerCase().trim();
  let visibleTotal = 0;

  documentCards.forEach((card) => {
    const title = (card.dataset.title || "").toLowerCase();
    const category = (card.dataset.category || "").toLowerCase();
    const text = card.innerText.toLowerCase();

    const matchKeyword =
      title.includes(keyword) ||
      category.includes(keyword) ||
      text.includes(keyword);

    const matchCategory =
      currentCategory === "all" || category.includes(currentCategory);

    const isVisible = matchKeyword && matchCategory;

    card.hidden = !isVisible;

    if (isVisible) {
      visibleTotal += 1;
    }
  });

  if (emptyState) {
    emptyState.style.display = visibleTotal === 0 ? "block" : "none";
  }

  if (visibleCount) {
    visibleCount.textContent = `${visibleTotal} dokumen tampil`;
  }
}

filterDocuments();
