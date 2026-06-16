const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".filter-btn");
const articleCards = document.querySelectorAll(".article-card");
const emptyState = document.getElementById("emptyState");

let currentCategory = "all";

menuToggle.addEventListener("click", () => {
  navLinks.classList.toggle("show");
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    currentCategory = button.dataset.category;
    filterArticles();
  });
});

searchInput.addEventListener("input", filterArticles);

function filterArticles() {
  const keyword = searchInput.value.toLowerCase().trim();
  let visibleCount = 0;

  articleCards.forEach((card) => {
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

  emptyState.style.display = visibleCount === 0 ? "block" : "none";
}