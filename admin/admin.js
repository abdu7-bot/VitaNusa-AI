(() => {
  const appShell = document.querySelector('.admin-app');
  const sidebar = document.getElementById('adminSidebar');
  const menuToggle = document.querySelector('.admin-menu-toggle');
  const sidebarClose = document.querySelector('[data-admin-sidebar-close]');
  const sidebarOverlay = document.querySelectoR('[data-admin-sidebar-overlay]');
  const sidebarCollapse = document.querySelector('[data-admin-sidebar-collapse]');
  const navLinks = Array.from(document.querySelectorAll('[data-admin-section]'));
  const panels = Array.from(document.querySelectorAll('[data-admin-panel]'));
  const placeholders = document.querySelectorAll('.admin-placeholder');
  const sectionOpeners = document.querySelectorAll('[data-open-admin-section]');
  const mobileQuery = window.matchMedia('(max-width: 920px)');


  const restoreKnowledgeImportPasteScroll = (event) => {
    const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
    if (!textarea?.matches('[data-knowledge-import-text]')) return;

    const pastedText = event.clipboardData?.getData('text/plain');
    if (!pastedText) return;

    const pageScrollX = window.scrollX;
    const pageScrollY = window.scrollY;
    const textareaScrollTop = textarea.scrollTop;
    const textareaScrollLeft = textarea.scrollLeft;
    const selectionStart = textarea.selectionStart ?? textarea.value.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;

    event.preventDefault();
    textarea.setRangeText(pastedText, selectionStart, selectionEnd, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const restoreScroll = () => {
      textarea.scrollTop = textareaScrollTop;
      textarea.scrollLeft = textareaScrollLeft;
      window.scrollTo(pageScrollX, pageScrollY);
    };

    restoreScroll();
    requestAnimationFrame(() => {
      restoreScroll();
      setTimeout(restoreScroll, 0);
    });
  };

  document.addEventListener('paste', restoreKnowledgeImportPasteScroll, true);

  const setSidebarOpen = (open) => {
    if (!sidebar || !menuToggle) return;
    sidebar.classList.toggle('is-open', open);
    document.body.classList.toggle('admin-sidebar-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    sidebar.setAttribute('aria-hidden', String(mobileQuery.matches && !open));
    if (sidebarOverlay) {
      sidebarOverlay.hidden = !open;
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  if (sidebar && menuToggle) {
    menuToggle.addEventListener('click', () => {
      setSidebarOpen(!sidebar.classList.contains('is-open'));
    });
  }

  sidebarClose?.addEventListener('click', closeSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  sidebarCollapse?.addEventListener('click', () => {
    const collapsed = appShell?.classList.toggle('is-sidebar-collapsed') || false;
    sidebarCollapse.setAttribute('aria-pressed', String(collapsed));
    sidebarCollapse.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  });

  const openSection = (target, trigger = null) => {
    const activeLink = trigger?.matches?.('[data-admin-section]')
      ? trigger
      : navLinks.find((item) => item.dataset.adminSection === target && !item.classList.contains('admin-nav-child'))
        || navLinks.find((item) => item.dataset.adminSection === target);
    const activePanel = panels.find((panel) => panel.dataset.adminPanel === target);
    if (!activePanel) return false;

    navLinks.forEach((item) => item.classList.toggle('is-active', item === activeLink));
    panels.forEach((panel) => {
      const isActive = panel.dataset.adminPanel === target;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });

    if (trigger?.dataset.contentFilterShortcut) {
      window.dispatchEvent(new CustomEvent('vitanusa:admin-content-filter', {
        detail: { category: trigger.dataset.contentFilterShortcut }
      }));
    }

    closeSidebar();
    return true;
  };

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      openSection(link.dataset.adminSection, link);
    });
  });

  sectionOpeners.forEach((button) => {
    button.addEventListener('click', () => {
      openSection(button.dataset.openAdminSection, button);
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

  const syncSidebarState = () => {
    if (!sidebar) return;
    if (!mobileQuery.matches) {
      closeSidebar();
      sidebar.setAttribute('aria-hidden', 'false');
      return;
    }
    sidebar.setAttribute('aria-hidden', String(!sidebar.classList.contains('is-open')));
  };

  mobileQuery.addEventListener?.('change', syncSidebarState);
  window.addEventListener('resize', syncSidebarState);
  syncSidebarState();

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
