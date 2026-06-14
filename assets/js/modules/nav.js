export function initMobileNavigation({
  buttonSelector = '.menu-toggle',
  navSelector = '#mainNav',
  openClass = 'open',
} = {}) {
  const menuToggle = document.querySelector(buttonSelector);
  const mainNav = document.querySelector(navSelector);

  if (!menuToggle || !mainNav) return null;

  const setOpen = (isOpen) => {
    mainNav.classList.toggle(openClass, isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  };

  const isOpen = () => mainNav.classList.contains(openClass);

  menuToggle.addEventListener('click', () => {
    setOpen(!isOpen());
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!isOpen()) return;
    if (mainNav.contains(target) || menuToggle.contains(target)) return;

    setOpen(false);
  });

  return { open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen(!isOpen()) };
}
