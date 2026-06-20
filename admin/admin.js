(() => {
  const sidebar = document.getElementById('adminSidebar');
  const menuToggle = document.querySelector('.admin-menu-toggle');
  const navLinks = Array.from(document.querySelectorAll('[data-admin-section]'));
  const panels = Array.from(document.querySelectorAll('[data-admin-panel]'));
  const placeholders = document.querySelectorAll('.admin-placeholder');

  const closeSidebar = () => {
    if (!sidebar || !menuToggle) return;
    sidebar.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  };

  if (sidebar && menuToggle) {
    menuToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.adminSection;

      navLinks.forEach((item) => item.classList.toggle('is-active', item === link));
      panels.forEach((panel) => {
        const isActive = panel.dataset.adminPanel === target;
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });

      closeSidebar();
    });
  });

  placeholders.forEach((item) => {
    item.addEventListener('click', () => {
      const message = item.dataset.placeholder || 'Fitur ini belum aktif pada Phase 2.';
      window.alert(message);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });
})();
