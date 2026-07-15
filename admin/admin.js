(() => {
  const appShell = document.querySelector('.admin-app');
  const sidebar = document.getElementById('adminSidebar');
  const menuToggle = document.querySelector('.admin-menu-toggle');
  const sidebarClose = document.querySelector('[data-admin-sidebar-close]');
  const sidebarOverlay = document.querySelector('[data-admin-sidebar-overlay]');
  const sidebarCollapse = document.querySelector('[data-admin-sidebar-collapse]');
  const navLinks = Array.from(document.querySelectorAll('[data-admin-section]'));
  const panels = Array.from(document.querySelectorAll('[data-admin-panel]'));
  const placeholders = document.querySelectorAll('.admin-placeholder');
  const sectionOpeners = document.querySelectorAll('[data-open-admin-section]');
  const mobileQuery = window.matchMedia('(max-width: 920px)');
  const pasteRestoreState = new WeakMap();

  const isKnowledgeImportTextarea = (target) =>
    target instanceof HTMLTextAreaElement && target.matches('[data-knowledge-import-text]');

  const scheduleScrollRestore = (textarea, snapshot) => {
    if (!textarea || !snapshot) return;
    const restore = () => {
      textarea.scrollTop = snapshot.textareaScrollTop;
      textarea.scrollLeft = snapshot.textareaScrollLeft;
      window.scrollTo(snapshot.pageScrollX, snapshot.pageScrollY);
    };

    restore();
    queueMicrotask(restore);
    requestAnimationFrame(() => {
      restore();
      setTimeout(restore, 0);
      setTimeout(restore, 80);
      setTimeout(restore, 180);
    });
  };

  const getScrollSnapshot = (textarea) => ({
    pageScrollX: window.scrollX,
    pageScrollY: window.scrollY,
    textareaScrollTop: textarea.scrollTop,
    textareaScrollLeft: textarea.scrollLeft
  });

  const handleKnowledgeImportBeforeInput = (event) => {
    const textarea = event.target;
    if (!isKnowledgeImportTextarea(textarea)) return;
    if (event.inputType && event.inputType !== 'insertFromPaste') return;

    const snapshot = getScrollSnapshot(textarea);
    pasteRestoreState.set(textarea, snapshot);
    scheduleScrollRestore(textarea, snapshot);
  };

  const handleKnowledgeImportPaste = (event) => {
    const textarea = event.target;
    if (!isKnowledgeImportTextarea(textarea)) return;

    const snapshot = getScrollSnapshot(textarea);
    pasteRestoreState.set(textarea, snapshot);

    const pastedText = event.clipboardData?.getData('text/plain') || '';
    if (!pastedText) {
      scheduleScrollRestore(textarea, snapshot);
      return;
    }

    const selectionStart = textarea.selectionStart ?? textarea.value.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;

    event.preventDefault();
    textarea.setRangeText(pastedText, selectionStart, selectionEnd, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    scheduleScrollRestore(textarea, snapshot);
  };

  const handleKnowledgeImportInput = (event) => {
    const textarea = event.target;
    if (!isKnowledgeImportTextarea(textarea)) return;
    const snapshot = pasteRestoreState.get(textarea);
    if (!snapshot) return;

    scheduleScrollRestore(textarea, snapshot);
    setTimeout(() => pasteRestoreState.delete(textarea), 260);
  };

  const injectKnowledgeCompactListStyles = () => {
    if (document.getElementById('knowledgeCompactListStyles')) return;
    const style = document.createElement('style');
    style.id = 'knowledgeCompactListStyles';
    style.textContent = `
      .knowledge-admin .knowledge-table .article-title-cell {
        max-width: 560px !important;
      }

      .knowledge-admin .knowledge-table .article-title-cell strong,
      .knowledge-admin .knowledge-table .article-title-cell small {
        display: -webkit-box !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        white-space: normal !important;
        word-break: normal !important;
        overflow-wrap: anywhere !important;
      }

      .knowledge-admin .knowledge-table .article-title-cell strong {
        -webkit-line-clamp: 3 !important;
        line-clamp: 3 !important;
        max-height: 4.2em !important;
      }

      .knowledge-admin .knowledge-table .article-title-cell small {
        -webkit-line-clamp: 3 !important;
        line-clamp: 3 !important;
        max-height: 4.8em !important;
        margin-top: 6px !important;
      }

      @media (max-width: 700px) {
        .knowledge-admin .knowledge-table tbody tr {
          margin-bottom: 12px !important;
          padding: 12px !important;
        }

        .knowledge-admin .knowledge-table td {
          padding-top: 6px !important;
          padding-bottom: 6px !important;
        }

        .knowledge-admin .knowledge-table td[data-label="Intent / Risk"],
        .knowledge-admin .knowledge-table td[data-label="Dibuat"],
        .knowledge-admin .knowledge-table td[data-label="Update"] {
          display: none !important;
        }

        .knowledge-admin .knowledge-table .article-title-cell strong {
          -webkit-line-clamp: 3 !important;
          line-clamp: 3 !important;
          font-size: 1rem !important;
          line-height: 1.35 !important;
          max-height: 4.1em !important;
        }

        .knowledge-admin .knowledge-table .article-title-cell small {
          -webkit-line-clamp: 3 !important;
          line-clamp: 3 !important;
          font-size: .9rem !important;
          line-height: 1.45 !important;
          max-height: 4.4em !important;
        }

        .knowledge-admin .knowledge-table .article-row-actions {
          gap: 6px !important;
        }

        .knowledge-admin .knowledge-table .article-action-button {
          min-height: 36px !important;
          padding: 8px 10px !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  document.addEventListener('beforeinput', handleKnowledgeImportBeforeInput, true);
  document.addEventListener('paste', handleKnowledgeImportPaste, true);
  document.addEventListener('input', handleKnowledgeImportInput, true);
  injectKnowledgeCompactListStyles();

  const setSidebarOpen = (open) => {
    if (!sidebar || !menuToggle) return;
    sidebar.classList.toggle('is-open', open);
    document.body.classList.toggle('admin-sidebar-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    sidebar.setAttribute('aria-hidden', String(mobileQuery.matches && !open));
    if (sidebarOverlay) sidebarOverlay.hidden = !open;
  };

  const closeSidebar = () => setSidebarOpen(false);

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
    if (activePanel.dataset.ownerOnly === 'true' && document.body.dataset.canManageAdmins !== 'true') {
      return false;
    }

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
    const role = admin.role === 'owner' ? 'Owner' : 'Admin';

    const mayManageAdmins = Boolean(event.detail?.canManageAdmins);
    document.body.dataset.canManageAdmins = String(mayManageAdmins);
    document.querySelectorAll('[data-owner-admin-management-nav]').forEach((target) => {
      target.hidden = !mayManageAdmins;
      target.disabled = !mayManageAdmins;
      target.setAttribute('aria-hidden', String(!mayManageAdmins));
    });

    if (!mayManageAdmins && panels.some((panel) => panel.dataset.ownerOnly === 'true' && !panel.hidden)) {
      openSection('dashboard');
    }

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
