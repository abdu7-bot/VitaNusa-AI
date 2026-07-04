(() => {
  const sidebar = document.getElementById('adminSidebar');
  const menuToggle = document.querySelector('.admin-menu-toggle');
  const navLinks = Array.from(document.querySelectorAll('[data-admin-section]'));
  const panels = Array.from(document.querySelectorAll('[data-admin-panel]'));
  const placeholders = document.querySelectorAll('.admin-placeholder');
  const sectionOpeners = document.querySelectorAll('[data-open-admin-section]');

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

  const openSection = (target) => {
    const activeLink = navLinks.find((item) => item.dataset.adminSection === target);
    const activePanel = panels.find((panel) => panel.dataset.adminPanel === target);
    if (!activePanel) return false;

    navLinks.forEach((item) => item.classList.toggle('is-active', item === activeLink));
    panels.forEach((panel) => {
      const isActive = panel.dataset.adminPanel === target;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });

    closeSidebar();
    return true;
  };

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      openSection(link.dataset.adminSection);
    });
  });

  sectionOpeners.forEach((button) => {
    button.addEventListener('click', () => {
      openSection(button.dataset.openAdminSection);
    });
  });

  placeholders.forEach((item) => {
    item.addEventListener('click', () => {
      const message = item.dataset.placeholder || 'Fitur ini belum aktif pada Phase 3.';
      window.alert(message);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });

  window.addEventListener('vitanusa:admin-open-panel', (event) => {
    openSection(event.detail?.panel);
  });

  window.addEventListener('vitanusa:admin-ready', (event) => {
    const user = event.detail?.user || {};
    const admin = event.detail?.admin || {};
    const displayName = user.displayName || user.email?.split('@')[0] || 'Admin VitaNusa';
    const role = admin.role || admin.type || 'Admin';

    document.querySelectorAll('[data-profile-name]').forEach((target) => {
      target.value = displayName;
    });
    document.querySelectorAll('[data-profile-role]').forEach((target) => {
      target.value = role;
    });
    document.querySelectorAll('[data-profile-avatar]').forEach((target) => {
      target.textContent = displayName.trim().slice(0, 2).toUpperCase() || 'VN';
    });
  });
})();
