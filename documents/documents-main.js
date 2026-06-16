const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".filter-btn");
const documentCards = document.querySelectorAll(".document-card");
const emptyState = document.getElementById("emptyState");

let currentCategory = "all";

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("show");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("show");
    });
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    currentCategory = button.dataset.category;
    filterDocuments();
  });
});

if (searchInput) {
  searchInput.addEventListener("input", filterDocuments);
}

function filterDocuments() {
  const keyword = searchInput.value.toLowerCase().trim();
  let visibleCount = 0;

  documentCards.forEach((card) => {
    const title = card.dataset.title.toLowerCase();
    const category = card.dataset.category.toLowerCase();
    const text = card.innerText.toLowerCase();

    const matchKeyword =
      title.includes(keyword) ||
      category.includes(keyword) ||
      text.includes(keyword);

    const matchCategory =
      currentCategory === "all" || category.includes(currentCategory);

    if (matchKeyword && matchCategory) {
      card.style.display = "flex";
      visibleCount++;
    } else {
      card.style.display = "none";
    }
  });

  if (emptyState) {
    emptyState.style.display = visibleCount === 0 ? "block" : "none";
  }
}